import React from 'react'
import { StyleSheet, View } from 'react-native'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Text } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import type { RelaySession } from '@/hooks/useRelaySession'
import { accent, ink, radius, space } from '@/theme/tokens'

/** The big on/off control plus live counts. Colour is never the only signal: the label says ON or OFF. */
export function RelayControl({ session }: { session: RelaySession }) {
  const { snapshot, busy } = session
  const on = snapshot.phase === 'running' || snapshot.phase === 'starting'
  const nearby = snapshot.nearby.length + snapshot.awaitingConsent.length

  return (
    <Card style={[styles.card, on && styles.cardOn]}>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: on ? accent.emerald : ink.faint }]} />
        <View style={styles.flex}>
          <Text variant="heading" weight="semibold" accessibilityRole="header">
            {on ? 'Relay is ON' : 'Relay is OFF'}
          </Text>
          <Text variant="caption" tone="muted">
            {on
              ? 'Visible foreground session. Closing this screen turns it off.'
              : 'You will not receive or pass on nearby alerts.'}
          </Text>
        </View>
      </View>

      <View style={styles.stats}>
        <Stat label="NEARBY" value={on ? nearby : 0} />
        <Stat label="CONNECTED" value={on ? snapshot.connected.length : 0} highlight={snapshot.connected.length > 0} />
        <Stat label="QUEUED" value={snapshot.pendingTransfers} />
      </View>

      <Button
        label={on ? 'Turn relay off' : 'Turn relay on'}
        variant={on ? 'secondary' : 'primary'}
        size="lg"
        fullWidth
        loading={busy}
        disabled={!session.supported}
        icon={<Icon name={on ? 'broadcast-off' : 'broadcast'} size={20} color={on ? ink.base : '#ffffff'} />}
        onPress={() => void (on ? session.stop() : session.start())}
        accessibilityLabel={on ? 'Turn the emergency relay off' : 'Turn the emergency relay on'}
      />
    </Card>
  )
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text variant="dataLg" weight="semibold" mono style={highlight ? { color: accent.emerald } : undefined}>
        {value}
      </Text>
      <Text variant="micro" weight="medium" tone="faint">
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  card: { gap: space.lg },
  cardOn: { borderColor: 'rgba(52,211,153,0.45)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dot: { width: 12, height: 12, borderRadius: radius.pill },
  stats: { flexDirection: 'row', gap: space.xl },
  stat: { gap: 2, minWidth: 72 },
})
