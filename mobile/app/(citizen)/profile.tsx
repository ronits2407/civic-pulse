import React, { useCallback, useEffect, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import Constants from 'expo-constants'
import { useRouter } from 'expo-router'

import { QuickLink } from '@/components/dashboard/QuickLink'
import { LocationPickerSheet } from '@/components/map/LocationPickerSheet'
import { Button } from '@/components/ui/Button'
import { Card, Divider } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { Chip } from '@/components/ui/Chip'
import { InfoRow } from '@/components/issues/DetailSection'
import { Notice } from '@/components/ui/Feedback'
import { ConnectionCheck } from '@/components/dashboard/ConnectionCheck'
import { Screen } from '@/components/ui/Screen'
import { Text } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import { useToast } from '@/components/feedback/ToastHost'
import { useAuth } from '@/lib/auth/AuthProvider'
import { profileApi } from '@/lib/api/endpoints'
import { formatCoordinates, karmaLevel, karmaProgress } from '@/lib/format'
import { getCurrentPoint, hasLocationPermission, requestLocationPermission, resolveAddress } from '@/lib/location/geo'
import { env } from '@/lib/env'
import { accent, ink, line, radius, space, surface, TONE_COLOR, TONE_TINT } from '@/theme/tokens'

/**
 * Profile and settings.
 *
 * Home location is the most consequential setting in the app, so it gets the most
 * space: the review queue only works within about 1 km of it, and the map sorts by it.
 * Everything else here is reference information.
 */
export default function ProfileScreen() {
  const router = useRouter()
  const toast = useToast()
  const { userId, email, displayName, avatarUrl, profile, role, signOut, refreshProfile, isAdmin } = useAuth()

  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null)

  useEffect(() => {
    hasLocationPermission().then(setPermissionGranted).catch(() => setPermissionGranted(false))
  }, [])

  const karma = profile?.karma_score ?? 0
  const level = karmaLevel(karma)
  const progress = karmaProgress(karma)

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

  return (
    <Screen scroll padded edges={['top']} contentContainerStyle={styles.content}>
      {/* Identity */}
      <View style={styles.identity}>
        <Avatar name={displayName} uri={avatarUrl} size={64} />
        <View style={styles.identityText}>
          <Text variant="title" numberOfLines={1}>
            {displayName ?? 'Citizen'}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {email ?? 'Signed in'}
          </Text>
          <View style={styles.roleRow}>
            <Chip
              label={role === 'admin' ? 'Municipal' : 'Citizen'}
              color={role === 'admin' ? TONE_COLOR.blue : TONE_COLOR.emerald}
              tint={role === 'admin' ? TONE_TINT.blue : TONE_TINT.emerald}
              dense
            />
          </View>
        </View>
      </View>

      {/* Karma */}
      <Card>
        <View style={styles.karmaHeader}>
          <View style={styles.karmaText}>
            <Text variant="micro" weight="medium" tone="faint">
              CIVIC STANDING
            </Text>
            <Text variant="heading" weight="semibold" style={{ color: TONE_COLOR.amber }}>
              {level.name}
            </Text>
          </View>
          <Text variant="dataLg" weight="semibold" mono>
            {karma}
          </Text>
        </View>

        <View style={styles.karmaBar}>
          <View style={[styles.karmaFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <View style={styles.karmaFooter}>
          <Text variant="micro" tone="faint">
            Level {level.level} of 4
          </Text>
          <Text variant="micro" tone="faint">
            {level.next === 'Max level' ? 'Top level reached' : `Next: ${level.next} at ${level.max}`}
          </Text>
        </View>

        <Text variant="caption" tone="faint" style={styles.karmaHint}>
          You earn 10 karma for filing a report, 2 for verifying a neighbour's, and 50 when
          one of yours is resolved.
        </Text>
      </Card>

      {/* Home location */}
      <Card style={styles.locationCard}>
        <View style={styles.sectionHeader}>
          <Icon name="map-marker-check-outline" size={15} color={accent.brand} />
          <Text variant="heading" weight="semibold">
            Home location
          </Text>
        </View>

        {profile?.home_location ? (
          <View style={styles.currentLocation}>
            <Text variant="bodyTight" weight="medium">
              {profile.home_address ?? 'Saved location'}
            </Text>
            <Text variant="micro" mono tone="faint">
              {formatCoordinates(profile.home_location.lat, profile.home_location.lng)}
            </Text>
          </View>
        ) : (
          <Notice
            tone="amber"
            body="Without a home location you cannot verify nearby reports — the queue is deliberately limited to about 1 km around you."
            style={styles.locationNotice}
          />
        )}

        {locationError ? <Notice tone="red" body={locationError} style={styles.locationNotice} /> : null}

        <View style={styles.locationActions}>
          <Button
            label={locating ? 'Locating…' : 'Use my location'}
            onPress={useCurrentLocation}
            loading={locating}
            disabled={saving}
            variant="secondary"
            style={styles.locationButton}
            icon={<Icon name="crosshairs-gps" size={15} color={ink.base} />}
          />
          <Button
            label="Pick on map"
            onPress={() => setPickerOpen(true)}
            disabled={saving || locating}
            variant="secondary"
            style={styles.locationButton}
            icon={<Icon name="map-marker-outline" size={15} color={ink.base} />}
          />
        </View>

        <Divider style={styles.divider} />
        <InfoRow
          label="Location permission"
          value={
            permissionGranted == null ? 'Checking…' : permissionGranted ? 'Allowed' : 'Not allowed'
          }
          tone={permissionGranted ? TONE_COLOR.emerald : TONE_COLOR.amber}
          last
        />
      </Card>

      {/* Destinations */}
      <View style={styles.links}>
        <QuickLink
          icon="trophy-outline"
          label="Karma leaderboard"
          hint="See who is doing the most for the city"
          tone={TONE_COLOR.amber}
          onPress={() => router.push('/leaderboard')}
        />
        {isAdmin ? (
          <QuickLink
            icon="office-building-outline"
            label="Municipal console"
            hint="Open the operations view"
            tone={TONE_COLOR.blue}
            onPress={() => router.push('/municipality')}
          />
        ) : null}
      </View>

      {/* Account */}
      <Card style={styles.aboutCard}>
        <Text variant="heading" weight="semibold">
          About
        </Text>
        <View style={styles.aboutBody}>
          <InfoRow label="App version" value={version} mono />
          <InfoRow label="Backend" value={env.apiUrl || 'Not configured'} mono last />
        </View>
        <Divider style={styles.divider} />
        <ConnectionCheck />
        <Divider style={styles.divider} />
        <Button
          label="Sign out"
          onPress={confirmSignOut}
          variant="danger"
          fullWidth
          icon={<Icon name="logout" size={17} color={accent.redSoft} />}
        />
      </Card>

      <LocationPickerSheet
        visible={pickerOpen}
        initial={profile?.home_location ?? null}
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
  content: { gap: space.lg, paddingBottom: space.huge },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  identityText: { flex: 1, gap: 3 },
  roleRow: { flexDirection: 'row', marginTop: 3 },
  karmaHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md },
  karmaText: { gap: 2 },
  karmaBar: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: surface.sunken,
    overflow: 'hidden',
    marginTop: space.lg,
  },
  karmaFill: { height: '100%', borderRadius: radius.pill, backgroundColor: accent.amberSoft },
  karmaFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm },
  karmaHint: { marginTop: space.md, lineHeight: 17 },
  locationCard: { gap: space.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  currentLocation: { gap: 3 },
  locationNotice: { marginTop: 0 },
  locationActions: { flexDirection: 'row', gap: space.sm },
  locationButton: { flex: 1 },
  divider: { marginVertical: space.xs },
  links: { gap: space.md },
  aboutCard: { gap: space.md },
  aboutBody: { gap: 0 },
})
