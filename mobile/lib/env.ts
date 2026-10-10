import Constants from 'expo-constants'
import * as Linking from 'expo-linking'

/** Trailing slashes break every route join, so strip once here. */
function trim(url: string) {
  return url.replace(/\/+$/, '')
}

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>

/**
 * The deep link the auth provider must bounce back to.
 *
 * This is derived at runtime rather than hardcoded because the right value depends on
 * how the app is hosted:
 *   - Expo Go            -> exp://<metro-host>:8081/--/auth-callback
 *   - dev / release build -> civicpulse://auth-callback
 * Expo Go does not own the `civicpulse://` scheme, so a hardcoded custom-scheme URL
 * can never return to the app there.
 *
 * Whatever this resolves to MUST be present in Supabase -> Authentication ->
 * URL Configuration -> Redirect URLs. If it is not, Supabase ignores `redirectTo` and
 * falls back to the project's Site URL (localhost:3000 in development), which is exactly
 * the "browser opens localhost instead of returning to the app" failure.
 *
 * `EXPO_PUBLIC_AUTH_REDIRECT` can still force a value, e.g. for a fixed production link.
 */
function authRedirectUrl(): string {
  const override = process.env.EXPO_PUBLIC_AUTH_REDIRECT?.trim()
  if (override) return override
  return Linking.createURL('auth-callback')
}

/**
 * Base URL of the Next.js backend.
 *
 * Precedence:
 *   1. EXPO_PUBLIC_API_URL, when set. Always wins - use it for production (Cloud Run)
 *      or to point a dev build at a specific machine.
 *   2. In development only: the machine Metro is running on, port 3000. The backend
 *      runs on the same computer as the dev server, so whichever host Expo Go used to
 *      load the app is also the right host for the API:
 *        - physical phone over Wi-Fi     -> http://<mac-lan-ip>:3000
 *        - emulator / phone via adb reverse -> http://127.0.0.1:3000
 *      This is why there is no fixed default: the old `10.0.2.2` default only exists
 *      inside the Android emulator and is unreachable from a real phone.
 *   3. app.config.ts `extra.apiUrl` (a last-resort build-time value).
 */
function resolveApiUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL?.trim()
  if (explicit) return trim(explicit)

  if (__DEV__) {
    // e.g. "192.168.1.20:8081" or "127.0.0.1:8081"
    const hostUri = Constants.expoConfig?.hostUri ?? ''
    const host = hostUri.split(':')[0]
    if (host) return `http://${host}:3000`
  }

  return trim(extra.apiUrl ?? '')
}

export const env = {
  /** Existing Supabase project. Anon key only — never the service-role key. */
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  /** Existing Next.js backend that hosts the 6-agent pipeline. */
  apiUrl: resolveApiUrl(),
  /** Deep link the auth provider should bounce back to. */
  authRedirect: authRedirectUrl(),
  /** Public, Android-restricted Maps SDK key. Empty string ⇒ maps degrade gracefully. */
  mapsKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? '',
} as const

export const supabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey)
export const apiConfigured = Boolean(env.apiUrl)

/** A single human-readable line describing what is missing, for the error screen. */
export function configProblems(): string[] {
  const problems: string[] = []
  if (!env.supabaseUrl) problems.push('EXPO_PUBLIC_SUPABASE_URL is not set')
  if (!env.supabaseAnonKey) problems.push('EXPO_PUBLIC_SUPABASE_ANON_KEY is not set')
  if (!env.apiUrl) problems.push('EXPO_PUBLIC_API_URL is not set')
  return problems
}
