import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/db/server'
import { isDemoMode } from '@/lib/demo'

export type AdminGuardResult =
  | { ok: true; userId: string | null; demo: boolean }
  | { ok: false; response: NextResponse }

/**
 * Admin gate for API routes. In demo mode it always passes (userId is a real profile id when one
 * exists, so FK columns like issue_comments.user_id still work). Otherwise requires an admin session.
 */
export async function requireAdmin(): Promise<AdminGuardResult> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (isDemoMode()) {
    if (user) return { ok: true, userId: user.id, demo: true }
    const svc = createServiceClient()
    const { data: admin } = await svc.from('profiles').select('id').eq('role', 'admin').limit(1).maybeSingle()
    if (admin?.id) return { ok: true, userId: admin.id, demo: true }
    const { data: any1 } = await svc.from('profiles').select('id').limit(1).maybeSingle()
    return { ok: true, userId: any1?.id ?? null, demo: true }
  }

  if (!user) return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { ok: true, userId: user.id, demo: false }
}
