import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Minimal async-resource hook.
 *
 * Deliberately hand-rolled rather than pulled from a data-fetching library: the app
 * has six read paths and no cache-invalidation graph, so a dependency would cost
 * more than it saves. What it does need to get right is the boring part — never
 * setting state after unmount, and never letting a slow earlier response overwrite
 * a newer one.
 */

export interface AsyncResource<T> {
  data: T | null
  error: string | null
  /** True only for the first load of the current dependency set. */
  loading: boolean
  /** True during a user-initiated refresh, so the UI can keep the old data. */
  refreshing: boolean
  reload: (options?: { silent?: boolean }) => Promise<void>
  setData: (updater: T | ((previous: T | null) => T | null)) => void
}

export function useAsync<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
  options: { enabled?: boolean } = {}
): AsyncResource<T> {
  const { enabled = true } = options

  const [data, setDataState] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [refreshing, setRefreshing] = useState(false)

  const mounted = useRef(true)
  // Monotonic token: only the newest request is allowed to commit its result.
  const requestId = useRef(0)
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const run = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true
      const id = ++requestId.current
      const controller = new AbortController()

      if (silent) setRefreshing(true)
      else setLoading(true)

      try {
        const result = await loaderRef.current(controller.signal)
        if (!mounted.current || id !== requestId.current) return
        setDataState(result)
        setError(null)
      } catch (err: any) {
        if (!mounted.current || id !== requestId.current) return
        if (err?.name === 'AbortError') return
        setError(err?.message ?? 'Something went wrong.')
      } finally {
        if (mounted.current && id === requestId.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    []
  )

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    run()
    // `deps` is intentionally the caller's dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled])

  const setData = useCallback((updater: T | ((previous: T | null) => T | null)) => {
    setDataState((previous) =>
      typeof updater === 'function' ? (updater as (p: T | null) => T | null)(previous) : updater
    )
  }, [])

  return { data, error, loading, refreshing, reload: run, setData }
}
