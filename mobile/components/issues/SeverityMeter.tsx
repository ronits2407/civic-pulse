import React from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import { severityFraction, severityMeta } from '@/lib/format'
import { Text } from '@/theme/Typography'
import { line, radius, space } from '@/theme/tokens'

/**
 * Ten-segment severity meter.
 *
 * Severity is an integer 1–10 from Agent 1, so a discrete 10-block meter states the
 * value exactly instead of approximating it with a continuous bar. Unlit segments
 * stay visible, which makes the scale itself legible at low severities.
 */

const SEGMENTS = 10

export function SeverityMeter({
  severity,
  isEmergency,
  showLabel = true,
  style,
}: {
  severity: number | null | undefined
  isEmergency?: boolean
  showLabel?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const meta = severityMeta(severity, isEmergency)
  const lit = Math.round(severityFraction(severity) * SEGMENTS)

  return (
    <View style={style}>
      <View style={styles.blocks} accessibilityLabel={`Severity ${meta.label}`}>
        {Array.from({ length: SEGMENTS }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.block,
              {
                backgroundColor: i < lit ? meta.color : 'transparent',
                borderColor: i < lit ? meta.color : line.soft,
              },
            ]}
          />
        ))}
      </View>
      {showLabel ? (
        <View style={styles.labelRow}>
          <Text variant="micro" weight="semibold" style={{ color: meta.color }}>
            {meta.label}
          </Text>
          <Text variant="micro" tone="faint" mono>
            {typeof severity === 'number' ? `${severity}/10` : '—'}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  blocks: { flexDirection: 'row', gap: 3 },
  block: {
    flex: 1,
    height: 5,
    borderRadius: radius.sm / 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.sm },
})
