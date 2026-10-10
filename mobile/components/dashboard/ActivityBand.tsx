import React from 'react'
import { StyleSheet, View } from 'react-native'

import { Text } from '@/theme/Typography'
import { accent, line, radius, space, surface, TONE_COLOR } from '@/theme/tokens'

/**
 * Activity summary for the citizen's own reports.
 *
 * A single proportional band over three figures, rather than three separate stat
 * cards. The band does real work: it shows the *mix* — whether someone's reports are
 * mostly resolved or mostly sitting in review — which three isolated numbers cannot.
 * Segments only appear for non-zero values, so the bar is never mostly empty.
 */

export interface ActivityCounts {
  open: number
  inProgress: number
  resolved: number
  total: number
}

interface Segment {
  key: string
  label: string
  value: number
  color: string
}

/** Widest first, so the bar reads left-to-right as "most of my reports are…". */
function buildSegments(counts: ActivityCounts): Segment[] {
  const all: Segment[] = [
    { key: 'resolved', label: 'Resolved', value: counts.resolved, color: accent.emerald },
    { key: 'in_progress', label: 'In progress', value: counts.inProgress, color: accent.amberSoft },
    { key: 'open', label: 'Under review', value: counts.open, color: accent.blue },
  ]
  return all.filter((s) => s.value > 0).sort((a, b) => b.value - a.value)
}

export function ActivityBand({ counts }: { counts: ActivityCounts }) {
  const segments = buildSegments(counts)
  const denom = segments.reduce((sum, s) => sum + s.value, 0) || 1

  return (
    <View>
      <View style={styles.headerRow}>
        <Text variant="heading" weight="semibold">
          Your reports
        </Text>
        <Text variant="data" weight="medium" tone="muted">
          {counts.total}
        </Text>
      </View>

      {segments.length > 0 ? (
        <View style={styles.band} accessibilityLabel={`${counts.resolved} resolved, ${counts.inProgress} in progress, ${counts.open} under review`}>
          {segments.map((segment) => (
            <View
              key={segment.key}
              style={[styles.segment, { flexGrow: segment.value / denom, backgroundColor: segment.color }]}
            />
          ))}
        </View>
      ) : (
        <View style={[styles.band, styles.bandEmpty]} />
      )}

      <View style={styles.legend}>
        {segments.map((segment) => (
          <View key={segment.key} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: segment.color }]} />
            <Text variant="micro" tone="muted">
              {segment.label}
            </Text>
            <Text variant="micro" mono style={{ color: TONE_COLOR.slate }}>
              {segment.value}
            </Text>
          </View>
        ))}
        {segments.length === 0 ? (
          <Text variant="micro" tone="faint">
            Nothing reported yet
          </Text>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  band: {
    flexDirection: 'row',
    height: 10,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: surface.sunken,
    gap: 2,
  },
  bandEmpty: { backgroundColor: surface.sunken },
  segment: { height: '100%', borderRadius: radius.pill,
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg, marginTop: space.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 3.5, borderWidth: StyleSheet.hairlineWidth, borderColor: line.base },
})
