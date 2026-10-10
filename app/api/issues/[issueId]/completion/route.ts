import { NextRequest, NextResponse } from 'next/server'
import { getRequestUser, getUserRole } from '@/lib/auth/request-user'
import { isDemoMode } from '@/lib/demo'
import { parseCompletionForm, storeAndAssessCompletion } from '@/lib/evidence/completion'
import { isUuid } from '@/lib/evidence/media'
import { RESOLUTION_REVIEW_WINDOW_HOURS, canTransitionResolutionState } from '@/lib/evidence/policy'
import {
  applyResolutionState,
  getIssueForResolution,
  getRepositoryClient,
  isActiveStaffForDepartment,
  recordEvent,
} from '@/lib/evidence/repository'
import { CLAIMABLE_STATES, CLAIMABLE_STATUSES } from '@/lib/evidence/resolution'
import { errorMessage } from '@/lib/evidence/errors'

export const maxDuration = 120

/**
 * Municipal completion claim. Department staff or administrators can submit proof.
 * Multipart fields: photos (File, 1..6), notes, capturedAt (ISO), lat, lng, accuracy.
 * Opens community review. It leaves operational status in_progress until quorum confirms.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ issueId: string }> }) {
  try {
    const { issueId } = await params
    if (!isUuid(issueId)) return NextResponse.json({ error: 'Invalid issue id' }, { status: 400 })

    const auth = await getRequestUser(req)
    const demo = isDemoMode()
    if (!auth && !demo) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const repo = getRepositoryClient()
    const issue = await getIssueForResolution(issueId, repo)
    if (!issue) return NextResponse.json({ error: 'Issue not found' }, { status: 404 })

    const staffId = auth?.user?.id ?? null
    let isAdmin = demo
    if (auth) {
      const role = await getUserRole(auth)
      if (role === 'admin') isAdmin = true
    }

    const isStaff = staffId && issue.department_id ? await isActiveStaffForDepartment(staffId, issue.department_id, repo) : false
    if (!isAdmin && !isStaff) {
      return NextResponse.json(
        { error: 'Only municipal staff of the responsible department or administrators can submit completion evidence.' },
        { status: 403 }
      )
    }

    // Ensure staffId is a valid UUID so storage path and DB foreign keys succeed
    let effectiveStaffId = staffId
    if (!effectiveStaffId || !isUuid(effectiveStaffId)) {
      const { data: adminProfile } = await repo.from('profiles').select('id').eq('role', 'admin').limit(1).maybeSingle()
      effectiveStaffId = adminProfile?.id ?? (await repo.from('profiles').select('id').limit(1).maybeSingle()).data?.id ?? null
      if (!effectiveStaffId) {
        effectiveStaffId = '00000000-0000-0000-0000-000000000001'
      }
    }
    const canClaimStatus = CLAIMABLE_STATUSES.includes(issue.status) || (isAdmin && issue.status === 'community_review')
    if (!canClaimStatus) {
      return NextResponse.json({ error: `Issue status "${issue.status}" cannot receive a completion claim.` }, { status: 409 })
    }
    const from = issue.resolution_verification_state
    if (!CLAIMABLE_STATES.includes(from)) {
      return NextResponse.json({ error: `A completion claim is already ${from.replace('_', ' ')}.` }, { status: 409 })
    }
    const decision = canTransitionResolutionState(from, 'awaiting_community', 'municipal_staff', { claimSubmitted: true })
    if (!decision.allowed) return NextResponse.json({ error: decision.reason }, { status: 409 })

    const parsed = parseCompletionForm(await req.formData())
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

    const round = issue.resolution_round + 1
    const outcome = await storeAndAssessCompletion({ repo, issue, staffId: effectiveStaffId, round, form: parsed.value })

    // Compare-and-set: operational status is never set to resolved here.
    const expiresAt = new Date(Date.now() + RESOLUTION_REVIEW_WINDOW_HOURS * 3_600_000).toISOString()
    const applied = await applyResolutionState(
      {
        issueId,
        from,
        to: 'awaiting_community',
        extra: { resolution_round: round, review_expires_at: expiresAt, status: 'in_progress' },
      },
      repo
    )
    if (!applied) {
      return NextResponse.json({ error: 'The issue changed while the claim was processed. Please retry.' }, { status: 409 })
    }

    await recordEvent(
      {
        issueId,
        eventType: 'completion_claimed',
        actorId: isUuid(staffId) ? staffId : effectiveStaffId,
        actorRole: 'municipal_staff',
        fromState: from,
        toState: 'awaiting_community',
        round,
        summary: `Municipal team submitted completion evidence. Community review is open for ${RESOLUTION_REVIEW_WINDOW_HOURS} hours.`,
        metadata: {
          assessment_id: outcome.assessment.id,
          confidence_index: outcome.draft.confidenceIndex,
          risk_flags: outcome.draft.riskFlags,
          photo_count: outcome.photoCount,
          claim_distance_m: outcome.distanceM,
        },
      },
      repo
    )

    return NextResponse.json({
      success: true,
      round,
      resolutionVerificationState: 'awaiting_community',
      reviewExpiresAt: expiresAt,
      assessment: {
        confidenceIndex: outcome.draft.confidenceIndex,
        evidenceCoverage: outcome.draft.evidenceCoverage,
        riskLevel: outcome.draft.riskLevel,
        riskFlags: outcome.draft.riskFlags,
      },
    })
  } catch (error: unknown) {
    console.error('Completion claim error:', error)
    return NextResponse.json({ error: errorMessage(error) || 'Failed to submit completion evidence' }, { status: 500 })
  }
}
