import React, { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { AlertFeed } from '@/components/mesh/AlertFeed'
import { HazardSheet } from '@/components/mesh/HazardSheet'
import { ConnectedPeers, PeerPrompts } from '@/components/mesh/PeerPrompts'
import { RelayControl } from '@/components/mesh/RelayControl'
import { SosSheet } from '@/components/mesh/SosSheet'
import { StatusNotices } from '@/components/mesh/StatusNotices'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Feedback'
import { Screen } from '@/components/ui/Screen'
import { Text } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import { useRelaySession } from '@/hooks/useRelaySession'
import { accent, space } from '@/theme/tokens'

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
    <Screen scroll padded contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          Neighborhood Emergency Network
        </Text>
        <Text variant="caption" tone="muted">
          Pass hazard alerts between nearby phones when there is no internet. Community reports,
          not official warnings.
        </Text>
      </View>

      <RelayControl session={session} />
      <StatusNotices session={session} />
      <PeerPrompts session={session} />
      <ConnectedPeers session={session} />

      <View style={styles.actions}>
        <Button
          label="SOS"
          size="lg"
          fullWidth
          icon={<Icon name="alert-octagon-outline" size={22} color="#ffffff" />}
          onPress={() => setSosOpen(true)}
          style={styles.sos}
          accessibilityLabel="Send an SOS to nearby phones"
        />
        <Button
          label="Report a hazard nearby"
          variant="secondary"
          size="lg"
          fullWidth
          icon={<Icon name="shield-alert-outline" size={20} color={accent.amberSoft} />}
          onPress={() => setHazardOpen(true)}
        />
        {!on ? (
          <Text variant="caption" style={{ color: accent.amberSoft }}>
            The relay is off. An alert you create now is saved on this phone only until the relay
            is on and a nearby phone is connected.
          </Text>
        ) : null}
      </View>

      <Text variant="label" weight="semibold" tone="muted">
        ALERTS ON THIS PHONE
      </Text>
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
  header: { gap: space.xs },
  actions: { gap: space.md },
  sos: { backgroundColor: accent.red, borderColor: accent.red },
})
