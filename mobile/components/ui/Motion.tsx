import React from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import Animated, { FadeInDown, FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated'

import { motion } from '@/theme/tokens'

/**
 * Entrance choreography.
 *
 * Content rises a short distance and fades in, staggered by its position. One shared
 * vocabulary (a short spring rise) means every screen moves the same way. All of it is
 * skipped when the system "remove animations" setting is on, so no content ever waits
 * on an animation to become usable.
 */

export function rise(index = 0) {
  return FadeInDown.springify()
    .damping(motion.softSpring.damping)
    .stiffness(motion.softSpring.stiffness)
    .delay(Math.min(index, 8) * motion.stagger)
    .withInitialValues({ opacity: 0, transform: [{ translateY: 14 }] })
    .reduceMotion(ReduceMotion.System)
}

export const layoutSpring = LinearTransition.springify()
  .damping(motion.spring.damping)
  .stiffness(motion.spring.stiffness)
  .reduceMotion(ReduceMotion.System)

export const fadeOut = FadeOut.duration(motion.fast).reduceMotion(ReduceMotion.System)

/** Wraps a block so it rises in on mount and animates size changes. */
export function Rise({ index = 0, children, style }: { index?: number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={rise(index)} layout={layoutSpring} style={style}>
      {children}
    </Animated.View>
  )
}
