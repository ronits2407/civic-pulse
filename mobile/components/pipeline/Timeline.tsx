import React from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated from 'react-native-reanimated'

import { rise } from '@/components/ui/Motion'
import { Text } from '@/theme/Typography'
import { Icon, type IconName } from '@/theme/icons'
import { getRail, type PipelineNodeState } from '@/lib/pipeline'
import { accent, ink, radius, space, surface } from '@/theme/tokens'

/**
 * Vertical agent timeline for the issue detail screen: the same data as the rail, with
 * each agent's plain-language job and an explicit state word, so the state never
 * depends on colour alone.
 */

const STATE: Record<PipelineNodeState, { word: string; icon: IconName; fg: string; bg: string }> = {
  done: { word: 'Done', icon: 'check', fg: ink.inverse, bg: ink.base },
  active: { word: 'Working', icon: 'dots-horizontal', fg: ink.base, bg: accent.kerb },
  pending: { word: 'Waiting', icon: 'clock-outline', fg: ink.faint, bg: surface.raised },
  failed: { word: 'Failed', icon: 'close', fg: ink.inverse, bg: accent.red },
  skipped: { word: 'Skipped', icon: 'minus', fg: ink.faint, bg: surface.raised },
}

export function Timeline({
  stage,
  isDuplicate = false,
  style,
}: {
  stage: string | null | undefined
  isDuplicate?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const rail = getRail(stage, isDuplicate)
  return (
    <View style={style}>
      {rail.map((entry, index) => {
        const s = STATE[entry.state]
        const last = index === rail.length - 1
        return (
          <Animated.View key={entry.node.stage} entering={rise(index)} style={styles.row}>
            <View style={styles.gutter}>
              <View style={[styles.badge, { backgroundColor: s.bg }]}>
                <Icon name={s.icon} size={14} color={s.fg} />
              </View>
              {!last ? (
                <View style={[styles.connector, entry.state === 'done' && styles.connectorDone]} />
              ) : null}
            </View>
            <View style={styles.body}>
              <View style={styles.header}>
                <Text variant="bodyTight" weight="semibold" numberOfLines={1} style={styles.title}>
                  {entry.node.title}
                </Text>
                <Text
                  variant="micro"
                  weight="bold"
                  style={{ color: entry.state === 'active' ? accent.amber : entry.state === 'failed' ? accent.red : ink.faint }}
                >
                  {s.word}
                </Text>
              </View>
              <Text variant="caption" tone="muted" style={styles.detail}>
                {entry.node.detail}
              </Text>
            </View>
          </Animated.View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  gutter: { alignItems: 'center', width: 28 },
  badge: { width: 28, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  connector: { width: 2, flex: 1, backgroundColor: '#E7E4DD', marginVertical: 4, borderRadius: 1 },
  connectorDone: { backgroundColor: ink.base },
  body: { flex: 1, paddingBottom: space.lg, paddingTop: 3 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  title: { flex: 1 },
  detail: { marginTop: 2, lineHeight: 18 },
})
