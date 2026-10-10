import React, { useCallback } from 'react'
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'

import { haptics } from '@/lib/haptics'
import { motion } from '@/theme/tokens'

/**
 * A pressable that physically acknowledges the touch.
 *
 * A spring (not a fixed tween) so a quick tap and a long press both feel natural. Driven
 * on the UI thread, and honours the system "remove animations" setting.
 */

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>
  /** How far to shrink on press. 1 disables the effect. */
  scaleTo?: number
  haptic?: keyof typeof haptics | null
  children: React.ReactNode
}

const SPRING = { ...motion.spring, reduceMotion: ReduceMotion.System }

export function PressableScale({
  style,
  scaleTo = 0.965,
  haptic = 'tap',
  children,
  disabled,
  onPress,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1)
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  const handlePressIn = useCallback(() => {
    if (!disabled) scale.set(withSpring(scaleTo, SPRING))
  }, [disabled, scale, scaleTo])

  const handlePressOut = useCallback(() => {
    scale.set(withSpring(1, SPRING))
  }, [scale])

  const handlePress = useCallback<NonNullable<PressableProps['onPress']>>(
    (event) => {
      if (disabled) return
      if (haptic) haptics[haptic]()
      onPress?.(event)
    },
    [disabled, haptic, onPress]
  )

  return (
    <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={handlePress} disabled={disabled} {...rest}>
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  )
}
