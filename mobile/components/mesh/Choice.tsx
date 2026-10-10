import React from 'react'
import { StyleSheet, View } from 'react-native'

import { PressableScale } from '@/components/ui/PressableScale'
import { Text } from '@/theme/Typography'
import { Icon, type IconName } from '@/theme/icons'
import { ink, radius, space, surface } from '@/theme/tokens'

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
        {icon ? <Icon name={icon} size={17} color={selected ? ink.inverse : ink.muted} /> : null}
        <Text
          variant="bodyTight"
          weight={selected ? 'semibold' : 'medium'}
          style={{ color: selected ? ink.inverse : ink.base }}
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
    minHeight: 46,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: surface.mist,
  },
  choiceOn: { backgroundColor: ink.base },
})
