import { getTrust, type EnginePeer } from '@/lib/mesh/peers'
import type { RelayContext } from '@/lib/mesh/relay-context'
import {
  acceptInvitation,
  expireConsent,
  onConnected,
  onDisconnected,
  scheduleDial,
} from '@/lib/mesh/relay-link'
import { nodeIdFromName, type PeerEvent, type TransportPeer } from '@/lib/mesh/transport'

/** Discovery results and invitations. Link lifecycle lives in relay-link.ts. */

const noop = () => undefined

export async function handlePeerEvent(ctx: RelayContext, event: PeerEvent): Promise<void> {
  if (!ctx.running) return
  switch (event.type) {
    case 'found':
      return onFound(ctx, event.peer)
    case 'lost':
      return onLost(ctx, event.peer)
    case 'invitation':
      return onInvitation(ctx, event.peer)
    case 'connected':
      return onConnected(ctx, event.peer)
    case 'disconnected':
      return onDisconnected(ctx, event.peer)
  }
}

function blank(t: TransportPeer, nodeId: string, link: EnginePeer['link'], inbound: boolean): EnginePeer {
  return {
    endpointId: t.endpointId,
    nodeId,
    name: t.name,
    link,
    trust: 'unknown',
    ready: false,
    connectedAt: null,
    invReceived: 0,
    pumping: false,
    dialAttempts: 0,
    inbound,
  }
}

async function onFound(ctx: RelayContext, t: TransportPeer): Promise<void> {
  const nodeId = nodeIdFromName(t.name)
  if (!nodeId || nodeId === ctx.myNode) return // not a CivicPulse relay, or ourselves
  if (ctx.limiter.isBanned(nodeId, ctx.now())) return
  if (ctx.peers.get(t.endpointId) || ctx.peers.activeForNode(nodeId)) return

  const trust = await getTrust(ctx.deps.db, nodeId)
  if (trust === 'blocked' || !ctx.running) return
  // Re-check: discovery can fire twice while the trust lookup was in flight.
  if (ctx.peers.get(t.endpointId) || ctx.peers.activeForNode(nodeId)) return

  const peer = blank(t, nodeId, trust === 'allowed' ? 'discovered' : 'awaiting_consent', false)
  peer.trust = trust
  ctx.peers.set(peer)
  if (trust === 'allowed') scheduleDial(ctx, peer)
  else expireConsent(ctx, peer)
  ctx.emit()
}

function onLost(ctx: RelayContext, t: TransportPeer): void {
  const peer = ctx.peers.get(t.endpointId)
  if (peer && (peer.link === 'discovered' || peer.link === 'awaiting_consent') && !peer.inbound) {
    ctx.clearEndpointTimer(peer.endpointId)
    ctx.peers.delete(peer.endpointId)
    ctx.emit()
  }
}

async function onInvitation(ctx: RelayContext, t: TransportPeer): Promise<void> {
  const { transport, db, config } = ctx.deps
  const refuse = async () => {
    await transport.rejectConnection(t.endpointId).catch(noop)
  }
  const nodeId = nodeIdFromName(t.name)
  if (!nodeId || nodeId === ctx.myNode) return refuse()
  if (ctx.limiter.isBanned(nodeId, ctx.now())) return refuse()

  const existing = ctx.peers.get(t.endpointId)
  const other = ctx.peers.activeForNode(nodeId)
  if (other && other.endpointId !== t.endpointId) return refuse()
  if (!existing && ctx.peers.slotsUsed() >= config.maxConnectedPeers) return refuse()

  const trust = await getTrust(db, nodeId)
  if (trust === 'blocked' || !ctx.running) return refuse()

  const peer = existing ?? blank(t, nodeId, 'awaiting_consent', true)
  peer.inbound = true
  peer.trust = trust
  ctx.clearEndpointTimer(t.endpointId)
  if (trust === 'allowed') {
    peer.link = 'invited'
    ctx.peers.set(peer)
    await acceptInvitation(ctx, peer)
  } else {
    // Unfamiliar peer: nothing is accepted until the user says so.
    peer.link = 'awaiting_consent'
    ctx.peers.set(peer)
    expireConsent(ctx, peer)
  }
  ctx.emit()
}
