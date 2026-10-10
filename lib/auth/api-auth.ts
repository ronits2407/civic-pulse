import { createClient } from '@supabase/supabase-js'

import { createServerSupabaseClient } from '@/lib/db/server'

/**
 * Resolve the identity behind an API request.
 *
 * Context — why this exists:
 * Several citizen-facing routes originally took `userId` straight out of the request
 * body or query string and trusted it. That is fine for a browser session that is
 * already backed by an httpOnly cookie, but it is not an authentication strategy: any
 * caller could claim to be anyone.
 *
 * The native client does not share the web app's cookies, so it authenticates with a
 * Supabase access token in the `Authorization: Bearer` header. This helper validates
 * that token server-side and gives the route a trustworthy user id.
 *
 * Resolution order, and the reasoning behind each step:
 *   1. Bearer token  — validated with Supabase. A malformed or expired token is a hard
 *                      401: the caller presented a credential and it was not accepted.
 *   2. Cookie session — preserves the existing web app behaviour unchanged.
 *   3. No credential at all — the caller supplied nothing. The route may fall back to
 *                      its legacy client-supplied id so the current web client keeps
 *                      working, but the caller is flagged as `unverified` so callers can
 *                      log it. This is a transitional state, not a security boundary.
 */

/**
 * Token validation intentionally uses the **publishable/anon** key, not the service
 * role key. Verifying a JWT is an auth-server call; it needs no elevated privilege,
 * and routing it through the service key would make API authentication fail whenever
 * that key is rotated, restricted or — as in this project — disabled in favour of
 * Supabase's newer key format.
 */
let authClient: ReturnType<typeof createClient> | null = null

function getAuthClient() {
  if (!authClient) {
    authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
    )
  }
  return authClient
}

export type IdentitySource = 'bearer' | 'cookie' | 'unverified' | 'none'

export interface ResolvedIdentity {
  /** Verified user id. Null when nothing could be verified. */
  userId: string | null
  source: IdentitySource
  /** Set when a credential was presented and rejected. */
  rejected?: string
}

export async function resolveApiIdentity(request: Request): Promise<ResolvedIdentity> {
  // ── 1. Bearer token (the native client) ───────────────────────────────────
  const header = request.headers.get('authorization') ?? request.headers.get('Authorization')
  if (header?.toLowerCase().startsWith('bearer ')) {
    const token = header.slice(7).trim()
    if (!token) return { userId: null, source: 'none', rejected: 'Empty bearer token' }

    try {
      const { data, error } = await getAuthClient().auth.getUser(token)
      if (error || !data?.user?.id) {
        return { userId: null, source: 'none', rejected: error?.message ?? 'Invalid token' }
      }
      return { userId: data.user.id, source: 'bearer' }
    } catch (err: any) {
      return { userId: null, source: 'none', rejected: err?.message ?? 'Token verification failed' }
    }
  }

  // ── 2. Cookie session (the web client) ────────────────────────────────────
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user?.id) return { userId: user.id, source: 'cookie' }
  } catch {
    // A missing or unreadable cookie is not an error — fall through.
  }

  return { userId: null, source: 'none' }
}

/**
 * Resolve the acting user id for a route.
 *
 * `legacyUserId` is the value the client used to send. It is returned only when no
 * credential was presented at all, so existing web callers keep working. A credential
 * that was presented and rejected always wins, and always fails.
 */
export async function resolveActingUser(
  request: Request,
  legacyUserId?: string | null
): Promise<{ userId: string | null; identity: ResolvedIdentity; error?: string; status?: number }> {
  const identity = await resolveApiIdentity(request)

  if (identity.userId) {
    // A verified identity always wins over a client-claimed one. If they disagree,
    // the client was trying to act as somebody else.
    if (legacyUserId && legacyUserId !== identity.userId) {
      console.warn(
        `[api-auth] Ignoring client-supplied userId ${legacyUserId}; using verified ${identity.userId} (${identity.source})`
      )
    }
    return { userId: identity.userId, identity }
  }

  if (identity.rejected) {
    return {
      userId: null,
      identity,
      error: 'Your session could not be verified. Sign in again.',
      status: 401,
    }
  }

  if (legacyUserId) {
    console.warn('[api-auth] No credential presented; accepting client-supplied userId. This is a legacy path.')
    return { userId: legacyUserId, identity: { ...identity, source: 'unverified' } }
  }

  return { userId: null, identity, error: 'Authentication required.', status: 401 }
}
