'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { EvidenceTimeline } from '@/components/evidence/EvidenceTimeline'
import type { ResolutionReviewSummary } from '@/lib/evidence/review-summary'
import type { ReviewVerdict } from '@/lib/evidence/types'

const OPTIONS: Array<{ verdict: ReviewVerdict; label: string; hint: string }> = [
  { verdict: 'fixed', label: 'Fixed', hint: 'The problem is gone.' },
  { verdict: 'partially_fixed', label: 'Partially fixed', hint: 'Some work was done, not all.' },
  { verdict: 'still_present', label: 'Still there', hint: 'The problem remains.' },
  { verdict: 'cant_tell', label: "Can't tell", hint: "I can't judge from here." },
]

const STATE_LABEL: Record<string, string> = {
  not_claimed: 'No completion claimed',
  awaiting_proof: 'Awaiting municipal proof',
  awaiting_community: 'Community review open',
  verified: 'Fix verified',
  disputed: 'Fix disputed',
  unverified: 'Could not be verified',
}

/**
 * Resolution review: "Did the municipality actually fix it?" - separate from intake review.
 * Identity and eligibility come from the server session; nothing here is sent as userId.
 */
export function ResolutionReviewCard({ issueId, onSubmitted }: { issueId: string; onSubmitted?: () => void }) {
  const [summary, setSummary] = useState<ResolutionReviewSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<ReviewVerdict | null>(null)
  const [comment, setComment] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/issues/${issueId}/resolution-review`, { cache: 'no-store' })
      if (res.ok) setSummary((await res.json()) as ResolutionReviewSummary)
    } finally {
      setLoading(false)
    }
  }, [issueId])

  useEffect(() => {
    load()
  }, [load])

  async function submit(verdict: ReviewVerdict) {
    setSubmitting(verdict)
    const toastId = toast.loading('Submitting your review...')
    try {
      const res = await fetch(`/api/issues/${issueId}/resolution-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict, comment: comment.trim() || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to submit review')
      toast.success('Thanks for reviewing this fix.', { id: toastId })
      setComment('')
      await load()
      onSubmitted?.()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to submit review", { id: toastId })
    } finally {
      setSubmitting(null)
    }
  }

  if (loading) return <p className="text-xs text-muted-foreground">Loading resolution review...</p>
  if (!summary) return <p className="text-xs text-muted-foreground">Resolution review is unavailable.</p>

  const open = summary.resolutionVerificationState === 'awaiting_community'
  const canVote = open && summary.viewer.eligible && !summary.viewer.myVerdict
  const t = summary.tallies

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card/40 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground">Did the city actually fix it?</h3>
          <p className="text-xs text-muted-foreground">
            {STATE_LABEL[summary.resolutionVerificationState] ?? summary.resolutionVerificationState}
            {summary.reviewExpiresAt && open ? ` - closes ${new Date(summary.reviewExpiresAt).toLocaleString()}` : ''}
          </p>
        </div>
        <div className="text-right text-[11px] text-muted-foreground">
          {t.fixed} / {summary.quorum} confirmations
        </div>
      </div>

      {summary.photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {summary.photos.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.url} src={p.url} alt="Municipal completion proof" className="rounded-lg border border-border object-cover aspect-video w-full" />
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>Fixed: {t.fixed}</span>
        <span>Partially: {t.partially_fixed}</span>
        <span>Still there: {t.still_present}</span>
        <span>Can&apos;t tell: {t.cant_tell}</span>
      </div>

      {summary.viewer.myVerdict && (
        <p className="text-xs text-emerald-700">You reviewed this fix: {summary.viewer.myVerdict.replace('_', ' ')}.</p>
      )}
      {open && !summary.viewer.eligible && summary.viewer.reason && (
        <p className="text-xs text-muted-foreground">{summary.viewer.reason}</p>
      )}

      {canVote && (
        <div className="space-y-3">
          <Textarea
            value={comment}
            maxLength={500}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional: what did you see?"
            className="text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            {OPTIONS.map((o) => (
              <Button
                key={o.verdict}
                variant={o.verdict === 'fixed' ? 'default' : 'outline'}
                disabled={submitting !== null}
                onClick={() => submit(o.verdict)}
                className="h-auto flex-col items-start gap-0.5 py-2 text-left"
              >
                <span className="text-sm font-semibold">{o.label}</span>
                <span className="text-[11px] font-normal opacity-80">{o.hint}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      <EvidenceTimeline assessments={summary.assessments} events={summary.events} />
    </div>
  )
}
