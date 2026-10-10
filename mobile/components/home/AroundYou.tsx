import React, { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'

import { MapSurface } from '@/components/map/MapSurface'
import { Card } from '@/components/ui/Card'
import { PressableScale } from '@/components/ui/PressableScale'
import { Text } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import type { useNearbyIssues } from '@/hooks/useNearbyIssues'
import type { LatLng } from '@/lib/location/postgis'
import { accent, radius, space, surface } from '@/theme/tokens'

const NASHIK = { latitude: 19.9975, longitude: 73.7898 }
const DELTA = { latitudeDelta: 0.04, longitudeDelta: 0.04 }

/** A small live map of open reports near the citizen's saved home area, on mist. */
export function AroundYou({ origin, nearby }: { origin: LatLng | null; nearby: ReturnType<typeof useNearbyIssues> }) {
  const router = useRouter()

  const markers = useMemo(
    () =>
      nearby.nearest
        .filter((i) => i.location)
        .map((i) => ({
          id: i.id,
          coordinate: { lat: i.location!.lat, lng: i.location!.lng },
          status: i.status,
          severity: i.severity,
          title: i.title,
        })),
    [nearby.nearest]
  )
  const region = useMemo(
    () => (origin ? { latitude: origin.lat, longitude: origin.lng, ...DELTA } : { ...NASHIK, ...DELTA }),
    [origin]
  )

  return (
    <Card variant="mist" style={styles.card}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <Text variant="heading">Around you</Text>
          <Text variant="caption" tone="muted">
            {origin
              ? `${nearby.withinOneKm} open report${nearby.withinOneKm === 1 ? '' : 's'} within 1 km`
              : 'Set your home area to see nearby reports'}
          </Text>
        </View>
        <PressableScale
          onPress={() => router.push(origin ? '/(citizen)/map' : '/(citizen)/profile')}
          accessibilityRole="button"
          accessibilityLabel={origin ? 'Open the map' : 'Set your home area'}
        >
          <View style={styles.arrow}>
            <Icon name="arrow-right" size={20} color={accent.brand} />
          </View>
        </PressableScale>
      </View>
      <MapSurface
        markers={markers}
        region={region}
        fallbackItems={nearby.nearest.map((i) => ({
          id: i.id,
          title: i.title,
          category: i.category,
          status: i.status,
          distanceMetres: i.distanceMetres,
        }))}
        onSelect={(id) => router.push(`/issue/${id}`)}
        userLocation={origin}
        height={180}
      />
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, gap: 2 },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
