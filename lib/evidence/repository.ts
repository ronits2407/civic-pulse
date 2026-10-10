import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/db/server'
import { isUuid } from './media'
import type {
  EvidenceAssessment,
  EvidenceAssessmentDraft,
  EvidenceSignalResult,
  PublicIssueEvent,
  ResolutionReviewRecord,
  ResolutionVerificationState,
  ReviewVerdict,
  TransitionActor,
} from './types'

/**
 * Service-role repository for the append-only evidence trail.
 * Server-only. Callers must have authenticated and authorised the actor first.
 */

export interface IssueResolutionRow {
  id: string
  user_id: string | null
  status: string
  category: string | null
  severity: number | null
  is_emergency: boolean | null
  department_id: string | null
  resolution_verification_state: ResolutionVerificationState
  resolution_round: number
  review_expires_at: string | null
  photo_url: string | null
  image_analysis: string | null
  description: string | null
  title: string | null
}

const ISSUE_COLUMNS =
  'id, user_id, status, category, severity, is_emergency, department_id, resolution_verification_state, resolution_round, review_expires_at, photo_url, image_analysis, description, title'

export function getRepositoryClient(): SupabaseClient {
  return createServiceClient() as unknown as SupabaseClient
}

export async function getIssueForResolution(
  issueId: string,
  client: SupabaseClient = getRepositoryClient()
): Promise<IssueResolutionRow | null> {
  const { data, error } = await client.from('issues').select(ISSUE_COLUMNS).eq('id', issueId).maybeSingle()
  if (error) throw error
  return (data as IssueResolutionRow | null) ?? null
}

export async function isActiveStaffForDepartment(
  userId: string,
  departmentId: string | null,
  client: SupabaseClient = getRepositoryClient()
): Promise<boolean> {
  if (!departmentId) return false
  const { data, error } = await client
    .from('municipal_staff_memberships')
    .select('id')
    .eq('user_id', userId)
    .eq('department_id', departmentId)
    .eq('active', true)
    .maybeSingle()
  if (error) throw error
  return Boolean(data)
}

export async function listStaffDepartmentIds(
  userId: string,
  client: SupabaseClient = getRepositoryClient()
): Promise<string[]> {
  const { data, error } = await client
    .from('municipal_staff_memberships')
    .select('department_id')
    .eq('user_id', userId)
    .eq('active', true)
  if (error) throw error
  return (data ?? []).map((r: { department_id: string }) => r.department_id)
}

export async function recordAssessment(
  issueId: string,
  draft: EvidenceAssessmentDraft,
  round = 0,
  client: SupabaseClient = getRepositoryClient()
): Promise<EvidenceAssessment> {
  const { data, error } = await client
    .from('evidence_assessments')
    .insert({
      issue_id: issueId,
      stage: draft.stage,
      round,
      confidence_index: draft.confidenceIndex,
      evidence_coverage: draft.evidenceCoverage,
      risk_level: draft.riskLevel,
      risk_flags: draft.riskFlags,
      signals: draft.signals,
      explanation: draft.explanation,
    })
    .select('id')
    .single()
  if (error) throw error
  return { ...draft, id: data.id as string, issueId }
}

export interface EventInput {
  issueId: string
  eventType: string
  actorId?: string | null
  actorRole: TransitionActor
  fromState?: ResolutionVerificationState | null
  toState?: ResolutionVerificationState | null
  round?: number | null
  summary?: string | null
  metadata?: Record<string, unknown>
}

export async function recordEvent(input: EventInput, client: SupabaseClient = getRepositoryClient()): Promise<void> {
  const actorId = input.actorId && isUuid(input.actorId) ? input.actorId : null
  const { error } = await client.from('issue_events').insert({
    issue_id: input.issueId,
    event_type: input.eventType,
    actor_id: actorId,
    actor_role: input.actorRole,
    from_state: input.fromState ?? null,
    to_state: input.toState ?? null,
    round: input.round ?? null,
    summary: input.summary ?? null,
    metadata: input.metadata ?? {},
  })
  if (error) throw error
}

export interface EvidenceInput {
  issueId: string
  stage: 'intake' | 'resolution'
  round: number
  kind: 'photo' | 'video_keyframe' | 'note'
  storagePath?: string | null
  mimeType?: string | null
  sizeBytes?: number | null
  notes?: string | null
  capturedAt?: string | null
  location?: { lat: number; lng: number } | null
  locationSource?: 'device_gps' | 'map_pin' | null
  locationAccuracyM?: number | null
  submittedBy?: string | null
}

export async function recordEvidence(input: EvidenceInput, client: SupabaseClient = getRepositoryClient()): Promise<string> {
  const submittedBy = input.submittedBy && isUuid(input.submittedBy) ? input.submittedBy : null
  const { data, error } = await client
    .from('issue_evidence')
    .insert({
      issue_id: input.issueId,
      stage: input.stage,
      round: input.round,
      kind: input.kind,
      storage_path: input.storagePath ?? null,
      mime_type: input.mimeType ?? null,
      size_bytes: input.sizeBytes ?? null,
      notes: input.notes ?? null,
      captured_at: input.capturedAt ?? null,
      location: input.location ? `POINT(${input.location.lng} ${input.location.lat})` : null,
      location_source: input.locationSource ?? null,
      location_accuracy_m: input.locationAccuracyM ?? null,
      submitted_by: submittedBy,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function listEvidenceForRound(
  issueId: string,
  stage: 'intake' | 'resolution',
  round: number,
  client: SupabaseClient = getRepositoryClient()
) {
  const { data, error } = await client
    .from('issue_evidence')
    .select('id, kind, storage_path, mime_type, notes, captured_at, submitted_by, created_at')
    .eq('issue_id', issueId)
    .eq('stage', stage)
    .eq('round', round)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Array<{
    id: string
    kind: string
    storage_path: string | null
    mime_type: string | null
    notes: string | null
    captured_at: string | null
    submitted_by: string
    created_at: string
  }>
}

export async function listReviewRecords(
  issueId: string,
  round: number,
  client: SupabaseClient = getRepositoryClient()
): Promise<ResolutionReviewRecord[]> {
  const { data, error } = await client
    .from('evidence_reviews')
    .select('reviewer_id, verdict, created_at')
    .eq('issue_id', issueId)
    .eq('round', round)
  if (error) throw error
  return (data ?? []).map((r: { reviewer_id: string; verdict: ReviewVerdict; created_at: string }) => ({
    reviewerId: r.reviewer_id,
    verdict: r.verdict,
    createdAt: r.created_at,
  }))
}

export async function recordReview(
  input: { issueId: string; round: number; reviewerId: string; verdict: ReviewVerdict; comment?: string | null },
  client: SupabaseClient = getRepositoryClient()
): Promise<{ duplicate: boolean }> {
  const { error } = await client.from('evidence_reviews').insert({
    issue_id: input.issueId,
    round: input.round,
    reviewer_id: input.reviewerId,
    verdict: input.verdict,
    comment: input.comment ?? null,
  })
  if (error) {
    if ((error as { code?: string }).code === '23505') return { duplicate: true }
    throw error
  }
  return { duplicate: false }
}

/** Distinct users who have ever submitted a completion claim on this issue (all rounds). */
export async function listClaimSubmitterIds(
  issueId: string,
  client: SupabaseClient = getRepositoryClient()
): Promise<string[]> {
  const { data, error } = await client
    .from('issue_events')
    .select('actor_id')
    .eq('issue_id', issueId)
    .eq('event_type', 'completion_claimed')
  if (error) throw error
  const ids = (data ?? []).map((r: { actor_id: string | null }) => r.actor_id)
  return [...new Set(ids.filter((v: string | null): v is string => Boolean(v)))]
}


interface AssessmentRow {
  id: string
  issue_id: string
  stage: 'intake' | 'resolution'
  round: number
  confidence_index: number
  evidence_coverage: number | string
  risk_level: 'low' | 'medium' | 'high'
  risk_flags: string[] | null
  signals: EvidenceSignalResult[] | null
  explanation: string
}

/** Latest intake assessment plus latest resolution assessment (by creation time). */
export async function getLatestAssessments(
  issueId: string,
  client: SupabaseClient = getRepositoryClient()
): Promise<EvidenceAssessment[]> {
  const { data, error } = await client
    .from('evidence_assessments')
    .select('id, issue_id, stage, round, confidence_index, evidence_coverage, risk_level, risk_flags, signals, explanation')
    .eq('issue_id', issueId)
    .order('created_at', { ascending: false })
  if (error) throw error
  const rows = (data ?? []) as AssessmentRow[]
  const picked = (['intake', 'resolution'] as const)
    .map((stage) => rows.find((r) => r.stage === stage))
    .filter((r): r is AssessmentRow => Boolean(r))
  return picked.map((r) => ({
    id: r.id,
    issueId: r.issue_id,
    stage: r.stage,
    confidenceIndex: r.confidence_index,
    evidenceCoverage: Number(r.evidence_coverage),
    riskLevel: r.risk_level,
    riskFlags: r.risk_flags ?? [],
    signals: r.signals ?? [],
    explanation: r.explanation,
  }))
}

export async function listPublicEvents(
  issueId: string,
  client: SupabaseClient = getRepositoryClient()
): Promise<PublicIssueEvent[]> {
  const { data, error } = await client
    .from('issue_events')
    .select('id, event_type, actor_role, from_state, to_state, round, summary, created_at')
    .eq('issue_id', issueId)
    .order('created_at', { ascending: true })
  if (error) throw error
  type Row = {
    id: string
    event_type: string
    actor_role: string | null
    from_state: string | null
    to_state: string | null
    round: number | null
    summary: string | null
    created_at: string
  }
  return ((data ?? []) as Row[]).map((e) => ({
    id: e.id,
    eventType: e.event_type,
    actorRole: e.actor_role,
    fromState: e.from_state,
    toState: e.to_state,
    round: e.round,
    summary: e.summary,
    createdAt: e.created_at,
  }))
}

/**
 * Compare-and-set state change: succeeds only if the issue is still in `from`.
 * Prevents two concurrent reviews/adjudications from both applying an outcome.
 */
export async function applyResolutionState(
  input: {
    issueId: string
    from: ResolutionVerificationState
    to: ResolutionVerificationState
    extra?: Record<string, unknown>
  },
  client: SupabaseClient = getRepositoryClient()
): Promise<boolean> {
  const { data, error } = await client
    .from('issues')
    .update({ resolution_verification_state: input.to, ...(input.extra ?? {}) })
    .eq('id', input.issueId)
    .eq('resolution_verification_state', input.from)
    .select('id')
  if (error) throw error
  return (data ?? []).length === 1
}

/** Karma for a verified fix; guarded so the reporter is rewarded at most once per issue. */
export async function awardResolutionKarmaOnce(
  issueId: string,
  userId: string | null,
  client: SupabaseClient = getRepositoryClient()
): Promise<void> {
  if (!userId) return
  const { data } = await client
    .from('karma_events')
    .select('id')
    .eq('issue_id', issueId)
    .eq('event_type', 'issue_resolved')
    .limit(1)
  if (data && data.length > 0) return
  await client.from('karma_events').insert({ user_id: userId, event_type: 'issue_resolved', points: 50, issue_id: issueId })
}
