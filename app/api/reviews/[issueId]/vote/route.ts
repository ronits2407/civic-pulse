import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/db/server'
import { resolveActingUser } from '@/lib/auth/api-auth'
import { isUuid } from '@/lib/evidence/media'
import { isUrgentSafety } from '@/lib/evidence/policy'
import { recordEvent } from '@/lib/evidence/repository'
import { errorMessage } from '@/lib/evidence/errors'

/**
 * INTAKE community review: "is this report plausible at this place and time?"
 * This route can never approve a resolution or mark an issue resolved; resolution
 * is verified separately via /api/issues/[issueId]/resolution-review.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ issueId: string }> }) {
  try {
    const { issueId } = await params
    if (!isUuid(issueId)) return NextResponse.json({ error: 'Invalid issue id' }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const { verdict, userId } = body
    const comment = typeof body.comment === 'string' ? body.comment.slice(0, 500) : null

    if (typeof verdict !== 'boolean') {
      return NextResponse.json({ error: 'Missing required field: verdict (boolean)' }, { status: 400 })
    }

    const identity = await resolveActingUser(req, userId)
    if (!identity.userId) {
      return NextResponse.json(
        { error: identity.error ?? 'Authentication required.' },
        { status: identity.status ?? 401 }
      )
    }
    const actingUserId = identity.userId

    const supabase = createServiceClient()

    const { data: target, error: targetError } = await supabase
      .from('issues')
      .select('user_id, status, severity, is_emergency')
      .eq('id', issueId)
      .maybeSingle()
    if (targetError) throw targetError
    if (!target) return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    if (target.status !== 'community_review') {
      return NextResponse.json({ error: 'This report is not open for community review.' }, { status: 409 })
    }
    if (target.user_id === actingUserId) {
      return NextResponse.json({ error: 'You cannot review your own report.' }, { status: 403 })
    }

    // 1. Insert verification record (unique per issue/user)
    const { error: insertError } = await supabase.from('verifications').insert({
      issue_id: issueId,
      user_id: actingUserId,
      verdict: verdict,
      comment,
      distance_meters: null,
    })

    if (insertError) {
      if ((insertError as { code?: string }).code === '23505') {
        return NextResponse.json({ error: 'You have already reviewed this report.' }, { status: 409 })
      }
      throw insertError
    }

    // 2. Add karma for participating (+2)
    await supabase.from('karma_events').insert({
      user_id: actingUserId,
      event_type: 'community_review_participation',
      points: 2,
      issue_id: issueId,
    })

    // 3. Fetch all votes to check quorum
    const { data: verifications, error: fetchError } = await supabase
      .from('verifications')
      .select('verdict, user_id')
      .eq('issue_id', issueId)

    if (fetchError) throw fetchError

    let confirms = 0
    let denies = 0
    verifications.forEach(v => {
      if (v.verdict) confirms++
      else denies++
    })

    const totalVotes = confirms + denies
    let finalOutcome: 'confirmed' | 'rejected' | 'pending' = 'pending'

    if (totalVotes >= 3) {
      if (confirms >= 3 && confirms >= denies) {
        finalOutcome = 'confirmed'
      } else if (denies >= 3 && denies > confirms) {
        finalOutcome = 'rejected'
      }
    }

    // Urgent safety hazards are never dismissed by a community vote; they stay routed to the department.
    if (finalOutcome === 'rejected' && isUrgentSafety({ isEmergency: target.is_emergency, severity: target.severity })) {
      finalOutcome = 'confirmed'
    }

    // 4. Handle final outcome if quorum reached
    if (finalOutcome !== 'pending') {
      const reporterId = target.user_id

      if (finalOutcome === 'confirmed') {
        // Update issue: resume pipeline
        await supabase.from('issues').update({
          status: 'open',
          pipeline_stage: 'agent4_resolution',
          review_confirmed_at: new Date().toISOString(),
        }).eq('id', issueId).eq('status', 'community_review')

        // Award reporter +20 karma
        if (reporterId) {
          await supabase.from('karma_events').insert({
            user_id: reporterId,
            event_type: 'issue_community_confirmed',
            points: 20,
            issue_id: issueId,
          })
        }

        // Award majority voters +5 bonus
        const majorityVoters = verifications.filter(v => v.verdict === true).map(v => v.user_id)
        for (const vId of majorityVoters) {
          await supabase.from('karma_events').insert({
            user_id: vId,
            event_type: 'community_review_majority_bonus',
            points: 5,
            issue_id: issueId,
          })
        }

        await recordEvent({
          issueId,
          eventType: 'intake_review_confirmed',
          actorRole: 'system',
          summary: 'Nearby residents found the report plausible; it continues to the department.',
        }).catch(err => console.error('Failed to record intake review event:', err))

        // Trigger Agent 4 manually by calling the pipeline resume endpoint (background)
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        fetch(`${appUrl}/api/reports/resume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issueId })
        }).catch(err => console.error('Failed to resume pipeline:', err))

      } else if (finalOutcome === 'rejected') {
        // No karma penalty: a rejected report is a plausibility finding, not a judgement on the citizen.
        await supabase.from('issues').update({
          status: 'closed',
          pipeline_stage: 'review_rejected',
          review_confirmed_at: new Date().toISOString(),
        }).eq('id', issueId).eq('status', 'community_review')

        // Award majority voters +5 bonus
        const majorityVoters = verifications.filter(v => v.verdict === false).map(v => v.user_id)
        for (const vId of majorityVoters) {
          await supabase.from('karma_events').insert({
            user_id: vId,
            event_type: 'community_review_majority_bonus',
            points: 5,
            issue_id: issueId,
          })
        }

        await recordEvent({
          issueId,
          eventType: 'intake_review_not_confirmed',
          actorRole: 'system',
          summary: 'Nearby residents could not confirm the report. This is not a finding that the reporter was dishonest.',
        }).catch(err => console.error('Failed to record intake review event:', err))
      }
    }

    return NextResponse.json({ success: true, outcome: finalOutcome })
  } catch (error: unknown) {
    console.error('Error casting vote:', error)
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
  }
}
