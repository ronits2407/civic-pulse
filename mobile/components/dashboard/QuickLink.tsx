import React from 'react'
import { StyleSheet, View } from 'react-native'

import { PressableScale } from '@/components/ui/PressableScale'
import { Text } from '@/theme/Typography'
import { Icon, type IconName } from '@/theme/icons'
import { line, radius, space, surface } from '@/theme/tokens'

/** Compact navigation row. Used for the secondary destinations on Home and Profile. */
export function QuickLink({
  icon,
  label,
  hint,
  onPress,
  badge,
  tone,
}: {
  icon: IconName
  label: string
  hint?: string
  onPress: () => void
  badge?: string | number | null
  tone?: string
}) {
  return (
    <PressableScale
      onPress={onPress}
      haptic="tap"
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
    >
      <View style={styles.row}>
        <View style={styles.iconWell}>
          <Icon name={icon} size={17} color={tone ?? '#8b949e'} />
        </View>
        <View style={styles.body}>
          <Text variant="bodyTight" weight="medium">
            {label}
          </Text>
          {hint ? (
            <Text variant="micro" tone="faint" numberOfLines={1}>
              {hint}
            </Text>
          ) : null}
        </View>
        {badge != null && badge !== 0 ? (
          <View style={styles.badge}>
            <Text variant="micro" weight="semibold" style={{ color: tone ?? '#8b949e' }}>
              {badge}
            </Text>
          </View>
        ) : null}
        <Icon name="chevron-right" size={18} color="#6e7681" />
      </View>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    backgroundColor: surface.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line.base,
  },
  iconWell: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surface.sunken,
  },
  body: { flex: 1, gap: 1 },
  badge: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: surface.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
