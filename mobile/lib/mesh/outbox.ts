import { MESH_CONFIG, type MeshConfig } from '@/lib/mesh/config'
import type { MeshDbTx } from '@/lib/mesh/db'

/**
 * mesh_outbox: queueing. Every function takes a transaction handle so the relay can call
 * them inside the same transaction that stores a received alert.
 *
 * Row lifecycle for one (alert, peer node):
 *
 *   pending --send ok--> sent --peer ack--> acked (ack_kind = 'peer_ack')
 *      ^                   |
 *      +---- disconnect ---+      pending --attempts exhausted--> failed
 *
 *   'sent' only means the transport accepted the bytes. It is NOT delivery evidence.
 *   'acked' with 'peer_ack' means the peer replied that it durably stored the alert.
 *   'acked' with 'peer_inventory' means the peer proved it already holds the alert.
 *
 * Rows are keyed by the peer's node id, not its transport endpoint id, because endpoint
 * ids change on every reconnection.
 */

/** Remember that `peerNode` already holds these alerts, so they are never sent to it. */
export async function markPeerHas(
  tx: MeshDbTx,
  peerNode: string,
  alertIds: string[],
  now: number
): Promise<void> {
  for (const id of alertIds) {
    await tx.run(
      `INSERT INTO mesh_outbox (alert_id, peer_node, state, attempts, acked_at, ack_kind, created_at)
       VALUES (?, ?, 'acked', 0, ?, 'peer_inventory', ?)
       ON CONFLICT (alert_id, peer_node) DO UPDATE SET
         state = 'acked',
         acked_at = COALESCE(mesh_outbox.acked_at, excluded.acked_at),
         ack_kind = COALESCE(mesh_outbox.ack_kind, 'peer_inventory')`,
      [id, peerNode, now, now]
    )
  }
}

/** Queue one alert for each peer that does not already have a row for it. */
export async function enqueueForPeers(
  tx: MeshDbTx,
  alertId: string,
  peerNodes: string[],
  now: number
): Promise<number> {
  let queued = 0
  for (const node of peerNodes) {
    const { changes } = await tx.run(
      `INSERT OR IGNORE INTO mesh_outbox (alert_id, peer_node, state, attempts, created_at)
       VALUES (?, ?, 'pending', 0, ?)`,
      [alertId, node, now]
    )
    queued += changes
  }
  return queued
}

/**
 * When a peer connects, queue every alert it might be missing. Alerts that cannot be
 * forwarded any more (expired, or already at the hop limit) are never queued.
 */
export async function enqueueStoredForPeer(tx: MeshDbTx, peerNode: string, now: number): Promise<number> {
  const { changes } = await tx.run(
    `INSERT OR IGNORE INTO mesh_outbox (alert_id, peer_node, state, attempts, created_at)
     SELECT a.id, ?, 'pending', 0, ?
       FROM mesh_alerts a
      WHERE a.expires_at > ? AND a.hop_count < a.max_hops`,
    [peerNode, now, now]
  )
  return changes
}

/** Remove outbox rows whose alert is gone, then shed the oldest rows past the hard cap. */
export async function pruneOutbox(tx: MeshDbTx, config: MeshConfig = MESH_CONFIG): Promise<void> {
  await tx.run('DELETE FROM mesh_outbox WHERE alert_id NOT IN (SELECT id FROM mesh_alerts)')
  const row = await tx.first<{ n: number }>('SELECT COUNT(*) AS n FROM mesh_outbox')
  const excess = (row?.n ?? 0) - config.maxOutboxRows
  if (excess > 0) {
    // Finished work goes first; live pending work is shed last.
    await tx.run(
      `DELETE FROM mesh_outbox WHERE rowid IN (
         SELECT rowid FROM mesh_outbox
          ORDER BY CASE state WHEN 'acked' THEN 0 WHEN 'failed' THEN 1 WHEN 'sent' THEN 2 ELSE 3 END,
                   created_at ASC
          LIMIT ?)`,
      [excess]
    )
  }
}
