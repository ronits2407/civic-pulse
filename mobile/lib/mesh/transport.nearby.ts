import * as Nearby from 'expo-nearby-connections'

import { classifyFailure, isAlreadyActive } from '@/lib/mesh/nearby-errors'
import {
  nodeIdFromName,
  type MeshTransport,
  type PeerEvent,
  type TransportError,
  type TransportErrorCode,
  type TransportPeer,
  type Unsubscribe,
} from '@/lib/mesh/transport'

/**
 * Adapter over expo-nearby-connections 1.1.1 (Google Nearby Connections on Android).
 *
 * Only calls that exist in the installed package are used. Strategy.P2P_CLUSTER is passed
 * explicitly to BOTH advertising and discovery; the package defaults to P2P_STAR, which
 * would silently give a hub-and-spoke topology.
 */
const STRATEGY = Nearby.Strategy.P2P_CLUSTER

export class NearbyTransport implements MeshTransport {
  private localName = ''
  private active = false
  private readonly known = new Map<string, TransportPeer>()
  private readonly peerHandlers = new Set<(event: PeerEvent) => void>()
  private readonly alertHandlers = new Set<(endpointId: string, text: string) => void>()
  private readonly errorHandlers = new Set<(error: TransportError) => void>()
  private offNative: Unsubscribe[] = []

  private emit(event: PeerEvent): void {
    this.peerHandlers.forEach((handler) => handler(event))
  }

  private fail(code: TransportErrorCode, message: string): void {
    this.errorHandlers.forEach((handler) => handler({ code, message }))
  }

  private upsert(endpointId: string, name: string, state: TransportPeer['state']): TransportPeer {
    const peer: TransportPeer = { endpointId, name: name || this.known.get(endpointId)?.name || '', state }
    this.known.set(endpointId, peer)
    return peer
  }

  /** Native events are wired once per session; every handle is kept so stopRelay() removes all. */
  private attach(): void {
    this.offNative = [
      Nearby.onPeerFound(({ peerId, name }) =>
        this.emit({ type: 'found', peer: this.upsert(peerId, name, 'discovered') })
      ),
      Nearby.onPeerLost(({ peerId }) => {
        const peer = this.known.get(peerId)
        if (peer && peer.state === 'discovered') {
          this.known.delete(peerId)
          this.emit({ type: 'lost', peer })
        }
      }),
      Nearby.onInvitationReceived(({ peerId, name }) =>
        this.emit({ type: 'invitation', peer: this.upsert(peerId, name, 'connecting') })
      ),
      Nearby.onConnected(({ peerId, name }) =>
        this.emit({ type: 'connected', peer: this.upsert(peerId, name, 'connected') })
      ),
      Nearby.onDisconnected(({ peerId }) => {
        const peer = this.known.get(peerId) ?? { endpointId: peerId, name: '', state: 'connected' as const }
        this.known.delete(peerId)
        this.emit({ type: 'disconnected', peer })
      }),
      Nearby.onTextReceived(({ peerId, text }) => this.alertHandlers.forEach((handler) => handler(peerId, text))),
    ]
  }

  private detach(): void {
    for (const off of this.offNative) off()
    this.offNative = []
  }

  async startRelay(localName: string): Promise<void> {
    if (nodeIdFromName(localName) === null) throw new Error('Invalid relay name')
    if (this.active) return
    if (!(await Nearby.isPlayServicesAvailable())) {
      throw Object.assign(new Error('Google Play services is required for nearby sharing.'), {
        code: 'play_services_missing' satisfies TransportErrorCode,
      })
    }
    this.localName = localName
    this.attach()
    try {
      await Nearby.startAdvertise(localName, STRATEGY).catch((e: unknown) => {
        if (!isAlreadyActive(e)) throw e
      })
      await Nearby.startDiscovery(localName, STRATEGY).catch((e: unknown) => {
        if (!isAlreadyActive(e)) throw e
      })
      this.active = true
    } catch (error) {
      await Nearby.stopAdvertise().catch(() => undefined)
      this.detach()
      throw Object.assign(error instanceof Error ? error : new Error(String(error)), {
        code: classifyFailure(error, 'start_failed'),
      })
    }
  }

  async stopRelay(): Promise<void> {
    this.active = false
    this.detach()
    this.known.clear()
    await Nearby.stopDiscovery().catch(() => undefined)
    await Nearby.stopAdvertise().catch(() => undefined)
    await Nearby.disconnect().catch(() => undefined)
  }

  async refreshDiscovery(): Promise<void> {
    if (!this.active) return
    await Nearby.stopDiscovery().catch(() => undefined)
    await Nearby.startDiscovery(this.localName, STRATEGY).catch((error: unknown) => {
      if (!isAlreadyActive(error)) this.fail(classifyFailure(error, 'start_failed'), 'Could not refresh discovery')
    })
  }

  getConnectedPeers = (): TransportPeer[] => [...this.known.values()].filter((p) => p.state === 'connected')
  getKnownPeers = (): TransportPeer[] => [...this.known.values()]

  async connect(endpointId: string): Promise<void> {
    this.upsert(endpointId, '', 'connecting')
    await Nearby.requestConnection(endpointId)
  }
  acceptConnection = (endpointId: string): Promise<void> => Nearby.acceptConnection(endpointId)
  rejectConnection = (endpointId: string): Promise<void> => Nearby.rejectConnection(endpointId)
  disconnect = (endpointId?: string): Promise<void> => Nearby.disconnect(endpointId)
  sendAlert = (endpointId: string, serialized: string): Promise<void> => Nearby.sendText(endpointId, serialized)

  subscribeToIncomingAlerts(callback: (endpointId: string, serialized: string) => void): Unsubscribe {
    this.alertHandlers.add(callback)
    return () => void this.alertHandlers.delete(callback)
  }
  subscribeToPeerChanges(callback: (event: PeerEvent) => void): Unsubscribe {
    this.peerHandlers.add(callback)
    return () => void this.peerHandlers.delete(callback)
  }
  subscribeToTransportErrors(callback: (error: TransportError) => void): Unsubscribe {
    this.errorHandlers.add(callback)
    return () => void this.errorHandlers.delete(callback)
  }
}
