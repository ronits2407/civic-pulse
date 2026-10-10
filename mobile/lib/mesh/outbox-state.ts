import { MESH_CONFIG, type MeshConfig } from '@/lib/mesh/config'
import type { MeshDbTx } from '@/lib/mesh/db'

/** mesh_outbox: send-state transitions. See outbox.ts for the lifecycle diagram. */

const marks = (list: string[]) => list.map(() => '?').join(',')

export interface OutboxCandidate {
  alert_id: string
  body: string
  attempts: number
}

/**
 * Alerts to put in the next frame for a peer: pending rows, plus rows that were sent but
 * never acknowledged within the retry interval. Critical alerts go first. Anything that
 * has since expired or reached the hop limit is excluded here, at send time, not only at
 * queue time.
 */
export async function nextBatch(
  tx: MeshDbTx,
  peerNode: string,
  now: number,
  limit: number,
  config: MeshConfig = MESH_CONFIG
): Promise<OutboxCandidate[]> {
  return tx.all<OutboxCandidate>(
    `SELECT o.alert_id AS alert_id, a.body AS body, o.attempts AS attempts
       FROM mesh_outbox o
       JOIN mesh_alerts a ON a.id = o.alert_id
      WHERE o.peer_node = ?
        AND a.expires_at > ? AND a.hop_count < a.max_hops
        AND o.attempts < ?
        AND (o.state = 'pending'
             OR (o.state = 'sent' AND COALESCE(o.last_attempt_at, 0) <= ?))
      ORDER BY CASE a.severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
               a.created_at DESC
      LIMIT ?`,
    [peerNode, now, config.maxSendAttempts, now - config.retryIntervalMs, limit]
  )
}

/** The transport accepted the bytes. Counts an attempt, proves nothing about receipt. */
export async function markSent(tx: MeshDbTx, peerNode: string, alertIds: string[], now: number): Promise<void> {
  if (alertIds.length === 0) return
  await tx.run(
    `UPDATE mesh_outbox SET state = 'sent', attempts = attempts + 1, last_attempt_at = ?
      WHERE peer_node = ? AND state IN ('pending','sent') AND alert_id IN (${marks(alertIds)})`,
    [now, peerNode, ...alertIds]
  )
}

/** The transport refused the bytes. Count the attempt; give up on the row after the limit. */
export async function markSendFailed(
  tx: MeshDbTx,
  peerNode: string,
  alertIds: string[],
  now: number,
  config: MeshConfig = MESH_CONFIG
): Promise<void> {
  if (alertIds.length === 0) return
  await tx.run(
    `UPDATE mesh_outbox
        SET attempts = attempts + 1, last_attempt_at = ?,
            state = CASE WHEN attempts + 1 >= ? THEN 'failed' ELSE 'pending' END
      WHERE peer_node = ? AND state IN ('pending','sent') AND alert_id IN (${marks(alertIds)})`,
    [now, config.maxSendAttempts, peerNode, ...alertIds]
  )
}

/**
 * The peer replied that it stored these alerts. Only rows we actually SENT can be acknowledged:
 * a peer cannot mark an alert "delivered" that we never transmitted to it.
 */
export async function markAcked(tx: MeshDbTx, peerNode: string, alertIds: string[], now: number): Promise<number> {
  if (alertIds.length === 0) return 0
  const { changes } = await tx.run(
    `UPDATE mesh_outbox SET state = 'acked', acked_at = ?, ack_kind = 'peer_ack'
      WHERE peer_node = ? AND state = 'sent' AND alert_id IN (${marks(alertIds)})`,
    [now, peerNode, ...alertIds]
  )
  return changes
}

/** The peer refused these alerts (invalid or rate limited). Stop retrying them. */
export async function markRejected(tx: MeshDbTx, peerNode: string, alertIds: string[]): Promise<void> {
  if (alertIds.length === 0) return
  await tx.run(
    `UPDATE mesh_outbox SET state = 'failed', ack_kind = 'peer_rejected'
      WHERE peer_node = ? AND state IN ('pending','sent') AND alert_id IN (${marks(alertIds)})`,
    [peerNode, ...alertIds]
  )
}

/**
 * A peer connection ended or the app restarted. Anything 'sent' but unacknowledged may
 * have been lost in flight, so it goes back to pending. On a fresh connection, rows that
 * exhausted their attempts on transport errors get one more chance. Rows the peer
 * explicitly REJECTED carry ack_kind = 'peer_rejected' and are never retried: resending
 * an alert the peer already judged invalid would only burn its rate limit.
 */
export async function requeueUnacked(tx: MeshDbTx, peerNode?: string, retryFailed = false): Promise<void> {
  const scope = peerNode ? 'AND peer_node = ?' : ''
  const params: string[] = peerNode ? [peerNode] : []
  // Attempts reset too: a fresh connection deserves a fresh retry budget.
  await tx.run(`UPDATE mesh_outbox SET state = 'pending', attempts = 0 WHERE state = 'sent' ${scope}`, params)
  if (retryFailed) {
    await tx.run(
      `UPDATE mesh_outbox SET state = 'pending', attempts = 0
        WHERE state = 'failed' AND ack_kind IS NULL ${scope}`,
      params
    )
  }
}
