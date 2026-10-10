'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CompletionEvidenceForm } from '@/components/admin/CompletionEvidenceForm'

export interface MunicipalityIssue {
  id: string
  title: string | null
  description: string | null
  category: string | null
  severity: number | null
  isEmergency: boolean
  status: string
  address: string | null
  slaDeadline: string | null
  createdAt: string
  verificationState: string
  departmentName: string | null
}

const CAN_CLAIM = ['not_claimed', 'awaiting_proof', 'disputed', 'unverified']

const STATE_LABEL: Record<string, string> = {
  not_claimed: 'No claim yet',
  awaiting_proof: 'Proof requested',
  awaiting_community: 'Community review open',
  verified: 'Verified',
  disputed: 'Disputed by residents',
  unverified: 'Review ended without quorum',
}

export function MunicipalityIssueCard({ issue, isTarget = false }: { issue: MunicipalityIssue; isTarget?: boolean }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(isTarget)
  const canClaim = CAN_CLAIM.includes(issue.verificationState)
  const urgent = issue.isEmergency || (issue.severity ?? 0) >= 8

  return (
    <div
      id={`issue-${issue.id}`}
      className={`rounded-2xl border transition-all duration-200 bg-card/40 p-5 space-y-3 ${
        isTarget
          ? 'border-[#17140f] ring-2 ring-[#17140f]/40 shadow-lg shadow-black/10 bg-sky/40'
          : 'border-border'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">{issue.title || 'Untitled issue'}</h2>
            {isTarget && (
              <Badge variant="outline" className="border-black/15 bg-sky/50 text-indigo-700 text-[10px]">
                Target Issue
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{issue.address || 'Address unavailable'}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {issue.departmentName && (
            <Badge variant="outline" className="border-black/10 bg-sky/60 text-indigo-700">
              {issue.departmentName}
            </Badge>
          )}
          {urgent && (
            <Badge variant="outline" className="border-black/10 bg-blush/60 text-rose-700">
              Urgent
            </Badge>
          )}
          <Badge variant="outline" className="capitalize">
            {issue.status.replace('_', ' ')}
          </Badge>
          <Badge variant="outline">{STATE_LABEL[issue.verificationState] ?? issue.verificationState}</Badge>
        </div>
      </div>

      {issue.description && <p className="text-sm text-muted-foreground line-clamp-3">{issue.description}</p>}

      {issue.status === 'community_review' && (
        <div className="bg-sun/60 border border-black/10 rounded-xl p-3 text-xs space-y-1">
          <div className="font-semibold text-amber-700">Intake Community Review Active</div>
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            This issue was flagged for resident intake verification. As an administrator, submitting completion proof will verify the report and open the 72-hour community resolution review.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground">
        <span className="capitalize">{issue.category ?? 'uncategorised'}</span>
        <span>Severity {issue.severity ?? '-'}/10</span>
        <span>Reported {new Date(issue.createdAt).toLocaleDateString()}</span>
        {issue.slaDeadline && <span>SLA {new Date(issue.slaDeadline).toLocaleDateString()}</span>}
      </div>

      {canClaim ? (
        showForm ? (
          <CompletionEvidenceForm
            issueId={issue.id}
            onSubmitted={() => {
              setShowForm(false)
              router.refresh()
            }}
          />
        ) : (
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            Submit completion proof
          </Button>
        )
      ) : (
        <p className="text-xs text-muted-foreground">
          {issue.verificationState === 'awaiting_community'
            ? 'Waiting for independent resident reviews.'
            : 'No action needed right now.'}
        </p>
      )}
    </div>
  )
}
