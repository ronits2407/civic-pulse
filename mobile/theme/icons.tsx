import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import type { ColorValue } from 'react-native'

/**
 * Single icon entry point.
 *
 * Routing every glyph through one component keeps the icon family swappable and,
 * more usefully, makes the name type-checked — `IconName` is derived from the
 * font's own glyph map, so a typo fails the build instead of rendering a blank box.
 */

export type IconName = keyof typeof MaterialCommunityIcons.glyphMap

export const glyphMap = MaterialCommunityIcons.glyphMap

/** Per-category glyphs, matching the icons the web dashboard assigns. */
export const CATEGORY_ICON: Record<string, IconName> = {
  infrastructure: 'wrench-outline',
  sanitation: 'trash-can-outline',
  safety: 'shield-alert-outline',
  utilities: 'flash-outline',
  environment: 'leaf',
  miscellaneous: 'information-outline',
}

export const FALLBACK_CATEGORY_ICON: IconName = 'information-outline'

export function Icon({
  name,
  size = 18,
  color,
}: {
  name: IconName
  size?: number
  /** Accepts `ColorValue` because navigation passes an `OpaqueColorValue`. */
  color?: ColorValue
}) {
  return <MaterialCommunityIcons name={name} size={size} color={color as string | undefined} />
}
