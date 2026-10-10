import type { MeshDb } from '@/lib/mesh/db'

/**
 * In-memory peer model + persisted consent.
 *
 * Two different identifiers are in play and must not be confused:
 *   endpointId  per-connection transport handle. Changes on every reconnect.
 *   nodeId      pseudonymous id the peer advertises (cp1-<16 hex>). Stable per install,
 *               but UNAUTHENTICATED: any phone can advertise any name. It keys a consent
 *               decision and an outbox row; it does not prove who a person is.
 */

export type PeerLink = 'discovered' | 'awaiting_consent' | 'connecting' | 'invited' | 'connected'
export type Trust = 'allowed' | 'blocked' | 'unknown'

export interface EnginePeer {
  endpointId: string
  nodeId: string
  name: string
  link: PeerLink
  trust: Trust
  /** The peer's inventory has been received and applied: it is safe to send alerts. */
  ready: boolean
  connectedAt: number | null
  /** Inventories received on this connection. A repeat means the peer missed ours. */
  invReceived: number
  pumping: boolean
  dialAttempts: number
  /** True when the peer dialled us (we received an invitation). */
  inbound: boolean
}

export interface PeerView {
  endpointId: string
  nodeId: string
  /** Short label derived from the pseudonymous id. Never a person's name. */
  label: string
  link: PeerLink
  trust: Trust
  ready: boolean
}

export const shortLabel = (nodeId: string): string => `Phone ${nodeId.slice(0, 4).toUpperCase()}`

export const toView = (peer: EnginePeer): PeerView => ({
  endpointId: peer.endpointId,
  nodeId: peer.nodeId,
  label: shortLabel(peer.nodeId),
  link: peer.link,
  trust: peer.trust,
  ready: peer.ready,
})

const LIVE: readonly PeerLink[] = ['connected', 'connecting', 'invited']

export class PeerRegistry {
  private readonly byEndpoint = new Map<string, EnginePeer>()

  get(endpointId: string): EnginePeer | undefined {
    return this.byEndpoint.get(endpointId)
  }
  set(peer: EnginePeer): void {
    this.byEndpoint.set(peer.endpointId, peer)
  }
  delete(endpointId: string): void {
    this.byEndpoint.delete(endpointId)
  }
  clear(): void {
    this.byEndpoint.clear()
  }
  all(): EnginePeer[] {
    return [...this.byEndpoint.values()]
  }
  connected(): EnginePeer[] {
    return this.all().filter((p) => p.link === 'connected')
  }
  /** Any live (connected, connecting or invited) peer that already uses this node id. */
  activeForNode(nodeId: string): EnginePeer | undefined {
    return this.all().find((p) => p.nodeId === nodeId && LIVE.includes(p.link))
  }
  slotsUsed(): number {
    return this.all().filter((p) => LIVE.includes(p.link)).length
  }
}

// -- Consent ------------------------------------------------------------------------

export async function getTrust(db: MeshDb, nodeId: string): Promise<Trust> {
  const row = await db.first<{ trust: 'allowed' | 'blocked' }>(
    'SELECT trust FROM mesh_peers WHERE node_id = ?',
    [nodeId]
  )
  return row ? row.trust : 'unknown'
}

export async function setTrust(
  db: MeshDb,
  nodeId: string,
  trust: 'allowed' | 'blocked',
  now: number
): Promise<void> {
  await db.run(
    `INSERT INTO mesh_peers (node_id, trust, first_seen_at, last_seen_at) VALUES (?,?,?,?)
     ON CONFLICT (node_id) DO UPDATE SET trust = excluded.trust, last_seen_at = excluded.last_seen_at`,
    [nodeId, trust, now, now]
  )
}

export async function forgetPeer(db: MeshDb, nodeId: string): Promise<void> {
  await db.run('DELETE FROM mesh_peers WHERE node_id = ?', [nodeId])
}

/** Bound the consent table so a flood of fake nodes cannot grow it without limit. */
export async function pruneTrust(db: MeshDb, maxRows = 200): Promise<void> {
  await db.run(
    `DELETE FROM mesh_peers WHERE rowid IN (
       SELECT rowid FROM mesh_peers
        ORDER BY CASE trust WHEN 'blocked' THEN 1 ELSE 0 END, last_seen_at ASC
        LIMIT MAX(0, (SELECT COUNT(*) FROM mesh_peers) - ?))`,
    [maxRows]
  )
}
