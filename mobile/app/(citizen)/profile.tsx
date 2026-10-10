import React, { useCallback, useEffect, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import Constants from 'expo-constants'
import { useRouter } from 'expo-router'

import { LocationPickerSheet } from '@/components/map/LocationPickerSheet'
import { TAB_BAR_CLEARANCE } from '@/components/navigation/PillTabBar'
import { IdentityCard } from '@/components/profile/IdentityCard'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Notice } from '@/components/ui/Feedback'
import { ListGroup, ListRow } from '@/components/ui/ListRow'
import { ConnectionCheck } from '@/components/dashboard/ConnectionCheck'
import { Rise } from '@/components/ui/Motion'
import { Screen } from '@/components/ui/Screen'
import { Text } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import { useToast } from '@/components/feedback/ToastHost'
import { useAuth } from '@/lib/auth/AuthProvider'
import { profileApi } from '@/lib/api/endpoints'
import { formatCoordinates } from '@/lib/format'
import { getCurrentPoint, hasLocationPermission, requestLocationPermission, resolveAddress } from '@/lib/location/geo'
import { env } from '@/lib/env'
import { TONE_TINT, accent, ink, space } from '@/theme/tokens'

/**
 * You: identity and standing, home area, destinations, and account.
 *
 * Home location is the most consequential setting in the app, so it gets the most
 * space: the review queue only works within about 1 km of it, and the map sorts by it.
 * Everything else here is reference information.
 */
export default function ProfileScreen() {
  const router = useRouter()
  const toast = useToast()
  const { userId, email, displayName, avatarUrl, profile, signOut, refreshProfile, isAdmin } = useAuth()

  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null)

  useEffect(() => {
    hasLocationPermission().then(setPermissionGranted).catch(() => setPermissionGranted(false))
  }, [])

  const karma = profile?.karma_score ?? 0

  const saveHome = useCallback(
    async (lat: number, lng: number, address: string) => {
      if (!userId) return
      setSaving(true)
      setLocationError(null)
      try {
        // Same contract as the web app: latitude/longitude plus the display address.
        await profileApi.saveHomeLocation({ lat, lng, userId, address })
        await refreshProfile()
        toast.success('Home location saved. Nearby reports will now appear in Verify.')
      } catch (err: any) {
        setLocationError(err?.message ?? 'Could not save your home location.')
        toast.error('Could not save your home location.')
      } finally {
        setSaving(false)
      }
    },
    [userId, refreshProfile, toast]
  )

  const useCurrentLocation = useCallback(async () => {
    setLocating(true)
    setLocationError(null)
    try {
      const outcome = await requestLocationPermission()
      if (outcome !== 'granted') {
        setPermissionGranted(false)
        setLocationError(
          outcome === 'denied'
            ? 'Location access is off for CivicPulse. Turn it on in Settings, or pick the spot on the map instead.'
            : 'Location services are turned off on this device.'
        )
        return
      }
      setPermissionGranted(true)
      const point = await getCurrentPoint()
      const address = await resolveAddress(point)
      await saveHome(point.lat, point.lng, address)
    } catch {
      setLocationError('Could not get a GPS fix. Try again, or set the location on the map.')
    } finally {
      setLocating(false)
    }
  }, [saveHome])

  const confirmSignOut = useCallback(() => {
    Alert.alert('Sign out?', 'Your reports stay on the server and will be here when you sign back in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ])
  }, [signOut])

  const version = Constants.expoConfig?.version ?? '1.0.0'

  const home = profile?.home_location ?? null

  return (
    <Screen scroll padded edges={['top']} bottomInset={TAB_BAR_CLEARANCE + space.lg} contentContainerStyle={styles.content}>
      <Rise index={0}>
        <Text variant="display" accessibilityRole="header" style={styles.title}>
          You
        </Text>
      </Rise>

      <Rise index={1}>
        <IdentityCard name={displayName} email={email} avatarUrl={avatarUrl} karma={karma} isAdmin={isAdmin} />
      </Rise>

      <Rise index={2}>
        <Card style={styles.homeCard}>
          <View style={styles.homeHead}>
            <View style={styles.homeIcon}>
              <Icon name="home-map-marker" size={22} color={ink.inverse} />
            </View>
            <View style={styles.flex}>
              <Text variant="heading">Home area</Text>
              <Text variant="caption" tone="muted" numberOfLines={2}>
                {home ? profile?.home_address ?? 'Saved location' : 'Not set yet'}
              </Text>
              {home ? (
                <Text variant="micro" mono tone="faint">
                  {formatCoordinates(home.lat, home.lng)}
                </Text>
              ) : null}
            </View>
          </View>
          {!home ? (
            <Notice tone="amber" body="Verify only shows reports within about 1 km of your home area, so set it to start verifying." />
          ) : null}
          {locationError ? <Notice tone="red" body={locationError} /> : null}
          {permissionGranted === false ? (
            <Text variant="caption" tone="faint">
              Location permission is off. You can still pick the spot on the map.
            </Text>
          ) : null}
          <View style={styles.homeActions}>
            <Button
              label={locating ? 'Locating' : 'Use my location'}
              onPress={useCurrentLocation}
              loading={locating || saving}
              disabled={saving}
              variant="subtle"
              size="sm"
              style={styles.flex}
              icon={<Icon name="crosshairs-gps" size={16} color={ink.base} />}
            />
            <Button
              label="Pick on map"
              onPress={() => setPickerOpen(true)}
              disabled={saving || locating}
              variant="subtle"
              size="sm"
              style={styles.flex}
              icon={<Icon name="map-marker-outline" size={16} color={ink.base} />}
            />
          </View>
        </Card>
      </Rise>

      <Rise index={3}>
        <ListGroup title="Community">
          <ListRow icon="trophy-outline" label="Karma leaderboard" hint="Who is doing the most for Nashik" iconBg={TONE_TINT.amber} iconColor={accent.amberSoft} onPress={() => router.push('/leaderboard')} />
          <ListRow icon="shield-check-outline" label="Verify reports" hint="Confirm reports near your home area" onPress={() => router.push('/(citizen)/review')} />
          <ListRow icon="broadcast" label="Offline emergency alerts" hint="Pass alerts between nearby phones without internet" iconBg={TONE_TINT.red} iconColor={accent.red} onPress={() => router.push('/emergency-network')} />
          {isAdmin ? (
            <ListRow icon="office-building-outline" label="Municipal console" hint="Open the operations view" iconBg={TONE_TINT.blue} iconColor={accent.blue} onPress={() => router.push('/municipality')} />
          ) : null}
        </ListGroup>
      </Rise>

      <Rise index={4}>
        <ListGroup title="About">
          <ListRow icon="information-outline" label="App version" trailing={<Text variant="data" tone="muted">{version}</Text>} />
          <ListRow icon="server-network" label="Server" hint={env.apiUrl || 'Not configured'} />
          <View style={styles.check}>
            <ConnectionCheck />
          </View>
        </ListGroup>
      </Rise>

      <Button label="Sign out" onPress={confirmSignOut} variant="danger" fullWidth icon={<Icon name="logout" size={18} color={accent.red} />} />

      <LocationPickerSheet
        visible={pickerOpen}
        initial={home}
        onClose={() => setPickerOpen(false)}
        onConfirm={(point, address) => {
          setPickerOpen(false)
          saveHome(point.lat, point.lng, address)
        }}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { gap: space.lg },
  title: { paddingTop: space.md },
  flex: { flex: 1 },
  homeCard: { gap: space.md },
  homeHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  homeIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: ink.base, alignItems: 'center', justifyContent: 'center' },
  homeActions: { flexDirection: 'row', gap: space.sm },
  check: { paddingVertical: space.md },
})
