import React, { useEffect, useRef } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated'

import { Text } from '@/theme/Typography'
import { accent, ink, radius, space, surface } from '@/theme/tokens'

/**
 * Six-box one-time-code entry. A single hidden TextInput owns the value (so paste,
 * SMS/email autofill and the number pad all work); the boxes only draw it. The active
 * box gets a navy ring, and the row shakes once when the code is rejected.
 */
export function CodeBoxes({
  value,
  onChange,
  length = 6,
  error = false,
  editable = true,
}: {
  value: string
  onChange: (v: string) => void
  length?: number
  error?: boolean
  editable?: boolean
}) {
  const input = useRef<TextInput>(null)
  const shake = useSharedValue(0)

  useEffect(() => {
    if (!error) return
    const t = { duration: 55, reduceMotion: ReduceMotion.System }
    shake.set(withSequence(withTiming(-8, t), withTiming(8, t), withTiming(-5, t), withTiming(5, t), withTiming(0, t)))
  }, [error, shake])
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }))

  return (
    <Pressable onPress={() => input.current?.focus()} accessibilityLabel="Sign-in code" accessibilityHint={`Enter the ${length}-digit code`}>
      <Animated.View style={[styles.row, shakeStyle]}>
        {Array.from({ length }).map((_, i) => {
          const char = value[i] ?? ''
          const active = editable && i === Math.min(value.length, length - 1)
          return (
            <View key={i} style={[styles.box, char ? styles.filled : null, active && styles.active, error && styles.error]}>
              <Text variant="title" mono>
                {char}
              </Text>
            </View>
          )
        })}
      </Animated.View>
      <TextInput
        ref={input}
        value={value}
        onChangeText={onChange}
        maxLength={length}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        autoFocus
        editable={editable}
        caretHidden
        style={styles.hidden}
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  box: {
    flex: 1,
    aspectRatio: 0.82,
    maxWidth: 58,
    borderRadius: radius.md,
    backgroundColor: '#EFEDE7',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filled: { backgroundColor: surface.card },
  active: { borderColor: ink.base, backgroundColor: surface.card },
  error: { borderColor: accent.red },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
})
