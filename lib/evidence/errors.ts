/** Safe message extraction for `catch (error: unknown)`. */
export function errorMessage(error: unknown, fallback = 'Unexpected error'): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const m = (error as { message?: unknown }).message
    if (typeof m === 'string' && m) return m
  }
  return fallback
}
