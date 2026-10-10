import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import type { Session } from '@supabase/supabase-js'

import { setAuthTokenProvider } from '@/lib/api/client'
import { fetchMyProfile, type MyProfile } from '@/lib/api/issues-repo'
import { env } from '@/lib/env'
import { supabase } from '@/lib/supabase/client'
import type { UserRole } from '@/types/civicpulse'

/**
 * Authentication for the native client.
 *
 * The web app authenticates through Next.js server actions and stores the session
 * in httpOnly cookies. Neither of those exists on a phone, so this provider keeps
 * the session in the keystore-backed Supabase client instead and exposes the same
 * concepts the web app has: a user, a role, and a sign-out.
 *
 * Role comes from the `profiles` row (citizen | admin), exactly as it does on the
 * web. It drives navigation: an admin account must never be dropped into the
 * citizen tabs.
 */

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'error'

interface AuthContextValue {
  status: AuthStatus
  /** Populated whenever `status` is 'signedIn'. */
  session: Session | null
  userId: string | null
  email: string | null
  displayName: string | null
  avatarUrl: string | null
  role: UserRole
  profile: MyProfile | null
  /** Set when session restoration or profile loading failed. */
  error: string | null
  isAdmin: boolean
  sendEmailCode: (email: string) => Promise<void>
  verifyEmailCode: (email: string, token: string) => Promise<void>
  signInWithGoogle: () => Promise<{ cancelled: boolean }>
  completeOAuthRedirect: (url: string) => Promise<{ ok: boolean; message?: string }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Supabase puts either `code` or an error in the redirect fragment/query. */
function readRedirectParams(url: string) {
  const parsed = Linking.parse(url)
  const params = { ...(parsed.queryParams ?? {}) } as Record<string, string | undefined>
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : ''
  if (hash) {
    for (const pair of hash.split('&')) {
      const [k, v] = pair.split('=')
      if (k && v && params[k] === undefined) params[k] = decodeURIComponent(v)
    }
  }
  return params
}

/**
 * The signup trigger creates the profile row, so a brand-new account can briefly
 * race the trigger. Retry a few times before declaring the profile missing.
 */
async function loadProfileWithRetry(userId: string, attempts = 3) {
  let lastError: unknown = null
  for (let i = 0; i < attempts; i++) {
    try {
      const profile = await fetchMyProfile(userId)
      if (profile) return profile
    } catch (err) {
      lastError = err
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 600))
  }
  if (lastError) throw lastError
  return null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<MyProfile | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Keeps the token provider stable without re-registering on every render.
  const sessionRef = useRef<Session | null>(null)
  sessionRef.current = session

  useEffect(() => {
    // The API client pulls the token lazily from this ref on every request.
    setAuthTokenProvider(async () => sessionRef.current?.access_token ?? null)
  }, [])

  const hydrate = useCallback(async (next: Session | null) => {
    if (!next?.user) {
      setSession(null)
      setProfile(null)
      setStatus('signedOut')
      return
    }

    setSession(next)
    try {
      const loaded = await loadProfileWithRetry(next.user.id)
      setProfile(loaded)
      setError(null)
      setStatus('signedIn')
    } catch (err: any) {
      // The session is valid but the profile read failed. Denying access entirely
      // would be worse than proceeding with a conservative default role.
      setProfile(null)
      setError(err?.message ?? 'Could not load your profile.')
      setStatus('signedIn')
    }
  }, [])

  // ── Session restoration + change subscription ─────────────────────────────
  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession()
        if (cancelled) return
        if (sessionError) {
          setError(sessionError.message)
          setStatus('error')
          return
        }
        await hydrate(data.session ?? null)
      } catch (err: any) {
        if (cancelled) return
        setError(err?.message ?? 'Could not restore your session.')
        setStatus('error')
      }
    })()

    const { data: sub } = supabase.auth.onAuthStateChange((event: string, next: Session | null) => {
      if (cancelled) return
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setProfile(null)
        setStatus('signedOut')
        return
      }
      // TOKEN_REFRESHED / SIGNED_IN / USER_UPDATED all warrant a re-hydrate.
      hydrate(next)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [hydrate])

  // ── Email OTP ─────────────────────────────────────────────────────────────
  const sendEmailCode = useCallback(async (email: string) => {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) throw new Error('Enter your email address.')

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        shouldCreateUser: true,
        // Tapping the emailed link opens the app and lands on auth-callback,
        // which performs the same code exchange as the typed-code path.
        emailRedirectTo: env.authRedirect,
      },
    })
    if (otpError) throw new Error(otpError.message)
  }, [])

  const verifyEmailCode = useCallback(
    async (email: string, token: string) => {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: token.trim(),
        type: 'email',
      })
      if (verifyError) throw new Error(verifyError.message)
      // onAuthStateChange fires SIGNED_IN and hydrates for us.
    },
    []
  )

  // ── Google OAuth ──────────────────────────────────────────────────────────
  const signInWithGoogle = useCallback(async () => {
    if (__DEV__) {
      // Whatever prints here must be in Supabase > Authentication > URL Configuration >
      // Redirect URLs, or Supabase falls back to the Site URL (localhost:3000).
      console.log('[auth] OAuth redirectTo =', env.authRedirect)
    }

    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: env.authRedirect,
        // Native has no address bar to redirect — we open the session ourselves
        // and read the code out of the deep link that comes back.
        skipBrowserRedirect: true,
      },
    })
    if (oauthError) throw new Error(oauthError.message)
    if (!data?.url) throw new Error('Google sign-in could not be started.')

    const result = await WebBrowser.openAuthSessionAsync(data.url, env.authRedirect)
    if (result.type !== 'success' || !result.url) {
      return { cancelled: true }
    }

    const outcome = await completeOAuthRedirectInternal(result.url)
    if (!outcome.ok) throw new Error(outcome.message ?? 'Google sign-in failed.')
    return { cancelled: false }
  }, [])

  const completeOAuthRedirectInternal = useCallback(
    async (url: string): Promise<{ ok: boolean; message?: string }> => {
      const params = readRedirectParams(url)

      if (params.error) {
        return { ok: false, message: params.error_description ?? params.error }
      }
      if (!params.code) {
        return { ok: false, message: 'The sign-in link was missing its code.' }
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(params.code)
      if (exchangeError) return { ok: false, message: exchangeError.message }
      return { ok: true }
    },
    []
  )

  /**
   * Used by `app/auth-callback.tsx` when the OS hands us a deep link
   * (email magic link, or an OAuth redirect the browser session did not capture).
   */
  const completeOAuthRedirect = useCallback(
    (url: string) => completeOAuthRedirectInternal(url),
    [completeOAuthRedirectInternal]
  )

  // ── Sign out ──────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    // Clear local state first so the UI never shows a half-signed-in frame.
    setSession(null)
    setProfile(null)
    setStatus('signedOut')
    await supabase.auth.signOut()
  }, [])

  const refreshProfile = useCallback(async () => {
    const userId = sessionRef.current?.user?.id
    if (!userId) return
    try {
      setProfile(await fetchMyProfile(userId))
    } catch {
      // A failed refresh keeps the previous profile on screen.
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? null
    const metadata = (user?.user_metadata ?? {}) as Record<string, any>
    const role: UserRole = (profile?.role as UserRole) ?? 'citizen'

    return {
      status,
      session,
      userId: user?.id ?? null,
      email: user?.email ?? null,
      displayName: metadata.full_name ?? metadata.name ?? null,
      avatarUrl: metadata.avatar_url ?? metadata.picture ?? null,
      role,
      profile,
      error,
      isAdmin: role === 'admin',
      sendEmailCode,
      verifyEmailCode,
      signInWithGoogle,
      completeOAuthRedirect,
      signOut,
      refreshProfile,
    }
  }, [
    status,
    session,
    profile,
    error,
    sendEmailCode,
    verifyEmailCode,
    signInWithGoogle,
    completeOAuthRedirect,
    signOut,
    refreshProfile,
  ])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
