import { analyzeImage } from '@/lib/ai/client'
import type { EvidenceSignalResult } from './types'

/**
 * Resolution-side evidence gathering. Produces structured signals only;
 * the pure policy (policy.ts) turns them into an assessment.
 * Any failure maps to `unknown`, never `contradicts`.
 */

export interface VisualComparison {
  sceneMatch: 'same' | 'different' | 'unclear'
  defectRemaining: 'none' | 'partial' | 'present' | 'unclear'
  anomalyFlags: string[]
  summary: string
}

const COMPARISON_PROMPT = `You compare civic-issue photos for an Indian municipal corporation.
Judge only what is visible. If you cannot tell, answer "unclear" - do not guess.
Reply with ONLY a JSON object:
{
  "scene_match": "same" | "different" | "unclear",
  "defect_remaining": "none" | "partial" | "present" | "unclear",
  "anomaly_flags": string[],
  "summary": "max 40 words describing what changed"
}
"scene_match": is it the same place/object as the original problem?
"anomaly_flags": any of "possible_stock_image", "possible_screenshot", "possible_edited", "low_quality", "unrelated_subject".`

const SCENE = ['same', 'different', 'unclear'] as const
const DEFECT = ['none', 'partial', 'present', 'unclear'] as const
const ALLOWED_FLAGS = new Set([
  'possible_stock_image',
  'possible_screenshot',
  'possible_edited',
  'low_quality',
  'unrelated_subject',
])

export function parseVisualComparison(raw: string): VisualComparison | null {
  const match = /\{[\s\S]*\}/.exec(raw)
  if (!match) return null
  try {
    const o = JSON.parse(match[0]) as Record<string, unknown>
    const scene = SCENE.find((s) => s === o.scene_match)
    const defect = DEFECT.find((s) => s === o.defect_remaining)
    if (!scene || !defect) return null
    const flags = Array.isArray(o.anomaly_flags)
      ? (o.anomaly_flags as unknown[]).filter((f): f is string => typeof f === 'string' && ALLOWED_FLAGS.has(f))
      : []
    return {
      sceneMatch: scene,
      defectRemaining: defect,
      anomalyFlags: flags,
      summary: typeof o.summary === 'string' ? o.summary.slice(0, 300) : '',
    }
  } catch {
    return null
  }
}

/**
 * Gemini Flash comparison of the original issue photo and one completion photo.
 * analyzeImage takes a single image, so the original is described first and that
 * description is given as context alongside the completion photo.
 */
export async function compareCompletionImage(input: {
  originalImageUrl: string | null
  completionImageUrl: string
}): Promise<VisualComparison | null> {
  try {
    let prompt: string
    if (input.originalImageUrl) {
      const original = await analyzeImage(
        input.originalImageUrl,
        'Describe the civic problem visible in this photo in at most 60 words: object, surroundings, distinctive landmarks.'
      )
      prompt = `${COMPARISON_PROMPT}\n\nOriginal problem photo description: ${original.slice(0, 600)}\nThe attached image is the municipality's claimed completion photo.`
    } else {
      prompt = `${COMPARISON_PROMPT}\n\nNo original photo exists, so "scene_match" must be "unclear". The attached image is the claimed completion photo.`
    }
    const raw = await analyzeImage(input.completionImageUrl, prompt)
    return parseVisualComparison(raw)
  } catch (err) {
    console.warn('[Evidence Assessor] Visual comparison unavailable:', err)
    return null
  }
}

export function mediaSignalFromComparisons(
  comparisons: Array<VisualComparison | null>,
  photoCount: number
): EvidenceSignalResult {
  const base = { key: 'media' as const, weight: 3, source: 'gemini-2.5-flash image comparison', freshness: 'fresh' as const }
  if (photoCount === 0) {
    return { ...base, outcome: 'unknown', reason: 'No completion photo was provided.', source: 'none', freshness: 'unknown' }
  }
  const usable = comparisons.filter((c): c is VisualComparison => c !== null)
  if (usable.length === 0) {
    return { ...base, outcome: 'unknown', reason: 'Photo analysis was unavailable; the photo is kept for community review.' }
  }
  if (usable.some((c) => c.defectRemaining === 'present' || c.defectRemaining === 'partial')) {
    const present = usable.some((c) => c.defectRemaining === 'present')
    return {
      ...base,
      outcome: 'contradicts',
      reason: present
        ? 'The completion photo still appears to show the defect.'
        : 'The completion photo appears to show a partial fix.',
    }
  }
  if (usable.some((c) => c.sceneMatch === 'different')) {
    return { ...base, outcome: 'contradicts', reason: 'The completion photo does not appear to show the reported location or object.' }
  }
  if (usable.every((c) => c.defectRemaining === 'none' && c.sceneMatch === 'same')) {
    return { ...base, outcome: 'supports', reason: 'The completion photo matches the original scene and shows no remaining defect.' }
  }
  return { ...base, outcome: 'neutral', reason: 'The photo analysis could not clearly confirm scene or fix.' }
}
