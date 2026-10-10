import { useCallback, useMemo, useState } from 'react'

import { reviewsApi } from '@/lib/api/endpoints'
import type { ReviewIssue, VoteOutcome } from '@/lib/api/contracts'
import { haversineMetres } from '@/lib/format'
import type { LatLng } from '@/lib/location/postgis'
import { useAsync } from '@/hooks/useAsync'

/**
 * The community-verification queue.
 *
 * Everything about quorum — how many confirmations are needed, what karma is
 * awarded, whether the pipeline resumes — is decided by
 * `POST /api/reviews/[issueId]/vote`. This hook deliberately does not reimplement
 * any of that; it forwards the verdict and reports the outcome the server chose.
 */
export interface ReviewQueueItem extends ReviewIssue {
  /** Distance from the citizen's saved home location, for "you're 300 m away". */
  distanceMetres: number | null
}

export function useReviewQueue(userId: string | null, homeLocation: LatLng | null) {
  const resource = useAsync<ReviewIssue[]>(
    () => (userId ? reviewsApi.queue(userId).then((r) => r.issues ?? []) : Promise.resolve([])),
    [userId],
    { enabled: Boolean(userId) }
  )

  // Votes cast in this session, so the card can lock immediately instead of
  // waiting for a refetch (and so a double tap cannot double-submit).
  const [localVotes, setLocalVotes] = useState<Record<string, VoteOutcome>>({})
  const [submittingId, setSubmittingId] = useState<string | null>(null)

  const items = useMemo<ReviewQueueItem[]>(() => {
    const raw = resource.data ?? []
    return raw.map((issue) => ({
      ...issue,
      distanceMetres:
        homeLocation && issue.location
          ? haversineMetres(homeLocation.lat, homeLocation.lng, issue.location.lat, issue.location.lng)
          : null,
    }))
  }, [resource.data, homeLocation])

  const pending = useMemo(() => items.filter((i) => !localVotes[i.id]), [items, localVotes])

  const submitVote = useCallback(
    async (
      issue: ReviewQueueItem,
      verdict: boolean,
      comment?: string
    ): Promise<VoteOutcome> => {
      if (!userId) throw new Error('You need to be signed in to verify a report.')
      if (localVotes[issue.id]) throw new Error('You have already voted on this report.')
      if (submittingId) throw new Error('Please wait for the previous vote to finish.')

      setSubmittingId(issue.id)
      try {
        const response = await reviewsApi.vote(issue.id, {
          userId,
          verdict,
          comment: comment?.trim() || null,
          distanceMeters: issue.distanceMetres != null ? Math.round(issue.distanceMetres) : null,
        })
        setLocalVotes((prev) => ({ ...prev, [issue.id]: response.outcome }))
        return response.outcome
      } finally {
        setSubmittingId(null)
      }
    },
    [userId, localVotes, submittingId]
  )

  return {
    ...resource,
    items: pending,
    allItems: items,
    totalCount: items.length,
    submitVote,
    submittingId,
    localVotes,
  }
}
