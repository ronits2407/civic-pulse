import React from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import { Text } from '@/theme/Typography'
import {
  CATEGORY_META,
  FALLBACK_CATEGORY,
  STATUS_META,
  TONE_COLOR,
  TONE_TINT,
  UNKNOWN_STATUS,
  ink,
  radius,
  space,
  type Tone,
} from '@/theme/tokens'

/** Small, information-carrying pill. Colour always means the same thing. */
export interface ChipProps {
  label: string
  color?: string
  tint?: string
  icon?: React.ReactNode
  style?: StyleProp<ViewStyle>
  dense?: boolean
}

export function Chip({ label, color, tint, icon, style, dense = false }: ChipProps) {
  return (
    <View style={[styles.chip, dense && styles.dense, { backgroundColor: tint ?? '#ECEDF1' }, style]}>
      {icon}
      <Text variant={dense ? 'micro' : 'caption'} weight="semibold" style={{ color: color ?? ink.muted }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

/** Status pill, with a dot so it never depends on colour alone. */
export function StatusPill({ status, dense }: { status: string | null | undefined; dense?: boolean }) {
  const meta = (status && STATUS_META[status]) || UNKNOWN_STATUS
  const tone: Tone = meta.tone
  return (
    <Chip
      label={meta.label}
      color={TONE_COLOR[tone]}
      tint={TONE_TINT[tone]}
      dense={dense}
      icon={<View style={[styles.dot, { backgroundColor: TONE_COLOR[tone] }]} />}
    />
  )
}

export function CategoryChip({ category, dense }: { category: string | null | undefined; dense?: boolean }) {
  const meta = (category && CATEGORY_META[category]) || FALLBACK_CATEGORY
  return <Chip label={meta.label} color={meta.color} tint={meta.tint} dense={dense} />
}

/** Label above value. Figures render in the display face so they line up. */
export function MetaItem({ label, value, tone = 'base', numeric = false }: { label: string; value: string; tone?: string; numeric?: boolean }) {
  return (
    <View style={styles.metaItem}>
      <Text variant="caption" tone="faint">
        {label}
      </Text>
      <Text variant={numeric ? 'data' : 'bodyTight'} weight="semibold" tone={tone} numberOfLines={2}>
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  dense: { paddingHorizontal: 10, paddingVertical: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  metaItem: { gap: 2, minWidth: 96 },
})
