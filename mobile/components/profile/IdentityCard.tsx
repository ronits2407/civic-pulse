import React, { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated'

import { Avatar } from '@/components/ui/Avatar'
import { Card } from '@/components/ui/Card'
import { Text } from '@/theme/Typography'
import { karmaLevel, karmaProgress } from '@/lib/format'
import { accent, motion, radius, space, surface } from '@/theme/tokens'

/**
 * Who you are and where you stand, on navy. The karma bar fills on mount in kerb amber:
 * the one place outside the pipeline where the accent appears, because karma is earned
 * by the same work the agents track.
 */
export function IdentityCard({
  name,
  email,
  avatarUrl,
  karma,
  isAdmin,
}: {
  name: string | null
  email: string | null
  avatarUrl: string | null
  karma: number
  isAdmin: boolean
}) {
  const level = karmaLevel(karma)
  const progress = karmaProgress(karma)
  const fill = useSharedValue(0)
  useEffect(() => {
    fill.set(withDelay(200, withSpring(progress, { ...motion.softSpring, reduceMotion: ReduceMotion.System })))
  }, [progress, fill])
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }))

  return (
    <Card variant="hero" style={styles.card}>
      <View style={styles.row}>
        <Avatar name={name} uri={avatarUrl} size={64} />
        <View style={styles.flex}>
          <Text variant="title" tone="inverse" numberOfLines={1}>
            {name ?? 'Citizen'}
          </Text>
          <Text variant="caption" tone="inverseMuted" numberOfLines={1}>
            {email ?? 'Signed in'}
            {isAdmin ? '  ·  Municipal staff' : ''}
          </Text>
        </View>
      </View>

      <View style={styles.karma}>
        <View style={styles.karmaHead}>
          <View>
            <Text variant="caption" tone="inverseMuted">
              Civic standing
            </Text>
            <Text variant="heading" style={{ color: accent.kerb }}>
              {level.name}
            </Text>
          </View>
          <Text variant="hero" tone="inverse">
            {karma}
          </Text>
        </View>
        <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
          <Animated.View style={[styles.fill, fillStyle]} />
        </View>
        <Text variant="micro" tone="inverseMuted">
          {level.next === 'Max level' ? 'Top level reached' : `Level ${level.level} of 4  ·  ${level.max - karma} karma to ${level.next}`}
        </Text>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: space.xl, padding: space.xl, borderRadius: radius.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  flex: { flex: 1, gap: 2 },
  karma: { gap: space.sm },
  karmaHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: surface.heroRaised, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: accent.kerb },
})
