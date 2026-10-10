import React, { createContext, useContext, useMemo } from 'react'
import { Text as RNText, type StyleProp, type TextProps, type TextStyle } from 'react-native'

import { font, ink, systemFont, type } from '@/theme/tokens'

/**
 * Typography with a guaranteed fallback.
 *
 * Two families from Ek Type: Anek Latin sets display sizes and figures, Mukta sets
 * everything you read. If the .ttf files fail to load the app renders on the system face.
 */

const FontContext = createContext(false)

export function FontProvider({ loaded, children }: { loaded: boolean; children: React.ReactNode }) {
  return <FontContext.Provider value={loaded}>{children}</FontContext.Provider>
}

/** The font stack in effect. Use from components that render text themselves (TextInput). */
export function useFontStack() {
  return useContext(FontContext) ? font : systemFont
}

export type TypeVariant = keyof typeof type
export type TypeWeight = 'regular' | 'medium' | 'semibold' | 'bold'
export type TypeTone = 'base' | 'muted' | 'faint' | 'inverse' | 'inverseMuted' | string

const TONE_MAP: Record<string, string> = {
  base: ink.base,
  muted: ink.muted,
  faint: ink.faint,
  inverse: ink.inverse,
  inverseMuted: ink.inverseMuted,
}

/** Variants set in the display face. */
const DISPLAY: ReadonlySet<TypeVariant> = new Set<TypeVariant>(['hero', 'display', 'title', 'heading'])

export interface AppTextProps extends TextProps {
  variant?: TypeVariant
  weight?: TypeWeight
  /** Named tone, or any raw colour string. */
  tone?: TypeTone
  /** Force the figure face, e.g. for a coordinate readout. */
  mono?: boolean
  center?: boolean
  style?: StyleProp<TextStyle>
}

export function Text({ variant = 'body', weight, tone = 'base', mono = false, center = false, style, ...rest }: AppTextProps) {
  const stack = useContext(FontContext) ? font : systemFont
  const isFigure = mono || variant === 'data' || variant === 'dataLg'
  const isDisplay = DISPLAY.has(variant)

  const family = isFigure
    ? weight === 'regular' || weight === 'medium'
      ? stack.monoMedium
      : stack.monoSemibold
    : isDisplay
      ? weight === 'bold' || variant === 'hero'
        ? stack.displayBold
        : stack.display
      : stack[weight ?? 'regular']

  const merged = useMemo<StyleProp<TextStyle>>(
    () => [
      type[variant] as TextStyle,
      { fontFamily: family, color: TONE_MAP[tone] ?? tone },
      // The system fallback needs an explicit weight; custom families encode it in the name.
      !family && { fontWeight: isDisplay || weight === 'bold' ? '700' : weight === 'semibold' ? '600' : '400' },
      center && { textAlign: 'center' as const },
      style,
    ],
    [variant, family, tone, center, style, isDisplay, weight]
  )

  return <RNText style={merged} {...rest} />
}
