import React from 'react'
import { StyleSheet, View } from 'react-native'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { Text } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import type { RelaySession } from '@/hooks/useRelaySession'
import type { PeerView } from '@/lib/mesh/peers'
import { accent, space, TONE_COLOR, TONE_TINT } from '@/theme/tokens'

/**
 * Consent prompts. Nothing is exchanged with an unfamiliar phone until the user taps Allow.
 * The label is derived from a pseudonymous id: it names a phone, never a person.
 */
export function PeerPrompts({ session }: { session: RelaySession }) {
  const { snapshot, allowPeer, blockPeer } = session
  if (snapshot.awaitingConsent.length === 0) return null

  return (
    <View style={styles.list}>
      <Text variant="label" weight="semibold" tone="muted">
        NEARBY PHONES ASKING TO CONNECT
      </Text>
      {snapshot.awaitingConsent.map((peer) => (
        <PeerCard key={peer.endpointId} peer={peer} onAllow={() => void allowPeer(peer.endpointId)} onBlock={() => void blockPeer(peer.endpointId)} />
      ))}
    </View>
  )
}

function PeerCard({ peer, onAllow, onBlock }: { peer: PeerView; onAllow: () => void; onBlock: () => void }) {
  return (
    <Card accentColor={accent.amberSoft} style={styles.card}>
      <View style={styles.head}>
        <Icon name="cellphone-wireless" size={20} color={accent.amberSoft} />
        <View style={styles.flex}>
          <Text variant="bodyTight" weight="semibold">
            {peer.label} wants to connect
          </Text>
          <Text variant="caption" tone="muted">
            An unfamiliar CivicPulse phone is nearby. If you allow it, you will exchange short
            community hazard alerts with it. Nothing about you is shared.
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Button label="Allow" size="md" onPress={onAllow} style={styles.flex} accessibilityLabel={`Allow ${peer.label}`} />
        <Button label="Block" size="md" variant="danger" onPress={onBlock} style={styles.flex} accessibilityLabel={`Block ${peer.label}`} />
      </View>
    </Card>
  )
}

/** Connected phones. Shown so a demo audience can see exactly who the relay is talking to. */
export function ConnectedPeers({ session }: { session: RelaySession }) {
  const { connected } = session.snapshot
  if (connected.length === 0) return null
  return (
    <View style={styles.row}>
      {connected.map((peer) => (
        <Chip
          key={peer.endpointId}
          label={peer.ready ? `${peer.label} · synced` : `${peer.label} · syncing`}
          color={TONE_COLOR[peer.ready ? 'emerald' : 'amber']}
          tint={TONE_TINT[peer.ready ? 'emerald' : 'amber']}
          icon={<Icon name="cellphone-wireless" size={13} color={TONE_COLOR[peer.ready ? 'emerald' : 'amber']} />}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: space.sm },
  card: { gap: space.md },
  head: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  actions: { flexDirection: 'row', gap: space.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
})
