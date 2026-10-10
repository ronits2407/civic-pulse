import React, { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { AlertFeed } from '@/components/mesh/AlertFeed'
import { HazardSheet } from '@/components/mesh/HazardSheet'
import { ConnectedPeers, PeerPrompts } from '@/components/mesh/PeerPrompts'
import { RelayControl } from '@/components/mesh/RelayControl'
import { SosSheet } from '@/components/mesh/SosSheet'
import { StatusNotices } from '@/components/mesh/StatusNotices'
import { Notice } from '@/components/ui/Feedback'
import { Screen } from '@/components/ui/Screen'
import { TopBar } from '@/components/ui/TopBar'
import { Rise } from '@/components/ui/Motion'
import { PressableScale } from '@/components/ui/PressableScale'
import { Text } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import { useRelaySession } from '@/hooks/useRelaySession'
import { TONE_TINT, accent, ink, radius, space } from '@/theme/tokens'

/**
 * Neighborhood Emergency Network.
 *
 * An explicitly started, visible, foreground relay session. It works with no internet:
 * everything on this screen runs over Bluetooth / Wi-Fi Direct between nearby phones.
 * It is an alert system, not a chat: there is no free-form composer and no inbox.
 */
export default function EmergencyNetworkScreen() {
  const session = useRelaySession()
  const [sosOpen, setSosOpen] = useState(false)
  const [hazardOpen, setHazardOpen] = useState(false)
  const on = session.snapshot.phase === 'running'

  return (
    <Screen scroll padded edges={['top', 'bottom']} contentContainerStyle={styles.content}>
      <TopBar title="Offline alerts" subtitle="Pass hazard alerts between nearby phones when there is no internet. These are community reports, not official warnings." />

      <Rise index={0}>
        <RelayControl session={session} />
      </Rise>
      <StatusNotices session={session} />
      <PeerPrompts session={session} />
      <ConnectedPeers session={session} />

      <Rise index={1} style={styles.actions}>
        <PressableScale onPress={() => setSosOpen(true)} haptic="press" accessibilityRole="button" accessibilityLabel="Send an SOS to nearby phones" style={styles.flex}>
          <View style={[styles.tile, styles.sosTile]}>
            <Icon name="alert-octagon" size={30} color={ink.inverse} />
            <Text variant="title" tone="inverse">SOS</Text>
            <Text variant="caption" tone="inverseMuted">Ask nearby phones for help</Text>
          </View>
        </PressableScale>
        <PressableScale onPress={() => setHazardOpen(true)} haptic="press" accessibilityRole="button" accessibilityLabel="Report a hazard nearby" style={styles.flex}>
          <View style={[styles.tile, styles.hazardTile]}>
            <Icon name="shield-alert-outline" size={30} color={accent.amberSoft} />
            <Text variant="title">Hazard</Text>
            <Text variant="caption" tone="muted">Warn people near you</Text>
          </View>
        </PressableScale>
      </Rise>
      {!on ? (
        <Text variant="caption" style={{ color: accent.amberSoft }}>
          The relay is off. An alert you create now stays on this phone until the relay is on and a nearby phone connects.
        </Text>
      ) : null}

      <Text variant="heading">Alerts on this phone</Text>
      <AlertFeed items={session.feed} />

      <Notice
        tone="blue"
        title="What this does and does not tell you"
        body="'Confirmed by a nearby phone' means that phone replied that it saved the alert. It does not mean everyone nearby has it, and nothing here has been sent to a server."
        icon={<Icon name="information-outline" size={16} color={accent.blue} />}
      />

      <SosSheet visible={sosOpen} relayOn={on} onClose={() => setSosOpen(false)} onSend={session.createAlert} />
      <HazardSheet visible={hazardOpen} onClose={() => setHazardOpen(false)} onSend={session.createAlert} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { gap: space.lg, paddingBottom: space.huge },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: space.md },
  tile: { borderRadius: radius.xl, padding: space.lg, gap: space.xs, minHeight: 150, justifyContent: 'flex-end' },
  sosTile: { backgroundColor: accent.red },
  hazardTile: { backgroundColor: TONE_TINT.amber },
})
