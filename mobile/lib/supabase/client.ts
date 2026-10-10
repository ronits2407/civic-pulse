// Must run before anything touches Supabase: React Native's URL implementation
// lacks pieces the Supabase SDK relies on for OAuth and deep links.
import 'react-native-url-polyfill/auto'

import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import { secureSessionStorage } from '@/lib/storage/session-storage'

const fallbackUrl = 'https://placeholder.supabase.co'
const fallbackKey = 'placeholder-anon-key'

/**
 * The existing Supabase project, shared with the web app.
 *
 * Differences from the web client and why they matter:
 *  - `storage` is the keystore-backed adapter, so the session survives app restarts.
 *  - `detectSessionInUrl` is off: there is no `window.location` to sniff on native.
 *    Deep links are handled explicitly in `app/auth-callback.tsx`.
 *  - `flowType: 'pkce'` gives us an auth code to exchange after an OAuth round trip,
 *    which is the right model for a custom-scheme redirect.
 */
export const supabase = createClient(env.supabaseUrl || fallbackUrl, env.supabaseAnonKey || fallbackKey, {
  auth: {
    storage: secureSessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
  realtime: { params: { eventsPerSecond: 5 } },
})
