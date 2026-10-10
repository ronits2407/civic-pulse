import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { fetchMyIssues, type DecodedIssue } from '@/lib/api/issues-repo'
import { supabase } from '@/lib/supabase/client'
import { useAsync } from '@/hooks/useAsync'

/**
 * Realtime link state, surfaced so the UI can be honest about it.
 * 'live' means the socket is up and push updates are arriving; anything else means
 * the screen is showing a snapshot and the user can pull to refresh.
 */
export type RealtimeStatus = 'connecting' | 'live' | 'unavailable'

/**
 * The citizen's own reports, kept current by Supabase Realtime.
 *
 * The subscription is deliberately coarse — any change to one of the citizen's rows
 * triggers a refetch rather than a local patch. The pipeline writes to a row many
 * times (once per agent) and the payload we care about differs at each step, so
 * re-reading the row is both simpler and more correct than merging deltas.
 */
export function useMyIssues(userId: string | null) {
  const resource = useAsync<DecodedIssue[]>(
    () => (userId ? fetchMyIssues(userId) : Promise.resolve([])),
    [userId],
    { enabled: Boolean(userId) }
  )

  const [realtime, setRealtime] = useState<RealtimeStatus>('connecting')
  const reloadRef = useRef(resource.reload)
  reloadRef.current = resource.reload

  // Collapses bursts of row updates (one report fires several) into one refetch.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleReload = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      reloadRef.current({ silent: true })
    }, 400)
  }, [])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`citizen-issues-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'issues', filter: `user_id=eq.${userId}` },
        scheduleReload
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtime('live')
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setRealtime('unavailable')
        } else {
          setRealtime('connecting')
        }
      })

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      supabase.removeChannel(channel)
    }
  }, [userId, scheduleReload])

  const issues = useMemo(() => resource.data ?? [], [resource.data])

  /** Counts for the home summary. Derived from the same list the user can scroll. */
  const summary = useMemo(() => {
    let open = 0
    let inProgress = 0
    let resolved = 0
    let needsAttention = 0
    for (const issue of issues) {
      if (issue.status === 'resolved') resolved += 1
      else if (issue.status === 'in_progress') inProgress += 1
      else if (issue.status === 'community_review') needsAttention += 1
      else if (issue.status === 'open') open += 1
      if (issue.pipeline_stage?.endsWith('_failed')) needsAttention += 1
    }
    return { open, inProgress, resolved, needsAttention, total: issues.length }
  }, [issues])

  return { ...resource, issues, summary, realtime }
}
