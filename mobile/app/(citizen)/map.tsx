import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'

import { MapSurface } from '@/components/map/MapSurface'
import { CategoryChip, StatusPill } from '@/components/ui/Chip'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, LoadingState, Notice, Skeleton } from '@/components/ui/Feedback'
import { Screen } from '@/components/ui/Screen'
import { PressableScale } from '@/components/ui/PressableScale'
import { Text } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useNearbyIssues } from '@/hooks/useNearbyIssues'
import { formatDistance, timeAgo } from '@/lib/format'
import { getCurrentPoint, hasLocationPermission, requestLocationPermission } from '@/lib/location/geo'
import type { LatLng } from '@/lib/location/postgis'
import { STATUS_META, TONE_COLOR, accent, ink, line, radius, space, surface } from '@/theme/tokens'

/** Default centre — Nashik. */
const NASHIK: LatLng = { lat: 19.9975, lng: 73.7898 }

/**
 * City map.
 *
 * Doubles as the "what is happening around me" survey. The legend is not decoration:
 * pin colours are meaningless without it, and a citizen glancing at the map needs to
 * know that red means an emergency rather than a resolved issue.
 */
export default function MapScreen() {
  const router = useRouter()
  const { profile } = useAuth()

  const [devicePoint, setDevicePoint] = useState<LatLng | null>(null)
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied' | 'unavailable'>('unknown')
  const [locating, setLocating] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Prefer where the citizen actually is; fall back to their saved home location.
  const origin = devicePoint ?? profile?.home_location ?? null
  const nearby = useNearbyIssues(origin)

  const locate = useCallback(async (silent: boolean) => {
    if (!silent) setLocating(true)
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
      if (!silent) setLocating(false)
    }
  }, [])

  // On mount, only centre on the device if permission was already granted — never
  // trigger a permission prompt just because someone opened the Map tab.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const granted = await hasLocationPermission()
      if (cancelled) return
      if (granted) {
        setPermission('granted')
        try {
          const point = await getCurrentPoint({ timeoutMs: 8000 })
          if (!cancelled) setDevicePoint({ lat: point.lat, lng: point.lng })
        } catch {
          // A failed fix is fine — the saved home location is still used.
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const markers = useMemo(
    () =>
      nearby.issues
        .filter((issue) => issue.location)
        .map((issue) => ({
          id: issue.id,
          coordinate: { lat: issue.location!.lat, lng: issue.location!.lng },
          status: issue.status,
          severity: issue.severity,
          title: issue.title,
        })),
    [nearby.issues]
  )

  const region = useMemo(
    () => ({
      latitude: origin?.lat ?? NASHIK.lat,
      longitude: origin?.lng ?? NASHIK.lng,
      latitudeDelta: origin ? 0.03 : 0.08,
      longitudeDelta: origin ? 0.03 : 0.08,
    }),
    [origin]
  )

  const selected = useMemo(
    () => nearby.issues.find((issue) => issue.id === selectedId) ?? null,
    [nearby.issues, selectedId]
  )

  const openDetail = useCallback((id: string) => router.push(`/issue/${id}`), [router])

  return (
    <Screen padded edges={['top']} contentContainerStyle={styles.container} style={styles.screenPadding} bottomInset={0}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="title">City map</Text>
          <Text variant="caption" tone="faint">
            {nearby.loading
              ? 'Loading reports…'
              : `${nearby.issues.length} open report${nearby.issues.length === 1 ? '' : 's'} in the last 500 filed`}
          </Text>
        </View>
        <Button
          label={locating ? 'Locating…' : 'Find me'}
          size="sm"
          variant="secondary"
          loading={locating}
          onPress={() => locate(false)}
          icon={<Icon name="crosshairs-gps" size={15} color={ink.base} />}
        />
      </View>

      {permission === 'denied' ? (
        <Notice
          tone="amber"
          title="Location is off"
          body="The map still works, but it cannot centre on you or sort reports by distance until location access is allowed."
          icon={<Icon name="map-marker-off-outline" size={15} color={accent.amberSoft} />}
          style={styles.notice}
        />
      ) : null}

      {nearby.error && nearby.issues.length === 0 ? (
        <ErrorState title="Could not load the map data" message={nearby.error} onRetry={() => nearby.reload()} />
      ) : nearby.loading && nearby.issues.length === 0 ? (
        <View style={styles.loadingStack}>
          <Skeleton height={300} />
          <Skeleton height={72} />
        </View>
      ) : (
        <>
          <View style={styles.mapWrap}>
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
              onSelect={(id) => setSelectedId(id)}
              userLocation={permission === 'granted' ? devicePoint : null}
              height={430}
            />

            {/* Legend — pin colours are meaningless without it. */}
            <View pointerEvents="none" style={styles.legend}>
              {(['open', 'in_progress', 'resolved', 'false_closure'] as const).map((status) => (
                <View key={status} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: TONE_COLOR[STATUS_META[status].tone] }]} />
                  <Text variant="micro" tone="muted">
                    {STATUS_META[status].label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Selected preview */}
          {selected ? (
            <PressableScale
              onPress={() => openDetail(selected.id)}
              haptic="tap"
              accessibilityRole="button"
              accessibilityLabel={`Open ${selected.title ?? 'report'}`}
            >
              <Card style={styles.preview}>
                <View style={styles.previewTop}>
                  <CategoryChip category={selected.category} dense />
                  <StatusPill status={selected.status} dense />
                </View>
                <Text variant="bodyTight" weight="semibold" numberOfLines={2}>
                  {selected.title?.trim() || 'Untitled report'}
                </Text>
                <View style={styles.previewMeta}>
                  <Text variant="micro" tone="faint" mono>
                    {formatDistance(selected.distanceMetres)}
                  </Text>
                  <Text variant="micro" tone="faint">
                    ·
                  </Text>
                  <Text variant="micro" tone="faint" numberOfLines={1} style={styles.previewAddress}>
                    {selected.address?.trim() || 'Location recorded'}
                  </Text>
                  <Text variant="micro" tone="faint">
                    ·
                  </Text>
                  <Text variant="micro" tone="faint">
                    {timeAgo(selected.created_at)}
                  </Text>
                </View>
              </Card>
            </PressableScale>
          ) : (
            <Card style={styles.hintCard}>
              <Icon name="gesture-tap" size={15} color={accent.brand} />
              <Text variant="caption" tone="muted" style={styles.hintText}>
                Tap a pin to see the report, or open one from the nearby list.
              </Text>
            </Card>
          )}

          {nearby.issues.length === 0 ? (
            <EmptyState
              title="Nothing open nearby"
              body="No open reports have been filed in this area yet."
            />
          ) : null}
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  screenPadding: { paddingHorizontal: space.lg },
  container: { gap: space.lg, paddingBottom: space.huge },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md },
  headerText: { flex: 1, gap: 2 },
  notice: { marginTop: 0 },
  loadingStack: { gap: space.lg },
  mapWrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line.base,
  },
  legend: {
    position: 'absolute',
    bottom: space.md,
    left: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(13,17,23,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line.base,
    gap: 5,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  preview: { gap: space.sm },
  previewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  previewMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  previewAddress: { flexShrink: 1 },
  hintCard: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  hintText: { flex: 1 },
})
