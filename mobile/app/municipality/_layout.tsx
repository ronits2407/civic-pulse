import React from 'react'
import { Redirect, Stack } from 'expo-router'

import { ErrorState, LoadingState } from '@/components/ui/Feedback'
import { Screen } from '@/components/ui/Screen'
import { useAuth } from '@/lib/auth/AuthProvider'
import { pushedScreenOptions } from '@/theme/navigation'

/**
 * Municipality route boundary.
 *
 * This group is the extension point for a future native municipal console. It exists
 * now for two reasons: to guarantee that a citizen session can never render municipal
 * screens, and to give the future work an obvious home instead of forcing it into the
 * citizen tab tree.
 */
export default function MunicipalityLayout() {
  const { status, isAdmin, error } = useAuth()

  if (status === 'loading') {
    return (
      <Screen padded>
        <LoadingState label="Checking your access" />
      </Screen>
    )
  }

  if (status === 'error') {
    return (
      <Screen padded>
        <ErrorState title="Could not verify your access" message={error} />
      </Screen>
    )
  }

  if (status !== 'signedIn') {
    return <Redirect href="/(auth)/login" />
  }

  // A citizen account must never see this group.
  if (!isAdmin) {
    return <Redirect href="/(citizen)" />
  }

  return (
    <Stack screenOptions={pushedScreenOptions}>
      <Stack.Screen name="index" options={{ title: 'Municipal console' }} />
    </Stack>
  )
}
