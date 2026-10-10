import React from 'react'
import { StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'

import { Avatar } from '@/components/ui/Avatar'
import { rise } from '@/components/ui/Motion'
import { Text } from '@/theme/Typography'
import { ink, radius, space, surface } from '@/theme/tokens'

export interface PodiumEntry {
  id: string
  name: string
  picture: string | null
  karma_score: number
}

/** Column heights follow rank, so the order reads at a glance: second, first, third. */
const HEIGHT = [118, 86, 64]
const ORDER = [1, 0, 2]

export function Podium({ entries, meId }: { entries: PodiumEntry[]; meId: string | null }) {
  const top = entries.slice(0, 3)
  if (top.length === 0) return null
  return (
    <View style={styles.row} accessibilityLabel={`Top ${top.length}: ${top.map((e, i) => `${i + 1}. ${e.name}, ${e.karma_score} karma`).join('; ')}`}>
      {ORDER.filter((i) => top[i]).map((i, n) => {
        const e = top[i]
        const first = i === 0
        return (
          <Animated.View key={e.id} entering={rise(n + 1)} style={styles.col}>
            <Avatar name={e.name} uri={e.picture} size={first ? 64 : 52} />
            <Text variant="label" weight="semibold" numberOfLines={1} center style={styles.name}>
              {e.id === meId ? 'You' : e.name.split(' ')[0]}
            </Text>
            <Text variant="data" tone="muted">
              {e.karma_score}
            </Text>
            <View style={[styles.block, { height: HEIGHT[i] }, first && styles.blockFirst]}>
              <Text variant="display" tone={first ? 'inverse' : 'base'}>
                {i + 1}
              </Text>
            </View>
          </Animated.View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, paddingTop: space.md },
  col: { flex: 1, alignItems: 'center', gap: 4 },
  name: { maxWidth: '100%' },
  block: {
    alignSelf: 'stretch',
    marginTop: space.sm,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    backgroundColor: surface.mist,
    alignItems: 'center',
    paddingTop: space.md,
  },
  blockFirst: { backgroundColor: ink.base },
})
