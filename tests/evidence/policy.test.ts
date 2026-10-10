import { describe, expect, test } from 'bun:test'
import {
  buildEvidenceAssessment,
  canTransitionResolutionState,
  createIntakePolicy,
  createResolutionPolicy,
  createResolutionReviewPolicy,
  decideIntakeRouting,
  evaluateResolutionReviews,
} from '@/lib/evidence/policy'
import type {
  EvidenceFactorKey,
  EvidenceOutcome,
  EvidenceSignalResult,
  ResolutionReviewRecord,
  ReviewVerdict,
} from '@/lib/evidence/types'

const sig = (key: EvidenceFactorKey, outcome: EvidenceOutcome): EvidenceSignalResult => ({
  key,
  outcome,
  weight: 0,
  reason: 'test',
  source: 'test',
  freshness: 'fresh',
})

const intake = createIntakePolicy({ category: 'infrastructure', severity: 4, isEmergency: false })

describe('buildEvidenceAssessment', () => {
  test('weighted mean with supports/neutral/contradicts', () => {
    const a = buildEvidenceAssessment(
      [
        sig('media', 'supports'),
        sig('location', 'neutral'),
        sig('cluster', 'contradicts'),
        sig('weather', 'unknown'),
        sig('events', 'not_applicable'),
      ],
      intake
    )
    // observed: media 3*1 + location 2*0.5 + cluster 1*0 = 4 over observed weight 6
    expect(a.confidenceIndex).toBe(67)
    // applicable weight excludes not_applicable events: 3+2+1+1 = 7; observed = 6
    expect(a.evidenceCoverage).toBeCloseTo(6 / 7, 2)
    expect(a.riskFlags).toContain('contradicted:cluster')
  })

  test('unknown and not_applicable never lower the score', () => {
    const base = buildEvidenceAssessment([sig('media', 'supports')], intake)
    const withMissing = buildEvidenceAssessment(
      [sig('media', 'supports'), sig('weather', 'unknown'), sig('events', 'unknown'), sig('cluster', 'not_applicable')],
      intake
    )
    expect(base.confidenceIndex).toBe(100)
    expect(withMissing.confidenceIndex).toBe(100)
    expect(withMissing.riskFlags.some((f) => f.startsWith('contradicted'))).toBe(false)
  })

  test('lower coverage when evidence is missing, without changing the index', () => {
    const full = buildEvidenceAssessment(
      [
        sig('media', 'supports'),
        sig('location', 'supports'),
        sig('cluster', 'supports'),
        sig('weather', 'supports'),
        sig('events', 'supports'),
      ],
      intake
    )
    const partial = buildEvidenceAssessment([sig('media', 'supports')], intake)
    expect(full.evidenceCoverage).toBe(1)
    expect(partial.evidenceCoverage).toBeLessThan(full.evidenceCoverage)
    expect(partial.riskFlags).toContain('low_coverage')
  })

  test('zero usable factors yields neutral 50, coverage 0, insufficient_evidence', () => {
    const a = buildEvidenceAssessment([sig('media', 'unknown'), sig('weather', 'not_applicable')], intake)
    expect(a.confidenceIndex).toBe(50)
    expect(a.evidenceCoverage).toBe(0)
    expect(a.riskFlags).toContain('insufficient_evidence')
  })

  test('resolution policy ignores cluster and weather signals', () => {
    const policy = createResolutionPolicy({ severity: 3 })
    const a = buildEvidenceAssessment(
      [sig('media', 'supports'), sig('cluster', 'contradicts'), sig('weather', 'contradicts')],
      policy
    )
    expect(a.confidenceIndex).toBe(100)
    expect(a.stage).toBe('resolution')
    expect(a.signals.map((s) => s.key).sort()).toEqual(['events', 'location', 'media'])
  })
})

describe('decideIntakeRouting (safety first)', () => {
  test('urgent hazards are never delayed by low confidence', () => {
    for (const p of [
      createIntakePolicy({ category: 'safety', severity: 9 }),
      createIntakePolicy({ category: 'safety', severity: 2, isEmergency: true }),
    ]) {
      const a = buildEvidenceAssessment([sig('media', 'contradicts')], p)
      const d = decideIntakeRouting(a, p)
      expect(d.needsCommunityReview).toBe(false)
      expect(d.urgentOverride).toBe(true)
      expect(a.riskLevel).toBe('high')
    }
  })

  test('thin evidence on a routine issue asks for community look, never rejects', () => {
    const a = buildEvidenceAssessment([], intake)
    const d = decideIntakeRouting(a, intake)
    expect(d.needsCommunityReview).toBe(true)
    expect(d.urgentOverride).toBe(false)
  })

  test('strong evidence routes directly', () => {
    const a = buildEvidenceAssessment([sig('media', 'supports'), sig('location', 'supports')], intake)
    expect(decideIntakeRouting(a, intake).needsCommunityReview).toBe(false)
  })
})

const OPENED = '2026-10-10T00:00:00.000Z'
const rev = (reviewerId: string, verdict: ReviewVerdict, minute = 0): ResolutionReviewRecord => ({
  reviewerId,
  verdict,
  createdAt: new Date(Date.parse(OPENED) + minute * 60_000).toISOString(),
})
const reviewPolicy = (hoursAfter = 1, excluded: string[] = ['reporter', 'staff']) =>
  createResolutionReviewPolicy({
    openedAt: OPENED,
    now: new Date(Date.parse(OPENED) + hoursAfter * 3_600_000),
    excludedReviewerIds: excluded,
  })

describe('evaluateResolutionReviews', () => {
  test('three distinct eligible fixed votes verify', () => {
    const r = evaluateResolutionReviews([rev('a', 'fixed'), rev('b', 'fixed'), rev('c', 'fixed')], reviewPolicy())
    expect(r.state).toBe('verified')
    expect(r.quorumMet).toBe(true)
  })

  test('two fixed votes keep waiting inside the window', () => {
    const r = evaluateResolutionReviews([rev('a', 'fixed'), rev('b', 'fixed')], reviewPolicy())
    expect(r.state).toBe('awaiting_community')
  })

  test('reporter, staff and duplicate voters are ineligible', () => {
    const r = evaluateResolutionReviews(
      [rev('reporter', 'fixed'), rev('staff', 'fixed'), rev('a', 'fixed'), rev('a', 'fixed', 1), rev('b', 'fixed')],
      reviewPolicy()
    )
    expect(r.fixedCount).toBe(2)
    expect(r.ineligibleCount).toBe(3)
    expect(r.state).toBe('awaiting_community')
  })

  test('partially_fixed and cant_tell never count toward quorum', () => {
    const r = evaluateResolutionReviews(
      [rev('a', 'fixed'), rev('b', 'fixed'), rev('c', 'partially_fixed'), rev('d', 'cant_tell')],
      reviewPolicy()
    )
    expect(r.fixedCount).toBe(2)
    expect(r.state).toBe('awaiting_community')
  })

  test('any eligible still_present disputes, even with quorum', () => {
    const r = evaluateResolutionReviews(
      [rev('a', 'fixed'), rev('b', 'fixed'), rev('c', 'fixed'), rev('d', 'still_present')],
      reviewPolicy()
    )
    expect(r.state).toBe('disputed')
  })

  test('still_present from the reporter does not dispute', () => {
    const r = evaluateResolutionReviews([rev('reporter', 'still_present'), rev('a', 'fixed')], reviewPolicy())
    expect(r.state).toBe('awaiting_community')
  })

  test('expiry without quorum is unverified; quorum beats expiry', () => {
    expect(evaluateResolutionReviews([rev('a', 'fixed')], reviewPolicy(72)).state).toBe('unverified')
    expect(evaluateResolutionReviews([rev('a', 'fixed')], reviewPolicy(71)).state).toBe('awaiting_community')
    expect(
      evaluateResolutionReviews([rev('a', 'fixed'), rev('b', 'fixed'), rev('c', 'fixed')], reviewPolicy(100)).state
    ).toBe('verified')
  })
})

const ADMIN_OK = { adminReason: 'Site inspected by ward officer.' }

describe('canTransitionResolutionState', () => {
  test('citizens cannot transition state directly', () => {
    expect(canTransitionResolutionState('awaiting_community', 'verified', 'citizen').allowed).toBe(false)
  })

  test('only municipal staff open community review', () => {
    expect(
      canTransitionResolutionState('not_claimed', 'awaiting_community', 'municipal_staff', { claimSubmitted: true }).allowed
    ).toBe(true)
    expect(canTransitionResolutionState('not_claimed', 'awaiting_community', 'municipal_staff').allowed).toBe(false)
    expect(
      canTransitionResolutionState('not_claimed', 'awaiting_community', 'admin', { ...ADMIN_OK, claimSubmitted: true }).allowed
    ).toBe(false)
  })

  test('system verifies only with quorum and no dispute', () => {
    const t = (from: 'awaiting_community' | 'awaiting_proof', ctx: object) =>
      canTransitionResolutionState(from, 'verified', 'system', ctx).allowed
    expect(t('awaiting_community', { quorumMet: true })).toBe(true)
    expect(t('awaiting_community', { quorumMet: false })).toBe(false)
    expect(t('awaiting_community', { quorumMet: true, hasDispute: true })).toBe(false)
    expect(t('awaiting_proof', { quorumMet: true })).toBe(false)
  })

  test('system disputes and expires only when conditions hold', () => {
    const s = (to: 'disputed' | 'unverified', ctx: object = {}) =>
      canTransitionResolutionState('awaiting_community', to, 'system', ctx).allowed
    expect(s('disputed', { hasDispute: true })).toBe(true)
    expect(s('disputed')).toBe(false)
    expect(s('unverified', { expired: true })).toBe(true)
    expect(s('unverified', { expired: false })).toBe(false)
  })

  test('admin transitions require a documented reason', () => {
    expect(canTransitionResolutionState('disputed', 'verified', 'admin').allowed).toBe(false)
    expect(canTransitionResolutionState('disputed', 'verified', 'admin', { adminReason: 'short' }).allowed).toBe(false)
    expect(canTransitionResolutionState('disputed', 'verified', 'admin', ADMIN_OK).allowed).toBe(true)
  })

  test('admin cannot verify without any completion claim', () => {
    expect(canTransitionResolutionState('not_claimed', 'verified', 'admin', ADMIN_OK).allowed).toBe(false)
  })

  test('municipal staff cannot verify their own claim', () => {
    expect(
      canTransitionResolutionState('awaiting_community', 'verified', 'municipal_staff', { quorumMet: true }).allowed
    ).toBe(false)
  })

  test('admin can reopen to awaiting_proof', () => {
    expect(canTransitionResolutionState('verified', 'awaiting_proof', 'admin', ADMIN_OK).allowed).toBe(true)
  })
})
