import type { DeliveryState } from '@/lib/mesh/alerts'
import type { MeshDb } from '@/lib/mesh/db'
import type { MeshAlert } from '@/lib/mesh/protocol'

/**
 * Read model for the alert feed and history.
 *
 * Delivery state is derived ONLY from evidence this phone holds:
 *   - 'peer_ack' rows: a nearby phone told us it durably stored the alert;
 *   - 'sent' rows: the radio accepted the bytes, which proves nothing about receipt.
 * There is no 'server_confirmed' state because server sync is not implemented.
 */

export interface FeedItem {
  alert: MeshAlert
  direction: 'local' | 'peer'
  receivedAt: number
  state: DeliveryState
  expired: boolean
  /** Peers that acknowledged storing this alert. The only real delivery evidence. */
  confirmedPeers: number
  /** Peers still queued or awaiting an acknowledgement. */
  waitingPeers: number
}

interface Row {
  body: string
  direction: 'local' | 'peer'
  received_at: number
  acked: number
  waiting: number
}

export function deriveState(
  direction: 'local' | 'peer',
  expired: boolean,
  confirmed: number,
  waiting: number
): DeliveryState {
  if (expired) return 'expired'
  if (confirmed > 0) return 'transmitted_to_peer'
  if (waiting > 0) return 'forwarding_pending'
  return direction === 'local' ? 'stored_locally' : 'received_from_peer'
}

export async function loadFeed(db: MeshDb, now: number, limit = 60): Promise<FeedItem[]> {
  const rows = await db.all<Row>(
    `SELECT a.body AS body, a.direction AS direction, a.received_at AS received_at,
            (SELECT COUNT(*) FROM mesh_outbox o WHERE o.alert_id = a.id AND o.ack_kind = 'peer_ack') AS acked,
            (SELECT COUNT(*) FROM mesh_outbox o WHERE o.alert_id = a.id AND o.state IN ('pending','sent')) AS waiting
       FROM mesh_alerts a
      ORDER BY a.created_at DESC
      LIMIT ?`,
    [limit]
  )
  const items: FeedItem[] = []
  for (const row of rows) {
    let alert: MeshAlert
    try {
      alert = JSON.parse(row.body) as MeshAlert
    } catch {
      continue
    }
    const expired = alert.expiresAt <= now
    items.push({
      alert,
      direction: row.direction,
      receivedAt: row.received_at,
      state: deriveState(row.direction, expired, row.acked, row.waiting),
      expired,
      confirmedPeers: row.acked,
      waitingPeers: row.waiting,
    })
  }
  return items
}
