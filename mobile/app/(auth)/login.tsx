import React, { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Link, useRouter } from 'expo-router'

import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Feedback'
import { Input } from '@/components/ui/Input'
import { Screen } from '@/components/ui/Screen'
import { useToast } from '@/components/feedback/ToastHost'
import { PipelineRail } from '@/components/pipeline/PipelineRail'
import { Text } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import { useAuth } from '@/lib/auth/AuthProvider'
import { env } from '@/lib/env'
import { accent, ink, line, radius, space, surface } from '@/theme/tokens'

/**
 * Sign-in.
 *
 * The hero is the pipeline itself. Rather than a generic logo block, the first thing
 * a new citizen sees is the five agents that will handle their report — which is
 * simultaneously the brand mark and an explanation of what the app does.
 *
 * Note there is no "sign in as municipal" switch. The web app lets a login URL
 * promote an account to admin; the mobile client deliberately does not, because that
 * is a privilege escalation reachable by anyone who can edit a link. Role is read
 * from the profile after authentication and routes the user accordingly.
 */
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
    <Screen padded scroll contentContainerStyle={styles.content}>
      {/* Hero: the product explains itself */}
      <View style={styles.hero}>
        <View style={styles.markRow}>
          <View style={styles.mark}>
            <Icon name="city-variant-outline" size={20} color={accent.brand} />
          </View>
          <Text variant="title" weight="bold">
            CivicPulse
          </Text>
        </View>

        <Text variant="body" tone="muted" style={styles.tagline}>
          Report a civic problem. Five AI agents classify it, check it against nearby
          reports, verify it, and hand it to the right department with a deadline.
        </Text>

        <View style={styles.railCard}>
          <PipelineRail stage={null} showLabels />
        </View>
      </View>

      {/* Form */}
      <View style={styles.form}>
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

        <Button
          label="Send sign-in code"
          onPress={handleEmail}
          loading={sending}
          disabled={googleBusy}
          fullWidth
          size="lg"
        />

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text variant="micro" weight="medium" tone="faint">
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
          icon={<Icon name="google" size={18} color={ink.base} />}
        />

        <Notice
          body="Municipal staff accounts are recognised automatically and open the municipal console instead of the citizen app."
          icon={<Icon name="shield-account-outline" size={15} color={accent.blue} />}
          tone="blue"
        />

        {__DEV__ ? (
          <Notice
            tone="amber"
            title="Dev: Google redirect URL"
            body={`This device sends:\n${env.authRedirect}\n\nIf Google lands on localhost:3000, Supabase rejected it. Add this exact URL to Supabase > Authentication > URL Configuration > Redirect URLs, then run: sh scripts/check-auth-redirect.sh '${env.authRedirect}'`}
          />
        ) : null}

        <Text variant="caption" tone="faint" center style={styles.legal}>
          By continuing you agree to report in good faith. Reports are public and
          verified by neighbours.
        </Text>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center' },
  hero: { gap: space.md },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  mark: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(45,164,78,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(45,164,78,0.4)',
  },
  tagline: { maxWidth: 420 },
  railCard: {
    marginTop: space.sm,
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line.base,
    backgroundColor: surface.card,
  },
  form: { marginTop: space.xxxl, gap: space.lg },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: line.soft },
  legal: { marginTop: space.sm, maxWidth: 340, alignSelf: 'center' },
})
