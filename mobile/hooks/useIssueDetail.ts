import { useCallback, useEffect, useRef, useState } from 'react'

import { fetchIssueById, type DecodedIssue } from '@/lib/api/issues-repo'
import { reportsApi } from '@/lib/api/endpoints'
import { isRetryable } from '@/lib/pipeline'
import { supabase } from '@/lib/supabase/client'
import { useAsync } from '@/hooks/useAsync'
import type { RealtimeStatus } from '@/hooks/useIssues'

/**
 * One issue, live.
 *
 * The pipeline writes the same row six or seven times as agents complete. Rather
 * than reconcile each payload, this subscribes to the row and refetches — the detail
 * screen is cheap to re-read and the alternative is a merge function that has to
 * understand every agent's partial write.
 */
export function useIssueDetail(issueId: string | null) {
  const resource = useAsync<DecodedIssue | null>(
    () => (issueId ? fetchIssueById(issueId) : Promise.resolve(null)),
    [issueId],
    { enabled: Boolean(issueId) }
  )

  const [realtime, setRealtime] = useState<RealtimeStatus>('connecting')
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)

  const reloadRef = useRef(resource.reload)
  reloadRef.current = resource.reload

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleReload = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => reloadRef.current({ silent: true }), 350)
  }, [])

  useEffect(() => {
    if (!issueId) return

    const channel = supabase
      .channel(`issue-detail-${issueId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'issues', filter: `id=eq.${issueId}` },
        scheduleReload
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtime('live')
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setRealtime('unavailable')
        } else setRealtime('connecting')
      })

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      supabase.removeChannel(channel)
    }
  }, [issueId, scheduleReload])

  const issue = resource.data ?? null

  /**
   * Re-run the pipeline from the failed stage.
   * Guarded by the same rule the route enforces, so we never show an action the
   * backend will reject with a 400.
   */
  const retry = useCallback(async () => {
    if (!issueId) return
    setRetrying(true)
    setRetryError(null)
    try {
      await reportsApi.retry(issueId)
      // The row updates a moment later; refetch a couple of times to catch it.
      setTimeout(() => reloadRef.current({ silent: true }), 900)
      setTimeout(() => reloadRef.current({ silent: true }), 2600)
    } catch (err: any) {
      setRetryError(err?.message ?? 'Could not restart the pipeline.')
    } finally {
      setRetrying(false)
    }
  }, [issueId])

  return {
    ...resource,
    issue,
    realtime,
    retry,
    retrying,
    retryError,
    canRetry: isRetryable(issue?.pipeline_stage),
  }
}
