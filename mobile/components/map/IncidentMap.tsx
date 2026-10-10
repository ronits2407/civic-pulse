import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Image } from 'expo-image'

import { PressableScale } from '@/components/ui/PressableScale'
import { Icon } from '@/theme/icons'
import { Text } from '@/theme/Typography'
import type { LatLng } from '@/lib/location/postgis'
import { STATUS_META, TONE_COLOR, accent, ink, line, surface, type Tone } from '@/theme/tokens'

/**
 * Incident map, drawn in React Native.
 *
 * Why not the native Maps SDK: it needs a Google Maps key and Play-services support to
 * draw anything, and when either is missing it renders an empty grey box with no error
 * the app can catch. This map instead fetches standard web-mercator tiles as ordinary
 * images - the same network path the app already uses for photos - so it renders
 * anywhere the rest of the app works, with no SDK, key or native module.
 *
 * It is deliberately small: pan, pinch/button zoom, tap-to-place, markers and a user dot.
 * It is the only file that knows how the map is drawn, so swapping in a native map later
 * means replacing this file and nothing else.
 *
 * Tiles: the same source as the web app - standard OpenStreetMap tiles,
 * `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` (see IssueMapInner.tsx).
 *
 * The web app makes them dark with a CSS rule:
 *   .leaflet-tile { filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%) }
 * React Native has no CSS filters, so "Dark" reproduces the same result with blend
 * modes: the hue and saturation of the normal tile, with the luminosity of an inverted
 * copy of it. "Standard" shows the tiles untouched and cannot fail the way a blend can.
 *
 * OSM's tile usage policy requires an identifying User-Agent and light use. That is
 * fine for development; for a public launch use a keyed tile provider.
 */

export interface MapRegion {
  latitude: number
  longitude: number
  latitudeDelta: number
  longitudeDelta: number
}

export interface MapMarker {
  id: string
  coordinate: LatLng
  status: string | null | undefined
  severity?: number | null
  isEmergency?: boolean
  title?: string | null
}

export interface IncidentMapProps {
  markers: MapMarker[]
  initialRegion: MapRegion
  selectedId?: string | null
  onSelectMarker?: (id: string) => void
  /** Called with the tapped coordinate. Used by the location picker. */
  onPressMap?: (coordinate: LatLng) => void
  onRegionChangeComplete?: (region: MapRegion) => void
  /** Blue "you are here" dot. Pass the device position, or null. */
  userLocation?: LatLng | null
  interactive?: boolean
  style?: StyleProp<ViewStyle>
}

// ── Tile maths (web mercator) ──────────────────────────────────────────────────────────────
const TILE = 256
const MIN_ZOOM = 3
const MAX_ZOOM = 18
const MAX_LAT = 85.0511

const TILE_SUBDOMAINS = ['a', 'b', 'c']
const tileUrl = (z: number, x: number, y: number) =>
  `https://${TILE_SUBDOMAINS[(x + y) % TILE_SUBDOMAINS.length]}.tile.openstreetmap.org/${z}/${x}/${y}.png`
const TILE_HEADERS = { 'User-Agent': 'CivicPulse-mobile/1.0 (civic issue reporting)' }
const ATTRIBUTION = '© OpenStreetMap contributors'

/** Remembered for the session so every map in the app uses the same look. */
let darkPreference = false

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const worldSize = (z: number) => TILE * 2 ** z

const lngToX = (lng: number, z: number) => ((lng + 180) / 360) * worldSize(z)
const latToY = (lat: number, z: number) => {
  const s = Math.sin((clamp(lat, -MAX_LAT, MAX_LAT) * Math.PI) / 180)
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * worldSize(z)
}
const xToLng = (x: number, z: number) => (x / worldSize(z)) * 360 - 180
const yToLat = (y: number, z: number) => {
  const n = Math.PI - (2 * Math.PI * y) / worldSize(z)
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}
const wrapLng = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180

/** Zoom level at which `lngDelta` degrees span `widthPx` pixels. */
const zoomForDelta = (lngDelta: number, widthPx: number) =>
  clamp(Math.round(Math.log2((widthPx * 360) / (TILE * Math.max(lngDelta, 1e-6)))), MIN_ZOOM, MAX_ZOOM)

interface ViewState {
  lat: number
  lng: number
  zoom: number
}

/** Emergency outranks status for pin colour - it is the loudest signal we have. */
function markerColor(marker: MapMarker): string {
  if (marker.isEmergency) return TONE_COLOR.red
  if (typeof marker.severity === 'number' && marker.severity >= 8) return TONE_COLOR.red
  const meta = marker.status ? STATUS_META[marker.status] : undefined
  const tone: Tone = meta?.tone ?? 'slate'
  return TONE_COLOR[tone]
}

export function IncidentMap({
  markers,
  initialRegion,
  selectedId,
  onSelectMarker,
  onPressMap,
  onRegionChangeComplete,
  userLocation,
  interactive = true,
  style,
}: IncidentMapProps) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [view, setView] = useState<ViewState>({
    lat: initialRegion.latitude,
    lng: initialRegion.longitude,
    zoom: 14,
  })
  const [tilesFailed, setTilesFailed] = useState(false)
  const [dark, setDark] = useState(darkPreference)
  const toggleDark = useCallback(() => {
    setDark((prev) => {
      darkPreference = !prev
      return !prev
    })
  }, [])

  // Latest values for the (created-once) PanResponder.
  const sizeRef = useRef(size)
  sizeRef.current = size
  const viewRef = useRef(view)
  viewRef.current = view
  const onPressMapRef = useRef(onPressMap)
  onPressMapRef.current = onPressMap

  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current
  const pinch = useRef(new Animated.Value(1)).current
  const gesture = useRef({ tapX: 0, tapY: 0, pinchStart: 0, pinchScale: 1, pinching: false }).current
  const loads = useRef(0)
  const failures = useRef(0)

  const sized = size.w > 0

  // Centre and zoom from the requested region once we know how wide the map is, and
  // again whenever the caller moves the region (e.g. the picker nudge pad).
  useEffect(() => {
    if (!sized) return
    setView({
      lat: initialRegion.latitude,
      lng: initialRegion.longitude,
      zoom: zoomForDelta(initialRegion.longitudeDelta, sizeRef.current.w),
    })
  }, [sized, initialRegion.latitude, initialRegion.longitude, initialRegion.longitudeDelta])

  // After a gesture commits, drop the temporary transform in the same frame so the new
  // tile layout and the reset land together (no snap-back flicker).
  useLayoutEffect(() => {
    pan.setValue({ x: 0, y: 0 })
    pinch.setValue(1)
  }, [view, pan, pinch])

  const emitRegion = useRef(onRegionChangeComplete)
  emitRegion.current = onRegionChangeComplete
  const firstEmit = useRef(true)
  useEffect(() => {
    if (firstEmit.current) {
      firstEmit.current = false
      return
    }
    if (!emitRegion.current || !size.w) return
    const lngDelta = (size.w / worldSize(view.zoom)) * 360
    emitRegion.current({
      latitude: view.lat,
      longitude: view.lng,
      longitudeDelta: lngDelta,
      latitudeDelta: lngDelta * (size.h / size.w),
    })
  }, [view, size.w, size.h])

  const commitPan = useCallback((dx: number, dy: number) => {
    setView((v) => {
      const cx = lngToX(v.lng, v.zoom) - dx
      const cy = latToY(v.lat, v.zoom) - dy
      return {
        zoom: v.zoom,
        lng: wrapLng(xToLng(cx, v.zoom)),
        lat: clamp(yToLat(cy, v.zoom), -MAX_LAT + 1, MAX_LAT - 1),
      }
    })
  }, [])

  const zoomBy = useCallback((delta: number) => {
    setView((v) => ({ ...v, zoom: clamp(v.zoom + delta, MIN_ZOOM, MAX_ZOOM) }))
  }, [])

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // Take over from a marker if the finger actually drags.
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        gesture.tapX = e.nativeEvent.locationX
        gesture.tapY = e.nativeEvent.locationY
        gesture.pinching = false
        gesture.pinchStart = 0
        gesture.pinchScale = 1
      },
      onPanResponderMove: (e, g) => {
        const touches = e.nativeEvent.touches
        if (touches && touches.length >= 2) {
          const dist = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY)
          if (!gesture.pinching) {
            gesture.pinching = true
            gesture.pinchStart = dist || 1
          }
          gesture.pinchScale = clamp(dist / gesture.pinchStart, 0.5, 3)
          pinch.setValue(gesture.pinchScale)
          return
        }
        if (!gesture.pinching) pan.setValue({ x: g.dx, y: g.dy })
      },
      onPanResponderRelease: (_, g) => {
        if (gesture.pinching) {
          const dz = Math.round(Math.log2(gesture.pinchScale))
          gesture.pinching = false
          if (dz !== 0) zoomBy(dz)
          else {
            pan.setValue({ x: 0, y: 0 })
            pinch.setValue(1)
          }
          return
        }
        const moved = Math.hypot(g.dx, g.dy)
        if (moved < 8) {
          pan.setValue({ x: 0, y: 0 })
          const cb = onPressMapRef.current
          const s = sizeRef.current
          const v = viewRef.current
          if (cb && s.w) {
            const worldX = lngToX(v.lng, v.zoom) - s.w / 2 + gesture.tapX
            const worldY = latToY(v.lat, v.zoom) - s.h / 2 + gesture.tapY
            cb({ lat: yToLat(worldY, v.zoom), lng: wrapLng(xToLng(worldX, v.zoom)) })
          }
          return
        }
        commitPan(g.dx, g.dy)
      },
      onPanResponderTerminate: () => {
        pan.setValue({ x: 0, y: 0 })
        pinch.setValue(1)
        gesture.pinching = false
      },
    })
  ).current

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setSize((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }))
  }, [])

  // ── Layout of tiles and markers for the committed view ────────────────────────────────
  const { z, originX, originY, tiles } = useMemo(() => {
    const zoom = view.zoom
    const cx = lngToX(view.lng, zoom)
    const cy = latToY(view.lat, zoom)
    const ox = cx - size.w / 2
    const oy = cy - size.h / 2
    const n = 2 ** zoom
    const margin = TILE
    const list: { key: string; uri: string; left: number; top: number }[] = []

    if (size.w > 0) {
      const minTx = Math.floor((ox - margin) / TILE)
      const maxTx = Math.floor((ox + size.w + margin) / TILE)
      const minTy = Math.max(0, Math.floor((oy - margin) / TILE))
      const maxTy = Math.min(n - 1, Math.floor((oy + size.h + margin) / TILE))
      for (let ty = minTy; ty <= maxTy; ty++) {
        for (let tx = minTx; tx <= maxTx; tx++) {
          const wrapped = ((tx % n) + n) % n
          list.push({
            key: `${zoom}/${tx}/${ty}`,
            uri: tileUrl(zoom, wrapped, ty),
            left: tx * TILE - ox,
            top: ty * TILE - oy,
          })
        }
      }
    }
    return { z: zoom, originX: ox, originY: oy, tiles: list }
  }, [view, size.w, size.h])

  const project = useCallback(
    (p: LatLng) => ({ x: lngToX(p.lng, z) - originX, y: latToY(p.lat, z) - originY }),
    [z, originX, originY]
  )

  const onTileLoad = useCallback(() => {
    loads.current += 1
    setTilesFailed((prev) => (prev ? false : prev))
  }, [])
  const onTileError = useCallback(() => {
    failures.current += 1
    if (failures.current >= 4 && loads.current === 0) setTilesFailed(true)
  }, [])

  /** One copy of the tile grid. Only the first copy reports load/error, so counts stay true. */
  const renderTiles = (track: boolean) =>
    tiles.map((t) => (
      <Image
        key={t.key}
        source={{ uri: t.uri, headers: TILE_HEADERS }}
        style={{ position: 'absolute', left: t.left, top: t.top, width: TILE, height: TILE }}
        contentFit="fill"
        cachePolicy="memory-disk"
        transition={120}
        onLoad={track ? onTileLoad : undefined}
        onError={track ? onTileError : undefined}
      />
    ))

  const visibleMarkers = markers.filter((m) => {
    const { x, y } = project(m.coordinate)
    return x > -40 && y > -40 && x < size.w + 40 && y < size.h + 40
  })

  const user = userLocation ? project(userLocation) : null

  return (
    <View
      style={[styles.container, style]}
      onLayout={onLayout}
      {...(interactive ? responder.panHandlers : {})}
    >
      <Animated.View
        pointerEvents="box-none"
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale: pinch }] },
        ]}
      >
        {/* Tiles never take touches, so the container is always the touch target. */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.isolated]}>
          {renderTiles(true)}
          {dark ? (
            // Luminosity of an inverted copy over the original = the web's dark filter.
            <View style={[StyleSheet.absoluteFill, styles.isolated, styles.luminosity]}>
              {renderTiles(false)}
              <View style={[StyleSheet.absoluteFill, styles.invert]} />
            </View>
          ) : null}
        </View>

        {user ? (
          <View
            pointerEvents="none"
            style={[styles.userRing, { left: user.x - 16, top: user.y - 16 }]}
          >
            <View style={styles.userDot} />
          </View>
        ) : null}

        {visibleMarkers.map((marker) => {
          const { x, y } = project(marker.coordinate)
          const selected = selectedId === marker.id
          const color = selected ? accent.brand : markerColor(marker)
          const d = selected ? 30 : 22
          return (
            <Pressable
              key={marker.id}
              onPress={() => onSelectMarker?.(marker.id)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={marker.title ?? 'Report'}
              style={[
                styles.marker,
                {
                  left: x - d / 2,
                  top: y - d / 2,
                  width: d,
                  height: d,
                  borderRadius: d / 2,
                  backgroundColor: color,
                  zIndex: selected ? 10 : 1,
                },
              ]}
            >
              <View style={styles.markerCore} />
            </Pressable>
          )
        })}
      </Animated.View>

      {tilesFailed ? (
        <View pointerEvents="none" style={styles.failed}>
          <Text variant="caption" tone="muted" center>
            Map tiles could not be loaded. Check the connection and reopen this screen.
          </Text>
        </View>
      ) : null}

      {interactive ? (
        <View style={styles.zoomControls} pointerEvents="box-none">
          <PressableScale
            onPress={() => zoomBy(1)}
            haptic="tap"
            accessibilityRole="button"
            accessibilityLabel="Zoom in"
          >
            <View style={styles.zoomButton}>
              <Icon name="plus" size={18} color={ink.base} />
            </View>
          </PressableScale>
          <PressableScale
            onPress={() => zoomBy(-1)}
            haptic="tap"
            accessibilityRole="button"
            accessibilityLabel="Zoom out"
          >
            <View style={styles.zoomButton}>
              <Icon name="minus" size={18} color={ink.base} />
            </View>
          </PressableScale>
          <PressableScale
            onPress={toggleDark}
            haptic="tap"
            accessibilityRole="button"
            accessibilityLabel={dark ? 'Switch to standard map' : 'Switch to dark map'}
          >
            <View style={[styles.zoomButton, dark && styles.zoomButtonOn]}>
              <Icon name="theme-light-dark" size={18} color={dark ? accent.brand : ink.base} />
            </View>
          </PressableScale>
        </View>
      ) : null}

      <View pointerEvents="none" style={styles.attribution}>
        <Text variant="micro" tone="muted">
          {ATTRIBUTION}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', backgroundColor: '#10161d' },
  marker: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.92)',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  markerCore: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(13,17,23,0.85)' },
  userRing: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(9,105,218,0.25)',
  },
  userDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: accent.blue,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  isolated: { isolation: 'isolate' },
  luminosity: { mixBlendMode: 'luminosity' },
  invert: { backgroundColor: '#ffffff', mixBlendMode: 'difference' },
  zoomButtonOn: { borderColor: accent.brand },
  zoomControls: { position: 'absolute', top: 10, right: 10, gap: 8 },
  zoomButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(22,27,34,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line.base,
  },
  failed: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '42%',
    padding: 12,
    borderRadius: 10,
    backgroundColor: surface.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line.base,
  },
  attribution: {
    position: 'absolute',
    right: 6,
    bottom: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(13,17,23,0.78)',
  },
})
