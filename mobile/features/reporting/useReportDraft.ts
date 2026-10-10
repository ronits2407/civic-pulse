import { useCallback, useEffect, useRef, useState } from 'react'

import { draftStorage } from '@/lib/storage/session-storage'

/**
 * Local draft persistence for the report composer.
 *
 * A civic report is often written while standing in the street, sometimes with no
 * signal. Losing a half-written description to a backgrounded app is the single
 * most frustrating thing this flow could do, so the composer mirrors its state to
 * AsyncStorage on a debounce and restores it on mount.
 *
 * This is local-only by design: a draft is explicitly NOT a submission, and the UI
 * must never imply the municipality has seen it.
 */

export type LocationMode = 'none' | 'gps' | 'map'

export interface ReportDraft {
  text: string
  imageUri: string | null
  videoUri: string | null
  lat: number | null
  lng: number | null
  address: string | null
  locationMode: LocationMode
  savedAt: string
}

const STORAGE_KEY = 'civicpulse.report-draft.v1'
const DEBOUNCE_MS = 700

export const EMPTY_DRAFT: ReportDraft = {
  text: '',
  imageUri: null,
  videoUri: null,
  lat: null,
  lng: null,
  address: null,
  locationMode: 'none',
  savedAt: '',
}

function isDraftMeaningful(draft: ReportDraft): boolean {
  return Boolean(
    draft.text.trim() || draft.imageUri || draft.videoUri || draft.lat != null || draft.lng != null
  )
}

export function useReportDraft() {
  const [draft, setDraft] = useState<ReportDraft>(EMPTY_DRAFT)
  const [restored, setRestored] = useState(false)
  const [restoredFrom, setRestoredFrom] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipNextSave = useRef(true)

  // ── Restore once on mount ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const raw = await draftStorage.getItem(STORAGE_KEY)
        if (cancelled) return
        if (raw) {
          const parsed = JSON.parse(raw) as ReportDraft
          if (isDraftMeaningful(parsed)) {
            setDraft({ ...EMPTY_DRAFT, ...parsed })
            setRestoredFrom(parsed.savedAt || null)
          }
        }
      } catch {
        // A corrupt draft is not worth surfacing; start clean.
      } finally {
        if (!cancelled) setRestored(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // ── Debounced save ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!restored) return
    // The first pass after restoring would immediately rewrite what we just read.
    if (skipNextSave.current) {
      skipNextSave.current = false
      return
    }

    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const next = { ...draft, savedAt: new Date().toISOString() }
      if (!isDraftMeaningful(next)) {
        draftStorage.removeItem(STORAGE_KEY).catch(() => {})
        return
      }
      draftStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {})
    }, DEBOUNCE_MS)

    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [draft, restored])

  const update = useCallback((patch: Partial<ReportDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
  }, [])

  const clearDraft = useCallback(async () => {
    setDraft(EMPTY_DRAFT)
    setRestoredFrom(null)
    try {
      await draftStorage.removeItem(STORAGE_KEY)
    } catch {
      // Nothing actionable if the clear fails; the next save overwrites anyway.
    }
  }, [])

  /** Discard only the restored snapshot, keeping whatever is typed now. */
  const dismissRestoredNotice = useCallback(() => setRestoredFrom(null), [])

  return { draft, update, clearDraft, restored, restoredFrom, dismissRestoredNotice }
}
