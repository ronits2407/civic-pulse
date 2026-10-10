import React from 'react'
import { StyleSheet, View } from 'react-native'

import { PressableScale } from '@/components/ui/PressableScale'
import { Text } from '@/theme/Typography'
import { Icon, type IconName } from '@/theme/icons'
import { accent, ink, line, radius, space, surface } from '@/theme/tokens'

/** A single-select pill. Selection is shown by colour AND weight, and exposed as a radio to screen readers. */
export function Choice({
  selected,
  label,
  icon,
  onPress,
}: {
  selected: boolean
  label: string
  icon?: IconName
  onPress: () => void
}) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={label}>
      <View style={[styles.choice, selected && styles.choiceOn]}>
        {icon ? <Icon name={icon} size={16} color={selected ? accent.brand : ink.muted} /> : null}
        <Text
          variant="bodyTight"
          weight={selected ? 'semibold' : 'medium'}
          style={{ color: selected ? accent.brand : ink.base }}
        >
          {label}
        </Text>
      </View>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 44,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: line.base,
    backgroundColor: surface.sunken,
  },
  choiceOn: { borderColor: accent.brand, backgroundColor: 'rgba(45,164,78,0.12)' },
})
