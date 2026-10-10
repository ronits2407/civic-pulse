import React, { useMemo } from 'react'
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import { PressableScale } from '@/components/ui/PressableScale'
import { Text } from '@/theme/Typography'
import { accent, ink, line, radius, space, surface } from '@/theme/tokens'

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
  fullWidth?: boolean
  haptic?: 'tap' | 'press' | null
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}

/**
 * Action button.
 *
 * Minimum height is 44pt / 48dp on the default and large sizes so every primary
 * action clears the recommended touch target without per-screen overrides.
 */

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
  haptic = 'press',
  accessibilityLabel,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading

  const palette = useMemo(() => {
    switch (variant) {
      case 'primary':
        return { bg: accent.brand, border: accent.brandDim, fg: '#ffffff' }
      case 'danger':
        return { bg: 'rgba(207,34,46,0.16)', border: 'rgba(248,113,113,0.42)', fg: accent.redSoft }
      case 'secondary':
        return { bg: surface.raised, border: line.base, fg: ink.base }
      case 'subtle':
        return { bg: surface.sunken, border: line.soft, fg: ink.muted }
      case 'ghost':
      default:
        return { bg: 'transparent', border: 'transparent', fg: ink.base }
    }
  }, [variant])

  const sizing = useMemo(() => {
    switch (size) {
      case 'sm':
        return { height: 36, paddingHorizontal: space.md, gap: space.xs, text: 'label' as const }
      case 'lg':
        return { height: 54, paddingHorizontal: space.xxl, gap: space.sm, text: 'heading' as const }
      case 'md':
      default:
        return { height: 48, paddingHorizontal: space.lg, gap: space.sm, text: 'body' as const }
    }
  }, [size])

  return (
    <PressableScale
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      haptic={isDisabled ? null : haptic}
      scaleTo={isDisabled ? 1 : 0.97}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={style}
    >
      <View
        style={[
          styles.base,
          {
            height: sizing.height,
            paddingHorizontal: sizing.paddingHorizontal,
            gap: sizing.gap,
            backgroundColor: palette.bg,
            borderColor: palette.border,
            opacity: isDisabled ? 0.5 : 1,
          },
          fullWidth && styles.fullWidth,
          variant === 'ghost' && styles.ghost,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={palette.fg} />
        ) : (
          icon
        )}
        <Text
          variant={sizing.text}
          weight="semibold"
          style={{ color: palette.fg }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fullWidth: { alignSelf: 'stretch' },
  ghost: { borderWidth: 0 },
})
