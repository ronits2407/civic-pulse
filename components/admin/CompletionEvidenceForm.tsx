'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ALLOWED_EVIDENCE_MIME_TYPES, MAX_COMPLETION_FILES, MAX_EVIDENCE_BYTES } from '@/lib/evidence/media-limits'

interface Props {
  issueId: string
  onSubmitted?: () => void
}

/**
 * Municipal completion form. The server derives who you are and whether your department owns the
 * issue; nothing identity-related is sent. Submitting opens community review - it does not close the issue.
 */
export function CompletionEvidenceForm({ issueId, onSubmitted }: Props) {
  const [files, setFiles] = useState<File[]>([])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    setError('')
    if (picked.length > MAX_COMPLETION_FILES) {
      setError(`Choose at most ${MAX_COMPLETION_FILES} photos.`)
      return
    }
    for (const f of picked) {
      if (!ALLOWED_EVIDENCE_MIME_TYPES.includes(f.type)) {
        setError('Only JPEG, PNG, WebP or HEIC images are allowed.')
        return
      }
      if (f.size > MAX_EVIDENCE_BYTES) {
        setError('Each photo must be under 20MB.')
        return
      }
    }
    setFiles(picked)
  }

  function getPosition(): Promise<GeolocationPosition | null> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null)
    return new Promise((resolve) =>
      navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { enableHighAccuracy: true, timeout: 10000 })
    )
  }

  async function submit() {
    if (submitting) return
    if (files.length === 0) return setError('Add at least one completion photo.')
    if (notes.trim().length < 10) return setError('Describe the work done (at least 10 characters).')
    setError('')
    setSubmitting(true)
    const toastId = toast.loading('Uploading and analysing proof...')
    try {
      // Location is optional: if unavailable the signal is "unknown", which never counts against the claim.
      const pos = await getPosition()
      const form = new FormData()
      files.forEach((f) => form.append('photos', f))
      form.append('notes', notes.trim())
      form.append('capturedAt', new Date(pos?.timestamp ?? Date.now()).toISOString())
      if (pos) {
        form.append('lat', String(pos.coords.latitude))
        form.append('lng', String(pos.coords.longitude))
        form.append('accuracy', String(pos.coords.accuracy))
      }
      const res = await fetch(`/api/issues/${issueId}/completion`, { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to submit completion evidence')
      toast.success('Completion evidence submitted. Community review is now open.', { id: toastId })
      setFiles([])
      setNotes('')
      onSubmitted?.()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to submit completion evidence"
      toast.error(message, { id: toastId })
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card/40 p-4">
      <div>
        <h4 className="text-sm font-semibold text-foreground">Submit completion proof</h4>
        <p className="text-xs text-muted-foreground">
          Residents near the site will review your proof. The issue stays in progress until enough of them confirm the fix.
        </p>
      </div>
      <input
        type="file"
        multiple
        accept={ALLOWED_EVIDENCE_MIME_TYPES.join(',')}
        onChange={onPick}
        className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-foreground"
      />
      {files.length > 0 && <p className="text-[11px] text-muted-foreground">{files.length} photo(s) selected.</p>}
      <Textarea
        value={notes}
        maxLength={2000}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Action taken (e.g. filled and compacted the pothole with cold mix)"
        className="text-sm"
      />
      {error && <p className="text-xs text-rose-700">{error}</p>}
      <Button onClick={submit} disabled={submitting} className="w-full">
        {submitting ? 'Submitting...' : 'Submit for community review'}
      </Button>
    </div>
  )
}
