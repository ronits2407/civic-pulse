export type EvidenceFactorKey = 'media' | 'location' | 'cluster' | 'weather' | 'events'

export type EvidenceOutcome = 'supports' | 'neutral' | 'contradicts' | 'unknown' | 'not_applicable'

export type EvidenceFreshness = 'fresh' | 'stale' | 'unknown'

export type EvidenceStage = 'intake' | 'resolution'

export type RiskLevel = 'low' | 'medium' | 'high'

export interface EvidenceSignalResult {
  key: EvidenceFactorKey
  outcome: EvidenceOutcome
  weight: number
  reason: string
  source: string
  freshness: EvidenceFreshness
}

export interface EvidenceAssessment {
  id: string
  issueId: string
  stage: EvidenceStage
  /** 0-100. 50 with coverage 0 means "not enough evidence", never "suspicious". */
  confidenceIndex: number
  /** 0-1: observed applicable weight / total applicable weight. */
  evidenceCoverage: number
  riskLevel: RiskLevel
  riskFlags: string[]
  signals: EvidenceSignalResult[]
  explanation: string
}

/** Result of the pure policy before persistence assigns id / issueId. */
export type EvidenceAssessmentDraft = Omit<EvidenceAssessment, 'id' | 'issueId'>

export type ResolutionVerificationState =
  | 'not_claimed'
  | 'awaiting_proof'
  | 'awaiting_community'
  | 'verified'
  | 'disputed'
  | 'unverified'

export type ReviewVerdict = 'fixed' | 'partially_fixed' | 'still_present' | 'cant_tell'

export const REVIEW_VERDICTS: readonly ReviewVerdict[] = [
  'fixed',
  'partially_fixed',
  'still_present',
  'cant_tell',
]

export type AdjudicationAction = 'verify' | 'reopen' | 'keep_disputed' | 'mark_unverified'

export const ADJUDICATION_ACTIONS: readonly AdjudicationAction[] = [
  'verify',
  'reopen',
  'keep_disputed',
  'mark_unverified',
]

export type TransitionActor = 'system' | 'municipal_staff' | 'admin' | 'citizen'

export interface ResolutionReviewRecord {
  reviewerId: string
  verdict: ReviewVerdict
  createdAt: string
}

export interface ResolutionReviewEvaluation {
  state: ResolutionVerificationState
  fixedCount: number
  partiallyFixedCount: number
  stillPresentCount: number
  cantTellCount: number
  ineligibleCount: number
  quorumMet: boolean
  expired: boolean
  reason: string
}

/** Public-safe timeline event (no coordinates, no storage paths, no reviewer ids). */
export interface PublicIssueEvent {
  id: string
  eventType: string
  actorRole: string | null
  fromState: string | null
  toState: string | null
  round: number | null
  summary: string | null
  createdAt: string
}
