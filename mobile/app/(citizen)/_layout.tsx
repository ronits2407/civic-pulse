import React from 'react'
import { Redirect, Tabs } from 'expo-router'

import { PillTabBar } from '@/components/navigation/PillTabBar'
import { useAuth } from '@/lib/auth/AuthProvider'
import { surface } from '@/theme/tokens'

/**
 * Citizen navigation: Home, Reports, Map, You.
 *
 * Reporting is the primary action and lives on Home's hero and quick tiles rather than as
 * a tab: a tab you visit once and leave is a wasted slot. Verify moved off the bar into a
 * Home tile, because it only matters when something is waiting, and Home says so.
 *
 * The admin guard stays here as well as in the boot gate: a municipal session that
 * reaches this group is redirected out rather than shown citizen screens.
 */
export default function CitizenLayout() {
  const { status, isAdmin } = useAuth()

  if (status === 'signedIn' && isAdmin) {
    return <Redirect href="/municipality" />
  }

  return (
    <Tabs
      tabBar={(props) => <PillTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: surface.canvas } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="reports" options={{ title: 'Reports' }} />
      <Tabs.Screen name="map" options={{ title: 'Map' }} />
      <Tabs.Screen name="profile" options={{ title: 'You' }} />
      {/* Flows that live in this group but are not tabs. */}
      <Tabs.Screen name="report" options={{ href: null }} />
      <Tabs.Screen name="review" options={{ href: null }} />
    </Tabs>
  )
}
