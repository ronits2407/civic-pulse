import type { SupabaseClient } from '@supabase/supabase-js'
import { parseGeoPoint, distanceMeters } from './geo'
import {
  canTransitionResolutionState,
  createResolutionReviewPolicy,
  evaluateResolutionReviews,
  RESOLUTION_REVIEW_WINDOW_HOURS,
} from './policy'
import {
  applyResolutionState,
  awardResolutionKarmaOnce,
  getRepositoryClient,
  listClaimSubmitterIds,
  listReviewRecords,
  recordEvent,
  type IssueResolutionRow,
} from './repository'
import type { ResolutionReviewEvaluation, ResolutionVerificationState } from './types'

/** Residents within this server-computed distance of the issue may review its resolution. */
export const RESOLUTION_REVIEW_RADIUS_M = 1000

/** Statuses from which a municipal completion claim may be filed. */
export const CLAIMABLE_STATUSES = ['open', 'in_progress']
/** Verification states from which a new claim may be filed. */
export const CLAIMABLE_STATES: ResolutionVerificationState[] = ['not_claimed', 'awaiting_proof', 'disputed', 'unverified']

/** Reporter + every past claim submitter are never eligible to review resolution. */
export async function getExcludedReviewerIds(
  issue: Pick<IssueResolutionRow, 'id' | 'user_id'>,
  client: SupabaseClient = getRepositoryClient()
): Promise<string[]> {
  const claimers = await listClaimSubmitterIds(issue.id, client)
  const { data } = await client
    .from('issue_evidence')
    .select('submitted_by')
    .eq('issue_id', issue.id)
    .eq('stage', 'resolution')
  const submitters = (data ?? []).map((r: { submitted_by: string | null }) => r.submitted_by)
  const all = [issue.user_id, ...claimers, ...submitters].filter((v): v is string => Boolean(v))
  return [...new Set(all)]
}

export type ReviewerEligibility = { eligible: true } | { eligible: false; reason: string }

/** Distance is derived server-side from the profile home location, never from the request. */
export async function checkReviewerEligibility(
  userId: string,
  issue: Pick<IssueResolutionRow, 'id' | 'user_id'>,
  client: SupabaseClient = getRepositoryClient()
): Promise<ReviewerEligibility> {
  const excluded = await getExcludedReviewerIds(issue, client)
  if (excluded.includes(userId)) {
    return { eligible: false, reason: 'The reporter and the municipal team that submitted the claim cannot review this resolution.' }
  }
  const [{ data: profile }, { data: issueRow }] = await Promise.all([
    client.from('profiles').select('home_location').eq('id', userId).maybeSingle(),
    client.from('issues').select('location').eq('id', issue.id).maybeSingle(),
  ])
  const home = parseGeoPoint(profile?.home_location)
  const there = parseGeoPoint(issueRow?.location)
  if (!home) return { eligible: false, reason: 'Set your home location to review fixes near you.' }
  if (!there) return { eligible: false, reason: 'This issue has no usable location.' }
  if (distanceMeters(home, there) > RESOLUTION_REVIEW_RADIUS_M) {
    return { eligible: false, reason: 'Only residents within 1 km of the issue can review its resolution.' }
  }
  return { eligible: true }
}

export interface SettleResult {
  state: ResolutionVerificationState
  changed: boolean
  evaluation: ResolutionReviewEvaluation | null
}

/**
 * Evaluates the active review round and, if the outcome changed, applies it with a
 * compare-and-set so concurrent callers cannot both apply it. Only the system actor acts here.
 * Never touches an issue that is not awaiting_community.
 */
export async function settleResolutionReview(
  issue: IssueResolutionRow,
  client: SupabaseClient = getRepositoryClient()
): Promise<SettleResult> {
  if (issue.resolution_verification_state !== 'awaiting_community' || !issue.review_expires_at) {
    return { state: issue.resolution_verification_state, changed: false, evaluation: null }
  }

  const round = issue.resolution_round
  const reviews = await listReviewRecords(issue.id, round, client)
  const excluded = await getExcludedReviewerIds(issue, client)
  const openedAt = new Date(Date.parse(issue.review_expires_at) - RESOLUTION_REVIEW_WINDOW_HOURS * 3_600_000).toISOString()
  const evaluation = evaluateResolutionReviews(
    reviews,
    createResolutionReviewPolicy({ openedAt, excludedReviewerIds: excluded })
  )

  const target = evaluation.state
  if (target === 'awaiting_community') return { state: target, changed: false, evaluation }

  const decision = canTransitionResolutionState('awaiting_community', target, 'system', {
    quorumMet: evaluation.quorumMet,
    hasDispute: evaluation.stillPresentCount > 0,
    expired: evaluation.expired,
  })
  if (!decision.allowed) return { state: 'awaiting_community', changed: false, evaluation }

  const now = new Date().toISOString()
  const extra: Record<string, unknown> =
    target === 'verified' ? { status: 'resolved', resolved_at: now } : {}
  const applied = await applyResolutionState(
    { issueId: issue.id, from: 'awaiting_community', to: target, extra },
    client
  )
  if (!applied) return { state: target, changed: false, evaluation }

  await recordEvent(
    {
      issueId: issue.id,
      eventType: `resolution_${target}`,
      actorRole: 'system',
      fromState: 'awaiting_community',
      toState: target,
      round,
      summary: evaluation.reason,
      metadata: {
        fixed: evaluation.fixedCount,
        partially_fixed: evaluation.partiallyFixedCount,
        still_present: evaluation.stillPresentCount,
        cant_tell: evaluation.cantTellCount,
      },
    },
    client
  )
  if (target === 'verified') await awardResolutionKarmaOnce(issue.id, issue.user_id, client)

  return { state: target, changed: true, evaluation }
}
