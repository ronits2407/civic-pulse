import { useMemo } from 'react'

import { issuesApi } from '@/lib/api/endpoints'
import type { MapIssue } from '@/lib/api/contracts'
import { haversineMetres } from '@/lib/format'
import type { LatLng } from '@/lib/location/postgis'
import { useAsync } from '@/hooks/useAsync'

/**
 * City-wide issue markers for the map and the home preview.
 *
 * Data comes from `/api/issues/map`, which already returns coordinates decoded to
 * `{ lat, lng }` — so no PostGIS decoding is needed on this path. The route caps the
 * result at the 500 most recent non-closed issues.
 */
export interface NearbyIssue extends MapIssue {
  distanceMetres: number | null
}

export function useNearbyIssues(origin: LatLng | null, options: { enabled?: boolean } = {}) {
  const resource = useAsync<MapIssue[]>(
    () => issuesApi.map().then((r) => r.issues ?? []),
    [],
    { enabled: options.enabled !== false }
  )

  const issues = useMemo<NearbyIssue[]>(() => {
    const raw = (resource.data ?? []).filter((i) => i.location)
    const withDistance = raw.map((issue) => ({
      ...issue,
      distanceMetres:
        origin && issue.location
          ? haversineMetres(origin.lat, origin.lng, issue.location.lat, issue.location.lng)
          : null,
    }))
    // Nearest-first once we know where the citizen is, newest-first otherwise.
    return withDistance.sort((a, b) => {
      if (a.distanceMetres != null && b.distanceMetres != null) {
        return a.distanceMetres - b.distanceMetres
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [resource.data, origin])

  /** Markers clustered around the citizen, for the home preview strip. */
  const nearest = useMemo(() => issues.slice(0, 3), [issues])

  const withinOneKm = useMemo(
    () => issues.filter((i) => i.distanceMetres != null && i.distanceMetres <= 1000).length,
    [issues]
  )

  return { ...resource, issues, nearest, withinOneKm }
}
