import type { NativeStackNavigationOptions } from 'expo-router'

import { accent, ink, line, surface } from '@/theme/tokens'

/**
 * Shared header styling for pushed (non-tab) routes.
 *
 * Headers are used for anything the citizen drills into and can back out of — issue
 * detail, leaderboard, receipt — while tab roots render their own large in-content
 * titles. That split keeps orientation obvious without wasting vertical space on the
 * tab roots, which is where phone screens are tightest.
 */

export const pushedScreenOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: surface.canvas },
  headerTitleStyle: { color: ink.base, fontSize: 16 },
  headerTintColor: accent.brand,
  headerShadowVisible: false,
  headerBackButtonDisplayMode: 'minimal',
  contentStyle: { backgroundColor: surface.canvas },
  animation: 'slide_from_right',
}

export const modalScreenOptions: NativeStackNavigationOptions = {
  ...pushedScreenOptions,
  presentation: 'modal',
  animation: 'slide_from_bottom',
}

/** Tab header is hidden; each tab renders its own title inside the scroll view. */
export const tabRootScreenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: surface.canvas },
}

export const tabBarColors = {
  active: accent.brand,
  inactive: ink.faint,
  background: surface.card,
  border: line.base,
} as const
