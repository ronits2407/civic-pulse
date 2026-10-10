import { accent, TONE_COLOR, type Tone } from '@/theme/tokens'

// ── Time ──────────────────────────────────────────────────────────────────────

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.round(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  return formatDate(iso)
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString(
    'en-IN',
    { hour: '2-digit', minute: '2-digit', hour12: false }
  )}`
}

// ── Geography ─────────────────────────────────────────────────────────────────

export function formatCoordinates(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

export function formatDistance(meters: number | null | undefined): string {
  if (meters == null || Number.isNaN(meters)) return '—'
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

/** Great-circle distance in metres. Used for review-queue proximity display. */
export function haversineMetres(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6_371_000
  const toRad = (v: number) => (v * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Severity ──────────────────────────────────────────────────────────────────

export interface SeverityMeta {
  label: string
  tone: Tone
  color: string
}

/**
 * Severity is a 1–10 integer from Agent 1. `is_emergency` overrides the band
 * because it is only ever set when the classifier saw immediate danger.
 */
export function severityMeta(severity: number | null | undefined, isEmergency?: boolean): SeverityMeta {
  const value = typeof severity === 'number' ? severity : 0
  if (isEmergency || value >= 9) return { label: 'Emergency', tone: 'red', color: TONE_COLOR.red }
  if (value >= 8) return { label: 'Critical', tone: 'red', color: TONE_COLOR.red }
  if (value >= 6) return { label: 'High', tone: 'amber', color: TONE_COLOR.amber }
  if (value >= 4) return { label: 'Moderate', tone: 'blue', color: TONE_COLOR.blue }
  if (value >= 1) return { label: 'Low', tone: 'slate', color: TONE_COLOR.slate }
  return { label: 'Unrated', tone: 'slate', color: TONE_COLOR.slate }
}

/** 0–1 fraction for severity meters. */
export function severityFraction(severity: number | null | undefined): number {
  const v = typeof severity === 'number' ? severity : 0
  return Math.max(0, Math.min(1, v / 10))
}

// ── SLA ───────────────────────────────────────────────────────────────────────

export interface SlaMeta {
  label: string
  tone: Tone
  overdue: boolean
  /** Hours remaining (negative when overdue). Null when there is no deadline. */
  hoursRemaining: number | null
}

/**
 * SLA countdown. Terminal states (resolved/closed) stop counting — a closed
 * issue is not "overdue", it is finished.
 */
export function slaMeta(
  deadline: string | null | undefined,
  status?: string | null
): SlaMeta {
  if (status === 'resolved') return { label: 'Resolved', tone: 'emerald', overdue: false, hoursRemaining: null }
  if (status === 'closed') return { label: 'Closed', tone: 'slate', overdue: false, hoursRemaining: null }
  if (!deadline) return { label: 'Awaiting SLA', tone: 'slate', overdue: false, hoursRemaining: null }

  const ms = new Date(deadline).getTime() - Date.now()
  if (Number.isNaN(ms)) return { label: 'Awaiting SLA', tone: 'slate', overdue: false, hoursRemaining: null }

  const hours = ms / 3_600_000
  if (hours < 0) {
    const overdue = Math.abs(hours)
    return {
      label: overdue < 24 ? `Overdue by ${Math.round(overdue)}h` : `Overdue by ${Math.round(overdue / 24)}d`,
      tone: 'red',
      overdue: true,
      hoursRemaining: hours,
    }
  }
  if (hours < 24) return { label: `${Math.max(1, Math.round(hours))}h left`, tone: 'amber', overdue: false, hoursRemaining: hours }
  return { label: `${Math.round(hours / 24)}d left`, tone: 'blue', overdue: false, hoursRemaining: hours }
}

// ── Karma (semantics copied from the web dashboard) ────────────────────────────

export interface KarmaLevel {
  name: string
  level: number
  min: number
  max: number
  next: string
}

export function karmaLevel(score: number | null | undefined): KarmaLevel {
  const s = typeof score === 'number' ? score : 0
  if (s >= 300) return { name: 'Civic Ambassador', level: 4, min: 300, max: 1000, next: 'Max level' }
  if (s >= 150) return { name: 'Civic Champion', level: 3, min: 150, max: 300, next: 'Civic Ambassador' }
  if (s >= 50) return { name: 'Civic Guardian', level: 2, min: 50, max: 150, next: 'Civic Champion' }
  return { name: 'Civic Observer', level: 1, min: 0, max: 50, next: 'Civic Guardian' }
}

/** 0–1 progress toward the next karma band. */
export function karmaProgress(score: number | null | undefined): number {
  const s = typeof score === 'number' ? score : 0
  const { min, max } = karmaLevel(s)
  if (max <= min) return 1
  return Math.max(0, Math.min(1, (s - min) / (max - min)))
}

// ── Misc ──────────────────────────────────────────────────────────────────────

export function titleCase(value: string | null | undefined): string {
  if (!value) return ''
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Colour for a credibility score (1–10) from Agent 3. */
export function credibilityMeta(score: number | null | undefined): { label: string; tone: Tone } {
  if (score == null) return { label: 'Pending', tone: 'slate' }
  if (score >= 8) return { label: `High · ${score}/10`, tone: 'emerald' }
  if (score >= 6) return { label: `Fair · ${score}/10`, tone: 'blue' }
  return { label: `Low · ${score}/10`, tone: 'amber' }
}

export const PLAIN = accent
