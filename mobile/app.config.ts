import type { ConfigContext, ExpoConfig } from 'expo/config'

/**
 * Android Maps SDK key.
 * This is a *public, Android-restricted* key (restrict it by package name +
 * SHA-1 in Google Cloud Console). Never put the backend GOOGLE_MAPS_API_KEY,
 * GEMINI_API_KEY or SUPABASE_SERVICE_ROLE_KEY in here — anything referenced by
 * this file ends up inside the APK.
 */
const androidMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? ''

/** Base URL of the existing Next.js backend (Cloud Run in prod). */
// No fixed default: 10.0.2.2 only exists inside the Android emulator, so baking it in
// breaks every real device. In dev the app derives the host from Metro (see lib/env.ts);
// release builds must set EXPO_PUBLIC_API_URL.
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? ''

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'CivicPulse',
  slug: 'civicpulse',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'civicpulse',
  userInterfaceStyle: 'light',
  backgroundColor: '#F3F1EC',
  icon: './assets/images/icon.png',
  extra: { apiUrl },
  android: {
    package: 'org.civicpulse.app',
    backgroundColor: '#F3F1EC',
    adaptiveIcon: {
      backgroundColor: '#F3F1EC',
      foregroundImage: './assets/images/android-icon-foreground.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    config: androidMapsKey ? { googleMaps: { apiKey: androidMapsKey } } : undefined,
    permissions: [
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.CAMERA',
      // Android 13+ will not show the emergency-alert notification without this.
      'android.permission.POST_NOTIFICATIONS',
    ],
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      { backgroundColor: '#F3F1EC', image: './assets/images/splash-icon.png', imageWidth: 96 },
    ],
    'expo-sharing',
    'expo-secure-store',
    'expo-font',
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'CivicPulse uses your location to pin a report to the exact spot so field crews can find it.',
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'CivicPulse needs access to your photos so you can attach evidence to a report.',
        cameraPermission: 'CivicPulse needs camera access so you can photograph a civic issue on the spot.',
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'CivicPulse needs camera access so you can photograph a civic issue on the spot.',
        recordAudioAndroid: false,
      },
    ],
    'expo-sqlite',
    // Neighborhood Emergency Network: offline alert relay over Google Nearby Connections.
    // Android only. The plugin writes the Bluetooth / Wi-Fi / Nearby permissions into the
    // manifest; runtime consent is requested by lib/mesh/permissions.ts.
    'expo-nearby-connections',
    [
      'expo-notifications',
      {
        color: '#cf222e',
        defaultChannel: 'mesh-alerts',
      },
    ],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
})
