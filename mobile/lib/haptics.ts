import * as Haptics from 'expo-haptics'
import { Platform } from 'react-native'

/**
 * Haptics are a garnish, never a signal. Every call is fire-and-forget and silent
 * on failure — a device without a vibrator (or with the user's system haptics off)
 * must not produce console noise or a dropped frame.
 */

const enabled = Platform.OS === 'android' || Platform.OS === 'ios'

function run(fn: () => Promise<void>) {
  if (!enabled) return
  fn().catch(() => {})
}

export const haptics = {
  /** Light tick — selecting a chip, toggling a control. */
  tap: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Firmer press — committing an action such as opening the report flow. */
  press: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Success — report accepted by the server. */
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Warning — a recoverable problem, e.g. permission denied. */
  warn: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** Failure — a request that could not be completed. */
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  /** Long form tick, for sheet open/close. */
  select: () => run(() => Haptics.selectionAsync()),
}
