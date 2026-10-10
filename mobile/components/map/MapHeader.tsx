import React from 'react'
import { StyleSheet, View } from 'react-native'

import { Notice } from '@/components/ui/Feedback'
import { PressableScale } from '@/components/ui/PressableScale'
import { Text } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import { TONE_COLOR, accent, ink, radius, shadow, space, surface } from '@/theme/tokens'

const LEGEND = [
  { label: 'Urgent', color: TONE_COLOR.red },
  { label: 'In progress', color: TONE_COLOR.amber },
  { label: 'Reviewing', color: TONE_COLOR.blue },
  { label: 'Fixed', color: TONE_COLOR.emerald },
]

/** Floating header for the full-bleed map: title, count, locate button, one-line legend. */
export function MapHeader({
  subtitle,
  located,
  locating,
  onLocate,
  permissionDenied,
}: {
  subtitle: string
  located: boolean
  locating: boolean
  onLocate: () => void
  permissionDenied: boolean
}) {
  return (
    <>
      <View style={[styles.header, shadow.card]}>
        <View style={styles.flex}>
          <Text variant="heading">City map</Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <PressableScale onPress={onLocate} disabled={locating} haptic="tap" accessibilityRole="button" accessibilityLabel="Centre on my location">
          <View style={[styles.locate, located && styles.locateOn]}>
            <Icon name={locating ? 'crosshairs' : 'crosshairs-gps'} size={20} color={located ? ink.inverse : ink.base} />
          </View>
        </PressableScale>
      </View>
      <View style={[styles.legend, shadow.card]} accessibilityLabel="Pin colours: red urgent, amber in progress, blue reviewing, green fixed">
        {LEGEND.map((l) => (
          <View key={l.label} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: l.color }]} />
            <Text variant="micro" weight="medium" tone="muted">
              {l.label}
            </Text>
          </View>
        ))}
      </View>
      {permissionDenied ? (
        <Notice tone="amber" body="Location is off for CivicPulse, so the map is centred on your home area. Turn it on in Settings to centre on you." />
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: surface.card,
    borderRadius: radius.xl,
    paddingVertical: space.md,
    paddingLeft: space.xl,
    paddingRight: space.md,
  },
  flex: { flex: 1 },
  locate: { width: 46, height: 46, borderRadius: 23, backgroundColor: surface.mist, alignItems: 'center', justifyContent: 'center' },
  locateOn: { backgroundColor: accent.brand },
  legend: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: space.md,
    backgroundColor: surface.card,
    borderRadius: radius.pill,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
})
