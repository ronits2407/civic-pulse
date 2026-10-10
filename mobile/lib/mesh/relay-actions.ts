import { buildAlert } from '@/lib/mesh/alerts'
import { setTrust } from '@/lib/mesh/peers'
import type { AlertSeverity, AlertType, MeshAlert } from '@/lib/mesh/protocol'
import type { RelayContext } from '@/lib/mesh/relay-context'
import { acceptInvitation, scheduleDial } from '@/lib/mesh/relay-link'
import { pumpAll } from '@/lib/mesh/relay-pump'
import { storeLocalAlert } from '@/lib/mesh/store-local'

/** Actions the user triggers: creating an alert, allowing or blocking a peer. */

export interface CreateAlertInput {
  type: AlertType
  severity: AlertSeverity
  summary: string
  latitude?: number
  longitude?: number
}

export type CreateAlertOutcome =
  | { ok: true; alert: MeshAlert; queuedFor: number }
  | { ok: false; reason: string }

const noop = () => undefined

/**
 * Create an alert on this phone. It is stored durably FIRST, so it survives a crash or a
 * radio failure, and only then offered to connected peers. Received alerts never reach
 * this function: nothing a peer sends can create or escalate an alert here.
 */
export async function createAlert(ctx: RelayContext, input: CreateAlertInput): Promise<CreateAlertOutcome> {
  const { db, identity, config, randomUuid } = ctx.deps
  const now = ctx.now()
  const built = buildAlert(
    {
      id: randomUuid(),
      type: input.type,
      severity: input.severity,
      originId: identity.originId,
      summary: input.summary.trim(),
      now,
      latitude: input.latitude,
      longitude: input.longitude,
    },
    config
  )
  if (!built.ok) return { ok: false, reason: built.reason }

  const result = await storeLocalAlert(db, built.value, ctx.allowedConnectedNodes(), now, config)
  if (result.status === 'rejected') return { ok: false, reason: result.reason }
  ctx.dataChanged()
  return { ok: true, alert: built.value, queuedFor: result.queuedFor }
}

/** Send whatever is queued. Failures surface through ctx.reportError, never as exceptions. */
export function flush(ctx: RelayContext): void {
  void pumpAll(ctx).catch((error) =>
    ctx.reportError({ code: 'send_failed', message: error instanceof Error ? error.message : 'Send failed' })
  )
}

/** The user allowed an unfamiliar peer. The decision is remembered across sessions. */
export async function allowPeer(ctx: RelayContext, endpointId: string): Promise<void> {
  const peer = ctx.peers.get(endpointId)
  if (!peer || peer.link !== 'awaiting_consent') return
  await setTrust(ctx.deps.db, peer.nodeId, 'allowed', ctx.now())
  peer.trust = 'allowed'
  ctx.clearEndpointTimer(endpointId)
  if (peer.inbound) {
    peer.link = 'invited'
    await acceptInvitation(ctx, peer)
  } else {
    peer.link = 'discovered'
    scheduleDial(ctx, peer)
  }
  ctx.emit()
}

/** The user blocked a peer: reject it now and ignore it in future sessions. */
export async function blockPeer(ctx: RelayContext, endpointId: string): Promise<void> {
  const peer = ctx.peers.get(endpointId)
  if (!peer) return
  await setTrust(ctx.deps.db, peer.nodeId, 'blocked', ctx.now())
  ctx.clearEndpointTimer(endpointId)
  if (peer.inbound) await ctx.deps.transport.rejectConnection(endpointId).catch(noop)
  else await ctx.deps.transport.disconnect(endpointId).catch(noop)
  ctx.peers.delete(endpointId)
  ctx.emit()
}
