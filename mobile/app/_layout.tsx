import React, { useEffect, useState } from 'react'
import { StyleSheet } from 'react-native'
import { Stack } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'

import {
  Mukta_400Regular,
  Mukta_500Medium,
  Mukta_600SemiBold,
  Mukta_700Bold,
  useFonts,
} from '@expo-google-fonts/mukta'
import {
  AnekLatin_500Medium,
  AnekLatin_600SemiBold,
  AnekLatin_700Bold,
  useFonts as useDisplayFonts,
} from '@expo-google-fonts/anek-latin'

import { ToastHost } from '@/components/feedback/ToastHost'
import { AuthProvider } from '@/lib/auth/AuthProvider'
import { FontProvider } from '@/theme/Typography'
import { pushedScreenOptions } from '@/theme/navigation'
import { surface } from '@/theme/tokens'

// Held until fonts settle so the first frame is never a flash of fallback type.
SplashScreen.preventAutoHideAsync().catch(() => {})

/**
 * Root layout.
 *
 * Provider order matters: SafeAreaProvider must wrap anything that reads insets
 * (the toast host does), and FontProvider must wrap every `Text` in the tree.
 */
export default function RootLayout() {
  const [bodyLoaded, bodyError] = useFonts({
    Mukta_400Regular,
    Mukta_500Medium,
    Mukta_600SemiBold,
    Mukta_700Bold,
  })
  const [displayLoaded, displayError] = useDisplayFonts({
    AnekLatin_500Medium,
    AnekLatin_600SemiBold,
    AnekLatin_700Bold,
  })

  /**
   * A font failure must never block the app. If the .ttf files cannot be loaded the
   * app proceeds on system faces (see FontProvider), so we stop waiting either when
   * they arrive OR when they definitively fail.
   */
  const fontsSettled = (bodyLoaded && displayLoaded) || Boolean(bodyError || displayError)
  const fontsReady = bodyLoaded && displayLoaded

  const [timedOut, setTimedOut] = useState(false)
  useEffect(() => {
    // Backstop: some Android devices never resolve the font promise at all.
    const t = setTimeout(() => setTimedOut(true), 3000)
    return () => clearTimeout(t)
  }, [])

  const ready = fontsSettled || timedOut

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {})
  }, [ready])

  if (!ready) return null

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <FontProvider loaded={fontsReady}>
          <AuthProvider>
            <ToastHost>
              <StatusBar style="dark" />
              <Stack screenOptions={{ ...pushedScreenOptions, headerShown: false }}>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen name="(citizen)" options={{ headerShown: false }} />
                <Stack.Screen name="municipality" options={{ headerShown: false }} />
                <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
                <Stack.Screen name="issue/[id]" options={{ title: 'Report detail' }} />
                <Stack.Screen name="leaderboard" options={{ title: 'Karma leaderboard' }} />
                <Stack.Screen name="receipt" options={{ title: 'Impact receipt' }} />
                <Stack.Screen name="emergency-network" options={{ title: 'Emergency network' }} />
              </Stack>
            </ToastHost>
          </AuthProvider>
        </FontProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: surface.canvas },
})
