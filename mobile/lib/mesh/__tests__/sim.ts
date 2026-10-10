import type {
  MeshTransport,
  PeerEvent,
  TransportError,
  TransportPeer,
  Unsubscribe,
} from '@/lib/mesh/transport'
import { SimNetwork, settle } from '@/lib/mesh/__tests__/sim-net'

export { SimNetwork, settle }

type Link = 'pending' | 'connected'

/** One simulated phone's radio, implementing the same MeshTransport as the real adapter. */
export class SimTransport implements MeshTransport {
  private started = false
  name = ''
  private readonly links = new Map<string, Link>()
  private readonly peerHandlers = new Set<(e: PeerEvent) => void>()
  private readonly alertHandlers = new Set<(endpointId: string, text: string) => void>()
  private readonly errorHandlers = new Set<(e: TransportError) => void>()
  /** When true, connect() issues nothing and emits nothing: a silent failure. */
  silentConnect = false
  failStart: TransportError | null = null

  constructor(readonly id: string, private readonly net: SimNetwork) {
    net.nodes.set(id, this)
  }

  private ep = (id: string) => `ep-${id}`
  private remote = (endpointId: string) => endpointId.replace(/^ep-/, '')
  private peerOf = (id: string, state: TransportPeer['state']): TransportPeer => ({
    endpointId: this.ep(id),
    name: this.net.nodes.get(id)?.name ?? '',
    state,
  })
  private emitPeer(event: PeerEvent): void {
    queueMicrotask(() => this.peerHandlers.forEach((h) => h(event)))
  }
  private visible(other: SimTransport): boolean {
    return other !== this && other.started && this.net.inRange(this.id, other.id)
  }

  async startRelay(localName: string): Promise<void> {
    if (this.failStart) throw Object.assign(new Error(this.failStart.message), { code: this.failStart.code })
    this.started = true
    this.name = localName
    for (const other of this.net.nodes.values()) {
      if (!this.visible(other)) continue
      this.emitPeer({ type: 'found', peer: this.peerOf(other.id, 'discovered') })
      other.emitPeer({ type: 'found', peer: other.peerOf(this.id, 'discovered') })
    }
  }

  async stopRelay(): Promise<void> {
    this.started = false
    for (const id of [...this.links.keys()]) this.dropLink(id, true)
  }

  async refreshDiscovery(): Promise<void> {
    for (const other of this.net.nodes.values()) {
      if (this.visible(other) && !this.links.has(other.id)) {
        this.emitPeer({ type: 'found', peer: this.peerOf(other.id, 'discovered') })
      }
    }
  }

  getConnectedPeers = (): TransportPeer[] =>
    [...this.links].filter(([, s]) => s === 'connected').map(([id]) => this.peerOf(id, 'connected'))
  getKnownPeers = (): TransportPeer[] => [...this.links.keys()].map((id) => this.peerOf(id, 'connecting'))

  async connect(endpointId: string): Promise<void> {
    if (this.silentConnect) return
    const target = this.net.nodes.get(this.remote(endpointId))
    if (!target || !this.visible(target)) throw new Error('out of range')
    this.links.set(target.id, 'pending')
    target.links.set(this.id, 'pending')
    target.emitPeer({ type: 'invitation', peer: target.peerOf(this.id, 'connecting') })
  }

  async acceptConnection(endpointId: string): Promise<void> {
    const other = this.net.nodes.get(this.remote(endpointId))
    if (!other || this.links.get(other.id) !== 'pending') throw new Error('no pending connection')
    this.links.set(other.id, 'connected')
    other.links.set(this.id, 'connected')
    this.emitPeer({ type: 'connected', peer: this.peerOf(other.id, 'connected') })
    other.emitPeer({ type: 'connected', peer: other.peerOf(this.id, 'connected') })
  }

  async rejectConnection(endpointId: string): Promise<void> {
    const id = this.remote(endpointId)
    this.links.delete(id)
    this.net.nodes.get(id)?.links.delete(this.id)
  }

  async disconnect(endpointId?: string): Promise<void> {
    const ids = endpointId ? [this.remote(endpointId)] : [...this.links.keys()]
    for (const id of ids) this.dropLink(id)
  }

  dropLink(id: string, quiet = false): void {
    const was = this.links.get(id)
    const other = this.net.nodes.get(id)
    const otherHad = other?.links.get(this.id)
    this.links.delete(id)
    other?.links.delete(this.id)
    if (was === 'connected' && !quiet) this.emitPeer({ type: 'disconnected', peer: this.peerOf(id, 'connected') })
    if (otherHad === 'connected' && other) {
      other.emitPeer({ type: 'disconnected', peer: other.peerOf(this.id, 'connected') })
    }
  }

  async sendAlert(endpointId: string, serialized: string): Promise<void> {
    const to = this.remote(endpointId)
    if (this.links.get(to) !== 'connected') throw new Error('not connected')
    let kind = 'raw'
    try {
      kind = (JSON.parse(serialized) as { t?: string }).t ?? 'raw'
    } catch {
      // junk keeps the 'raw' kind
    }
    if (this.net.refuseFrom.has(this.id)) throw new Error('send refused')
    const delivered = !this.net.swallowFrom.has(this.id)
    this.net.log.push({ from: this.id, to, kind, delivered })
    if (delivered) this.inject(to, serialized)
  }

  /** Deliver text to `to` as if this phone sent it. Also used to inject hostile frames. */
  inject(to: string, text: string): void {
    const target = this.net.nodes.get(to)
    queueMicrotask(() => target?.alertHandlers.forEach((h) => h(this.ep(this.id), text)))
  }

  subscribeToIncomingAlerts(cb: (endpointId: string, serialized: string) => void): Unsubscribe {
    this.alertHandlers.add(cb)
    return () => void this.alertHandlers.delete(cb)
  }
  subscribeToPeerChanges(cb: (event: PeerEvent) => void): Unsubscribe {
    this.peerHandlers.add(cb)
    return () => void this.peerHandlers.delete(cb)
  }
  subscribeToTransportErrors(cb: (error: TransportError) => void): Unsubscribe {
    this.errorHandlers.add(cb)
    return () => void this.errorHandlers.delete(cb)
  }

  /** Live listeners, to prove stop() leaves none behind. */
  get listenerCount(): number {
    return this.peerHandlers.size + this.alertHandlers.size + this.errorHandlers.size
  }
}
