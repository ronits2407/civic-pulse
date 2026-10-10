import * as Location from 'expo-location'

import { geoApi } from '@/lib/api/endpoints'
import { formatCoordinates } from '@/lib/format'
import type { LatLng } from '@/lib/location/postgis'

export type { LatLng }

/**
 * Device location, wrapped so callers never touch permission APIs directly.
 *
 * The pattern here is "ask when it is needed, explain why, and degrade": we never
 * request permission on app start, because a permission prompt with no context is
 * the fastest way to get a permanent denial on Android.
 */

export type PermissionOutcome = 'granted' | 'denied' | 'unavailable'

export interface LocatedPoint extends LatLng {
  /** Horizontal accuracy in metres, when the platform reports it. */
  accuracy: number | null
}

/** Request foreground location access. Called only from an explicit user action. */
export async function requestLocationPermission(): Promise<PermissionOutcome> {
  try {
    const servicesEnabled = await Location.hasServicesEnabledAsync()
    if (!servicesEnabled) return 'unavailable'

    const existing = await Location.getForegroundPermissionsAsync()
    if (existing.granted) return 'granted'
    if (existing.canAskAgain === false) return 'denied'

    const requested = await Location.requestForegroundPermissionsAsync()
    return requested.granted ? 'granted' : 'denied'
  } catch {
    return 'unavailable'
  }
}

/** True when permission was already granted, without prompting. */
export async function hasLocationPermission(): Promise<boolean> {
  try {
    const { granted } = await Location.getForegroundPermissionsAsync()
    return granted
  } catch {
    return false
  }
}

/**
 * Current position with a timeout.
 * `Balanced` accuracy is the right trade for civic reporting: a pothole is a
 * street-level feature, and GPS-only fixes often take 30 s or never arrive indoors.
 */
export async function getCurrentPoint(
  options: { timeoutMs?: number } = {}
): Promise<LocatedPoint> {
  const timeout = options.timeoutMs ?? 12_000

  const position = await Promise.race([
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('LOCATION_TIMEOUT')), timeout)
    ),
  ])

  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy ?? null,
  }
}

/** Last known position — instant, used to centre a map before a fix arrives. */
export async function getLastKnownPoint(): Promise<LocatedPoint | null> {
  try {
    const position = await Location.getLastKnownPositionAsync()
    if (!position) return null
    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy ?? null,
    }
  } catch {
    return null
  }
}

/**
 * Reverse geocode through the existing backend proxy.
 * Never throws: a failure degrades to a plain coordinate readout, which is still a
 * usable address for a field crew.
 */
export async function resolveAddress(point: LatLng): Promise<string> {
  const fallback = formatCoordinates(point.lat, point.lng)
  try {
    const response = await geoApi.reverse(point.lat, point.lng)
    const address = response?.address?.trim()
    return address && address.length > 0 ? address : fallback
  } catch {
    return fallback
  }
}
