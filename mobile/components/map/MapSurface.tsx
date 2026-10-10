import React from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import { IncidentMap, type MapMarker, type MapRegion } from '@/components/map/IncidentMap'
import { MapErrorBoundary } from '@/components/map/MapErrorBoundary'
import { NearbyFallback, type FallbackItem } from '@/components/map/NearbyFallback'
import type { LatLng } from '@/lib/location/postgis'
import { radius, surface } from '@/theme/tokens'

/**
 * Map container used by Home and the Map tab.
 *
 * The map is drawn in React Native (see IncidentMap), so it needs no key or native
 * module. The error boundary remains as a safety net: if anything in the map throws,
 * the screen falls back to the nearby-reports list instead of going blank.
 */

export interface MapSurfaceProps {
  markers: MapMarker[]
  region: MapRegion
  /** Source for the fallback list. Same data as the markers. */
  fallbackItems: FallbackItem[]
  selectedId?: string | null
  onSelect: (id: string) => void
  onPressMap?: (coordinate: LatLng) => void
  onRegionChangeComplete?: (region: MapRegion) => void
  /** Device position for the blue dot. Null/undefined hides it. */
  userLocation?: LatLng | null
  interactive?: boolean
  height?: number
  style?: StyleProp<ViewStyle>
}

export function MapSurface({
  markers,
  region,
  fallbackItems,
  selectedId,
  onSelect,
  onPressMap,
  onRegionChangeComplete,
  userLocation,
  interactive = true,
  height = 260,
  style,
}: MapSurfaceProps) {
  const fallback = (
    <View style={[styles.fallbackWrap, style]}>
      <NearbyFallback items={fallbackItems} onSelect={onSelect} />
    </View>
  )

  return (
    <View style={style}>
      <MapErrorBoundary fallback={fallback}>
        <View style={[styles.mapWrap, { height }]}>
          <IncidentMap
            markers={markers}
            initialRegion={region}
            selectedId={selectedId}
            onSelectMarker={onSelect}
            onPressMap={onPressMap}
            onRegionChangeComplete={onRegionChangeComplete}
            userLocation={userLocation}
            interactive={interactive}
            style={StyleSheet.absoluteFill}
          />
        </View>
      </MapErrorBoundary>
    </View>
  )
}

const styles = StyleSheet.create({
  mapWrap: {
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: surface.sunken,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#30363d',
  },
  fallbackWrap: { width: '100%' },
})
