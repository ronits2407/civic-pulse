import React, { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import * as Linking from 'expo-linking'

import { Button } from '@/components/ui/Button'
import { LoadingState } from '@/components/ui/Feedback'
import { Screen } from '@/components/ui/Screen'
import { Text } from '@/theme/Typography'
import { useAuth } from '@/lib/auth/AuthProvider'
import { accent, space } from '@/theme/tokens'

/**
 * Deep-link recipient.
 *
 * Two things arrive here: an emailed magic link, and (as a safety net) a Google
 * OAuth redirect the in-app browser session did not intercept. Both carry a `code`
 * that must be exchanged for a session — the native equivalent of the web app's
 * `/auth/callback` route, which does the same job by writing cookies.
 */
export default function AuthCallbackScreen() {
  const url = Linking.useURL()
  const router = useRouter()
  const { completeOAuthRedirect, status, isAdmin } = useAuth()

  const [failed, setFailed] = useState<string | null>(null)
  const handledRef = useRef(false)

  useEffect(() => {
    // Only the first URL is actionable; React Navigation can re-emit it.
    if (!url || handledRef.current) return
    handledRef.current = true

    ;(async () => {
      const result = await completeOAuthRedirect(url)
      if (!result.ok) setFailed(result.message ?? 'This sign-in link could not be used.')
    })()
  }, [url, completeOAuthRedirect])

  // No URL at all means the screen was opened directly rather than via a link.
  useEffect(() => {
    if (url) return
    const t = setTimeout(() => {
      if (!handledRef.current) setFailed('No sign-in link was provided.')
    }, 1500)
    return () => clearTimeout(t)
  }, [url])

  if (status === 'signedIn') {
    return <Redirect href={isAdmin ? '/municipality' : '/(citizen)'} />
  }

  if (failed) {
    return (
      <Screen padded>
        <View style={styles.center}>
          <Text variant="title" center style={{ color: accent.redSoft }}>
            Sign-in link failed
          </Text>
          <Text variant="bodyTight" tone="muted" center style={styles.body}>
            {failed}
          </Text>
          <Button
            label="Back to sign in"
            onPress={() => router.replace('/(auth)/login')}
            style={{ marginTop: space.xl }}
          />
        </View>
      </Screen>
    )
  }

  return (
    <Screen padded>
      <LoadingState label="Signing you in" />
    </Screen>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { marginTop: space.sm, maxWidth: 320 },
})
