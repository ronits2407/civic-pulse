import type {
  EvidenceAssessmentDraft,
  EvidenceFactorKey,
  EvidenceOutcome,
  EvidenceSignalResult,
  EvidenceStage,
  ResolutionReviewEvaluation,
  ResolutionReviewRecord,
  ResolutionVerificationState,
  RiskLevel,
  TransitionActor,
} from './types'

/**
 * Pure, deterministic evidence policy. No DB, network or AI calls in this file.
 * Core rule: missing evidence (unknown / not_applicable) is never a contradiction.
 */

export const DEFAULT_FACTOR_WEIGHTS: Record<EvidenceFactorKey, number> = {
  media: 3,
  location: 2,
  cluster: 1,
  weather: 1,
  events: 1,
}

export const URGENT_SEVERITY_THRESHOLD = 8
export const RESOLUTION_QUORUM = 3
export const RESOLUTION_REVIEW_WINDOW_HOURS = 72

const OUTCOME_SCORE: Partial<Record<EvidenceOutcome, number>> = {
  supports: 1,
  neutral: 0.5,
  contradicts: 0,
}

export interface EvidencePolicy {
  stage: EvidenceStage
  weights: Record<EvidenceFactorKey, number>
  /** Factors that make sense for this category / stage. */
  applicable: EvidenceFactorKey[]
  isUrgent: boolean
  /** Extra flags supplied by upstream analysis (e.g. visual anomalies). */
  extraRiskFlags: string[]
  lowCoverageThreshold: number
  /** Below this index (and not urgent) intake asks neighbours to take a look. */
  reviewIndexThreshold: number
}

export function isUrgentSafety(input: { isEmergency?: boolean | null; severity?: number | null }): boolean {
  return Boolean(input.isEmergency) || (input.severity ?? 0) >= URGENT_SEVERITY_THRESHOLD
}

export function createIntakePolicy(input: {
  category?: string | null
  severity?: number | null
  isEmergency?: boolean | null
  extraRiskFlags?: string[]
}): EvidencePolicy {
  return {
    stage: 'intake',
    weights: { ...DEFAULT_FACTOR_WEIGHTS },
    applicable: ['media', 'location', 'cluster', 'weather', 'events'],
    isUrgent: isUrgentSafety(input),
    extraRiskFlags: input.extraRiskFlags ?? [],
    lowCoverageThreshold: 0.4,
    reviewIndexThreshold: 60,
  }
}

export function createResolutionPolicy(input: {
  severity?: number | null
  isEmergency?: boolean | null
  extraRiskFlags?: string[]
}): EvidencePolicy {
  return {
    stage: 'resolution',
    weights: { ...DEFAULT_FACTOR_WEIGHTS },
    // Cluster and weather say nothing about whether a fix happened on the ground.
    applicable: ['media', 'location', 'events'],
    isUrgent: isUrgentSafety(input),
    extraRiskFlags: input.extraRiskFlags ?? [],
    lowCoverageThreshold: 0.4,
    reviewIndexThreshold: 60,
  }
}

const isUsable = (outcome: EvidenceOutcome) => outcome in OUTCOME_SCORE

export function buildEvidenceAssessment(
  signals: EvidenceSignalResult[],
  policy: EvidencePolicy
): EvidenceAssessmentDraft {
  // Last signal per key wins; signals outside the applicable set are ignored.
  const byKey = new Map<EvidenceFactorKey, EvidenceSignalResult>()
  for (const s of signals) {
    if (policy.applicable.includes(s.key)) byKey.set(s.key, s)
  }

  const normalized: EvidenceSignalResult[] = policy.applicable.map((key) => {
    const s = byKey.get(key)
    return s
      ? { ...s, weight: policy.weights[key] }
      : {
          key,
          outcome: 'unknown' as const,
          weight: policy.weights[key],
          reason: 'No check was performed for this factor.',
          source: 'none',
          freshness: 'unknown' as const,
        }
  })

  const applicableSignals = normalized.filter((s) => s.outcome !== 'not_applicable')
  const usable = applicableSignals.filter((s) => isUsable(s.outcome))
  const totalWeight = applicableSignals.reduce((sum, s) => sum + s.weight, 0)
  const observedWeight = usable.reduce((sum, s) => sum + s.weight, 0)

  const flags = new Set<string>(policy.extraRiskFlags)
  if (policy.isUrgent) flags.add('urgent_safety')

  const supports = usable.filter((s) => s.outcome === 'supports').map((s) => s.key)
  const contradicts = usable.filter((s) => s.outcome === 'contradicts')
  const missing = applicableSignals.filter((s) => !isUsable(s.outcome)).map((s) => s.key)
  for (const c of contradicts) flags.add(`contradicted:${c.key}`)

  if (usable.length === 0 || observedWeight === 0) {
    flags.add('insufficient_evidence')
    return {
      stage: policy.stage,
      confidenceIndex: 50,
      evidenceCoverage: 0,
      riskLevel: policy.isUrgent ? 'high' : 'medium',
      riskFlags: [...flags],
      signals: normalized,
      explanation:
        'Not enough evidence could be checked yet, so the index stays neutral at 50. This is not a negative finding about the report.',
    }
  }

  const weightedScore = usable.reduce((sum, s) => sum + s.weight * (OUTCOME_SCORE[s.outcome] as number), 0)
  const confidenceIndex = Math.round((weightedScore / observedWeight) * 100)
  const evidenceCoverage = totalWeight > 0 ? Math.round((observedWeight / totalWeight) * 100) / 100 : 0
  if (evidenceCoverage < policy.lowCoverageThreshold) flags.add('low_coverage')

  const contradictedWeight = contradicts.reduce((sum, s) => sum + s.weight, 0)
  let riskLevel: RiskLevel = 'low'
  if (
    contradicts.length > 0 ||
    confidenceIndex < policy.reviewIndexThreshold ||
    evidenceCoverage < policy.lowCoverageThreshold
  ) {
    riskLevel = 'medium'
  }
  if (policy.isUrgent || contradictedWeight >= 3 || policy.extraRiskFlags.length > 0) riskLevel = 'high'

  const explanation = [
    `Confidence ${confidenceIndex}/100 from ${usable.length} of ${applicableSignals.length} applicable factors (coverage ${Math.round(evidenceCoverage * 100)}%).`,
    `Supports: ${supports.length ? supports.join(', ') : 'none'}.`,
    `Contradicts: ${contradicts.length ? contradicts.map((c) => c.key).join(', ') : 'none'}.`,
    `Unknown or unchecked (not counted against the report): ${missing.length ? missing.join(', ') : 'none'}.`,
  ].join(' ')

  return {
    stage: policy.stage,
    confidenceIndex,
    evidenceCoverage,
    riskLevel,
    riskFlags: [...flags],
    signals: normalized,
    explanation,
  }
}

export interface IntakeRoutingDecision {
  needsCommunityReview: boolean
  urgentOverride: boolean
  reason: string
}

/**
 * Urgent safety hazards are never held back by low confidence.
 * Low confidence / thin evidence only asks neighbours for a second look; it never rejects.
 */
export function decideIntakeRouting(
  assessment: Pick<EvidenceAssessmentDraft, 'confidenceIndex' | 'riskFlags'>,
  policy: EvidencePolicy
): IntakeRoutingDecision {
  if (policy.isUrgent) {
    return {
      needsCommunityReview: false,
      urgentOverride: true,
      reason: 'Urgent safety hazard: routed to the department immediately regardless of confidence.',
    }
  }
  const insufficient = assessment.riskFlags.includes('insufficient_evidence')
  const low = assessment.confidenceIndex < policy.reviewIndexThreshold
  if (insufficient || low) {
    return {
      needsCommunityReview: true,
      urgentOverride: false,
      reason: insufficient
        ? 'Not enough checkable evidence; nearby residents are asked to take a look.'
        : 'Confidence is below the review threshold; nearby residents are asked to take a look.',
    }
  }
  return { needsCommunityReview: false, urgentOverride: false, reason: 'Evidence is sufficient for routing.' }
}

export interface ResolutionReviewPolicy {
  quorum: number
  windowHours: number
  /** When the current review round opened (ISO). */
  openedAt: string
  now: Date
  /** Reporter and municipal claim submitters can never vote on resolution. */
  excludedReviewerIds: string[]
}

export function createResolutionReviewPolicy(input: {
  openedAt: string
  now?: Date
  excludedReviewerIds: Array<string | null | undefined>
  quorum?: number
  windowHours?: number
}): ResolutionReviewPolicy {
  return {
    quorum: input.quorum ?? RESOLUTION_QUORUM,
    windowHours: input.windowHours ?? RESOLUTION_REVIEW_WINDOW_HOURS,
    openedAt: input.openedAt,
    now: input.now ?? new Date(),
    excludedReviewerIds: input.excludedReviewerIds.filter((v): v is string => Boolean(v)),
  }
}

export function evaluateResolutionReviews(
  reviews: ResolutionReviewRecord[],
  policy: ResolutionReviewPolicy
): ResolutionReviewEvaluation {
  const excluded = new Set(policy.excludedReviewerIds)
  const seen = new Set<string>()
  let fixed = 0
  let partial = 0
  let still = 0
  let cant = 0
  let ineligible = 0

  const ordered = [...reviews].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  for (const r of ordered) {
    if (excluded.has(r.reviewerId) || seen.has(r.reviewerId)) {
      ineligible++
      continue
    }
    seen.add(r.reviewerId)
    if (r.verdict === 'fixed') fixed++
    else if (r.verdict === 'partially_fixed') partial++
    else if (r.verdict === 'still_present') still++
    else cant++
  }

  const opened = Date.parse(policy.openedAt)
  const expired = Number.isFinite(opened) && policy.now.getTime() >= opened + policy.windowHours * 3_600_000
  const quorumMet = fixed >= policy.quorum

  const base = {
    fixedCount: fixed,
    partiallyFixedCount: partial,
    stillPresentCount: still,
    cantTellCount: cant,
    ineligibleCount: ineligible,
    quorumMet,
    expired,
  }

  if (still > 0) {
    return { ...base, state: 'disputed', reason: 'At least one eligible resident reports the problem is still present.' }
  }
  if (quorumMet) {
    return { ...base, state: 'verified', reason: `${fixed} independent residents confirmed the fix.` }
  }
  if (expired) {
    return {
      ...base,
      state: 'unverified',
      reason: `The ${policy.windowHours}h review window ended without ${policy.quorum} confirmations.`,
    }
  }
  return { ...base, state: 'awaiting_community', reason: 'Waiting for more independent confirmations.' }
}


export interface TransitionContext {
  /** Reason documented by an admin (mandatory for any admin transition). */
  adminReason?: string | null
  /** Municipal staff submitted a completion claim with proof for the next round. */
  claimSubmitted?: boolean
  quorumMet?: boolean
  hasDispute?: boolean
  expired?: boolean
}

export interface TransitionDecision {
  allowed: boolean
  reason: string
}

const MIN_ADMIN_REASON_LENGTH = 10

export function isValidAdminReason(reason: string | null | undefined): boolean {
  return typeof reason === 'string' && reason.trim().length >= MIN_ADMIN_REASON_LENGTH
}

const NO_CLAIM_STATES: ResolutionVerificationState[] = ['not_claimed', 'awaiting_proof']

export function canTransitionResolutionState(
  from: ResolutionVerificationState,
  to: ResolutionVerificationState,
  actor: TransitionActor,
  context: TransitionContext = {}
): TransitionDecision {
  const deny = (reason: string): TransitionDecision => ({ allowed: false, reason })
  const allow = (reason: string): TransitionDecision => ({ allowed: true, reason })

  if (from === to) return deny('State is unchanged.')
  if (actor === 'citizen') return deny('Citizens only cast reviews; the system applies the outcome.')

  if (actor === 'admin' && !isValidAdminReason(context.adminReason)) {
    return deny(`Admin transitions require a documented reason of at least ${MIN_ADMIN_REASON_LENGTH} characters.`)
  }

  if (to === 'awaiting_community') {
    if (actor !== 'municipal_staff') return deny('Only municipal staff can submit a completion claim.')
    if (!context.claimSubmitted) return deny('A completion claim with proof is required.')
    if (from === 'verified') return deny('A verified resolution must be reopened by an admin first.')
    return allow('Municipal completion claim submitted; community review opens.')
  }

  if (to === 'awaiting_proof') {
    if (actor === 'admin') return allow(from === 'not_claimed' ? 'Admin requested proof.' : 'Admin reopened the issue for new proof.')
    return deny('Only an admin can reopen or request proof.')
  }

  if (to === 'verified') {
    if (actor === 'admin') {
      return NO_CLAIM_STATES.includes(from)
        ? deny('Cannot verify a resolution that has no completion claim.')
        : allow('Admin adjudicated the resolution as verified.')
    }
    if (actor === 'system') {
      if (from !== 'awaiting_community') return deny('Quorum verification only applies during community review.')
      if (!context.quorumMet) return deny('Quorum of independent "fixed" reviews not met.')
      if (context.hasDispute) return deny('A dispute blocks automatic verification.')
      return allow('Quorum of independent residents confirmed the fix.')
    }
    return deny('Municipal staff cannot verify their own claim.')
  }

  if (to === 'disputed') {
    if (actor === 'system') {
      if (from !== 'awaiting_community') return deny('Disputes only arise during community review.')
      return context.hasDispute ? allow('A resident reported the issue is still present.') : deny('No dispute recorded.')
    }
    if (actor === 'admin') {
      return NO_CLAIM_STATES.includes(from)
        ? deny('Nothing to dispute before a completion claim.')
        : allow('Admin kept or marked the resolution as disputed.')
    }
    return deny('Municipal staff cannot dispute a claim.')
  }

  if (to === 'unverified') {
    if (actor === 'system') {
      if (from !== 'awaiting_community') return deny('Only an open review window can expire.')
      if (!context.expired || context.quorumMet) return deny('The review window has not expired without quorum.')
      return allow('Review window expired without quorum.')
    }
    if (actor === 'admin') {
      return NO_CLAIM_STATES.includes(from)
        ? deny('Nothing to mark unverified before a completion claim.')
        : allow('Admin marked the resolution as unverified.')
    }
    return deny('Municipal staff cannot mark their own claim unverified.')
  }

  return deny('Unsupported transition.')
}
