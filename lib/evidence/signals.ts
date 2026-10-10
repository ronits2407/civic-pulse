import { distanceMeters, type LatLng } from './geo'
import type { EvidenceSignalResult } from './types'

/** Pure signal builders shared by intake and resolution. Missing data -> `unknown`, never `contradicts`. */

export function completionLocationSignal(input: {
  issueLocation: LatLng | null
  claimLocation: LatLng | null
  accuracyM: number | null
}): { signal: EvidenceSignalResult; distanceM: number | null } {
  const base = { key: 'location' as const, weight: 2, source: 'submitted device location vs issue location' }
  if (!input.issueLocation || !input.claimLocation) {
    return {
      signal: { ...base, outcome: 'unknown', reason: 'No completion location was provided.', freshness: 'unknown' },
      distanceM: null,
    }
  }
  const d = Math.round(distanceMeters(input.issueLocation, input.claimLocation))
  // GPS error is not misconduct: widen tolerance by reported accuracy (capped).
  const tolerance = 100 + Math.min(Math.max(input.accuracyM ?? 0, 0), 200)
  if (d <= tolerance) {
    return { signal: { ...base, outcome: 'supports', reason: `Completion was captured within ~${d} m of the report.`, freshness: 'fresh' }, distanceM: d }
  }
  if (d <= tolerance * 3) {
    return { signal: { ...base, outcome: 'neutral', reason: `Completion location is ~${d} m away; could be GPS drift.`, freshness: 'fresh' }, distanceM: d }
  }
  return { signal: { ...base, outcome: 'contradicts', reason: `Completion location is ~${d} m from the report.`, freshness: 'fresh' }, distanceM: d }
}

export function completionTimingSignal(input: {
  capturedAt: Date | null
  issueCreatedAt: Date
  now: Date
}): EvidenceSignalResult {
  const base = { key: 'events' as const, weight: 1, source: 'capture timestamp vs report timeline' }
  if (!input.capturedAt || Number.isNaN(input.capturedAt.getTime())) {
    return { ...base, outcome: 'unknown', reason: 'No capture time was provided.', freshness: 'unknown' }
  }
  const t = input.capturedAt.getTime()
  if (t < input.issueCreatedAt.getTime()) {
    return { ...base, outcome: 'contradicts', reason: 'The proof was captured before the issue was reported.', freshness: 'stale' }
  }
  if (t > input.now.getTime() + 5 * 60_000) {
    return { ...base, outcome: 'contradicts', reason: 'The capture time is in the future.', freshness: 'unknown' }
  }
  const ageHours = (input.now.getTime() - t) / 3_600_000
  if (ageHours <= 24) return { ...base, outcome: 'supports', reason: 'The proof was captured within the last 24 hours.', freshness: 'fresh' }
  return { ...base, outcome: 'neutral', reason: 'The proof is older than 24 hours.', freshness: 'stale' }
}

/** Intake location plausibility from how the reporter chose the location. */
export function intakeLocationSignal(input: {
  source: 'device_gps' | 'map_pin' | null
  accuracyM: number | null
  capturedAt: Date | null
  now: Date
}): EvidenceSignalResult {
  const base = { key: 'location' as const, weight: 2, source: 'reporter location capture' }
  if (!input.source) {
    return { ...base, outcome: 'unknown', reason: 'How the location was chosen was not recorded.', freshness: 'unknown' }
  }
  if (input.source === 'map_pin') {
    return { ...base, outcome: 'neutral', reason: 'Location was placed manually on the map; it is plausible but not device-verified.', freshness: 'unknown' }
  }
  const ageMin = input.capturedAt ? (input.now.getTime() - input.capturedAt.getTime()) / 60_000 : null
  const fresh = ageMin !== null && ageMin >= -5 && ageMin <= 30
  const accurate = input.accuracyM !== null && input.accuracyM <= 100
  if (fresh && accurate) {
    return { ...base, outcome: 'supports', reason: `Device GPS fix (about ${Math.round(input.accuracyM as number)} m accuracy) taken near report time.`, freshness: 'fresh' }
  }
  return {
    ...base,
    outcome: 'neutral',
    reason: 'Device GPS was used, but accuracy or capture time was not good enough to rely on.',
    freshness: fresh ? 'fresh' : 'unknown',
  }
}
