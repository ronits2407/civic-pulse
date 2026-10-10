import React, { createContext, useContext, useMemo } from 'react'
import { Text as RNText, type StyleProp, type TextProps, type TextStyle } from 'react-native'

import { font, ink, systemFont, type } from '@/theme/tokens'

/**
 * Typography with a guaranteed fallback.
 *
 * Custom fonts are a nicety, not a dependency: if the .ttf files fail to load the
 * app still renders correctly on the platform's system face. `FontProvider`
 * publishes whether they arrived, and `Text` picks the matching stack.
 *
 * JetBrains Mono is reserved for measured values — severity, SLA countdowns,
 * coordinates, karma, issue ids — so numbers are visually separable from prose.
 */

const FontContext = createContext(false)

export function FontProvider({
  loaded,
  children,
}: {
  loaded: boolean
  children: React.ReactNode
}) {
  return <FontContext.Provider value={loaded}>{children}</FontContext.Provider>
}

/**
 * The font stack currently in effect. Use this from components that render text
 * themselves — `TextInput` in particular — so the typographic system stays whole
 * when custom fonts are unavailable.
 */
export function useFontStack() {
  const loaded = useContext(FontContext)
  return loaded ? font : systemFont
}

export type TypeVariant = keyof typeof type
export type TypeWeight = 'regular' | 'medium' | 'semibold' | 'bold'
export type TypeTone = 'base' | 'muted' | 'faint' | 'inverse' | string

const TONE_MAP: Record<string, string> = {
  base: ink.base,
  muted: ink.muted,
  faint: ink.faint,
  inverse: ink.inverse,
}

export interface AppTextProps extends TextProps {
  variant?: TypeVariant
  weight?: TypeWeight
  /** Named tone, or any raw colour string (e.g. a category accent). */
  tone?: TypeTone
  /** Force the monospace face, e.g. for a coordinate readout. */
  mono?: boolean
  center?: boolean
  style?: StyleProp<TextStyle>
}

export function Text({
  variant = 'body',
  weight,
  tone = 'base',
  mono = false,
  center = false,
  style,
  ...rest
}: AppTextProps) {
  const fontsLoaded = useContext(FontContext)

  const stack = fontsLoaded ? font : systemFont
  // `data`/`dataLg` are inherently numeric, so they default to mono.
  const wantsMono = mono || variant === 'data' || variant === 'dataLg'

  const resolvedWeight: TypeWeight = weight ?? (variant === 'display' || variant === 'title' ? 'bold' : variant === 'heading' ? 'semibold' : 'regular')

  const family = wantsMono
    ? resolvedWeight === 'bold' || resolvedWeight === 'semibold'
      ? stack.monoSemibold
      : stack.monoMedium
    : (stack as any)[resolvedWeight]

  const merged = useMemo<StyleProp<TextStyle>>(
    () => [
      type[variant] as TextStyle,
      { fontFamily: family, color: TONE_MAP[tone] ?? tone },
      center && { textAlign: 'center' as const },
      style,
    ],
    [variant, family, tone, center, style]
  )

  return <RNText style={merged} {...rest} />
}
