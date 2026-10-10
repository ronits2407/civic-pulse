import { encodeFrame, type Frame } from '@/lib/mesh/frames'
import type { EnginePeer } from '@/lib/mesh/peers'
import type { RelayContext } from '@/lib/mesh/relay-context'
import { buildInventory, prepareBatch, recordSendFailed, recordSent } from '@/lib/mesh/sync'

/** Most batches sent to one peer in a single pump, so one peer cannot monopolise the loop. */
const MAX_BATCHES_PER_PUMP = 20

/** Tell a peer which alerts we hold. Both sides do this on connect; it is the sync handshake. */
export async function sendInventory(ctx: RelayContext, peer: EnginePeer): Promise<void> {
  const { db, config, transport } = ctx.deps
  const ids = await buildInventory(db, ctx.now(), config)
  const frame: Frame = { t: 'inv', v: config.schemaVersion, node: ctx.myNode, ids }
  try {
    await transport.sendAlert(peer.endpointId, encodeFrame(frame))
  } catch (error) {
    ctx.reportError({
      code: 'send_failed',
      message: error instanceof Error ? error.message : 'Could not send inventory',
      endpointId: peer.endpointId,
    })
  }
}

/**
 * Send everything eligible to one peer.
 *
 * Gate: a peer receives alerts only once it is connected, user-allowed AND its inventory
 * has been applied, so we never push an alert it already holds. 'Sent' is recorded only
 * after the transport accepted the bytes, and it is not delivery evidence; only the peer's
 * ack (relay-inbound) moves a row to acknowledged.
 */
export async function pump(ctx: RelayContext, peer: EnginePeer): Promise<void> {
  if (peer.pumping || peer.link !== 'connected' || !peer.ready || peer.trust !== 'allowed') return
  const { db, config, transport } = ctx.deps
  peer.pumping = true
  try {
    for (let i = 0; i < MAX_BATCHES_PER_PUMP; i++) {
      const now = ctx.now()
      if (ctx.limiter.sendBudget(peer.nodeId, now) <= 0) break
      const batch = await prepareBatch(db, peer.nodeId, ctx.myNode, now, config)
      if (!batch || peer.link !== 'connected') break
      try {
        await transport.sendAlert(peer.endpointId, batch.text)
      } catch (error) {
        await recordSendFailed(db, peer.nodeId, batch.alertIds, now, config)
        ctx.reportError({
          code: 'send_failed',
          message: error instanceof Error ? error.message : 'Send failed',
          endpointId: peer.endpointId,
        })
        break
      }
      await recordSent(db, peer.nodeId, batch.alertIds, now)
      ctx.limiter.noteSent(peer.nodeId, batch.alertIds.length, now)
    }
  } finally {
    peer.pumping = false
  }
  ctx.dataChanged()
}

export async function pumpAll(ctx: RelayContext): Promise<void> {
  for (const peer of ctx.peers.connected()) await pump(ctx, peer)
}
