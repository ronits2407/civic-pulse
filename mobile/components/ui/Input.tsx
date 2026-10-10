import React, { useCallback, useState } from 'react'
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native'

import { Text, useFontStack } from '@/theme/Typography'
import { accent, ink, line, radius, space, surface } from '@/theme/tokens'

/**
 * Text input with a labelled frame and a visible focus ring.
 *
 * The focus colour is the same `#0969da` the web app uses for input focus, so the
 * interaction language matches across platforms.
 */

export interface InputProps extends TextInputProps {
  label?: string
  /** Rendered under the field in red. */
  error?: string | null
  /** Rendered under the field in muted grey; hidden while `error` is set. */
  hint?: string | null
  /** Right-aligned adornment inside the field (e.g. a unit or action). */
  suffix?: React.ReactNode
  /**
   * Render the value in the monospace face. Used for codes, coordinates and any
   * other value a citizen reads digit-by-digit.
   */
  mono?: boolean
  containerStyle?: StyleProp<ViewStyle>
}

export function Input({
  label,
  error,
  hint,
  suffix,
  mono = false,
  containerStyle,
  style,
  onFocus,
  onBlur,
  editable = true,
  ...rest
}: InputProps) {
  const [focused, setFocused] = useState(false)
  const fontStack = useFontStack()

  const handleFocus = useCallback<NonNullable<TextInputProps['onFocus']>>(
    (e) => {
      setFocused(true)
      onFocus?.(e)
    },
    [onFocus]
  )

  const handleBlur = useCallback<NonNullable<TextInputProps['onBlur']>>(
    (e) => {
      setFocused(false)
      onBlur?.(e)
    },
    [onBlur]
  )

  const borderColor = error ? accent.redSoft : focused ? accent.blue : line.base

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text variant="label" weight="semibold" tone="muted" style={styles.label}>
          {label}
        </Text>
      ) : null}

      <View style={[styles.field, { borderColor }, !editable && styles.fieldDisabled]}>
        <TextInput
          {...rest}
          editable={editable}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholderTextColor={ink.faint}
          selectionColor={accent.brand}
          cursorColor={accent.brand}
          style={[
            styles.input,
            { fontFamily: mono ? fontStack.mono : fontStack.regular },
            style,
          ]}
        />
        {suffix ? <View style={styles.suffix}>{suffix}</View> : null}
      </View>

      {error ? (
        <Text variant="caption" style={{ color: accent.redSoft, marginTop: space.xs }}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="faint" style={{ marginTop: space.xs }}>
          {hint}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 0 },
  label: { marginBottom: space.sm },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: surface.sunken,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.md,
    minHeight: 50,
  },
  fieldDisabled: { opacity: 0.55 },
  input: {
    flex: 1,
    color: ink.base,
    fontSize: 16,
    paddingVertical: space.md,
  },
  suffix: { paddingLeft: space.sm },
})
