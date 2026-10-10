import { NextRequest, NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/auth/request-user'
import { isUuid } from '@/lib/evidence/media'
import { getIssueForResolution, getRepositoryClient, recordEvent, recordReview } from '@/lib/evidence/repository'
import { checkReviewerEligibility, settleResolutionReview } from '@/lib/evidence/resolution'
import { buildResolutionReviewSummary } from '@/lib/evidence/review-summary'
import { REVIEW_VERDICTS, type ReviewVerdict } from '@/lib/evidence/types'

type Ctx = { params: Promise<{ issueId: string }> }

/** Public-safe summary of the active resolution review round (aggregate tallies only). */
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const { issueId } = await params
    if (!isUuid(issueId)) return NextResponse.json({ error: 'Invalid issue id' }, { status: 400 })

    const repo = getRepositoryClient()
    let issue = await getIssueForResolution(issueId, repo)
    if (!issue) return NextResponse.json({ error: 'Issue not found' }, { status: 404 })

    // Apply window expiry lazily so readers always see the current state.
    const settled = await settleResolutionReview(issue, repo)
    if (settled.changed) issue = (await getIssueForResolution(issueId, repo)) ?? issue

    const auth = await getRequestUser(req)
    const summary = await buildResolutionReviewSummary({ issue, viewerId: auth?.user.id ?? null, repo })
    return NextResponse.json(summary)
  } catch (error: unknown) {
    console.error('Resolution review GET error:', error)
    return NextResponse.json({ error: 'Failed to load resolution review' }, { status: 500 })
  }
}

/** A signed-in, eligible resident submits a verdict for the active round. */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { issueId } = await params
    if (!isUuid(issueId)) return NextResponse.json({ error: 'Invalid issue id' }, { status: 400 })

    const auth = await getRequestUser(req)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const reviewerId = auth.user.id

    const body = await req.json().catch(() => ({}))
    const verdict = body?.verdict as ReviewVerdict
    if (!REVIEW_VERDICTS.includes(verdict)) {
      return NextResponse.json({ error: `verdict must be one of: ${REVIEW_VERDICTS.join(', ')}` }, { status: 400 })
    }
    const comment = typeof body?.comment === 'string' ? body.comment.trim().slice(0, 500) || null : null

    const repo = getRepositoryClient()
    let issue = await getIssueForResolution(issueId, repo)
    if (!issue) return NextResponse.json({ error: 'Issue not found' }, { status: 404 })

    // Expire first so a late vote cannot revive a closed window.
    const expired = await settleResolutionReview(issue, repo)
    if (expired.changed) issue = (await getIssueForResolution(issueId, repo)) ?? issue
    if (issue.resolution_verification_state !== 'awaiting_community') {
      return NextResponse.json(
        { error: 'This resolution is not open for community review.', resolutionVerificationState: issue.resolution_verification_state },
        { status: 409 }
      )
    }

    const eligibility = await checkReviewerEligibility(reviewerId, issue, repo)
    if (!eligibility.eligible) return NextResponse.json({ error: eligibility.reason }, { status: 403 })

    const { duplicate } = await recordReview({ issueId, round: issue.resolution_round, reviewerId, verdict, comment }, repo)
    if (duplicate) return NextResponse.json({ error: 'You have already reviewed this fix.' }, { status: 409 })

    await recordEvent(
      {
        issueId,
        eventType: 'resolution_review_cast',
        actorId: reviewerId,
        actorRole: 'citizen',
        round: issue.resolution_round,
        summary: 'A resident reviewed the fix.',
        metadata: { verdict },
      },
      repo
    )
    await repo
      .from('karma_events')
      .insert({ user_id: reviewerId, event_type: 'resolution_review_participation', points: 2, issue_id: issueId })

    const fresh = (await getIssueForResolution(issueId, repo)) ?? issue
    const settled = await settleResolutionReview(fresh, repo)

    return NextResponse.json({ success: true, resolutionVerificationState: settled.state, changed: settled.changed })
  } catch (error: unknown) {
    console.error('Resolution review POST error:', error)
    return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 })
  }
}
