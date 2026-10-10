import type { TransportErrorCode } from '@/lib/mesh/transport'

/** Best-effort mapping of a Nearby failure message to something the UI can explain. */
export function classifyFailure(error: unknown, fallback: TransportErrorCode): TransportErrorCode {
  const text = error instanceof Error ? error.message : String(error)
  if (/PERMISSION/i.test(text)) return 'permission_denied'
  if (/RADIO|BLUETOOTH|WIFI|WI-FI|LOCATION/i.test(text)) return 'radio_unavailable'
  return fallback
}

/** Starting a mode that is already running is not a failure for our purposes. */
export function isAlreadyActive(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error)
  return /ALREADY_(ADVERTISING|DISCOVERING)|STATUS_ALREADY/i.test(text)
}
