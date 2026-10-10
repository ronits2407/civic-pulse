import React from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import { radius, shadow, space, surface } from '@/theme/tokens'

/**
 * The workhorse surface.
 *
 * On paper, depth reads from soft shadow rather than borders, so cards are white with a
 * diffuse lift and no outline. `mist` and `hero` are the two coloured surfaces; nothing
 * else in the app introduces a new background colour.
 */

export interface CardProps {
  children: React.ReactNode
  /**
   * `default` white raised card · `sunken` well inside another card · `mist` soft
   * periwinkle panel · `hero` deep navy · `bare` no surface.
   */
  variant?: 'default' | 'sunken' | 'bare' | 'mist' | 'hero'
  /** Coloured left edge, used for severity / category accent. */
  accentColor?: string
  padded?: boolean
  style?: StyleProp<ViewStyle>
  onLayout?: View['props']['onLayout']
}

const BACKGROUND: Record<NonNullable<CardProps['variant']>, string> = {
  default: surface.card,
  sunken: surface.sunken,
  bare: 'transparent',
  mist: surface.mist,
  hero: surface.hero,
}

export function Card({ children, variant = 'default', accentColor, padded = true, style, onLayout }: CardProps) {
  const lifted = variant === 'default' || variant === 'hero'
  return (
    <View
      onLayout={onLayout}
      style={[
        styles.base,
        { backgroundColor: BACKGROUND[variant] },
        lifted && shadow.card,
        variant === 'sunken' && styles.sunken,
        padded && styles.padded,
        accentColor ? { borderLeftColor: accentColor, borderLeftWidth: 4 } : null,
        style,
      ]}
    >
      {children}
    </View>
  )
}

/** Thin divider for use inside a card. */
export function Divider({ style, inverse = false }: { style?: StyleProp<ViewStyle>; inverse?: boolean }) {
  return <View style={[styles.divider, inverse && styles.dividerInverse, style]} />
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.lg },
  sunken: { borderRadius: radius.md },
  padded: { padding: space.lg },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E7E4DD', width: '100%' },
  dividerInverse: { backgroundColor: 'rgba(255,255,255,0.12)' },
})
