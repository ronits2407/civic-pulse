import type { DeliveryState } from '@/lib/mesh/alerts'
import type { AlertSeverity, AlertType } from '@/lib/mesh/protocol'
import type { IconName } from '@/theme/icons'
import type { Tone } from '@/theme/tokens'

/** Presentation vocabulary for the Neighborhood Emergency Network screen. */

export const TYPE_LABEL: Record<AlertType, string> = {
  sos: 'SOS',
  flood: 'Flood',
  fire: 'Fire',
  road_hazard: 'Road hazard',
  gas_leak: 'Gas leak',
}

export const TYPE_ICON: Record<AlertType, IconName> = {
  sos: 'alert-octagon-outline',
  flood: 'waves',
  fire: 'fire',
  road_hazard: 'car-brake-alert',
  gas_leak: 'gas-cylinder',
}

export const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  advisory: 'Advisory',
  warning: 'Warning',
  critical: 'Critical',
}

export const SEVERITY_TONE: Record<AlertSeverity, Tone> = {
  advisory: 'blue',
  warning: 'amber',
  critical: 'red',
}

/** Hazards a citizen can report. SOS is a separate, deliberately harder-to-trigger action. */
export const HAZARD_TYPES: AlertType[] = ['flood', 'fire', 'road_hazard', 'gas_leak']

export const HAZARD_SEVERITIES: AlertSeverity[] = ['advisory', 'warning', 'critical']

export const STATE_TONE: Record<DeliveryState, Tone> = {
  created_locally: 'slate',
  stored_locally: 'amber',
  received_from_peer: 'blue',
  forwarding_pending: 'amber',
  transmitted_to_peer: 'emerald',
  expired: 'slate',
}

/**
 * Short, honest labels. "Confirmed by a nearby phone" is shown only when that phone replied
 * that it stored the alert. Nothing here says "delivered to everyone" and nothing says the
 * server has it, because neither can be known.
 */
export const STATE_SHORT: Record<DeliveryState, string> = {
  created_locally: 'Created here',
  stored_locally: 'Saved here only',
  received_from_peer: 'From a nearby phone',
  forwarding_pending: 'Waiting to send',
  transmitted_to_peer: 'Confirmed by a nearby phone',
  expired: 'Expired',
}

export const REJECT_MESSAGE: Record<string, string> = {
  relay_off: 'Turn the relay on first.',
  rate_limited: 'You have reached the hourly alert limit. Try again later.',
  sos_cooldown: 'An SOS was sent a moment ago. Wait a minute before sending another.',
  duplicate: 'That alert was already created.',
  bad_summary: 'Add a short description (up to 140 characters, no special characters).',
}
