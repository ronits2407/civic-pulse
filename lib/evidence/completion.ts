import type { SupabaseClient } from '@supabase/supabase-js'
import { compareCompletionImage, mediaSignalFromComparisons, type VisualComparison } from './assessor'
import { isValidLatLng, parseGeoPoint, type LatLng } from './geo'
import { EVIDENCE_BUCKET, MAX_COMPLETION_FILES, buildEvidencePath, validateEvidenceFile } from './media'
import { buildEvidenceAssessment, createResolutionPolicy } from './policy'
import { recordAssessment, recordEvidence, type IssueResolutionRow } from './repository'
import { completionLocationSignal, completionTimingSignal } from './signals'
import type { EvidenceAssessment, EvidenceAssessmentDraft } from './types'

export interface ParsedCompletionForm {
  files: File[]
  notes: string
  capturedAt: Date | null
  claimLocation: LatLng | null
  accuracyM: number | null
}

export type ParseResult = { ok: true; value: ParsedCompletionForm } | { ok: false; error: string }

function numberField(form: FormData, key: string): number | null {
  const raw = form.get(key)
  if (raw === null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

/** Validates the multipart completion form. All input is untrusted. */
export function parseCompletionForm(form: FormData): ParseResult {
  const files = form.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0)
  if (files.length === 0) return { ok: false, error: 'At least one completion photo is required.' }
  if (files.length > MAX_COMPLETION_FILES) return { ok: false, error: `At most ${MAX_COMPLETION_FILES} photos are allowed.` }
  for (const f of files) {
    const v = validateEvidenceFile({ type: f.type, size: f.size })
    if (!v.ok) return { ok: false, error: v.error }
  }

  const notes = String(form.get('notes') ?? '').trim().slice(0, 2000)
  if (notes.length < 10) return { ok: false, error: 'Action notes (at least 10 characters) are required.' }

  const capturedRaw = String(form.get('capturedAt') ?? '')
  const captured = capturedRaw ? new Date(capturedRaw) : null
  const capturedAt = captured && !Number.isNaN(captured.getTime()) ? captured : null

  const lat = numberField(form, 'lat')
  const lng = numberField(form, 'lng')
  const claimLocation = lat !== null && lng !== null && isValidLatLng({ lat, lng }) ? { lat, lng } : null
  const acc = numberField(form, 'accuracy')
  const accuracyM = acc !== null && acc >= 0 ? acc : null

  return { ok: true, value: { files, notes, capturedAt, claimLocation, accuracyM } }
}

interface StoredProof {
  path: string
  mime: string
  size: number
  signedUrl: string | null
}

export interface CompletionOutcome {
  assessment: EvidenceAssessment
  draft: EvidenceAssessmentDraft
  photoCount: number
  distanceM: number | null
}

/**
 * Stores proof privately, assesses it, and appends evidence + assessment rows.
 * Does NOT change issue state; the caller does the compare-and-set transition afterwards.
 */
export async function storeAndAssessCompletion(input: {
  repo: SupabaseClient
  issue: IssueResolutionRow
  staffId: string
  round: number
  form: ParsedCompletionForm
}): Promise<CompletionOutcome> {
  const { repo, issue, staffId, round, form } = input

  const stored: StoredProof[] = []
  for (const f of form.files) {
    const path = buildEvidencePath(staffId, issue.id, f.type)
    const { error } = await repo.storage.from(EVIDENCE_BUCKET).upload(path, await f.arrayBuffer(), {
      contentType: f.type,
      upsert: false,
    })
    if (error) throw new Error(`Failed to store evidence: ${error.message}`)
    const { data: signed } = await repo.storage.from(EVIDENCE_BUCKET).createSignedUrl(path, 300)
    stored.push({ path, mime: f.type, size: f.size, signedUrl: signed?.signedUrl ?? null })
  }

  // Failed analysis becomes `unknown`, never `contradicts`.
  const comparisons: Array<VisualComparison | null> = []
  for (const s of stored) {
    comparisons.push(
      s.signedUrl
        ? await compareCompletionImage({ originalImageUrl: issue.photo_url, completionImageUrl: s.signedUrl })
        : null
    )
  }

  const { data: geo } = await repo.from('issues').select('location, created_at').eq('id', issue.id).maybeSingle()
  const { signal: locationSignal, distanceM } = completionLocationSignal({
    issueLocation: parseGeoPoint(geo?.location),
    claimLocation: form.claimLocation,
    accuracyM: form.accuracyM,
  })
  const timingSignal = completionTimingSignal({
    capturedAt: form.capturedAt,
    issueCreatedAt: new Date(geo?.created_at ?? 0),
    now: new Date(),
  })

  const anomalyFlags = [...new Set(comparisons.flatMap((c) => c?.anomalyFlags ?? []))]
  const policy = createResolutionPolicy({
    severity: issue.severity,
    isEmergency: issue.is_emergency,
    extraRiskFlags: anomalyFlags,
  })
  const draft = buildEvidenceAssessment(
    [mediaSignalFromComparisons(comparisons, stored.length), locationSignal, timingSignal],
    policy
  )

  for (const s of stored) {
    await recordEvidence(
      {
        issueId: issue.id,
        stage: 'resolution',
        round,
        kind: 'photo',
        storagePath: s.path,
        mimeType: s.mime,
        sizeBytes: s.size,
        notes: form.notes,
        capturedAt: form.capturedAt?.toISOString() ?? null,
        location: form.claimLocation,
        locationSource: form.claimLocation ? 'device_gps' : null,
        locationAccuracyM: form.accuracyM,
        submittedBy: staffId,
      },
      repo
    )
  }
  const assessment = await recordAssessment(issue.id, draft, round, repo)
  return { assessment, draft, photoCount: stored.length, distanceM }
}
