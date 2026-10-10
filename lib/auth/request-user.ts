import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/db/server'

export interface RequestUser {
  user: User
  /** Caller-scoped client: RLS applies as this user. */
  supabase: SupabaseClient
}

/**
 * Resolves the authenticated user from the session cookie, or from an
 * `Authorization: Bearer <token>` header. Never reads identity from body/query.
 * Returns null when unauthenticated.
 */
export async function getRequestUser(request?: Request): Promise<RequestUser | null> {
  const header = request?.headers.get('authorization') ?? request?.headers.get('Authorization')
  const match = header ? /^Bearer\s+(.+)$/i.exec(header.trim()) : null

  if (match) {
    const token = match[1]
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } }
    )
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) return null
    return { user: data.user, supabase }
  }

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return { user: data.user, supabase: supabase as unknown as SupabaseClient }
}

export type AppRole = 'citizen' | 'admin'

/** Reads the caller's role from `profiles` using the caller-scoped client (not from the request). */
export async function getUserRole(ctx: RequestUser): Promise<AppRole> {
  const { data } = await ctx.supabase.from('profiles').select('role').eq('id', ctx.user.id).single()
  return data?.role === 'admin' ? 'admin' : 'citizen'
}
