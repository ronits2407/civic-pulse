import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Modal, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { IncidentMap } from '@/components/map/IncidentMap'
import { MapErrorBoundary } from '@/components/map/MapErrorBoundary'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Feedback'
import { PressableScale } from '@/components/ui/PressableScale'
import { Text } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import { formatCoordinates } from '@/lib/format'
import { getCurrentPoint, requestLocationPermission, resolveAddress } from '@/lib/location/geo'
import type { LatLng } from '@/lib/location/postgis'
import { haptics } from '@/lib/haptics'
import { accent, ink, radius, space, surface } from '@/theme/tokens'

/**
 * Location picker.
 *
 * Three ways to place the pin, in order of least effort: tap the map, use the current
 * fix, or nudge with the arrow pad. The arrow pad matters more than it looks — it is
 * the only adjustment that survives the map being unavailable, and it gives precise
 * control that tapping a small screen never does (a tap at city zoom can be hundreds
 * of metres out).
 */

const NASHIK = { latitude: 19.9975, longitude: 73.7898 }

/** ~55 m of latitude. Mirrored on longitude so the pad feels square. */
const NUDGE_DEGREES = 0.0005

interface Props {
  visible: boolean
  initial: LatLng | null
  onClose: () => void
  onConfirm: (point: LatLng, address: string) => void
}

function NudgeButton({
  icon,
  label,
  onPress,
}: {
  icon: 'arrow-up' | 'arrow-down' | 'arrow-left' | 'arrow-right'
  label: string
  onPress: () => void
}) {
  return (
    <PressableScale
      onPress={onPress}
      haptic="tap"
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.nudgeButton}>
        <Icon name={icon} size={18} color={ink.base} />
      </View>
    </PressableScale>
  )
}

export function LocationPickerSheet({ visible, initial, onClose, onConfirm }: Props) {
  const insets = useSafeAreaInsets()

  const [point, setPoint] = useState<LatLng>(initial ?? { lat: NASHIK.latitude, lng: NASHIK.longitude })
  const [resolving, setResolving] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locationProblem, setLocationProblem] = useState<string | null>(null)

  // Re-centre each time the sheet opens with a new starting point.
  useEffect(() => {
    if (visible && initial) setPoint(initial)
  }, [visible, initial])

  const region = useMemo(
    () => ({
      latitude: point.lat,
      longitude: point.lng,
      latitudeDelta: 0.008,
      longitudeDelta: 0.008,
    }),
    [point]
  )

  const markers = useMemo(
    () => [
      {
        id: 'pin',
        coordinate: point,
        status: null,
        title: 'Selected location',
      },
    ],
    [point]
  )

  const nudge = useCallback((dLat: number, dLng: number) => {
    haptics.select()
    setPoint((prev) => ({ lat: prev.lat + dLat, lng: prev.lng + dLng }))
  }, [])

  const useCurrentLocation = useCallback(async () => {
    setLocating(true)
    setLocationProblem(null)
    try {
      const permission = await requestLocationPermission()
      if (permission === 'denied') {
        setLocationProblem(
          'Location access is off for CivicPulse. You can still place the pin by tapping the map.'
        )
        return
      }
      if (permission === 'unavailable') {
        setLocationProblem('Location services are turned off on this device.')
        return
      }
      const current = await getCurrentPoint()
      setPoint({ lat: current.lat, lng: current.lng })
    } catch {
      setLocationProblem('Could not get a GPS fix. Move somewhere with a clearer view of the sky.')
    } finally {
      setLocating(false)
    }
  }, [])

  const confirm = useCallback(async () => {
    setResolving(true)
    try {
      const address = await resolveAddress(point)
      onConfirm(point, address)
    } finally {
      setResolving(false)
    }
  }, [point, onConfirm])

  const mapFallback = (
    <View style={styles.mapFallback}>
      <Icon name="map-marker-off-outline" size={20} color={accent.amberSoft} />
      <Text variant="caption" tone="muted" center style={styles.fallbackText}>
        The map could not be drawn. Use the arrow pad below to set the pin precisely.
      </Text>
    </View>
  )

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text variant="heading" weight="semibold">
                Where is the problem?
              </Text>
              <Text variant="data" tone="muted" mono style={styles.coords}>
                {formatCoordinates(point.lat, point.lng)}
              </Text>
            </View>
            <PressableScale onPress={onClose} haptic="tap" accessibilityLabel="Close location picker">
              <View style={styles.closeButton}>
                <Icon name="close" size={17} color={ink.muted} />
              </View>
            </PressableScale>
          </View>

          {/* Map */}
          <View style={styles.mapWrap}>
            <MapErrorBoundary fallback={mapFallback}>
              <IncidentMap
                markers={markers}
                initialRegion={region}
                selectedId="pin"
                onPressMap={(coordinate) => setPoint(coordinate)}
                style={StyleSheet.absoluteFill}
              />
            </MapErrorBoundary>

            <View pointerEvents="none" style={styles.hint}>
              <Icon name="gesture-tap" size={12} color={ink.base} />
              <Text variant="micro" weight="medium">
                Tap the map to move the pin
              </Text>
            </View>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            <View style={styles.nudgePad}>
              <NudgeButton icon="arrow-up" label="Move pin north" onPress={() => nudge(NUDGE_DEGREES, 0)} />
              <View style={styles.nudgeRowMid}>
                <NudgeButton icon="arrow-left" label="Move pin west" onPress={() => nudge(0, -NUDGE_DEGREES)} />
                <View style={styles.nudgeCentre}>
                  <Icon name="crosshairs-gps" size={15} color={accent.brand} />
                </View>
                <NudgeButton icon="arrow-right" label="Move pin east" onPress={() => nudge(0, NUDGE_DEGREES)} />
              </View>
              <NudgeButton icon="arrow-down" label="Move pin south" onPress={() => nudge(-NUDGE_DEGREES, 0)} />
            </View>

            <View style={styles.sideControls}>
              <Button
                label={locating ? 'Locating…' : 'Use my location'}
                onPress={useCurrentLocation}
                loading={locating}
                variant="secondary"
                size="sm"
                fullWidth
                icon={<Icon name="crosshairs-gps" size={15} color={ink.base} />}
              />
              <Text variant="micro" tone="faint" center>
                Arrow pad moves the pin about 55 m per tap
              </Text>
            </View>
          </View>

          {locationProblem ? (
            <Notice tone="amber" body={locationProblem} style={styles.notice} />
          ) : null}

          <Button
            label="Use this location"
            onPress={confirm}
            loading={resolving}
            size="lg"
            fullWidth
            icon={<Icon name="map-marker-check-outline" size={18} color={ink.inverse} />}
          />
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,28,46,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: surface.canvas,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: space.xl,
    gap: space.lg,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md },
  headerText: { flex: 1, gap: 3 },
  coords: { fontSize: 13 },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surface.raised,
  },
  mapWrap: {
    height: 236,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: surface.sunken,
  },
  mapFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.lg },
  fallbackText: { maxWidth: 280 },
  hint: {
    position: 'absolute',
    top: space.sm,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  controls: { flexDirection: 'row', gap: space.lg, alignItems: 'center' },
  nudgePad: { alignItems: 'center', gap: space.xs },
  nudgeRowMid: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  nudgeButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surface.card,
  },
  nudgeCentre: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: surface.mist,
  },
  sideControls: { flex: 1, gap: space.sm },
  notice: { marginTop: 0 },
})
