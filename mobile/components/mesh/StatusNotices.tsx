import React from 'react'
import { Linking, StyleSheet, View } from 'react-native'

import { Notice } from '@/components/ui/Feedback'
import { Icon } from '@/theme/icons'
import type { RelaySession } from '@/hooks/useRelaySession'
import type { TransportErrorCode } from '@/lib/mesh/transport'
import { accent, space } from '@/theme/tokens'

/** What a transport failure means to a citizen, and what they can do about it. */
const ERROR_COPY: Record<TransportErrorCode, { title: string; body: string }> = {
  permission_denied: {
    title: 'Nearby permission needed',
    body: 'Allow Nearby devices (and Location on older Android) in Settings, then turn the relay on again.',
  },
  radio_unavailable: {
    title: 'Bluetooth or Wi-Fi is off',
    body: 'Turn on Bluetooth and Wi-Fi. They do not need an internet connection, only the radios.',
  },
  play_services_missing: {
    title: 'Google Play services is required',
    body: 'Nearby sharing uses Google Play services, which this phone does not have or has disabled.',
  },
  unsupported_platform: { title: 'Not available here', body: 'The emergency network works on Android phones only.' },
  start_failed: { title: 'Could not start the relay', body: 'Check Bluetooth, Wi-Fi and Location, then try again.' },
  connect_failed: { title: 'Could not reach a nearby phone', body: 'It retries automatically while the relay is on.' },
  connect_timeout: { title: 'A nearby phone did not answer', body: 'It retries automatically while the relay is on.' },
  send_failed: { title: 'A transfer did not go through', body: 'It stays queued and will be retried.' },
}

const openSettings = () => void Linking.openSettings()

/** Permission, radio and transport problems, each with a concrete next step. */
export function StatusNotices({ session }: { session: RelaySession }) {
  const { permission, snapshot, notificationsAllowed, supported, expoGo } = session
  const error = snapshot.error
  const on = snapshot.phase === 'running'
  const warn = <Icon name="alert-outline" size={16} color={accent.amberSoft} />

  return (
    <View style={styles.notices}>
      {expoGo ? (
        <Notice
          tone="amber"
          title="Needs the CivicPulse app build"
          body="Expo Go cannot run nearby sharing. Install the CivicPulse APK (a development or release build) on this phone to use the relay."
          icon={warn}
        />
      ) : null}
      {!supported && !expoGo ? (
        <Notice tone="amber" title="Android only" body="The Neighborhood Emergency Network is not available on this device." icon={warn} />
      ) : null}
      {permission?.state === 'denied' ? (
        <Notice
          tone="red"
          title="Nearby permission needed"
          body={`Missing: ${permission.missing.join(', ')}. ${
            permission.canAskAgain ? 'Tap Turn relay on to be asked again.' : 'Open Settings and allow them.'
          }`}
          icon={warn}
          actionLabel={permission.canAskAgain ? undefined : 'Open Settings'}
          onAction={permission.canAskAgain ? undefined : openSettings}
        />
      ) : null}
      {permission?.state === 'location_services_off' ? (
        <Notice
          tone="amber"
          title="Turn on Location"
          body="This Android version needs the Location switch on to find nearby phones. Your position is not shared."
          icon={warn}
          actionLabel="Open Settings"
          onAction={openSettings}
        />
      ) : null}
      {error ? (
        <Notice tone={on ? 'amber' : 'red'} title={ERROR_COPY[error.code].title} body={ERROR_COPY[error.code].body} icon={warn} />
      ) : null}
      {notificationsAllowed === false ? (
        <Notice
          tone="amber"
          title="Notifications are off"
          body="Alerts still appear in the list below, but this phone will not ring or vibrate."
          icon={warn}
          actionLabel="Open Settings"
          onAction={openSettings}
        />
      ) : null}
      {!on ? (
        <Notice
          tone="slate"
          title="Not connected to anyone"
          body="Alerts you create are saved on this phone and sent when the relay is on and a nearby phone is connected. Nothing here has reached a server."
          icon={<Icon name="information-outline" size={16} color={accent.slate} />}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({ notices: { gap: space.sm } })
