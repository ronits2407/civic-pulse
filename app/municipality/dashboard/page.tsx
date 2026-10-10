import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createServiceClient } from '@/lib/db/server'
import { getRepositoryClient, listStaffDepartmentIds } from '@/lib/evidence/repository'
import { MunicipalityIssueCard } from '@/components/admin/MunicipalityIssueCard'
import { isDemoMode, DEMO_ADMIN_USER } from '@/lib/demo'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Building2, LayoutDashboard, ShieldCheck } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ departmentId?: string; issueId?: string }>
}

export default async function MunicipalityDashboardPage({ searchParams }: Props) {
  const demo = isDemoMode()
  const supabase = await createServerSupabaseClient()
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser()

  let user: any = sessionUser
  let profile: any = null

  if (sessionUser) {
    const { data } = await supabase.from('profiles').select('*').eq('id', sessionUser.id).maybeSingle()
    profile = data
  }

  const isAdmin = profile?.role === 'admin' || demo

  if (demo) {
    // Demo mode: automatically active for testing
    if (!user) user = DEMO_ADMIN_USER
    if (!profile) profile = { id: user.id, email: user.email, role: 'admin' }
  } else {
    if (!user) redirect('/auth/login?role=admin')
    if (!isAdmin) {
      const repo = getRepositoryClient()
      const staffDeptIds = await listStaffDepartmentIds(user.id, repo)
      if (staffDeptIds.length === 0) {
        redirect('/dashboard')
      }
    }
  }

  const db = demo || isAdmin ? createServiceClient() : supabase
  const params = await searchParams
  const selectedDeptId = params.departmentId || null
  const targetIssueId = params.issueId || null

  // Fetch departments
  let departments: Array<{ id: string; name: string }> = []
  if (isAdmin) {
    const { data } = await db.from('departments').select('id, name').order('name')
    departments = data ?? []
  } else {
    const repo = getRepositoryClient()
    const staffDeptIds = await listStaffDepartmentIds(user.id, repo)
    const { data } = await db.from('departments').select('id, name').in('id', staffDeptIds).order('name')
    departments = data ?? []
  }

  const deptMap = new Map(departments.map((d) => [d.id, d.name]))

  // Fetch issues
  let issuesQuery = db
    .from('issues')
    .select(
      'id, title, description, category, severity, is_emergency, status, address, department_id, sla_deadline, created_at, resolution_verification_state, resolution_round, review_expires_at'
    )
    .in('status', ['open', 'in_progress'])

  if (selectedDeptId) {
    issuesQuery = issuesQuery.eq('department_id', selectedDeptId)
  } else if (!isAdmin && departments.length > 0) {
    issuesQuery = issuesQuery.in('department_id', departments.map((d) => d.id))
  }

  const { data: rawIssues } = await issuesQuery
    .order('is_emergency', { ascending: false })
    .order('severity', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(100)

  let issues = rawIssues ?? []

  // If a target issue was specified from the Admin Portal and isn't in the list, fetch and prepend it
  if (targetIssueId && !issues.some((i) => i.id === targetIssueId)) {
    const { data: targetIssue } = await db
      .from('issues')
      .select(
        'id, title, description, category, severity, is_emergency, status, address, department_id, sla_deadline, created_at, resolution_verification_state, resolution_round, review_expires_at'
      )
      .eq('id', targetIssueId)
      .maybeSingle()

    if (targetIssue) {
      issues = [targetIssue, ...issues]
    }
  }

  // Count active issues per department for filter pills
  const { data: allActiveIssues } = await db
    .from('issues')
    .select('department_id')
    .in('status', ['open', 'in_progress'])

  const countByDept = new Map<string, number>()
  for (const item of allActiveIssues ?? []) {
    if (item.department_id) {
      countByDept.set(item.department_id, (countByDept.get(item.department_id) ?? 0) + 1)
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8 lg:p-10 text-foreground">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <Building2 className="w-6 h-6 text-[#2f3fa8]" />
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Municipal Workspace</h1>
              {isAdmin ? (
                <Badge variant="outline" className="border-black/10 bg-sky/60 text-indigo-700 text-xs">
                  <ShieldCheck className="w-3 h-3 mr-1" /> All Departments
                </Badge>
              ) : (
                <Badge variant="outline" className="border-black/10 bg-olive/60 text-emerald-700 text-xs">
                  Department Staff
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {isAdmin
                ? 'Administrators have unrestricted access to inspect and submit completion evidence for all municipal departments.'
                : `Assigned Departments: ${departments.map((d) => d.name).join(', ') || 'None'}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="h-9 px-3 border-border hover:bg-muted text-xs">
              <Link href="/admin/dashboard">
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" /> Admin Portal
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="h-9 px-3 text-xs text-muted-foreground hover:text-foreground">
              <Link href="/dashboard">
                <LayoutDashboard className="w-3.5 h-3.5 mr-1.5" /> Citizen View
              </Link>
            </Button>
          </div>
        </div>

        {/* Department Filter Pills */}
        {departments.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <Link
              href={`/municipality/dashboard${targetIssueId ? `?issueId=${targetIssueId}` : ''}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-colors ${
                !selectedDeptId
                  ? 'bg-[#17140f] text-white'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              All Departments ({allActiveIssues?.length ?? 0})
            </Link>
            {departments.map((dept) => {
              const active = selectedDeptId === dept.id
              const count = countByDept.get(dept.id) ?? 0
              return (
                <Link
                  key={dept.id}
                  href={`/municipality/dashboard?departmentId=${dept.id}${targetIssueId ? `&issueId=${targetIssueId}` : ''}`}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-colors ${
                    active
                      ? 'bg-[#17140f] text-white'
                      : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {dept.name} ({count})
                </Link>
              )
            })}
          </div>
        )}

        {/* Issues List */}
        {issues.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card/40 p-12 text-center space-y-3">
            <Building2 className="w-10 h-10 text-muted-foreground mx-auto opacity-50" />
            <h3 className="text-base font-semibold text-foreground">No open issues</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              There are currently no open or in-progress issues matching this department filter.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {issues.map((issue) => (
              <MunicipalityIssueCard
                key={issue.id}
                isTarget={issue.id === targetIssueId}
                issue={{
                  id: issue.id,
                  title: issue.title,
                  description: issue.description,
                  category: issue.category,
                  severity: issue.severity,
                  isEmergency: Boolean(issue.is_emergency),
                  status: issue.status,
                  address: issue.address,
                  slaDeadline: issue.sla_deadline,
                  createdAt: issue.created_at,
                  verificationState: issue.resolution_verification_state,
                  departmentName: issue.department_id ? deptMap.get(issue.department_id) ?? null : 'Unassigned',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
