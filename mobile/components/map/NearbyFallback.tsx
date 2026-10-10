import React from 'react'
import { StyleSheet, View } from 'react-native'

import { StatusPill } from '@/components/ui/Chip'
import { PressableScale } from '@/components/ui/PressableScale'
import { Text } from '@/theme/Typography'
import { CATEGORY_ICON, FALLBACK_CATEGORY_ICON, Icon } from '@/theme/icons'
import { formatDistance } from '@/lib/format'
import { CATEGORY_META, FALLBACK_CATEGORY, line, space } from '@/theme/tokens'

/**
 * Map fallback: a distance-ordered list of nearby reports.
 *
 * When the Maps SDK is unavailable (no key configured, or the native module is absent
 * in the current build) the screen must still do its job. This is not a placeholder
 * graphic — it is the same nearby-issue data the markers would have shown, ordered by
 * how close each one is, which is the question a citizen actually has.
 */

export interface FallbackItem {
  id: string
  title: string | null
  category: string | null
  status: string | null
  distanceMetres: number | null
}

export function NearbyFallback({
  items,
  onSelect,
  maxItems = 6,
}: {
  items: FallbackItem[]
  onSelect: (id: string) => void
  maxItems?: number
}) {
  const shown = items.slice(0, maxItems)

  if (shown.length === 0) {
    return (
      <View style={styles.empty}>
        <Text variant="bodyTight" tone="muted" center>
          No other reports have been filed near you yet.
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.list}>
      {shown.map((item, index) => {
        const meta = (item.category && CATEGORY_META[item.category]) || FALLBACK_CATEGORY
        const icon = (item.category && CATEGORY_ICON[item.category]) || FALLBACK_CATEGORY_ICON
        return (
          <PressableScale
            key={item.id}
            onPress={() => onSelect(item.id)}
            haptic="tap"
            accessibilityRole="button"
            accessibilityLabel={`${item.title ?? 'Report'}, ${formatDistance(item.distanceMetres)} away`}
          >
            <View style={[styles.row, index > 0 && styles.rowDivided]}>
              <View style={[styles.iconWell, { borderColor: meta.color + '44' }]}>
                <Icon name={icon} size={15} color={meta.color} />
              </View>
              <View style={styles.rowBody}>
                <Text variant="bodyTight" weight="medium" numberOfLines={1}>
                  {item.title?.trim() || 'Untitled report'}
                </Text>
                <Text variant="micro" tone="faint" mono>
                  {formatDistance(item.distanceMetres)} away
                </Text>
              </View>
              <StatusPill status={item.status} dense />
            </View>
          </PressableScale>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  list: { gap: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  rowDivided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: line.soft },
  iconWell: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowBody: { flex: 1, gap: 1 },
  empty: { paddingVertical: space.xxl },
})
