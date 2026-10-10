import { requeueUnacked } from '@/lib/mesh/outbox-state'
import type { EnginePeer } from '@/lib/mesh/peers'
import type { RelayContext } from '@/lib/mesh/relay-context'
import { sendInventory } from '@/lib/mesh/relay-pump'
import type { TransportPeer } from '@/lib/mesh/transport'

/**
 * Link lifecycle: dialling, accepting, failing, connecting, disconnecting.
 *
 * Library facts this code is built around (verified in expo-nearby-connections 1.1.1):
 *  - requestConnection() issues the request and auto-accepts on the dialling side; the
 *    advertising side receives an invitation and MUST call acceptConnection();
 *  - a failed connection produces NO event, so every dial and accept has its own timeout;
 *  - cluster mode does not connect everyone automatically; each link is requested here.
 */

const noop = () => undefined

/** Accept an invitation. The 'connected' event, not this call, marks the link usable. */
export async function acceptInvitation(ctx: RelayContext, peer: EnginePeer): Promise<void> {
  ctx.setEndpointTimer(peer.endpointId, ctx.deps.config.connectTimeoutMs, () =>
    failLink(ctx, peer.endpointId, 'connect_timeout')
  )
  try {
    await ctx.deps.transport.acceptConnection(peer.endpointId)
  } catch (error) {
    failLink(ctx, peer.endpointId, 'connect_failed', error)
  }
}

/** Unknown peers wait for the user's decision, but not forever. */
export function expireConsent(ctx: RelayContext, peer: EnginePeer): void {
  ctx.setEndpointTimer(peer.endpointId, ctx.deps.config.consentTimeoutMs, () => {
    const current = ctx.peers.get(peer.endpointId)
    if (!current || current.link !== 'awaiting_consent') return
    if (current.inbound) void ctx.deps.transport.rejectConnection(peer.endpointId).catch(noop)
    ctx.peers.delete(peer.endpointId)
    ctx.emit()
  })
}

/**
 * Of two phones, the one with the smaller node id dials at once; the other waits a few
 * seconds and dials only if no connection has appeared. This avoids both phones
 * requesting at the same moment, which Nearby resolves poorly.
 */
export function scheduleDial(ctx: RelayContext, peer: EnginePeer): void {
  const { config } = ctx.deps
  const wait = (ctx.myNode < peer.nodeId ? 0 : config.fallbackDialDelayMs) + ctx.dialDelay(peer.nodeId)
  ctx.setEndpointTimer(peer.endpointId, wait, () => void dial(ctx, peer.endpointId))
}

async function dial(ctx: RelayContext, endpointId: string): Promise<void> {
  const peer = ctx.peers.get(endpointId)
  if (!peer || peer.link !== 'discovered' || peer.trust !== 'allowed') return
  if (ctx.peers.activeForNode(peer.nodeId)) return
  if (ctx.peers.slotsUsed() >= ctx.deps.config.maxConnectedPeers) return
  peer.link = 'connecting'
  ctx.setEndpointTimer(endpointId, ctx.deps.config.connectTimeoutMs, () =>
    failLink(ctx, endpointId, 'connect_timeout')
  )
  ctx.emit()
  try {
    await ctx.deps.transport.connect(endpointId)
  } catch (error) {
    failLink(ctx, endpointId, 'connect_failed', error)
  }
}

/** A dial or accept did not produce a connection: clean up, back off, and try again later. */
export function failLink(
  ctx: RelayContext,
  endpointId: string,
  code: 'connect_failed' | 'connect_timeout',
  error?: unknown
): void {
  const peer = ctx.peers.get(endpointId)
  if (!peer || peer.link === 'connected') return
  ctx.clearEndpointTimer(endpointId)
  void ctx.deps.transport.disconnect(endpointId).catch(noop)
  const tries = (ctx.attempts.get(peer.nodeId) ?? 0) + 1
  ctx.attempts.set(peer.nodeId, tries)
  const fallback = code === 'connect_timeout' ? 'Connection timed out' : 'Connection failed'
  ctx.reportError({ code, message: error instanceof Error ? error.message : fallback, endpointId })
  if (peer.inbound || tries >= ctx.deps.config.maxDialAttempts) {
    ctx.peers.delete(endpointId) // the other side (or fresh discovery) will re-announce it
  } else {
    peer.link = 'discovered'
    void ctx.deps.transport.refreshDiscovery().catch(noop)
    scheduleDial(ctx, peer)
  }
  ctx.emit()
}

/** Frames are not ordered across payloads, so repeat our inventory until the peer answers. */
function ensureHandshake(ctx: RelayContext, endpointId: string, attempt: number): void {
  ctx.setEndpointTimer(endpointId, 3_000, () => {
    const peer = ctx.peers.get(endpointId)
    if (!peer || peer.link !== 'connected' || peer.ready || attempt >= 4) return
    void sendInventory(ctx, peer).then(() => ensureHandshake(ctx, endpointId, attempt + 1))
  })
}

export async function onConnected(ctx: RelayContext, t: TransportPeer): Promise<void> {
  const peer = ctx.peers.get(t.endpointId)
  // A connection we never agreed to (no recorded consent) is dropped immediately.
  const wasAgreed = peer && peer.trust === 'allowed' && (peer.link === 'connecting' || peer.link === 'invited')
  if (!peer || !wasAgreed) {
    void ctx.deps.transport.disconnect(t.endpointId).catch(noop)
    return
  }
  ctx.clearEndpointTimer(t.endpointId)
  ctx.attempts.delete(peer.nodeId)
  ctx.limiter.resetConnection(t.endpointId)
  peer.link = 'connected'
  peer.ready = false
  peer.invReceived = 0
  peer.connectedAt = ctx.now()
  // A fresh link gets a fresh retry budget for work that failed or was in flight before.
  await ctx.deps.db.transaction((tx) => requeueUnacked(tx, peer.nodeId, true))
  await sendInventory(ctx, peer)
  ensureHandshake(ctx, peer.endpointId, 1)
  ctx.dataChanged()
}

export async function onDisconnected(ctx: RelayContext, t: TransportPeer): Promise<void> {
  const peer = ctx.peers.get(t.endpointId)
  if (!peer) return
  ctx.clearEndpointTimer(t.endpointId)
  ctx.limiter.resetConnection(t.endpointId)
  ctx.peers.delete(t.endpointId)
  // Anything sent but unacknowledged may have been lost in flight: queue it again.
  await ctx.deps.db.transaction((tx) => requeueUnacked(tx, peer.nodeId, false))
  if (peer.link === 'connected') {
    ctx.after(ctx.dialDelay(peer.nodeId) + 2_000, () => void ctx.deps.transport.refreshDiscovery().catch(noop))
  }
  ctx.dataChanged()
}
