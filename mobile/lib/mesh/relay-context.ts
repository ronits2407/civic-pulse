import type { EngineDeps, RelayPhase, RelaySnapshot } from '@/lib/mesh/engine-types'
import { PeerLimiter } from '@/lib/mesh/limiter'
import { PeerRegistry, toView } from '@/lib/mesh/peers'
import type { TransportError } from '@/lib/mesh/transport'

/**
 * Shared mutable state for one relay session. The engine's behaviour is split across
 * relay-peers (connections), relay-inbound (frames) and relay-pump (sending); they all
 * operate on this object. Nothing here touches the radio directly.
 */
export class RelayContext {
  readonly peers = new PeerRegistry()
  readonly limiter: PeerLimiter
  /** Failed-dial counters per node id, for backoff. Reset on a successful connection. */
  readonly attempts = new Map<string, number>()
  /** Pending dial / consent timers keyed by endpoint id, so they can be cancelled on any exit path. */
  readonly endpointTimers = new Map<string, unknown>()
  phase: RelayPhase = 'stopped'
  error: TransportError | null = null
  running = false
  private readonly timers = new Set<unknown>()
  private pending = 0

  constructor(readonly deps: EngineDeps) {
    this.limiter = new PeerLimiter(deps.config)
  }

  now(): number {
    return this.deps.clock.now()
  }

  get myNode(): string {
    return this.deps.identity.nodeId
  }

  /** Schedule work that is silently dropped if the session has ended by the time it fires. */
  after(ms: number, fn: () => void): unknown {
    const handle = this.deps.clock.setTimeout(() => {
      this.timers.delete(handle)
      if (this.running) fn()
    }, ms)
    this.timers.add(handle)
    return handle
  }

  cancel(handle: unknown): void {
    this.deps.clock.clearTimeout(handle)
    this.timers.delete(handle)
  }

  /** Replace (and cancel) the single timer slot for an endpoint. */
  setEndpointTimer(endpointId: string, ms: number, fn: () => void): void {
    this.clearEndpointTimer(endpointId)
    this.endpointTimers.set(endpointId, this.after(ms, fn))
  }

  clearEndpointTimer(endpointId: string): void {
    const handle = this.endpointTimers.get(endpointId)
    if (handle !== undefined) this.cancel(handle)
    this.endpointTimers.delete(endpointId)
  }

  /** Backoff before the next dial of a node, growing with consecutive failures. */
  dialDelay(nodeId: string): number {
    const n = this.attempts.get(nodeId) ?? 0
    const steps = this.deps.config.reconnectBackoffMs
    return n === 0 ? 0 : steps[Math.min(n - 1, steps.length - 1)]
  }

  clearTimers(): void {
    for (const handle of this.timers) this.deps.clock.clearTimeout(handle)
    this.timers.clear()
    this.endpointTimers.clear()
  }

  reportError(error: TransportError): void {
    this.error = error
    this.emit()
  }

  /** Node ids of connected peers the user has allowed. */
  allowedConnectedNodes(): string[] {
    return this.peers.connected().filter((p) => p.trust === 'allowed').map((p) => p.nodeId)
  }

  snapshot(): RelaySnapshot {
    const all = this.peers.all()
    return {
      phase: this.phase,
      nearby: all.filter((p) => p.link === 'discovered' || p.link === 'connecting' || p.link === 'invited').map(toView),
      connected: all.filter((p) => p.link === 'connected').map(toView),
      awaitingConsent: all.filter((p) => p.link === 'awaiting_consent').map(toView),
      pendingTransfers: this.pending,
      error: this.error,
    }
  }

  /** Refresh counters and tell the UI. Never throws: a UI refresh must not break the relay. */
  emit(): void {
    void this.deps.db
      .first<{ n: number }>("SELECT COUNT(*) AS n FROM mesh_outbox WHERE state IN ('pending','sent')")
      .then((row) => {
        this.pending = row?.n ?? 0
      })
      .catch(() => undefined)
      .then(() => this.deps.events?.onSnapshot?.(this.snapshot()))
  }

  dataChanged(): void {
    this.deps.events?.onDataChanged?.()
    this.emit()
  }
}
