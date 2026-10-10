/**
 * Transport abstraction for the Neighborhood Emergency Network.
 *
 * Shaped around what `expo-nearby-connections` 1.1.1 actually offers (verified from its
 * published types and Android source), not an idealised API:
 *
 *  - advertising and discovery are independent calls on one shared client, so one phone
 *    can do both under Strategy.P2P_CLUSTER (to be confirmed on hardware);
 *  - the advertiser side must call acceptConnection(); the side that dials auto-accepts;
 *  - a FAILED connection emits no event at all, so the relay times dials out itself;
 *  - a payload is bytes carried as a string, capped by Nearby (~32 KB);
 *  - an endpoint id is a per-connection handle, NOT a stable identity. Stable (pseudonymous)
 *    identity is the node id the peers put in their advertised name.
 */

export type PeerLinkState = 'discovered' | 'connecting' | 'connected'

export interface TransportPeer {
  /** Per-connection transport handle. Changes every time the peer reconnects. */
  endpointId: string
  /** Advertised endpoint name, e.g. "cp1-3f9a...". Untrusted input. */
  name: string
  state: PeerLinkState
}

export type PeerEvent =
  | { type: 'found'; peer: TransportPeer }
  | { type: 'lost'; peer: TransportPeer }
  | { type: 'invitation'; peer: TransportPeer }
  | { type: 'connected'; peer: TransportPeer }
  | { type: 'disconnected'; peer: TransportPeer }

export type TransportErrorCode =
  | 'permission_denied'
  | 'radio_unavailable'
  | 'play_services_missing'
  | 'unsupported_platform'
  | 'start_failed'
  | 'connect_failed'
  | 'connect_timeout'
  | 'send_failed'

export interface TransportError {
  code: TransportErrorCode
  message: string
  endpointId?: string
}

export type Unsubscribe = () => void

export interface MeshTransport {
  /** Begin advertising AND discovering as `localName` with Strategy.P2P_CLUSTER. */
  startRelay(localName: string): Promise<void>
  /** Stop advertising, discovery and every connection. Safe to call when not started. */
  stopRelay(): Promise<void>

  getConnectedPeers(): TransportPeer[]
  getKnownPeers(): TransportPeer[]

  /**
   * Restart discovery only (advertising and connections are untouched). A dial that fails
   * emits no event and the endpoint may be stale, so the relay re-discovers before retrying.
   */
  refreshDiscovery(): Promise<void>

  /** Dial a discovered peer. Resolves when the request is issued, NOT when connected. */
  connect(endpointId: string): Promise<void>
  acceptConnection(endpointId: string): Promise<void>
  rejectConnection(endpointId: string): Promise<void>
  disconnect(endpointId?: string): Promise<void>

  /** Send one serialized frame. Resolving means the transport accepted it, not that it arrived. */
  sendAlert(endpointId: string, serialized: string): Promise<void>

  subscribeToIncomingAlerts(callback: (endpointId: string, serialized: string) => void): Unsubscribe
  subscribeToPeerChanges(callback: (event: PeerEvent) => void): Unsubscribe
  subscribeToTransportErrors(callback: (error: TransportError) => void): Unsubscribe
}

/** Endpoint names carry a protocol tag so unrelated advertisers are ignored. */
export const NAME_PREFIX = 'cp1-'

export const advertisedName = (nodeId: string): string => `${NAME_PREFIX}${nodeId}`

/** Extract the node id from an advertised name, or null if the name is not ours. */
export function nodeIdFromName(name: string): string | null {
  if (typeof name !== 'string' || !name.startsWith(NAME_PREFIX)) return null
  const id = name.slice(NAME_PREFIX.length)
  return /^[0-9a-f]{16}$/.test(id) ? id : null
}
