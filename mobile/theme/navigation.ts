import type { NativeStackNavigationOptions } from 'expo-router'

import { ink, surface } from '@/theme/tokens'

/**
 * Navigation chrome.
 *
 * Native headers are hidden everywhere: each screen draws its own floating round back
 * button (components/ui/TopBar) so the title can sit inside the content, as large type,
 * rather than in a thin system bar.
 */
export const pushedScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  headerTintColor: ink.base,
  contentStyle: { backgroundColor: surface.canvas },
  animation: 'slide_from_right',
  animationDuration: 280,
}

export const modalScreenOptions: NativeStackNavigationOptions = {
  ...pushedScreenOptions,
  presentation: 'modal',
  animation: 'slide_from_bottom',
}

export const tabRootScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: surface.canvas },
}

export const tabBarColors = {
  active: ink.inverse,
  inactive: ink.faint,
  background: surface.card,
  border: 'transparent',
} as const
