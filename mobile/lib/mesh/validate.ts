import { MESH_CONFIG, type MeshConfig } from '@/lib/mesh/config'
import {
  ALERT_SEVERITIES,
  ALERT_TYPES,
  DIGEST_RE,
  FORBIDDEN_TEXT_RE,
  HEX16_PATTERN,
  byteLength,
  computeDigest,
  isFiniteInt,
  isRecord,
  isUuid,
  type AlertSeverity,
  type AlertType,
  type MeshAlert,
  type Validation,
} from '@/lib/mesh/protocol'

export function validateSummary(summary: unknown, config: MeshConfig = MESH_CONFIG): Validation<string> {
  if (typeof summary !== 'string') return { ok: false, reason: 'bad_summary' }
  const trimmed = summary.trim()
  if (trimmed.length === 0 || trimmed.length > config.summaryMaxChars) return { ok: false, reason: 'bad_summary' }
  if (trimmed !== summary || FORBIDDEN_TEXT_RE.test(summary)) return { ok: false, reason: 'bad_summary' }
  return { ok: true, value: summary }
}

export interface ValidateOptions {
  now: number
  config?: MeshConfig
  /** Skip the expiry check. Only used to re-read an already stored alert for display. */
  allowExpired?: boolean
}

function validateLocation(
  input: Record<string, unknown>
): Validation<{ latitude?: number; longitude?: number }> {
  const hasLat = input.latitude !== undefined && input.latitude !== null
  const hasLng = input.longitude !== undefined && input.longitude !== null
  if (hasLat !== hasLng) return { ok: false, reason: 'bad_location' }
  if (!hasLat) return { ok: true, value: {} }
  const { latitude, longitude } = input
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return { ok: false, reason: 'bad_location' }
  if (!(latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180)) {
    return { ok: false, reason: 'bad_location' }
  }
  return { ok: true, value: { latitude, longitude } }
}

/**
 * Validate an untrusted value into a MeshAlert.
 *
 * The result is rebuilt field by field from known keys, so unknown properties (including
 * prototype tricks) never survive into storage, display or forwarding.
 */
export function validateAlert(input: unknown, options: ValidateOptions): Validation<MeshAlert> {
  const config = options.config ?? MESH_CONFIG
  const { now } = options
  if (!isRecord(input)) return { ok: false, reason: 'malformed' }

  if (input.schemaVersion !== config.schemaVersion) return { ok: false, reason: 'unsupported_version' }
  if (!isUuid(input.id)) return { ok: false, reason: 'bad_id' }
  if (!ALERT_TYPES.includes(input.type as AlertType)) return { ok: false, reason: 'bad_type' }
  if (!ALERT_SEVERITIES.includes(input.severity as AlertSeverity)) return { ok: false, reason: 'bad_severity' }
  if (input.source !== 'community') return { ok: false, reason: 'unsupported_source' }
  if (typeof input.originId !== 'string' || !HEX16_PATTERN.test(input.originId)) {
    return { ok: false, reason: 'bad_origin' }
  }

  const summary = validateSummary(input.summary, config)
  if (!summary.ok) return summary
  const location = validateLocation(input)
  if (!location.ok) return location

  if (!isFiniteInt(input.createdAt) || !isFiniteInt(input.expiresAt)) return { ok: false, reason: 'bad_time' }
  if (input.expiresAt <= input.createdAt) return { ok: false, reason: 'bad_time' }
  if (input.createdAt > now + config.clockSkewMs) return { ok: false, reason: 'from_future' }
  if (input.expiresAt - input.createdAt > config.maxTtlMs) return { ok: false, reason: 'ttl_too_long' }
  if (!options.allowExpired && input.expiresAt <= now) return { ok: false, reason: 'expired' }

  if (!isFiniteInt(input.hopCount) || !isFiniteInt(input.maxHops)) return { ok: false, reason: 'bad_hops' }
  if (input.maxHops < 0 || input.maxHops > config.maxHops) return { ok: false, reason: 'bad_hops' }
  if (input.hopCount < 0 || input.hopCount > input.maxHops) return { ok: false, reason: 'bad_hops' }

  const integrity = input.integrity
  if (
    !isRecord(integrity) ||
    integrity.alg !== 'sha256' ||
    typeof integrity.digest !== 'string' ||
    !DIGEST_RE.test(integrity.digest)
  ) {
    return { ok: false, reason: 'bad_integrity' }
  }

  const alert: MeshAlert = {
    schemaVersion: input.schemaVersion,
    id: input.id.toLowerCase(),
    type: input.type as AlertType,
    severity: input.severity as AlertSeverity,
    source: 'community',
    originId: input.originId,
    createdAt: input.createdAt,
    expiresAt: input.expiresAt,
    ...location.value,
    summary: summary.value,
    hopCount: input.hopCount,
    maxHops: input.maxHops,
    integrity: { alg: 'sha256', digest: integrity.digest },
  }

  if (computeDigest(alert) !== alert.integrity.digest) return { ok: false, reason: 'bad_integrity' }
  if (byteLength(JSON.stringify(alert)) > config.alertMaxBytes) return { ok: false, reason: 'too_large' }
  return { ok: true, value: alert }
}
