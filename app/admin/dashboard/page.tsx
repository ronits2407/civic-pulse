import { createServerSupabaseClient, createServiceClient } from '@/lib/db/server'
import { redirect } from 'next/navigation'
import { AdminDashboardClient } from '@/components/admin/AdminDashboardClient'
import { isDemoMode, DEMO_ADMIN_USER } from '@/lib/demo'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const demo = isDemoMode()
  const supabase = await createServerSupabaseClient()
  const { data: { user: sessionUser } } = await supabase.auth.getUser()

  let user: any = sessionUser
  let profile: any = null

  if (sessionUser) {
    const { data } = await supabase.from('profiles').select('*').eq('id', sessionUser.id).single()
    profile = data
  }

  if (demo) {
    // Demo mode: no login required, everyone who opens /admin is an admin.
    if (!user) user = DEMO_ADMIN_USER
    if (!profile) profile = { id: user.id, email: user.email, role: 'admin' }
  } else {
    if (!user) redirect('/auth/login?role=admin')
    if (profile?.role !== 'admin') redirect('/dashboard')
  }

  // Demo mode reads with the service client so RLS never hides issues from the open admin view.
  const db = demo ? createServiceClient() : supabase

  // Fetch all issues (for municipal view, we fetch all issues)
  const { data: issues } = await db
    .from('issues')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: departments } = await db
    .from('departments')
    .select('*')

  return (
    <AdminDashboardClient
      user={user}
      profile={profile}
      initialIssues={issues || []}
      departments={departments || []}
    />
  )
}
