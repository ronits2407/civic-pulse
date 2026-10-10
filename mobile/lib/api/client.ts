import { env } from '@/lib/env'

/**
 * Thin, typed transport for the existing Next.js backend.
 *
 * Responsibilities are deliberately narrow: build the URL, attach the Supabase
 * access token, enforce a timeout, and normalise errors. Feature modules call
 * `endpoints.ts`, never `fetch` directly.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
  }

  /** Network-level failure (no HTTP status at all). */
  get isNetworkError() {
    return this.status === 0
  }
}

// ── Auth token registry ───────────────────────────────────────────────────────
// `auth/` owns the session; this keeps the dependency pointing one way only.

type TokenProvider = () => Promise<string | null>

let tokenProvider: TokenProvider = async () => null

/** Called once by AuthProvider so requests can carry `Authorization: Bearer`. */
export function setAuthTokenProvider(provider: TokenProvider) {
  tokenProvider = provider
}

export interface RequestOptions {
  /** Skip the Authorization header (public endpoints). */
  anonymous?: boolean
  /** Milliseconds before the request is aborted. Default 20s. */
  timeoutMs?: number
  signal?: AbortSignal
}

const DEFAULT_TIMEOUT_MS = 20_000

function buildUrl(path: string): string {
  if (!env.apiUrl) {
    throw new ApiError(
      'EXPO_PUBLIC_API_URL is not configured. Set it in mobile/.env.local to reach the CivicPulse backend.',
      0
    )
  }
  return `${env.apiUrl}${path.startsWith('/') ? path : `/${path}`}`
}

/** Pull the most useful message out of whichever error shape the route returned. */
async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const text = await res.text()
    if (!text) return `Request failed with status ${res.status}`
    try {
      const json = JSON.parse(text)
      if (typeof json?.error === 'string') return json.error
      if (typeof json?.message === 'string') return json.message
    } catch {
      // Non-JSON body (e.g. an HTML error page) — fall through to the raw text.
      if (text.length < 300) return text
    }
    return `Request failed with status ${res.status}`
  } catch {
    return `Request failed with status ${res.status}`
  }
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  // Chain an externally supplied signal so callers can also cancel.
  if (options.signal) {
    if (options.signal.aborted) controller.abort()
    else options.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  if (!options.anonymous) {
    try {
      const token = await tokenProvider()
      if (token) headers.Authorization = `Bearer ${token}`
    } catch {
      // A missing token must not break anonymous-capable endpoints; the
      // server decides whether authentication was actually required.
    }
  }

  let res: Response
  try {
    res = await fetch(buildUrl(path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (err: any) {
    clearTimeout(timeout)
    if (err?.name === 'AbortError') {
      throw new ApiError('The request timed out. Check your connection and try again.', 0)
    }
    // In development, name the address that failed. "Could not reach CivicPulse" alone
    // hides the usual cause: the app is pointed at an address the device cannot reach.
    throw new ApiError(
      __DEV__
        ? `Could not reach CivicPulse at ${env.apiUrl}. Is the backend running, and can this device reach that address?`
        : 'Could not reach CivicPulse. Check your network connection.',
      0
    )
  } finally {
    clearTimeout(timeout)
  }

  if (!res.ok) {
    throw new ApiError(await extractErrorMessage(res), res.status)
  }

  if (res.status === 204) return undefined as T

  try {
    return (await res.json()) as T
  } catch {
    throw new ApiError('The server returned a response the app could not read.', res.status)
  }
}

export const http = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, body, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, body, options),
}
