import { env } from '@/lib/env'

/**
 * Connectivity probe for the backend.
 *
 * "Could not reach CivicPulse" can mean five different things (wrong URL baked into the
 * bundle, stale cache, backend down, tunnel down, device network blocking the host).
 * This reports which URL the app is really using and what the device actually got back,
 * so the cause is read off the screen instead of guessed.
 */

export interface PingResult {
  url: string
  ok: boolean
  status: number | null
  ms: number
  detail: string
}

export async function pingBackend(timeoutMs = 10_000): Promise<PingResult> {
  const url = `${env.apiUrl}/api/test`
  const started = Date.now()

  if (!env.apiUrl) {
    return { url, ok: false, status: null, ms: 0, detail: 'EXPO_PUBLIC_API_URL is empty and could not be derived.' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
    const ms = Date.now() - started
    const body = await res.text()
    return {
      url,
      ok: res.ok,
      status: res.status,
      ms,
      detail: res.ok ? 'Backend answered.' : `Backend answered with HTTP ${res.status}: ${body.slice(0, 120)}`,
    }
  } catch (err: any) {
    return {
      url,
      ok: false,
      status: null,
      ms: Date.now() - started,
      detail:
        err?.name === 'AbortError'
          ? `No answer within ${timeoutMs / 1000}s. The address is probably blocked or unreachable from this network.`
          : `Request failed before any response: ${err?.message ?? 'unknown error'}`,
    }
  } finally {
    clearTimeout(timer)
  }
}
