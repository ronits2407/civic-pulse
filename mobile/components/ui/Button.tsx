import React from 'react'
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import { PressableScale } from '@/components/ui/PressableScale'
import { Text } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import { accent, ink, radius, space, surface } from '@/theme/tokens'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps {
  label: string
  onPress?: () => void
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  /** Rendered to the left of the label. */
  icon?: React.ReactNode
  /** Show a round arrow chip at the trailing edge (the app's signature call to action). */
  trailingArrow?: boolean
  fullWidth?: boolean
  haptic?: 'tap' | 'press' | null
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}

const PALETTE: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: accent.brand, fg: ink.inverse, border: accent.brand },
  secondary: { bg: surface.card, fg: ink.base, border: '#DCD8CF' },
  subtle: { bg: surface.mist, fg: ink.base, border: surface.mist },
  danger: { bg: '#FBE7E4', fg: accent.red, border: '#F3C9C2' },
  ghost: { bg: 'transparent', fg: ink.base, border: 'transparent' },
}

const SIZING: Record<ButtonSize, { height: number; pad: number; text: 'label' | 'bodyTight' | 'body' }> = {
  sm: { height: 38, pad: space.lg, text: 'label' },
  md: { height: 50, pad: space.xl, text: 'bodyTight' },
  lg: { height: 58, pad: space.xl, text: 'body' },
}

/**
 * Pill buttons. Every primary and large size clears a 48dp touch target. The trailing
 * arrow chip mirrors the round action buttons on the hero cards, so "go somewhere"
 * always looks the same.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  trailingArrow = false,
  fullWidth = false,
  haptic = 'press',
  accessibilityLabel,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading
  const p = PALETTE[variant]
  const s = SIZING[size]
  const arrow = trailingArrow && size !== 'sm'

  return (
    <PressableScale
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      haptic={isDisabled ? null : haptic}
      scaleTo={isDisabled ? 1 : 0.97}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[fullWidth && styles.fullWidth, style]}
    >
      <View
        style={[
          styles.base,
          {
            height: s.height,
            paddingLeft: s.pad,
            paddingRight: arrow ? 6 : s.pad,
            backgroundColor: p.bg,
            borderColor: p.border,
            opacity: isDisabled && !loading ? 0.45 : 1,
          },
          arrow && styles.spread,
        ]}
      >
        <View style={styles.labelRow}>
          {loading ? <ActivityIndicator size="small" color={p.fg} /> : icon}
          <Text variant={s.text} weight="semibold" style={{ color: p.fg }} numberOfLines={1}>
            {label}
          </Text>
        </View>
        {arrow ? (
          <View style={[styles.arrow, { height: s.height - 12, width: s.height - 12, backgroundColor: variant === 'primary' ? surface.card : accent.brand }]}>
            <Icon name="arrow-right" size={20} color={variant === 'primary' ? accent.brand : ink.inverse} />
          </View>
        ) : null}
      </View>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  fullWidth: { alignSelf: 'stretch' },
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  spread: { justifyContent: 'space-between' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  arrow: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
})
