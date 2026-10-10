import React, { useEffect, useRef, useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'

import { PressableScale } from '@/components/ui/PressableScale'
import { Text } from '@/theme/Typography'
import { ink, motion, radius, space, surface } from '@/theme/tokens'

/**
 * Segmented control. A navy thumb slides to the chosen option on a spring, so changing a
 * filter feels like moving one physical piece rather than three buttons flickering.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  const [width, setWidth] = useState(0)
  const index = Math.max(0, options.findIndex((o) => o.value === value))
  const segment = width > 0 ? (width - 10) / options.length : 0

  // Place the thumb instantly on first layout, then spring on every later change, so it
  // never slides in from the left edge when the screen opens.
  const x = useSharedValue(0)
  const placed = useRef(false)
  useEffect(() => {
    if (segment <= 0) return
    const target = index * segment
    if (!placed.current) {
      placed.current = true
      x.set(target)
    } else {
      x.set(withSpring(target, { ...motion.spring, reduceMotion: ReduceMotion.System }))
    }
  }, [index, segment, x])
  const thumb = useAnimatedStyle(() => ({ width: segment, transform: [{ translateX: x.value }] }))

  return (
    <View
      style={styles.track}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
    >
      {segment > 0 ? <Animated.View style={[styles.thumb, thumb]} /> : null}
      {options.map((option) => {
        const on = option.value === value
        return (
          <PressableScale
            key={option.value}
            onPress={() => onChange(option.value)}
            haptic="tap"
            scaleTo={0.98}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={styles.hit}
          >
            <View style={styles.segment}>
              <Text variant="label" weight="semibold" style={{ color: on ? ink.inverse : ink.muted }}>
                {option.label}
              </Text>
            </View>
          </PressableScale>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', backgroundColor: surface.card, borderRadius: radius.pill, padding: 5 },
  thumb: { position: 'absolute', top: 5, bottom: 5, left: 5, borderRadius: radius.pill, backgroundColor: ink.base },
  hit: { flex: 1 },
  segment: { height: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm },
})
