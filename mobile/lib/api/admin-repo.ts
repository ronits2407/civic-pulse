import { supabase } from '@/lib/supabase/client'

/**
 * Read-only operational counts for the municipal entry point.
 *
 * The full municipal console (civic inbox, SLA triage, TSP route planning, Agent 5
 * predictive hotspots) is served by the existing web app at `/admin/dashboard`. Porting
 * it is a separate project; what the mobile app owes a municipal user today is a correct
 * role boundary and a truthful snapshot of the queue.
 *
 * These are head-only `count` queries, so no rows travel over the wire. The underlying
 * RLS policy already allows reads of `issues` for any signed-in user; the screen itself
 * is additionally gated on `role === 'admin'`.
 */

export interface OperationsSummary {
  open: number
  inProgress: number
  communityReview: number
  /** Past `sla_deadline` and still unresolved. */
  overdue: number
  /** Pipeline stages left in a `*_failed` state. */
  failed: number
  total: number
}

async function countWhere(
  apply: (query: any) => any
): Promise<number> {
  const base = supabase.from('issues').select('id', { count: 'exact', head: true })
  const { count, error } = await apply(base)
  if (error) throw error
  return count ?? 0
}

export async function fetchOperationsSummary(): Promise<OperationsSummary> {
  const nowIso = new Date().toISOString()

  const [open, inProgress, communityReview, overdue, failed, total] = await Promise.all([
    countWhere((q) => q.eq('status', 'open')),
    countWhere((q) => q.eq('status', 'in_progress')),
    countWhere((q) => q.eq('status', 'community_review')),
    countWhere((q) =>
      q.in('status', ['open', 'in_progress']).lt('sla_deadline', nowIso).not('sla_deadline', 'is', null)
    ),
    countWhere((q) => q.like('pipeline_stage', '%_failed')),
    countWhere((q) => q.neq('status', 'closed')),
  ])

  return { open, inProgress, communityReview, overdue, failed, total }
}
