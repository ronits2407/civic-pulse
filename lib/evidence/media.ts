import { randomUUID } from 'crypto'
import { ALLOWED_EVIDENCE_MIME_TYPES, MAX_COMPLETION_FILES, MAX_EVIDENCE_BYTES } from './media-limits'

export { ALLOWED_EVIDENCE_MIME_TYPES, MAX_COMPLETION_FILES, MAX_EVIDENCE_BYTES }

export const EVIDENCE_BUCKET = 'issue-evidence'

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const KEY_RE = /^([0-9a-f-]{36})\/([0-9a-f-]{36})\/([0-9a-f-]{36})\.(jpg|png|webp|heic|heif)$/i

export type MediaValidation = { ok: true } | { ok: false; error: string }

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

export function validateEvidenceFile(file: { type: string; size: number }): MediaValidation {
  if (!MIME_TO_EXT[file.type]) {
    return { ok: false, error: `Unsupported file type "${file.type || 'unknown'}". Use JPEG, PNG, WebP or HEIC images.` }
  }
  if (file.size <= 0) return { ok: false, error: 'File is empty.' }
  if (file.size > MAX_EVIDENCE_BYTES) return { ok: false, error: 'File exceeds the 20MB limit.' }
  return { ok: true }
}

/** Opaque private object path: {userId}/{issueId}/{uuid}.{ext}. No user-supplied filename is ever used. */
export function buildEvidencePath(userId: string, issueId: string, mimeType: string): string {
  const ext = MIME_TO_EXT[mimeType]
  if (!ext) throw new Error(`Unsupported MIME type: ${mimeType}`)
  if (!isUuid(userId) || !isUuid(issueId)) throw new Error('userId and issueId must be UUIDs')
  return `${userId}/${issueId}/${randomUUID()}.${ext}`
}

/**
 * Validates a client-supplied storage key. The key must sit inside the caller's own folder
 * (session-derived userId) and the target issue's folder; anything else is rejected.
 */
export function validateEvidenceKey(key: unknown, userId: string, issueId: string): MediaValidation {
  if (typeof key !== 'string' || key.length > 200) return { ok: false, error: 'Invalid storage key.' }
  if (key.includes('..') || key.includes('//')) return { ok: false, error: 'Invalid storage key.' }
  const m = KEY_RE.exec(key)
  if (!m) return { ok: false, error: 'Storage key does not match the expected format.' }
  if (m[1].toLowerCase() !== userId.toLowerCase()) return { ok: false, error: 'Storage key is outside your folder.' }
  if (m[2].toLowerCase() !== issueId.toLowerCase()) return { ok: false, error: 'Storage key belongs to a different issue.' }
  return { ok: true }
}

export function mimeFromKey(key: string): string | null {
  const ext = key.split('.').pop()?.toLowerCase()
  const entry = Object.entries(MIME_TO_EXT).find(([, e]) => e === ext)
  return entry ? entry[0] : null
}
