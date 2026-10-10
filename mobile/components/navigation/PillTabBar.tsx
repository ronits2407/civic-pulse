import React, { type ComponentProps } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
} from 'react-native-reanimated'
import type { Tabs } from 'expo-router'

import { haptics } from '@/lib/haptics'
import { Text } from '@/theme/Typography'
import { Icon, type IconName } from '@/theme/icons'
import { ink, motion, radius, shadow, space, surface } from '@/theme/tokens'

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0]

/** Icon pair per tab: outline when idle, filled when active. */
export const TAB_ICONS: Record<string, { idle: IconName; active: IconName; label: string }> = {
  index: { idle: 'home-variant-outline', active: 'home-variant', label: 'Home' },
  reports: { idle: 'clipboard-text-outline', active: 'clipboard-text', label: 'Reports' },
  map: { idle: 'map-outline', active: 'map', label: 'Map' },
  profile: { idle: 'account-circle-outline', active: 'account-circle', label: 'You' },
}

/** Height the bar occupies, so scroll content can clear it. */
export const TAB_BAR_CLEARANCE = 112

const SPRING = { ...motion.spring, reduceMotion: ReduceMotion.System }

function TabItem({
  focused,
  meta,
  onPress,
  onLongPress,
}: {
  focused: boolean
  meta: (typeof TAB_ICONS)[string]
  onPress: () => void
  onLongPress: () => void
}) {
  // The active tab widens into a labelled navy pill; idle tabs are a bare icon.
  // One 0..1 driver per tab; colour, padding and label width all follow it, so the pill
  // grows and fills as a single movement instead of snapping its colour.
  const t = useDerivedValue(() => withSpring(focused ? 1 : 0, SPRING), [focused])
  const pill = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(t.value, [0, 1], ['rgba(20,28,46,0)', ink.base]),
    paddingHorizontal: 12 + t.value * 6,
  }))
  const label = useAnimatedStyle(() => ({
    opacity: t.value,
    maxWidth: Math.max(0, t.value) * 90,
    marginLeft: t.value * 8,
  }))

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={meta.label}
      style={styles.hit}
    >
      <Animated.View style={[styles.pill, pill]}>
        <Icon name={focused ? meta.active : meta.idle} size={22} color={focused ? ink.inverse : ink.faint} />
        <Animated.View style={[styles.labelClip, label]}>
          <Text variant="label" weight="semibold" tone="inverse" numberOfLines={1}>
            {meta.label}
          </Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  )
}

/**
 * Floating pill tab bar. It hovers above the content with its own shadow and leaves the
 * screen edges free, so the paper canvas reads as one continuous surface.
 */
export function PillTabBar({ state, descriptors, navigation, insets }: TabBarProps) {
  // Full-screen flows inside the tab group (report, verify) get the whole screen.
  if (!TAB_ICONS[state.routes[state.index]?.name]) return null
  return (
    <View pointerEvents="box-none" style={[styles.dock, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
      <View style={[styles.bar, shadow.float]}>
        {state.routes.map((route, index) => {
          const meta = TAB_ICONS[route.name]
          if (!meta) return null
          const focused = state.index === index
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
            if (!focused && !event.defaultPrevented) {
              haptics.select()
              navigation.navigate(route.name, route.params)
            }
          }
          const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key })
          void descriptors
          return <TabItem key={route.key} focused={focused} meta={meta} onPress={onPress} onLongPress={onLongPress} />
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: space.lg },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    backgroundColor: surface.card,
    borderRadius: radius.pill,
    padding: 7,
  },
  hit: { minHeight: 52, justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', height: 50, borderRadius: radius.pill },
  labelClip: { overflow: 'hidden' },
})
