import type { EngineDeps, RelaySnapshot } from '@/lib/mesh/engine-types'
import { pruneOutbox } from '@/lib/mesh/outbox'
import { requeueUnacked } from '@/lib/mesh/outbox-state'
import { RelayContext } from '@/lib/mesh/relay-context'
import { handleIncoming } from '@/lib/mesh/relay-inbound'
import { handlePeerEvent } from '@/lib/mesh/relay-peers'
import {
  allowPeer,
  blockPeer,
  createAlert,
  flush,
  type CreateAlertInput,
  type CreateAlertOutcome,
} from '@/lib/mesh/relay-actions'
import { pumpAll } from '@/lib/mesh/relay-pump'
import { pruneExpired } from '@/lib/mesh/store'
import { advertisedName, type TransportError, type Unsubscribe } from '@/lib/mesh/transport'

export type { CreateAlertInput, CreateAlertOutcome }

/**
 * Relay engine: one foreground session of the Neighborhood Emergency Network.
 *
 * It owns the radio session and nothing else: persistence goes through lib/mesh/store*,
 * wire parsing through lib/mesh/frames, and the platform through the MeshTransport seam.
 * Everything time-based goes through the injected Clock, so the whole engine runs
 * deterministically in tests.
 */
export class RelayEngine {
  private readonly ctx: RelayContext
  private unsubs: Unsubscribe[] = []

  constructor(deps: EngineDeps) {
    this.ctx = new RelayContext(deps)
  }

  get snapshot(): RelaySnapshot {
    return this.ctx.snapshot()
  }

  get nodeId(): string {
    return this.ctx.myNode
  }

  /** Begin advertising and discovering. Failures become `snapshot.error`, not exceptions. */
  async start(): Promise<void> {
    const ctx = this.ctx
    if (ctx.phase === 'running' || ctx.phase === 'starting') return
    ctx.phase = 'starting'
    ctx.error = null
    ctx.running = true
    ctx.emit()

    const { transport, db, config } = ctx.deps
    this.unsubs = [
      transport.subscribeToPeerChanges((event) => void handlePeerEvent(ctx, event).catch((e) => this.fault(e))),
      transport.subscribeToIncomingAlerts(
        (endpointId, text) => void handleIncoming(ctx, endpointId, text).catch((e) => this.fault(e))
      ),
      transport.subscribeToTransportErrors((error) => ctx.reportError(error)),
    ]

    try {
      await db.transaction(async (tx) => {
        await pruneExpired(tx, ctx.now(), config)
        // Work in flight when the app last died is queued again; nothing is replayed to the user.
        await requeueUnacked(tx, undefined, true)
        await pruneOutbox(tx, config)
      })
      await transport.startRelay(advertisedName(ctx.myNode))
      ctx.phase = 'running'
      this.scheduleRetry()
    } catch (error) {
      ctx.phase = 'error'
      ctx.running = false
      ctx.clearTimers()
      this.detach()
      const code = (error as { code?: TransportError['code'] } | null)?.code
      ctx.reportError({
        code: code ?? 'start_failed',
        message: error instanceof Error ? error.message : 'Could not start the relay',
      })
      await transport.stopRelay().catch(() => undefined)
    }
    ctx.dataChanged()
  }

  /** Stop radios, cancel timers and detach listeners. Safe to call repeatedly. */
  async stop(): Promise<void> {
    const ctx = this.ctx
    if (ctx.phase === 'stopped' || ctx.phase === 'stopping') return
    ctx.phase = 'stopping'
    ctx.running = false
    ctx.clearTimers()
    this.detach()
    ctx.peers.clear()
    await ctx.deps.transport.stopRelay().catch(() => undefined)
    ctx.phase = 'stopped'
    ctx.emit()
  }

  private detach(): void {
    for (const off of this.unsubs) off()
    this.unsubs = []
  }

  private fault(error: unknown): void {
    this.ctx.reportError({
      code: 'send_failed',
      message: error instanceof Error ? error.message : 'Unexpected relay error',
    })
  }

  /** Re-send unacknowledged work on a timer while peers stay connected. */
  private scheduleRetry(): void {
    const { ctx } = this
    ctx.after(ctx.deps.config.retryIntervalMs, () => {
      void pumpAll(ctx)
        .catch((e) => this.fault(e))
        .then(() => this.scheduleRetry())
    })
  }

  async createAlert(input: CreateAlertInput): Promise<CreateAlertOutcome> {
    const outcome = await createAlert(this.ctx, input)
    if (outcome.ok) flush(this.ctx)
    return outcome
  }

  allowPeer(endpointId: string): Promise<void> {
    return allowPeer(this.ctx, endpointId)
  }

  blockPeer(endpointId: string): Promise<void> {
    return blockPeer(this.ctx, endpointId)
  }
}
