import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { MapHeader } from '@/components/map/MapHeader'
import { MapPreview } from '@/components/map/MapPreview'
import { MapSurface } from '@/components/map/MapSurface'
import { TAB_BAR_CLEARANCE } from '@/components/navigation/PillTabBar'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useNearbyIssues } from '@/hooks/useNearbyIssues'
import { getCurrentPoint, hasLocationPermission, requestLocationPermission } from '@/lib/location/geo'
import type { LatLng } from '@/lib/location/postgis'
import { space, surface } from '@/theme/tokens'

const NASHIK: LatLng = { lat: 19.9975, lng: 73.7898 }

/**
 * City map, full bleed. The header floats over the map, and the selected report rises as
 * a card just above the tab bar. Tapping empty map dismisses it.
 */
export default function MapScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { profile } = useAuth()

  const [devicePoint, setDevicePoint] = useState<LatLng | null>(null)
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied' | 'unavailable'>('unknown')
  const [locating, setLocating] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Prefer where the citizen actually is; fall back to their saved home area.
  const origin = devicePoint ?? profile?.home_location ?? null
  const nearby = useNearbyIssues(origin)

  const locate = useCallback(async () => {
    setLocating(true)
    try {
      const outcome = await requestLocationPermission()
      if (outcome !== 'granted') {
        setPermission(outcome === 'denied' ? 'denied' : 'unavailable')
        return
      }
      setPermission('granted')
      const point = await getCurrentPoint()
      setDevicePoint({ lat: point.lat, lng: point.lng })
    } catch {
      setPermission((prev) => (prev === 'granted' ? prev : 'unavailable'))
    } finally {
      setLocating(false)
    }
  }, [])

  // Only centre on the device if permission was already granted: opening a tab must
  // never trigger a permission prompt.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!(await hasLocationPermission()) || cancelled) return
      setPermission('granted')
      try {
        const point = await getCurrentPoint({ timeoutMs: 8000 })
        if (!cancelled) setDevicePoint({ lat: point.lat, lng: point.lng })
      } catch {
        // The saved home area is still used.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const markers = useMemo(
    () =>
      nearby.issues
        .filter((i) => i.location)
        .map((i) => ({
          id: i.id,
          coordinate: { lat: i.location!.lat, lng: i.location!.lng },
          status: i.status,
          severity: i.severity,
          title: i.title,
        })),
    [nearby.issues]
  )
  const centre = origin ?? NASHIK
  const region = useMemo(
    () => ({ latitude: centre.lat, longitude: centre.lng, latitudeDelta: 0.06, longitudeDelta: 0.06 }),
    [centre.lat, centre.lng]
  )
  const selected = nearby.issues.find((i) => i.id === selectedId) ?? null
  const count = nearby.issues.length
  const where = devicePoint ? ' near you' : profile?.home_location ? ' near home' : ' in Nashik'
  const subtitle = nearby.loading && !nearby.data ? 'Loading reports' : `${count} open report${count === 1 ? '' : 's'}${where}`

  return (
    <View style={styles.root}>
      <MapSurface
        markers={markers}
        region={region}
        fallbackItems={nearby.issues.map((i) => ({
          id: i.id,
          title: i.title,
          category: i.category,
          status: i.status,
          distanceMetres: i.distanceMetres,
        }))}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onPressMap={() => setSelectedId(null)}
        userLocation={devicePoint}
        bleed
        controlsTop={insets.top + 150}
        style={StyleSheet.absoluteFill}
      />

      <View pointerEvents="box-none" style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <MapHeader
          subtitle={subtitle}
          located={Boolean(devicePoint)}
          locating={locating}
          onLocate={locate}
          permissionDenied={permission === 'denied'}
        />
      </View>

      <View pointerEvents="box-none" style={[styles.bottom, { paddingBottom: TAB_BAR_CLEARANCE + insets.bottom }]}>
        {selected ? (
          <MapPreview
            key={selected.id}
            issue={selected}
            onOpen={() => router.push(`/issue/${selected.id}`)}
            onClose={() => setSelectedId(null)}
          />
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: surface.canvas },
  top: { position: 'absolute', left: space.lg, right: space.lg, top: 0, gap: space.sm },
  bottom: { position: 'absolute', left: space.lg, right: space.lg, bottom: 0 },
})
