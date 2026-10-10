/** Client-safe media constants (no Node imports). Server validation lives in media.ts. */
export const MAX_EVIDENCE_BYTES = 20 * 1024 * 1024
export const MAX_COMPLETION_FILES = 6
export const ALLOWED_EVIDENCE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
