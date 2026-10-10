import React from 'react'
import { Platform, StyleSheet, type ColorValue } from 'react-native'
import { Redirect, Tabs } from 'expo-router'

import { Icon, type IconName } from '@/theme/icons'
import { useAuth } from '@/lib/auth/AuthProvider'
import { tabBarColors } from '@/theme/navigation'
import { ink, space } from '@/theme/tokens'

/**
 * Citizen navigation.
 *
 * Four destinations, not five. Home carries the primary "report an issue" action as
 * its hero, so a dedicated Report tab would spend a permanent slot on a shortcut the
 * home screen already provides. Map, Verify and Profile are the three places a citizen
 * actually navigates to.
 *
 * The admin guard lives here as well as in the boot gate: a municipal session that
 * somehow reaches this group is redirected out rather than shown citizen screens.
 */

function tabIcon(name: IconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Icon name={name} size={size} color={color} />
  )
}

export default function CitizenLayout() {
  const { status, isAdmin } = useAuth()

  if (status === 'signedIn' && isAdmin) {
    return <Redirect href="/municipality" />
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tabBarColors.active,
        tabBarInactiveTintColor: tabBarColors.inactive,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        sceneStyle: { backgroundColor: '#0d1117' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: tabIcon('home-variant-outline') }}
      />
      <Tabs.Screen name="map" options={{ title: 'Map', tabBarIcon: tabIcon('map-outline') }} />
      <Tabs.Screen
        name="review"
        options={{ title: 'Verify', tabBarIcon: tabIcon('shield-check-outline') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: tabIcon('account-outline') }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: tabBarColors.background,
    borderTopColor: tabBarColors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    height: Platform.OS === 'ios' ? 84 : 62,
    paddingTop: space.sm,
    paddingBottom: Platform.OS === 'ios' ? space.xxl : space.sm,
  },
  tabItem: { paddingVertical: 0 },
  tabLabel: { fontSize: 11, fontWeight: '600', color: ink.muted },
})
