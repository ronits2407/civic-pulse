import { MESH_CONFIG, type MeshConfig } from '@/lib/mesh/config'
import { byteLength, sha256Hex } from '@/lib/mesh/sha256'

/**
 * Neighborhood Emergency Network - wire protocol, version 1.
 *
 * TRUST MODEL (read this before extending the protocol)
 * -----------------------------------------------------
 * Nearby Connections encrypts the link to the *immediate* peer. That says nothing about
 * who originally wrote an alert that was relayed through three phones. The `integrity`
 * digest below detects accidental corruption and a relay that edits an alert without
 * recomputing it. It is NOT a signature: anyone can recompute a SHA-256, so it does
 * not authenticate the origin. Consequently:
 *
 *   - every alert is `source: 'community'` and is shown as UNVERIFIED;
 *   - an alert that claims any other source (e.g. "official") is REJECTED, because there
 *     is no key infrastructure here that could make such a claim believable;
 *   - `originId` is an opaque, random, per-install pseudonym. It is useful for rate
 *     limiting and provenance, and it is not an identity.
 *
 * Authenticated origin claims need asymmetric signatures (e.g. Ed25519 with a
 * municipality-published key) and are listed as future work in the docs.
 */

export const ALERT_TYPES = ['sos', 'flood', 'fire', 'road_hazard', 'gas_leak'] as const
export type AlertType = (typeof ALERT_TYPES)[number]

export const ALERT_SEVERITIES = ['advisory', 'warning', 'critical'] as const
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number]

export interface AlertIntegrity {
  alg: 'sha256'
  digest: string
}

export interface MeshAlert {
  schemaVersion: number
  /** Stable event id. Never regenerated while an alert is relayed. */
  id: string
  type: AlertType
  severity: AlertSeverity
  /** Only 'community' is accepted. See the trust model above. */
  source: 'community'
  /** Opaque per-install pseudonym of the phone that created the alert. */
  originId: string
  /** Epoch ms when the original event was created. */
  createdAt: number
  expiresAt: number
  latitude?: number
  longitude?: number
  summary: string
  /** Relay hops already used. 0 on the originating phone. */
  hopCount: number
  maxHops: number
  integrity: AlertIntegrity
}

export type RejectReason =
  | 'malformed'
  | 'unsupported_version'
  | 'too_large'
  | 'bad_id'
  | 'bad_type'
  | 'bad_severity'
  | 'unsupported_source'
  | 'bad_origin'
  | 'bad_summary'
  | 'bad_location'
  | 'bad_time'
  | 'from_future'
  | 'ttl_too_long'
  | 'expired'
  | 'bad_hops'
  | 'bad_integrity'
  | 'rate_limited'

export type Validation<T> = { ok: true; value: T } | { ok: false; reason: RejectReason }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const HEX16_RE = /^[0-9a-f]{16}$/
const HEX64_RE = /^[0-9a-f]{64}$/
// Control characters and bidirectional overrides: never legitimate in a one-line summary,
// and the latter can visually reorder text to disguise it.
// eslint-disable-next-line no-control-regex
const FORBIDDEN_TEXT_RE = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/

export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_RE.test(value)

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isFiniteInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value)

// -- Identity derivation ----------------------------------------------------------

/** Transport handle advertised in the endpoint name. Random, not personal. */
export const deriveNodeId = (installId: string): string =>
  sha256Hex(`civicpulse-mesh|node|${installId}`).slice(0, 16)

/** Pseudonym stamped on alerts this install creates. Deliberately different from the node id. */
export const deriveOriginId = (installId: string): string =>
  sha256Hex(`civicpulse-mesh|origin|${installId}`).slice(0, 16)

export const isNodeId = (value: unknown): value is string =>
  typeof value === 'string' && HEX16_RE.test(value)

// -- Integrity ---------------------------------------------------------------------

type Immutable = Omit<MeshAlert, 'hopCount' | 'integrity'>

/**
 * Canonical digest over every field that must not change in transit. `hopCount` is
 * excluded on purpose: relays increment it. `maxHops` IS covered, so a relay cannot
 * raise the limit.
 */
export function computeDigest(alert: Immutable): string {
  const canonical = JSON.stringify([
    alert.schemaVersion,
    alert.id,
    alert.type,
    alert.severity,
    alert.source,
    alert.originId,
    alert.createdAt,
    alert.expiresAt,
    alert.latitude ?? null,
    alert.longitude ?? null,
    alert.summary,
    alert.maxHops,
  ])
  return sha256Hex(`civicpulse-mesh-v1|${canonical}`)
}

export { HEX64_RE as DIGEST_RE, HEX16_RE as HEX16_PATTERN, FORBIDDEN_TEXT_RE, isFiniteInt, byteLength }
export type { Immutable as ImmutableAlertFields }
