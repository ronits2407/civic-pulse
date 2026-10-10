import React, { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Text } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import type { RelaySession } from '@/hooks/useRelaySession'
import { ink, radius, space, surface } from '@/theme/tokens'

const LIVE = '#7BE0A6'

/** A ring that expands and fades from the broadcast icon while the relay is on. */
function Pulse({ on }: { on: boolean }) {
  const t = useSharedValue(0)
  useEffect(() => {
    t.set(
      on
        ? withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System }), -1, false)
        : 0
    )
  }, [on, t])
  const ring = useAnimatedStyle(() => ({ opacity: on ? 0.55 * (1 - t.value) : 0, transform: [{ scale: 1 + t.value * 1.3 }] }))
  return (
    <View style={styles.iconWrap}>
      <Animated.View style={[styles.ring, ring]} />
      <View style={[styles.icon, on && styles.iconOn]}>
        <Icon name={on ? 'broadcast' : 'broadcast-off'} size={26} color={on ? ink.base : ink.inverse} />
      </View>
    </View>
  )
}

/** The big on/off control plus live counts. Colour is never the only signal: the label says ON or OFF. */
export function RelayControl({ session }: { session: RelaySession }) {
  const { snapshot, busy } = session
  const on = snapshot.phase === 'running' || snapshot.phase === 'starting'
  const nearby = snapshot.nearby.length + snapshot.awaitingConsent.length

  return (
    <Card variant="hero" style={styles.card}>
      <View style={styles.row}>
        <Pulse on={on} />
        <View style={styles.flex}>
          <Text variant="heading" tone="inverse" accessibilityRole="header">
            {on ? 'Relay is ON' : 'Relay is OFF'}
          </Text>
          <Text variant="caption" tone="inverseMuted">
            {on ? 'Visible session. Leaving the app turns it off after 30 seconds.' : 'You will not receive or pass on nearby alerts.'}
          </Text>
        </View>
      </View>

      <View style={styles.stats}>
        <Stat label="Nearby" value={on ? nearby : 0} />
        <View style={styles.rule} />
        <Stat label="Connected" value={on ? snapshot.connected.length : 0} highlight={snapshot.connected.length > 0} />
        <View style={styles.rule} />
        <Stat label="Queued" value={snapshot.pendingTransfers} />
      </View>

      <Button
        label={on ? 'Turn relay off' : 'Turn relay on'}
        variant={on ? 'secondary' : 'subtle'}
        size="lg"
        fullWidth
        loading={busy}
        disabled={!session.supported}
        icon={<Icon name={on ? 'broadcast-off' : 'broadcast'} size={20} color={ink.base} />}
        onPress={() => void (on ? session.stop() : session.start())}
        accessibilityLabel={on ? 'Turn the emergency relay off' : 'Turn the emergency relay on'}
      />
    </Card>
  )
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text variant="dataLg" style={{ color: highlight ? LIVE : ink.inverse }}>
        {value}
      </Text>
      <Text variant="caption" tone="inverseMuted">
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  card: { gap: space.xl, padding: space.xl, borderRadius: radius.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  iconWrap: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 56, height: 56, borderRadius: 28, backgroundColor: LIVE },
  icon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: surface.heroRaised },
  iconOn: { backgroundColor: LIVE },
  stats: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  rule: { width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.14)' },
})
