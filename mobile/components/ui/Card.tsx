import React from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import { line, radius, space, surface } from '@/theme/tokens'

/**
 * The workhorse surface.
 *
 * Borders are the primary structural device in this interface — they read as
 * precise and instrument-like on a dark canvas, where shadows mostly disappear.
 * A very low-opacity shadow is layered on top for elevation cues on lighter screens.
 */

export interface CardProps {
  children: React.ReactNode
  /** `default` is the raised card; `sunken` is a well inside another card. */
  variant?: 'default' | 'sunken' | 'bare'
  /** Draw a coloured left edge — used for severity / category accent on incident cards. */
  accentColor?: string
  padded?: boolean
  style?: StyleProp<ViewStyle>
  onLayout?: View['props']['onLayout']
}

export function Card({
  children,
  variant = 'default',
  accentColor,
  padded = true,
  style,
  onLayout,
}: CardProps) {
  const background =
    variant === 'sunken' ? surface.sunken : variant === 'bare' ? 'transparent' : surface.card

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.base,
        { backgroundColor: background },
        variant === 'bare' && styles.bare,
        padded && styles.padded,
        accentColor ? { borderLeftColor: accentColor, borderLeftWidth: 3 } : null,
        style,
      ]}
    >
      {children}
    </View>
  )
}

/** Thin divider that matches the card hairline. */
export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line.base,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  bare: { borderWidth: 0, shadowOpacity: 0, elevation: 0 },
  padded: { padding: space.lg },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: line.soft, width: '100%' },
})
