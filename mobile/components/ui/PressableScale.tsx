import React, { useCallback } from 'react'
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { haptics } from '@/lib/haptics'

/**
 * A pressable that physically acknowledges the touch.
 *
 * Scaling is driven on the UI thread and honours the system "remove animations"
 * setting via Reanimated's `ReduceMotion.System`, so accessibility preferences are
 * respected without a second code path.
 */

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>
  /** How far to shrink on press. 1 disables the effect. */
  scaleTo?: number
  haptic?: keyof typeof haptics | null
  children: React.ReactNode
}

export function PressableScale({
  style,
  scaleTo = 0.975,
  haptic = 'tap',
  children,
  disabled,
  onPress,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  const handlePressIn = useCallback(() => {
    if (disabled) return
    scale.value = withTiming(scaleTo, { duration: 90, reduceMotion: ReduceMotion.System })
  }, [disabled, scale, scaleTo])

  const handlePressOut = useCallback(() => {
    scale.value = withTiming(1, { duration: 140, reduceMotion: ReduceMotion.System })
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
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled}
      // Android ripples would double up with the scale feedback.
      android_ripple={undefined}
      {...rest}
    >
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  )
}
