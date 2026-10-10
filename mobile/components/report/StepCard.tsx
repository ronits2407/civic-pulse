import React from 'react'
import { StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'

import { Card } from '@/components/ui/Card'
import { layoutSpring, rise } from '@/components/ui/Motion'
import { PressableScale } from '@/components/ui/PressableScale'
import { Text } from '@/theme/Typography'
import { Icon, type IconName } from '@/theme/icons'
import { accent, ink, radius, space, surface } from '@/theme/tokens'

/**
 * One step of the report form. The badge turns into a navy tick once the step is
 * complete, so the form shows its own progress without a separate stepper. These are
 * genuinely ordered steps, which is why they are numbered.
 */
export function StepCard({
  step,
  title,
  hint,
  done,
  optional,
  right,
  children,
}: {
  step: number
  title: string
  hint?: string
  done: boolean
  optional?: boolean
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Animated.View entering={rise(step)} layout={layoutSpring}>
      <Card style={styles.card}>
        <View style={styles.head}>
          <View style={[styles.badge, done && styles.badgeDone]}>
            {done ? (
              <Icon name="check" size={16} color={ink.inverse} />
            ) : (
              <Text variant="label" weight="bold">
                {step}
              </Text>
            )}
          </View>
          <View style={styles.flex}>
            <Text variant="heading">
              {title}
              {optional ? (
                <Text variant="caption" tone="faint">
                  {'  '}optional
                </Text>
              ) : null}
            </Text>
            {hint ? (
              <Text variant="caption" tone="muted">
                {hint}
              </Text>
            ) : null}
          </View>
          {right}
        </View>
        {children}
      </Card>
    </Animated.View>
  )
}

/** Square action tile used for camera / gallery / video / GPS / map pin. */
export function ActionTile({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: IconName
  label: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic="tap"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={styles.tileHit}
    >
      <View style={[styles.tile, disabled && styles.disabled]}>
        <View style={styles.tileIcon}>
          <Icon name={icon} size={22} color={accent.brand} />
        </View>
        <Text variant="caption" weight="semibold" center numberOfLines={1}>
          {label}
        </Text>
      </View>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  card: { gap: space.lg },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  flex: { flex: 1, gap: 2 },
  badge: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: surface.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDone: { backgroundColor: ink.base },
  tileHit: { flex: 1 },
  tile: {
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    backgroundColor: surface.sunken,
  },
  tileIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
})
