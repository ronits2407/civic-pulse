import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/db/server'
import { requireAdmin } from '@/lib/auth/admin-guard'
import { errorMessage } from '@/lib/evidence/errors'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ issueId: string }> }
) {
  try {
    const { issueId } = await params
    const updates = await request.json()

    const guard = await requireAdmin()
    if (!guard.ok) return guard.response

    // Outside demo mode, closure is never a direct admin mutation: it needs a municipal claim +
    // community quorum, or an explicit documented adjudication.
    if (updates.status === 'resolved' && !guard.demo) {
      return NextResponse.json(
        {
          error:
            'Issues cannot be set to resolved directly. Use the municipal completion + community resolution review workflow, or POST /api/admin/issues/{issueId}/adjudication with a documented reason.',
        },
        { status: 409 }
      )
    }

    // Only allow updating status and department_id
    const allowedUpdates: Record<string, unknown> = {}
    if (updates.status) allowedUpdates.status = updates.status
    if (updates.status === 'resolved') {
      // Demo-mode direct resolve
      allowedUpdates.resolved_at = new Date().toISOString()
      allowedUpdates.resolution_verification_state = 'verified'
      allowedUpdates.review_expires_at = null
    } else if (updates.status) {
      allowedUpdates.resolved_at = null
    }
    if (updates.department_id !== undefined) allowedUpdates.department_id = updates.department_id || null

    if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 })
    }

    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
      .from('issues')
      .update(allowedUpdates)
      .eq('id', issueId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ issue: data })
  } catch (error: unknown) {
    console.error('Update issue error:', error)
    return NextResponse.json(
      { error: errorMessage(error) || 'Failed to update issue' },
      { status: 500 }
    )
  }
}
