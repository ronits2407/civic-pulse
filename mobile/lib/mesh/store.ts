import { MESH_CONFIG, type MeshConfig } from '@/lib/mesh/config'
import type { MeshDb, MeshDbTx } from '@/lib/mesh/db'
import { enqueueForPeers, markPeerHas, pruneOutbox } from '@/lib/mesh/outbox'
import type { MeshAlert, RejectReason } from '@/lib/mesh/protocol'
import { isForwardable } from '@/lib/mesh/alerts'

/**
 * Durable alert storage.
 *
 * The invariant this file exists to protect: an alert is either FULLY recorded
 * (alert row + seen id + forwarding work) or not recorded at all. All three writes happen
 * in one transaction, so a crash can never leave an id marked "seen" without the alert
 * being stored, which would make the phone silently drop it forever.
 */

export type AcceptResult =
  | { status: 'accepted'; forwardedTo: number }
  | { status: 'duplicate' }
  | { status: 'rejected'; reason: RejectReason }

const SEVERITY_RANK = `CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END`

/**
 * Retention policy: expired alerts are kept for `historyRetentionMs` so the history list can
 * still show them (labelled Expired), then removed. Seen ids outlive the alert by
 * `seenGraceMs` so a late replay of an expired alert is still recognised.
 */
export async function pruneExpired(tx: MeshDbTx, now: number, config: MeshConfig = MESH_CONFIG): Promise<void> {
  await tx.run('DELETE FROM mesh_alerts WHERE expires_at <= ?', [now - config.historyRetentionMs])
  await tx.run('DELETE FROM mesh_seen WHERE expires_at <= ?', [now])
}

/** Free a slot by dropping stale rows, then the least important received alert. */
export async function makeRoom(tx: MeshDbTx, now: number, config: MeshConfig): Promise<boolean> {
  await pruneExpired(tx, now, config)
  const row = await tx.first<{ n: number }>('SELECT COUNT(*) AS n FROM mesh_alerts')
  if ((row?.n ?? 0) < config.maxStoredAlerts) return true

  // Still full: the oldest expired alert (kept only for history) goes before any live one.
  const stale = await tx.first<{ id: string }>(
    'SELECT id FROM mesh_alerts WHERE expires_at <= ? ORDER BY expires_at ASC LIMIT 1',
    [now]
  )
  if (stale) {
    await tx.run('DELETE FROM mesh_alerts WHERE id = ?', [stale.id])
    return true
  }

  // Never evict an alert this phone created, and never evict a critical one to make room.
  const victim = await tx.first<{ id: string }>(
    `SELECT id FROM mesh_alerts
      WHERE direction = 'peer' AND severity != 'critical'
      ORDER BY ${SEVERITY_RANK} DESC, received_at ASC LIMIT 1`
  )
  if (!victim) return false
  await tx.run('DELETE FROM mesh_alerts WHERE id = ?', [victim.id])
  return true
}

/** Write the alert row and its seen id. Callers must already be inside a transaction. */
export async function insertAlert(
  tx: MeshDbTx,
  alert: MeshAlert,
  direction: 'local' | 'peer',
  receivedFrom: string | null,
  now: number,
  config: MeshConfig
): Promise<void> {
  await tx.run(
    `INSERT INTO mesh_alerts
       (id, body, type, severity, origin_id, created_at, expires_at, hop_count, max_hops,
        direction, received_from, received_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      alert.id, JSON.stringify(alert), alert.type, alert.severity, alert.originId,
      alert.createdAt, alert.expiresAt, alert.hopCount, alert.maxHops, direction, receivedFrom, now,
    ]
  )
  await tx.run('INSERT INTO mesh_seen (id, expires_at) VALUES (?, ?)', [
    alert.id,
    alert.expiresAt + config.seenGraceMs,
  ])
}

/**
 * Accept an alert that has ALREADY passed validateAlert().
 *
 * @param fromNode        node id of the immediate sender. It already has the alert, so it
 *                        is never queued to receive it back.
 * @param otherPeerNodes  node ids of the other currently connected peers.
 */
export async function acceptReceivedAlert(
  db: MeshDb,
  alert: MeshAlert,
  fromNode: string,
  otherPeerNodes: string[],
  now: number,
  config: MeshConfig = MESH_CONFIG
): Promise<AcceptResult> {
  return db.transaction<AcceptResult>(async (tx) => {
    const seen = await tx.first<{ id: string }>('SELECT id FROM mesh_seen WHERE id = ?', [alert.id])
    if (seen) {
      // A repeat still proves the sender has it, so we stop offering it back.
      await markPeerHas(tx, fromNode, [alert.id], now)
      return { status: 'duplicate' }
    }

    const burst = await tx.first<{ n: number }>(
      'SELECT COUNT(*) AS n FROM mesh_alerts WHERE origin_id = ? AND received_at > ?',
      [alert.originId, now - 60_000]
    )
    if ((burst?.n ?? 0) >= config.originAlertsPerMinute) return { status: 'rejected', reason: 'rate_limited' }
    if (!(await makeRoom(tx, now, config))) return { status: 'rejected', reason: 'rate_limited' }

    await insertAlert(tx, alert, 'peer', fromNode, now, config)
    await markPeerHas(tx, fromNode, [alert.id], now)

    let forwardedTo = 0
    if (isForwardable(alert, now)) {
      const targets = otherPeerNodes.filter((node) => node !== fromNode)
      forwardedTo = await enqueueForPeers(tx, alert.id, targets, now)
    }
    await pruneOutbox(tx, config)
    return { status: 'accepted', forwardedTo }
  })
}
