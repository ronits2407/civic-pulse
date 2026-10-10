import { MESH_CONFIG, type MeshConfig } from '@/lib/mesh/config'
import type { MeshDb } from '@/lib/mesh/db'
import { enqueueForPeers, pruneOutbox } from '@/lib/mesh/outbox'
import type { MeshAlert } from '@/lib/mesh/protocol'
import { insertAlert, makeRoom } from '@/lib/mesh/store'

export type CreateResult =
  | { status: 'created'; queuedFor: number }
  | { status: 'rejected'; reason: 'rate_limited' | 'sos_cooldown' | 'duplicate' }

/** Store an alert created on this phone and queue it for every connected peer. */
export async function storeLocalAlert(
  db: MeshDb,
  alert: MeshAlert,
  connectedPeerNodes: string[],
  now: number,
  config: MeshConfig = MESH_CONFIG
): Promise<CreateResult> {
  return db.transaction<CreateResult>(async (tx) => {
    const dup = await tx.first<{ id: string }>('SELECT id FROM mesh_seen WHERE id = ?', [alert.id])
    if (dup) return { status: 'rejected', reason: 'duplicate' }

    // Counted from the database, not memory, so a force-stop does not reset the limit.
    const hour = await tx.first<{ n: number }>(
      "SELECT COUNT(*) AS n FROM mesh_alerts WHERE direction = 'local' AND created_at > ?",
      [now - 3_600_000]
    )
    if ((hour?.n ?? 0) >= config.localAlertsPerHour) return { status: 'rejected', reason: 'rate_limited' }

    if (alert.type === 'sos') {
      const last = await tx.first<{ created_at: number }>(
        "SELECT created_at FROM mesh_alerts WHERE direction = 'local' AND type = 'sos' ORDER BY created_at DESC LIMIT 1"
      )
      if (last && now - last.created_at < config.sosCooldownMs) {
        return { status: 'rejected', reason: 'sos_cooldown' }
      }
    }

    await makeRoom(tx, now, config)
    await insertAlert(tx, alert, 'local', null, now, config)
    const queuedFor = await enqueueForPeers(tx, alert.id, connectedPeerNodes, now)
    await pruneOutbox(tx, config)
    return { status: 'created', queuedFor }
  })
}

/**
 * Claim the single notification for an alert. Returns true exactly once per alert id, even
 * across restarts and even if the same alert arrives over several paths.
 */
export async function claimNotification(db: MeshDb, alertId: string, now: number): Promise<boolean> {
  const { changes } = await db.run(
    'UPDATE mesh_alerts SET notified_at = ? WHERE id = ? AND notified_at IS NULL',
    [now, alertId]
  )
  return changes === 1
}
