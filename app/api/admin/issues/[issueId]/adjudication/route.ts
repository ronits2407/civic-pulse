import { NextRequest, NextResponse } from 'next/server'
import { getRequestUser, getUserRole } from '@/lib/auth/request-user'
import { isUuid } from '@/lib/evidence/media'
import { canTransitionResolutionState, isValidAdminReason } from '@/lib/evidence/policy'
import {
  applyResolutionState,
  awardResolutionKarmaOnce,
  getIssueForResolution,
  getRepositoryClient,
  recordEvent,
} from '@/lib/evidence/repository'
import { ADJUDICATION_ACTIONS, type AdjudicationAction, type ResolutionVerificationState } from '@/lib/evidence/types'

const TARGET: Record<AdjudicationAction, ResolutionVerificationState> = {
  verify: 'verified',
  reopen: 'awaiting_proof',
  keep_disputed: 'disputed',
  mark_unverified: 'unverified',
}

/**
 * Explicit human adjudication. Admin role is read from the session user's profile, and a
 * documented reason is mandatory. This is the only admin path that can mark an issue resolved.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ issueId: string }> }) {
  try {
    const { issueId } = await params
    if (!isUuid(issueId)) return NextResponse.json({ error: 'Invalid issue id' }, { status: 400 })

    const auth = await getRequestUser(req)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if ((await getUserRole(auth)) !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const action = body?.action as AdjudicationAction
    if (!ADJUDICATION_ACTIONS.includes(action)) {
      return NextResponse.json({ error: `action must be one of: ${ADJUDICATION_ACTIONS.join(', ')}` }, { status: 400 })
    }
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
    if (!isValidAdminReason(reason)) {
      return NextResponse.json({ error: 'A documented reason of at least 10 characters is required.' }, { status: 400 })
    }

    const repo = getRepositoryClient()
    const issue = await getIssueForResolution(issueId, repo)
    if (!issue) return NextResponse.json({ error: 'Issue not found' }, { status: 404 })

    const from = issue.resolution_verification_state
    const to = TARGET[action]

    // keep_disputed on an already-disputed issue is an explicit, logged decision with no state change.
    const isNoopKeep = action === 'keep_disputed' && from === 'disputed'
    if (!isNoopKeep) {
      const decision = canTransitionResolutionState(from, to, 'admin', { adminReason: reason })
      if (!decision.allowed) return NextResponse.json({ error: decision.reason }, { status: 409 })

      const now = new Date().toISOString()
      let extra: Record<string, unknown> = {}
      if (to === 'verified') extra = { status: 'resolved', resolved_at: now }
      // Reopening or un-verifying must not leave a stale "resolved" operational status behind.
      if (to === 'awaiting_proof' || to === 'disputed' || to === 'unverified') {
        extra = { review_expires_at: null, ...(issue.status === 'resolved' ? { status: 'in_progress', resolved_at: null } : {}) }
      }
      const applied = await applyResolutionState({ issueId, from, to, extra }, repo)
      if (!applied) return NextResponse.json({ error: 'The issue changed concurrently. Please retry.' }, { status: 409 })
    }

    await recordEvent(
      {
        issueId,
        eventType: `admin_adjudication_${action}`,
        actorId: auth.user.id,
        actorRole: 'admin',
        fromState: from,
        toState: isNoopKeep ? from : to,
        round: issue.resolution_round,
        summary: reason,
        metadata: { action },
      },
      repo
    )
    if (to === 'verified') await awardResolutionKarmaOnce(issueId, issue.user_id, repo)

    return NextResponse.json({ success: true, resolutionVerificationState: isNoopKeep ? from : to })
  } catch (error: unknown) {
    console.error('Adjudication error:', error)
    return NextResponse.json({ error: 'Failed to record adjudication' }, { status: 500 })
  }
}
