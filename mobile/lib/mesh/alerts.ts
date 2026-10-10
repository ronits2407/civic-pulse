import { MESH_CONFIG, type MeshConfig } from '@/lib/mesh/config'
import {
  computeDigest,
  type AlertSeverity,
  type AlertType,
  type ImmutableAlertFields,
  type MeshAlert,
  type Validation,
} from '@/lib/mesh/protocol'
import { validateAlert } from '@/lib/mesh/validate'

export interface NewAlertInput {
  id: string
  type: AlertType
  severity: AlertSeverity
  originId: string
  summary: string
  now: number
  ttlMs?: number
  latitude?: number
  longitude?: number
  maxHops?: number
}

/** Build a freshly created alert (hop 0) and run it through the same validator a receiver uses. */
export function buildAlert(input: NewAlertInput, config: MeshConfig = MESH_CONFIG): Validation<MeshAlert> {
  const ttl = Math.min(input.ttlMs ?? config.defaultTtlMs, config.maxTtlMs)
  const maxHops = Math.min(input.maxHops ?? config.maxHops, config.maxHops)
  // 5 decimal places is roughly 1 m. More precision is false precision for a hazard report.
  const latitude = input.latitude === undefined ? undefined : Math.round(input.latitude * 1e5) / 1e5
  const longitude = input.longitude === undefined ? undefined : Math.round(input.longitude * 1e5) / 1e5

  const base: ImmutableAlertFields = {
    schemaVersion: config.schemaVersion,
    id: input.id.toLowerCase(),
    type: input.type,
    severity: input.severity,
    source: 'community',
    originId: input.originId,
    createdAt: input.now,
    expiresAt: input.now + ttl,
    ...(latitude !== undefined && longitude !== undefined ? { latitude, longitude } : {}),
    summary: input.summary,
    maxHops,
  }
  const candidate: MeshAlert = {
    ...base,
    hopCount: 0,
    integrity: { alg: 'sha256', digest: computeDigest(base) },
  }
  return validateAlert(candidate, { now: input.now, config })
}

/** The copy of a stored alert that goes on the wire: same id and digest, hop + 1. */
export function forwardCopy(alert: MeshAlert): MeshAlert {
  return { ...alert, hopCount: alert.hopCount + 1 }
}

/**
 * An alert may be passed on only while it is unexpired and its hop count is below the limit.
 * (A copy sent at hopCount == maxHops - 1 arrives at hopCount == maxHops and stops there.)
 */
export function isForwardable(
  alert: Pick<MeshAlert, 'hopCount' | 'maxHops' | 'expiresAt'>,
  now: number
): boolean {
  return alert.expiresAt > now && alert.hopCount < alert.maxHops
}

/** What this phone can honestly say about an alert. `server_confirmed` is intentionally absent. */
export type DeliveryState =
  | 'created_locally'
  | 'stored_locally'
  | 'received_from_peer'
  | 'forwarding_pending'
  | 'transmitted_to_peer'
  | 'expired'

export const DELIVERY_LABEL: Record<DeliveryState, string> = {
  created_locally: 'Created on this phone',
  stored_locally: 'Saved on this phone - no nearby phone reached yet',
  received_from_peer: 'Received from a nearby phone',
  forwarding_pending: 'Waiting to be passed on',
  transmitted_to_peer: 'Passed to a nearby phone',
  expired: 'Expired',
}
