import React, { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'

import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Feedback'
import { Input } from '@/components/ui/Input'
import { Screen } from '@/components/ui/Screen'
import { useToast } from '@/components/feedback/ToastHost'
import { Rail } from '@/components/pipeline/Rail'
import { Card } from '@/components/ui/Card'
import { Rise } from '@/components/ui/Motion'
import { Text } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import { useAuth } from '@/lib/auth/AuthProvider'
import { env } from '@/lib/env'
import { accent, ink, radius, space } from '@/theme/tokens'

/**
 * Sign-in.
 *
 * The hero is the pipeline itself, on navy, with the first agent already working. Rather than a generic logo block, the first thing
 * a new citizen sees is the five agents that will handle their report — which is
 * simultaneously the brand mark and an explanation of what the app does.
 *
 * Note there is no "sign in as municipal" switch. The web app lets a login URL
 * promote an account to admin; the mobile client deliberately does not, because that
 * is a privilege escalation reachable by anyone who can edit a link. Role is read
 * from the profile after authentication and routes the user accordingly.
 */
/**
 * The redirect-URL banner is shown in every build (development AND the release APK) so the
 * exact URL a phone sends can be allow-listed in Supabase. Set EXPO_PUBLIC_SHOW_AUTH_DEBUG=0
 * when building for the public to hide it.
 */
const SHOW_AUTH_DEBUG = __DEV__ || process.env.EXPO_PUBLIC_SHOW_AUTH_DEBUG !== '0'

export default function LoginScreen() {
  const router = useRouter()
  const toast = useToast()
  const { sendEmailCode, signInWithGoogle } = useAuth()

  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleEmail = useCallback(async () => {
    if (sending) return
    const trimmed = email.trim()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setError('Enter a valid email address.')
      return
    }

    setSending(true)
    setError(null)
    try {
      await sendEmailCode(trimmed)
      router.push({ pathname: '/(auth)/verify', params: { email: trimmed } })
    } catch (err: any) {
      setError(err?.message ?? 'Could not send the code. Try again.')
    } finally {
      setSending(false)
    }
  }, [email, sending, sendEmailCode, router])

  const handleGoogle = useCallback(async () => {
    if (googleBusy) return
    setGoogleBusy(true)
    setError(null)
    try {
      const result = await signInWithGoogle()
      if (result.cancelled) {
        toast.info('Google sign-in was cancelled.')
      }
      // On success the auth listener redirects via the boot gate.
    } catch (err: any) {
      setError(err?.message ?? 'Google sign-in failed.')
    } finally {
      setGoogleBusy(false)
    }
  }, [googleBusy, signInWithGoogle, toast])

  return (
    <Screen padded scroll avoidKeyboard edges={['top', 'bottom']} contentContainerStyle={styles.content}>
      <Rise index={0}>
        <Card variant="hero" style={styles.hero}>
          <View style={styles.markRow}>
            <View style={styles.mark}>
              <Icon name="city-variant-outline" size={22} color={ink.base} />
            </View>
            <Text variant="heading" tone="inverse">
              CivicPulse
            </Text>
          </View>
          <Text variant="display" tone="inverse">
            Fix your street, one report at a time
          </Text>
          <Text variant="bodyTight" tone="inverseMuted">
            Five AI agents classify your report, check it against nearby ones, verify it, and hand it to the right department with a deadline.
          </Text>
          <Rail stage="agent1_classifier" tone="onDark" style={styles.rail} />
        </Card>
      </Rise>

      <Rise index={1} style={styles.form}>
        <Text variant="title">Sign in</Text>
        <Input
          label="Email address"
          placeholder="you@example.com"
          value={email}
          onChangeText={(t) => {
            setEmail(t)
            if (error) setError(null)
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="go"
          onSubmitEditing={handleEmail}
          error={error}
          editable={!sending && !googleBusy}
        />
        <Button label="Email me a sign-in code" onPress={handleEmail} loading={sending} disabled={googleBusy} fullWidth size="lg" trailingArrow />

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text variant="caption" tone="faint">
            or
          </Text>
          <View style={styles.dividerLine} />
        </View>

        <Button
          label="Continue with Google"
          onPress={handleGoogle}
          loading={googleBusy}
          disabled={sending}
          variant="secondary"
          fullWidth
          size="lg"
          icon={<Icon name="google" size={20} color={ink.base} />}
        />

        <Text variant="caption" tone="faint" center style={styles.legal}>
          Municipal staff accounts open the municipal console automatically. Reports are public and verified by neighbours, so please report in good faith.
        </Text>

        {SHOW_AUTH_DEBUG ? (
          <Notice
            tone="amber"
            title="Google redirect URL"
            body={`This device sends:\n${env.authRedirect}\n\nIf Google lands on localhost:3000, Supabase rejected it. Add this exact URL to Supabase > Authentication > URL Configuration > Redirect URLs, then run: sh scripts/check-auth-redirect.sh '${env.authRedirect}'`}
          />
        ) : null}
      </Rise>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', gap: space.xxl, paddingTop: space.lg },
  hero: { gap: space.md, padding: space.xl, borderRadius: radius.xl },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm },
  mark: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: accent.kerb },
  rail: { marginTop: space.md },
  form: { gap: space.lg },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#D9D5CC' },
  legal: { maxWidth: 340, alignSelf: 'center' },
})
