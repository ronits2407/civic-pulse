import { PermissionsAndroid, Platform, type Permission } from 'react-native'
import * as Location from 'expo-location'

/**
 * Runtime permissions for Nearby Connections. The library does not request them; that is
 * the app's job, and this runs only from an explicit tap on "Turn on relay".
 *
 * Requirements (Google Nearby Connections documentation):
 *   Android 13+ (API 33+)   BLUETOOTH_ADVERTISE, BLUETOOTH_CONNECT, BLUETOOTH_SCAN, NEARBY_WIFI_DEVICES
 *   Android 12  (API 31-32) BLUETOOTH_ADVERTISE, BLUETOOTH_CONNECT, BLUETOOTH_SCAN, ACCESS_FINE_LOCATION
 *   Android 11 and below    ACCESS_FINE_LOCATION (plus the install-time Bluetooth/Wi-Fi ones)
 *
 * The exact set per API level is taken from that documentation and has NOT yet been
 * confirmed on every Android version; see the test log in docs.
 */

export type MeshPermissionStatus =
  | { state: 'granted' }
  | { state: 'unsupported'; message: string }
  | { state: 'denied'; missing: string[]; canAskAgain: boolean }
  | { state: 'location_services_off' }

const api = (): number => (typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10))

export function requiredPermissions(sdk: number = api()): Permission[] {
  const list: Permission[] = []
  if (sdk >= 31) {
    list.push(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
    )
  }
  if (sdk >= 33) list.push(PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES)
  if (sdk <= 32) list.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)
  return list
}

const short = (permission: string): string => permission.replace('android.permission.', '')

async function locationServicesOk(sdk: number): Promise<boolean> {
  // Older Android versions need the system location switch on for Bluetooth discovery.
  if (sdk > 30) return true
  try {
    return await Location.hasServicesEnabledAsync()
  } catch {
    return true
  }
}

/** Current state without prompting. */
export async function checkMeshPermissions(): Promise<MeshPermissionStatus> {
  if (Platform.OS !== 'android') {
    return { state: 'unsupported', message: 'The Neighborhood Emergency Network is Android-only for now.' }
  }
  const sdk = api()
  const missing: string[] = []
  for (const permission of requiredPermissions(sdk)) {
    if (!(await PermissionsAndroid.check(permission))) missing.push(short(permission))
  }
  if (missing.length > 0) return { state: 'denied', missing, canAskAgain: true }
  return (await locationServicesOk(sdk)) ? { state: 'granted' } : { state: 'location_services_off' }
}

/** Ask for everything missing. Call only from a user action. */
export async function requestMeshPermissions(): Promise<MeshPermissionStatus> {
  if (Platform.OS !== 'android') return checkMeshPermissions()
  const sdk = api()
  const results = await PermissionsAndroid.requestMultiple(requiredPermissions(sdk))
  const missing: string[] = []
  let canAskAgain = true
  for (const [permission, result] of Object.entries(results)) {
    if (result === PermissionsAndroid.RESULTS.GRANTED) continue
    missing.push(short(permission))
    if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) canAskAgain = false
  }
  if (missing.length > 0) return { state: 'denied', missing, canAskAgain }
  return (await locationServicesOk(sdk)) ? { state: 'granted' } : { state: 'location_services_off' }
}
