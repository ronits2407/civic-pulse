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
  line,
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
  /** Uppercase micro caps for terse markers like the pipeline stage badges. */
  dense?: boolean
}

export function Chip({ label, color, tint, icon, style, dense = false }: ChipProps) {
  const resolvedColor = color ?? line.strong
  const resolvedTint = tint ?? 'rgba(148,163,184,0.12)'

  return (
    <View
      style={[
        styles.chip,
        dense && styles.chipDense,
        { backgroundColor: resolvedTint, borderColor: resolvedColor + '44' },
        style,
      ]}
    >
      {icon}
      <Text
        variant={dense ? 'micro' : 'caption'}
        weight="semibold"
        style={{ color: resolvedColor }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  )
}

/** Status pill driven by the raw backend status value. */
export function StatusPill({ status, dense }: { status: string | null | undefined; dense?: boolean }) {
  const meta = (status && STATUS_META[status]) || UNKNOWN_STATUS
  const tone: Tone = meta.tone
  return (
    <Chip label={meta.label} color={TONE_COLOR[tone]} tint={TONE_TINT[tone]} dense={dense} />
  )
}

/** Category pill driven by the taxonomy the classifier writes. */
export function CategoryChip({
  category,
  dense,
}: {
  category: string | null | undefined
  dense?: boolean
}) {
  const meta = (category && CATEGORY_META[category]) || FALLBACK_CATEGORY
  return <Chip label={meta.label} color={meta.color} tint={meta.tint} dense={dense} />
}

/**
 * Neutral label/value pair used in detail grids.
 * Values render in the mono face so figures line up column-to-column.
 */
export function MetaItem({
  label,
  value,
  tone = 'base',
  numeric = false,
}: {
  label: string
  value: string
  tone?: 'base' | 'muted' | 'faint' | string
  numeric?: boolean
}) {
  return (
    <View style={styles.metaItem}>
      <Text variant="micro" weight="medium" tone="faint">
        {label}
      </Text>
      <Text variant={numeric ? 'data' : 'bodyTight'} weight="medium" tone={tone} numberOfLines={2}>
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  chipDense: { paddingHorizontal: 6, paddingVertical: 2 },
  metaItem: { gap: 2, minWidth: 96 },
})
