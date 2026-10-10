import type { SupabaseClient } from '@supabase/supabase-js'
import { EVIDENCE_BUCKET } from './media'
import {
  RESOLUTION_QUORUM,
  RESOLUTION_REVIEW_WINDOW_HOURS,
  createResolutionReviewPolicy,
  evaluateResolutionReviews,
} from './policy'
import {
  getLatestAssessments,
  listEvidenceForRound,
  listPublicEvents,
  listReviewRecords,
  type IssueResolutionRow,
} from './repository'
import { checkReviewerEligibility, getExcludedReviewerIds } from './resolution'
import type { EvidenceAssessment, PublicIssueEvent, ResolutionVerificationState, ReviewVerdict } from './types'

export interface ResolutionReviewSummary {
  issueId: string
  status: string
  resolutionVerificationState: ResolutionVerificationState
  round: number
  reviewExpiresAt: string | null
  quorum: number
  tallies: Record<ReviewVerdict, number>
  viewer: { signedIn: boolean; eligible: boolean; reason: string | null; myVerdict: ReviewVerdict | null }
  /** Short-lived signed URLs, only for eligible signed-in reviewers. Never raw storage paths. */
  photos: Array<{ url: string; capturedAt: string | null }>
  assessments: EvidenceAssessment[]
  events: PublicIssueEvent[]
}

/**
 * Public-safe review summary: aggregate tallies only. No reviewer identities,
 * no coordinates, no storage paths.
 */
export async function buildResolutionReviewSummary(input: {
  issue: IssueResolutionRow
  viewerId: string | null
  repo: SupabaseClient
}): Promise<ResolutionReviewSummary> {
  const { issue, viewerId, repo } = input
  const round = issue.resolution_round
  const reviews = round > 0 ? await listReviewRecords(issue.id, round, repo) : []
  const excluded = await getExcludedReviewerIds(issue, repo)
  const openedAt = issue.review_expires_at
    ? new Date(Date.parse(issue.review_expires_at) - RESOLUTION_REVIEW_WINDOW_HOURS * 3_600_000).toISOString()
    : new Date(0).toISOString()
  const tally = evaluateResolutionReviews(reviews, createResolutionReviewPolicy({ openedAt, excludedReviewerIds: excluded }))

  const viewer: ResolutionReviewSummary['viewer'] = {
    signedIn: Boolean(viewerId),
    eligible: false,
    reason: viewerId ? null : 'Sign in to review this fix.',
    myVerdict: null,
  }
  const photos: ResolutionReviewSummary['photos'] = []

  if (viewerId) {
    const eligibility = await checkReviewerEligibility(viewerId, issue, repo)
    viewer.eligible = eligibility.eligible
    viewer.reason = eligibility.eligible ? null : eligibility.reason
    viewer.myVerdict = reviews.find((r) => r.reviewerId === viewerId)?.verdict ?? null

    if (eligibility.eligible && issue.resolution_verification_state === 'awaiting_community') {
      for (const e of await listEvidenceForRound(issue.id, 'resolution', round, repo)) {
        if (!e.storage_path) continue
        const { data } = await repo.storage.from(EVIDENCE_BUCKET).createSignedUrl(e.storage_path, 600)
        if (data?.signedUrl) photos.push({ url: data.signedUrl, capturedAt: e.captured_at })
      }
    }
  }

  const [assessments, events] = await Promise.all([getLatestAssessments(issue.id, repo), listPublicEvents(issue.id, repo)])

  return {
    issueId: issue.id,
    status: issue.status,
    resolutionVerificationState: issue.resolution_verification_state,
    round,
    reviewExpiresAt: issue.review_expires_at,
    quorum: RESOLUTION_QUORUM,
    tallies: {
      fixed: tally.fixedCount,
      partially_fixed: tally.partiallyFixedCount,
      still_present: tally.stillPresentCount,
      cant_tell: tally.cantTellCount,
    },
    viewer,
    photos,
    assessments,
    events,
  }
}
