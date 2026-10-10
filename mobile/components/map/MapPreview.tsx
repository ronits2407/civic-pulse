import React from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { FadeInDown, FadeOutDown, ReduceMotion } from 'react-native-reanimated'
import { Image } from 'expo-image'

import { StatusPill } from '@/components/ui/Chip'
import { PressableScale } from '@/components/ui/PressableScale'
import { Text } from '@/theme/Typography'
import { CATEGORY_ICON, FALLBACK_CATEGORY_ICON, Icon } from '@/theme/icons'
import { formatDistance, timeAgo } from '@/lib/format'
import { CATEGORY_META, FALLBACK_CATEGORY, ink, motion, radius, shadow, space, surface } from '@/theme/tokens'

export interface PreviewIssue {
  id: string
  title: string | null
  category: string | null
  status: string | null
  address: string | null
  created_at: string
  photo_url?: string | null
  distanceMetres?: number | null
}

const enter = FadeInDown.springify().damping(motion.spring.damping).reduceMotion(ReduceMotion.System)
const exit = FadeOutDown.duration(motion.fast).reduceMotion(ReduceMotion.System)

/** Floating card for the selected pin. Rises in from the bottom; tap opens the report. */
export function MapPreview({ issue, onOpen, onClose }: { issue: PreviewIssue; onOpen: () => void; onClose: () => void }) {
  const meta = (issue.category && CATEGORY_META[issue.category]) || FALLBACK_CATEGORY
  const icon = (issue.category && CATEGORY_ICON[issue.category]) || FALLBACK_CATEGORY_ICON
  return (
    <Animated.View entering={enter} exiting={exit} style={[styles.sheet, shadow.float]}>
      <PressableScale onPress={onOpen} haptic="tap" accessibilityRole="button" accessibilityLabel={`Open ${issue.title ?? 'report'}`}>
        <View style={styles.row}>
          {issue.photo_url ? (
            <Image source={{ uri: issue.photo_url }} style={styles.thumb} contentFit="cover" transition={150} alt="Photo attached to the report" />
          ) : (
            <View style={[styles.thumb, styles.thumbIcon, { backgroundColor: meta.tint }]}>
              <Icon name={icon} size={24} color={meta.color} />
            </View>
          )}
          <View style={styles.body}>
            <Text variant="caption" weight="semibold" style={{ color: meta.color }}>
              {meta.label}
              {issue.distanceMetres != null ? `  \u00b7  ${formatDistance(issue.distanceMetres)} away` : ''}
            </Text>
            <Text variant="heading" numberOfLines={2}>
              {issue.title?.trim() || 'Untitled report'}
            </Text>
            <View style={styles.meta}>
              <StatusPill status={issue.status} dense />
              <Text variant="caption" tone="faint">
                {timeAgo(issue.created_at)}
              </Text>
            </View>
          </View>
          <View style={styles.arrow}>
            <Icon name="arrow-right" size={20} color={ink.inverse} />
          </View>
        </View>
      </PressableScale>
      <PressableScale onPress={onClose} haptic="tap" accessibilityRole="button" accessibilityLabel="Close preview" style={styles.close}>
        <Icon name="close" size={16} color={ink.muted} />
      </PressableScale>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: surface.card, borderRadius: radius.xl, padding: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  thumb: { width: 72, height: 72, borderRadius: radius.md },
  thumbIcon: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 3 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  arrow: { width: 44, height: 44, borderRadius: 22, backgroundColor: ink.base, alignItems: 'center', justifyContent: 'center' },
  close: { position: 'absolute', top: 8, right: 8, padding: 6 },
})
