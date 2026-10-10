import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

import type { AlertType, MeshAlert } from '@/lib/mesh/protocol'

/**
 * Local notifications for received alerts.
 *
 * Everything shown comes from a closed vocabulary except the summary, and the summary has
 * already passed validateSummary() (length-bounded, no control or bidi characters). The
 * notification carries only the alert id as data, so tapping it can never trigger an
 * action chosen by a peer.
 */

export const MESH_CHANNEL_ID = 'mesh-alerts'

const TITLES: Record<AlertType, string> = {
  sos: 'SOS from a nearby phone',
  flood: 'Flood reported nearby',
  fire: 'Fire reported nearby',
  road_hazard: 'Road hazard reported nearby',
  gas_leak: 'Gas leak reported nearby',
}

let configured = false

export async function configureNotifications(): Promise<void> {
  if (configured) return
  configured = true
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  })
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(MESH_CHANNEL_ID, {
      name: 'Nearby emergency alerts',
      description: 'Alerts relayed by phones near you. Community reports, not official warnings.',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    })
  }
}

/** Ask for permission to notify. Returns false if the user declined; the feed still works. */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync()
    if (current.granted) return true
    if (!current.canAskAgain) return false
    return (await Notifications.requestPermissionsAsync()).granted
  } catch {
    return false
  }
}

/** Show one notification. Failures are swallowed: a missing notification must not break relaying. */
export async function showAlertNotification(alert: MeshAlert): Promise<void> {
  try {
    await configureNotifications()
    await Notifications.scheduleNotificationAsync({
      identifier: `mesh-${alert.id}`, // same id again replaces rather than duplicates
      content: {
        title: TITLES[alert.type],
        body: `${alert.summary}\nUnverified community report from a nearby phone.`,
        data: { alertId: alert.id },
        sound: true,
      },
      trigger: { channelId: MESH_CHANNEL_ID },
    })
  } catch {
    // Notification permission denied or channel unavailable: the alert is still in the feed.
  }
}
