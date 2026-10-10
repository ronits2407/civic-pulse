import React, { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'

import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Feedback'
import { CodeBoxes } from '@/components/auth/CodeBoxes'
import { Rise } from '@/components/ui/Motion'
import { TopBar } from '@/components/ui/TopBar'
import { Screen } from '@/components/ui/Screen'
import { useToast } from '@/components/feedback/ToastHost'
import { Text } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import { useAuth } from '@/lib/auth/AuthProvider'
import { accent, ink, radius, space, surface } from '@/theme/tokens'

const CODE_LENGTH = 6
const RESEND_COOLDOWN_S = 30

/**
 * Email code verification.
 *
 * The code path is used rather than a pure magic link because it survives the most
 * common real-world case: the citizen reads the email on a laptop and types the code
 * into their phone. The deep-link path still works (see app/auth-callback.tsx), so a
 * tap on the emailed link opens the app directly.
 *
 * Server-side requirement: the Supabase "Magic Link" email template must include
 * `{{ .Token }}` for the six-digit code to be present in the message.
 */
export default function VerifyScreen() {
  const router = useRouter()
  const toast = useToast()
  const params = useLocalSearchParams<{ email?: string }>()
  const email = typeof params.email === 'string' ? params.email : ''

  const { verifyEmailCode, sendEmailCode } = useAuth()
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S)

  // Guards against a second auto-submit while the first is still in flight.
  const submittedRef = useRef(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  const handleVerify = useCallback(
    async (value: string) => {
      if (submittedRef.current) return
      if (value.length !== CODE_LENGTH) {
        setError(`Enter the ${CODE_LENGTH}-digit code from your email.`)
        return
      }

      submittedRef.current = true
      setVerifying(true)
      setError(null)
      try {
        await verifyEmailCode(email, value)
        // The auth listener picks up SIGNED_IN and the boot gate routes onward.
        toast.success('Signed in.')
      } catch (err: any) {
        setError(err?.message ?? 'That code did not work. Check it and try again.')
        setCode('')
        submittedRef.current = false
      } finally {
        setVerifying(false)
      }
    },
    [email, verifyEmailCode, toast]
  )

  const handleChange = useCallback(
    (value: string) => {
      const digits = value.replace(/\D/g, '').slice(0, CODE_LENGTH)
      setCode(digits)
      if (error) setError(null)
      // Auto-submit the moment the last digit lands — one less tap on a phone.
      if (digits.length === CODE_LENGTH) handleVerify(digits)
    },
    [error, handleVerify]
  )

  const handleResend = useCallback(async () => {
    if (resending || cooldown > 0) return
    setResending(true)
    try {
      await sendEmailCode(email)
      setCooldown(RESEND_COOLDOWN_S)
      toast.info('A new code is on its way.')
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not resend the code.')
    } finally {
      setResending(false)
    }
  }, [resending, cooldown, sendEmailCode, email, toast])

  return (
    <Screen padded scroll avoidKeyboard edges={['top', 'bottom']} contentContainerStyle={styles.content}>
      <TopBar onBack={() => router.replace('/(auth)/login')} />

      <Rise index={0} style={styles.header}>
        <View style={styles.iconWell}>
          <Icon name="email-fast-outline" size={28} color={ink.inverse} />
        </View>
        <Text variant="display">Check your email</Text>
        <Text variant="body" tone="muted">
          We sent a {CODE_LENGTH}-digit code to{' '}
          <Text variant="body" weight="semibold">
            {email || 'your email address'}
          </Text>
        </Text>
      </Rise>

      <Rise index={1} style={styles.form}>
        <CodeBoxes value={code} onChange={handleChange} length={CODE_LENGTH} error={Boolean(error)} editable={!verifying} />
        {error ? (
          <Text variant="caption" style={{ color: accent.red }}>
            {error}
          </Text>
        ) : null}
        <Button
          label="Verify and continue"
          onPress={() => handleVerify(code)}
          loading={verifying}
          disabled={code.length !== CODE_LENGTH}
          fullWidth
          size="lg"
          trailingArrow
        />
        <View style={styles.actions}>
          <Button
            label={cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            onPress={handleResend}
            variant="ghost"
            size="sm"
            loading={resending}
            disabled={cooldown > 0 || resending}
          />
          <Button label="Use a different email" onPress={() => router.replace('/(auth)/login')} variant="ghost" size="sm" />
        </View>
      </Rise>

      <Notice
        tone="blue"
        body="You can also tap the link in the email. It opens CivicPulse and signs you in."
        icon={<Icon name="link-variant" size={16} color={accent.blue} />}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: space.xxl },
  header: { gap: space.sm, marginTop: space.lg },
  iconWell: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ink.base,
    marginBottom: space.sm,
  },
  form: { gap: space.lg, backgroundColor: surface.card, borderRadius: radius.xl, padding: space.xl },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' },
})
