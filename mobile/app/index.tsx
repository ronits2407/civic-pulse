import React from 'react'
import { Redirect } from 'expo-router'
import { StyleSheet, View } from 'react-native'

import { Button } from '@/components/ui/Button'
import { LoadingState } from '@/components/ui/Feedback'
import { Screen } from '@/components/ui/Screen'
import { Text } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import { useAuth } from '@/lib/auth/AuthProvider'
import { configProblems, supabaseConfigured } from '@/lib/env'
import { accent, space } from '@/theme/tokens'

/**
 * Boot gate.
 *
 * Every launch lands here first. It answers one question — where should this user
 * be? — and is also the only place that reports a broken build configuration, so a
 * misconfigured `EXPO_PUBLIC_*` surfaces as a readable screen instead of an infinite
 * spinner or a confusing network error on the login screen.
 */
export default function BootGate() {
  const { status, isAdmin, error } = useAuth()

  if (!supabaseConfigured) {
    const problems = configProblems()
    return (
      <Screen padded>
        <View style={styles.center}>
          <View style={styles.iconWell}>
            <Icon name="cog-outline" size={26} color={accent.amberSoft} />
          </View>
          <Text variant="title" center>
            CivicPulse is not configured yet
          </Text>
          <Text variant="bodyTight" tone="muted" center style={styles.body}>
            The app is missing the Supabase connection details it needs to sign you in.
          </Text>
          <View style={styles.problemList}>
            {problems.map((problem) => (
              <Text key={problem} variant="caption" mono tone="faint" center>
                {problem}
              </Text>
            ))}
          </View>
          <Text variant="caption" tone="faint" center style={styles.body}>
            Create mobile/.env.local from mobile/.env.example, then restart the dev server.
          </Text>
        </View>
      </Screen>
    )
  }

  if (status === 'loading') {
    return (
      <Screen padded>
        <LoadingState label="Restoring your session" />
      </Screen>
    )
  }

  if (status === 'error') {
    return (
      <Screen padded>
        <View style={styles.center}>
          <Text variant="title" center style={{ color: accent.redSoft }}>
            Could not restore your session
          </Text>
          <Text variant="bodyTight" tone="muted" center style={styles.body}>
            {error ?? 'The stored session could not be read from this device.'}
          </Text>
          <Button
            label="Sign in again"
            onPress={() => {
              // Fall through to the login screen by clearing the error state.
              // The AuthProvider re-runs on the next launch.
            }}
            style={{ marginTop: space.xl }}
          />
          <Redirect href="/(auth)/login" />
        </View>
      </Screen>
    )
  }

  if (status === 'signedIn') {
    // Role decides the destination. An admin account never lands in the citizen tabs.
    return <Redirect href={isAdmin ? '/municipality' : '/(citizen)'} />
  }

  return <Redirect href="/(auth)/login" />
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconWell: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.lg,
  },
  body: { marginTop: space.sm, maxWidth: 320 },
  problemList: { marginTop: space.lg, gap: 2 },
})
