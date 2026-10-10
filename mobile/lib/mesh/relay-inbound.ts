import { encodeFrame, parseFrame, type Frame } from '@/lib/mesh/frames'
import type { EnginePeer } from '@/lib/mesh/peers'
import type { RelayContext } from '@/lib/mesh/relay-context'
import { pump, pumpAll, sendInventory } from '@/lib/mesh/relay-pump'
import { applyAck, applyPeerInventory, receiveAlerts } from '@/lib/mesh/sync'

/**
 * Inbound frames. Order of checks matters:
 *   1. the sender must be a peer we agreed to talk to (connected + user-allowed);
 *   2. per-peer rate limit, BEFORE any parsing work;
 *   3. strict parse (size, version, shape);
 *   4. the frame's claimed node id must match the node id this endpoint registered with;
 *   5. only then act. Alerts are validated individually and acknowledged only AFTER commit.
 */

const noop = () => undefined

function misbehaved(ctx: RelayContext, peer: EnginePeer): void {
  if (!ctx.limiter.violation(peer.endpointId)) return
  ctx.limiter.ban(peer.nodeId, ctx.now())
  void ctx.deps.transport.disconnect(peer.endpointId).catch(noop)
}

async function reply(ctx: RelayContext, peer: EnginePeer, frame: Frame): Promise<void> {
  try {
    await ctx.deps.transport.sendAlert(peer.endpointId, encodeFrame(frame))
  } catch {
    // A lost ack is harmless: the sender resends and we answer "duplicate" with a fresh ack.
  }
}

export async function handleIncoming(ctx: RelayContext, endpointId: string, text: string): Promise<void> {
  if (!ctx.running) return
  const peer = ctx.peers.get(endpointId)
  if (!peer || peer.link !== 'connected' || peer.trust !== 'allowed') return

  const now = ctx.now()
  if (!ctx.limiter.allowFrame(endpointId, now)) {
    ctx.deps.events?.onRejected?.('rate_limited', peer.nodeId)
    misbehaved(ctx, peer)
    return
  }

  const parsed = parseFrame(text, ctx.deps.config)
  if (!parsed.ok) {
    ctx.deps.events?.onRejected?.(parsed.reason, peer.nodeId)
    misbehaved(ctx, peer)
    return
  }
  const frame = parsed.value
  // A phone cannot speak for a different node id than the one it connected as.
  if (frame.node !== peer.nodeId) {
    ctx.deps.events?.onRejected?.('malformed', peer.nodeId)
    misbehaved(ctx, peer)
    return
  }

  switch (frame.t) {
    case 'hello':
      return
    case 'inv':
      return onInventory(ctx, peer, frame.ids)
    case 'alerts':
      return onAlerts(ctx, peer, frame.alerts)
    case 'ack':
      await applyAck(ctx.deps.db, peer.nodeId, frame.ids, frame.rejected, now)
      ctx.dataChanged()
      return pump(ctx, peer)
  }
}

async function onInventory(ctx: RelayContext, peer: EnginePeer, ids: string[]): Promise<void> {
  const { db, config } = ctx.deps
  await applyPeerInventory(db, peer.nodeId, ids, ctx.now(), config)
  peer.invReceived += 1
  peer.ready = true
  ctx.clearEndpointTimer(peer.endpointId)
  // A repeated inventory means the peer never saw ours (frames can be lost): answer again.
  if (peer.invReceived > 1) {
    await sendInventory(ctx, peer)
  }
  ctx.dataChanged()
  await pump(ctx, peer)
}

async function onAlerts(ctx: RelayContext, peer: EnginePeer, raw: unknown[]): Promise<void> {
  const { db, config, events } = ctx.deps
  const others = ctx.allowedConnectedNodes().filter((node) => node !== peer.nodeId)
  const result = await receiveAlerts(db, raw, peer.nodeId, others, ctx.now(), config)

  // The ack goes out only now, after every accepted alert has been committed.
  await reply(ctx, peer, {
    t: 'ack', v: config.schemaVersion, node: ctx.myNode, ids: result.acked, rejected: result.rejected,
  })

  for (const reason of result.reasons) events?.onRejected?.(reason, peer.nodeId)
  // Mostly-invalid batches count against the peer; a single stale alert does not.
  if (result.reasons.length > 0 && result.acked.length === 0) misbehaved(ctx, peer)

  for (const alert of result.accepted) events?.onAlertReceived?.(alert, peer.nodeId)
  ctx.dataChanged()
  // Relay: the new alerts were queued for the OTHER peers inside the commit; send them now.
  if (result.accepted.length > 0) await pumpAll(ctx)
}
