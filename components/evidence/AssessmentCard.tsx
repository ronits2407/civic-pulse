'use client'

import type { EvidenceAssessment, EvidenceSignalResult, RiskLevel } from '@/lib/evidence/types'
import { Badge } from '@/components/ui/badge'

const RISK_STYLES: Record<RiskLevel, string> = {
  low: 'bg-olive/60 text-emerald-700 border-black/10',
  medium: 'bg-sun/60 text-amber-700 border-black/10',
  high: 'bg-blush/60 text-rose-700 border-black/10',
}

const OUTCOME_LABEL: Record<EvidenceSignalResult['outcome'], string> = {
  supports: 'Supports',
  neutral: 'Neutral',
  contradicts: 'Conflicts',
  unknown: 'Not checked',
  not_applicable: 'Not applicable',
}

const OUTCOME_STYLE: Record<EvidenceSignalResult['outcome'], string> = {
  supports: 'text-emerald-700',
  neutral: 'text-indigo-700',
  contradicts: 'text-rose-700',
  unknown: 'text-muted-foreground',
  not_applicable: 'text-muted-foreground',
}

const FACTOR_LABEL: Record<EvidenceSignalResult['key'], string> = {
  media: 'Photo evidence',
  location: 'Location',
  cluster: 'Nearby reports',
  weather: 'Weather',
  events: 'Local events / timing',
}

const FLAG_LABEL: Record<string, string> = {
  insufficient_evidence: 'Not enough evidence yet',
  low_coverage: 'Limited evidence checked',
  urgent_safety: 'Urgent safety',
  possible_stock_image: 'Possible stock image',
  possible_screenshot: 'Possible screenshot',
  possible_edited: 'Possible edited image',
  low_quality: 'Low image quality',
  unrelated_subject: 'Unrelated subject',
}

function flagLabel(flag: string): string {
  if (flag.startsWith('contradicted:')) return `Conflicting ${flag.slice('contradicted:'.length)} evidence`
  return FLAG_LABEL[flag] ?? flag.replace(/_/g, ' ')
}

/** Renders one assessment. Only public-safe fields: no coordinates, no storage paths. */
export function AssessmentCard({ assessment, title }: { assessment: EvidenceAssessment; title: string }) {
  const observed = assessment.signals.filter((s) => s.outcome !== 'unknown' && s.outcome !== 'not_applicable')
  const missing = assessment.signals.filter((s) => s.outcome === 'unknown' || s.outcome === 'not_applicable')
  const insufficient = assessment.riskFlags.includes('insufficient_evidence')
  const coveragePct = Math.round(assessment.evidenceCoverage * 100)

  return (
    <div className="rounded-xl border border-border bg-card/40 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <Badge variant="outline" className={`capitalize ${RISK_STYLES[assessment.riskLevel]}`}>
          {assessment.riskLevel} risk
        </Badge>
      </div>

      <div className="flex items-end gap-4">
        <div>
          <div className="text-3xl font-bold text-foreground leading-none">{assessment.confidenceIndex}</div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">Confidence Index / 100</div>
        </div>
        <div className="flex-1">
          <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
            <span>Evidence coverage</span>
            <span>{coveragePct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-[#17140f]" style={{ width: `${coveragePct}%` }} />
          </div>
        </div>
      </div>

      {insufficient && (
        <p className="text-xs text-muted-foreground">
          There was not enough checkable evidence, so the index stays neutral. This is not a negative finding.
        </p>
      )}

      {assessment.riskFlags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {assessment.riskFlags.map((flag) => (
            <Badge key={flag} variant="outline" className="text-[10px] text-muted-foreground">
              {flagLabel(flag)}
            </Badge>
          ))}
        </div>
      )}

      {observed.length > 0 && (
        <ul className="space-y-1.5">
          {observed.map((s) => (
            <li key={s.key} className="text-xs">
              <span className="font-semibold text-foreground">{FACTOR_LABEL[s.key]}: </span>
              <span className={OUTCOME_STYLE[s.outcome]}>{OUTCOME_LABEL[s.outcome]}</span>
              <span className="text-muted-foreground"> - {s.reason}</span>
            </li>
          ))}
        </ul>
      )}

      {missing.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Not counted against this report:{' '}
          {missing.map((s) => `${FACTOR_LABEL[s.key]} (${OUTCOME_LABEL[s.outcome].toLowerCase()})`).join(', ')}.
        </p>
      )}
    </div>
  )
}
