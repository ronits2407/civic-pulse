import React, { useCallback, useMemo, useState } from 'react'
import { RefreshControl, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'

import { ActivityBand } from '@/components/dashboard/ActivityBand'
import { QuickLink } from '@/components/dashboard/QuickLink'
import { IssueCard } from '@/components/issues/IssueCard'
import { MapSurface } from '@/components/map/MapSurface'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card, Divider } from '@/components/ui/Card'
import { EmptyState, ErrorState, Notice, Skeleton } from '@/components/ui/Feedback'
import { Screen } from '@/components/ui/Screen'
import { PressableScale } from '@/components/ui/PressableScale'
import { Text } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useMyIssues } from '@/hooks/useIssues'
import { useNearbyIssues } from '@/hooks/useNearbyIssues'
import { useReviewQueue } from '@/hooks/useReviewQueue'
import { karmaLevel } from '@/lib/format'
import type { DecodedIssue } from '@/lib/api/issues-repo'
import { accent, ink, line, radius, space, surface } from '@/theme/tokens'

/** Default map centre — Nashik, the city this deployment serves. */
const NASHIK = { latitude: 19.9975, longitude: 73.7898 }
const DELTA = { latitudeDelta: 0.05, longitudeDelta: 0.05 }

/**
 * Citizen home.
 *
 * Ordered by what people actually open the app to do: file something, then check what
 * happened to what they already filed. Community and map affordances sit below that
 * because they are secondary — useful, but not why anyone launched the app.
 */
export default function HomeScreen() {
  const router = useRouter()
  const { userId, displayName, avatarUrl, profile } = useAuth()

  const myIssues = useMyIssues(userId)
  const origin = profile?.home_location ?? null
  const nearby = useNearbyIssues(origin)
  const review = useReviewQueue(userId, origin)

  const [selectedMarker, setSelectedMarker] = useState<string | null>(null)

  const greetingName = (displayName ?? '').split(' ')[0] || 'there'
  const karma = profile?.karma_score ?? 0
  const level = karmaLevel(karma)

  /**
   * Things the citizen can act on: a pipeline that gave up, and a report that needs
   * neighbours to confirm it. Surfacing these on Home is what turns a status list
   * into something a person can do something about.
   */
  const attention = useMemo(
    () =>
      myIssues.issues.filter(
        (issue) =>
          issue.pipeline_stage?.endsWith('_failed') || issue.status === 'community_review'
      ),
    [myIssues.issues]
  )

  const mapMarkers = useMemo(
    () =>
      nearby.nearest
        .filter((issue) => issue.location)
        .map((issue) => ({
          id: issue.id,
          coordinate: { lat: issue.location!.lat, lng: issue.location!.lng },
          status: issue.status,
          severity: issue.severity,
          title: issue.title,
        })),
    [nearby.nearest]
  )

  const region = useMemo(
    () =>
      origin
        ? { latitude: origin.lat, longitude: origin.lng, ...DELTA }
        : { ...NASHIK, ...DELTA },
    [origin]
  )

  const openIssue = useCallback(
    (issue: DecodedIssue) => router.push(`/issue/${issue.id}`),
    [router]
  )

  const handleMarkerPress = useCallback(
    (id: string) => {
      setSelectedMarker(id)
      router.push(`/issue/${id}`)
    },
    [router]
  )

  const refreshing = myIssues.refreshing || nearby.refreshing || review.refreshing
  const onRefresh = useCallback(() => {
    myIssues.reload({ silent: true })
    nearby.reload({ silent: true })
    review.reload({ silent: true })
  }, [myIssues, nearby, review])

  const isFirstLoad = myIssues.loading && !myIssues.data

  return (
    <Screen
      scroll
      padded
      edges={['top']}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={accent.brand}
          colors={[accent.brand]}
          progressBackgroundColor={surface.card}
        />
      }
    >
      {/* ── Identity ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="micro" weight="medium" tone="faint">
            {level.name.toUpperCase()}
          </Text>
          <Text variant="title" numberOfLines={1}>
            Hello, {greetingName}
          </Text>
        </View>
        <PressableScale
          onPress={() => router.push('/(citizen)/profile')}
          haptic="tap"
          accessibilityRole="button"
          accessibilityLabel="Open your profile"
        >
          <Avatar name={displayName} uri={avatarUrl} size={44} />
        </PressableScale>
      </View>

      {/* ── Primary action ────────────────────────────────────────────────── */}
      <PressableScale
        onPress={() => router.push('/(citizen)/report')}
        haptic="press"
        accessibilityRole="button"
        accessibilityLabel="Report a civic issue"
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Icon name="plus-circle-outline" size={22} color="#ffffff" />
          </View>
          <View style={styles.heroBody}>
            <Text variant="heading" weight="semibold" style={styles.heroTitle}>
              Report an issue
            </Text>
            <Text variant="caption" style={styles.heroSub}>
              Photo, location and a short description is enough
            </Text>
          </View>
          <Icon name="arrow-right" size={20} color="#ffffff" />
        </View>
      </PressableScale>

      {/* ── Connection / sync state ───────────────────────────────────────── */}
      {myIssues.realtime === 'unavailable' ? (
        <Notice
          tone="amber"
          title="Live updates paused"
          body="The realtime connection dropped, so statuses may be slightly behind. Pull down to refresh."
          icon={<Icon name="wifi-off" size={15} color={accent.amberSoft} />}
          actionLabel="Refresh now"
          onAction={onRefresh}
        />
      ) : null}

      {isFirstLoad ? (
        <View style={styles.skeletons}>
          <Skeleton height={96} />
          <Skeleton height={140} />
          <Skeleton height={96} />
        </View>
      ) : (
        <>
          {/* ── Needs attention ─────────────────────────────────────────── */}
          {attention.length > 0 ? (
            <Notice
              tone={attention.some((i) => i.pipeline_stage?.endsWith('_failed')) ? 'red' : 'amber'}
              title={
                attention.length === 1
                  ? '1 report needs your attention'
                  : `${attention.length} reports need attention`
              }
              body={
                attention.some((i) => i.pipeline_stage?.endsWith('_failed'))
                  ? 'A processing step did not finish. Open the report to restart it.'
                  : 'Neighbours are verifying these reports before they reach the department.'
              }
              icon={<Icon name="alert-outline" size={15} color={accent.amberSoft} />}
              actionLabel="Review"
              onAction={() => router.push('/issue/' + attention[0].id)}
            />
          ) : null}

          {/* ── Activity ──────────────────────────────────────────────────── */}
          <Card>
            <ActivityBand
              counts={{
                open: myIssues.summary.open,
                inProgress: myIssues.summary.inProgress,
                resolved: myIssues.summary.resolved,
                total: myIssues.summary.total,
              }}
            />
            {myIssues.summary.needsAttention > 0 ? (
              <Text variant="caption" tone="faint" style={styles.attentionHint}>
                {myIssues.summary.needsAttention} needing attention
              </Text>
            ) : null}
          </Card>

          {/* ── Near you ──────────────────────────────────────────────────── */}
          <Card padded={false} style={styles.nearCard}>
            <View style={styles.nearHeader}>
              <View>
                <Text variant="heading" weight="semibold">
                  Near you
                </Text>
                <Text variant="caption" tone="faint" style={styles.nearSub}>
                  {origin
                    ? `${nearby.withinOneKm} report${nearby.withinOneKm === 1 ? '' : 's'} within 1 km`
                    : 'Set a home location to see what is happening nearby'}
                </Text>
              </View>
              <Button
                label="Open map"
                size="sm"
                variant="ghost"
                onPress={() => router.push('/(citizen)/map')}
              />
            </View>

            <View style={styles.nearMap}>
              <MapSurface
                markers={mapMarkers}
                region={region}
                fallbackItems={nearby.nearest.map((i) => ({
                  id: i.id,
                  title: i.title,
                  category: i.category,
                  status: i.status,
                  distanceMetres: i.distanceMetres,
                }))}
                selectedId={selectedMarker}
                onSelect={handleMarkerPress}
                userLocation={origin}
                height={190}
              />
            </View>
          </Card>

          {/* ── Community ─────────────────────────────────────────────────── */}
          <QuickLink
            icon="shield-check-outline"
            label="Verify nearby reports"
            hint={
              review.totalCount > 0
                ? `${review.totalCount} waiting for a neighbour to confirm`
                : 'Nothing waiting for you right now'
            }
            badge={review.totalCount}
            tone={accent.blue}
            onPress={() => router.push('/(citizen)/review')}
          />

          {/* ── My reports ────────────────────────────────────────────────── */}
          <View style={styles.sectionHeader}>
            <Text variant="heading" weight="semibold">
              My reports
            </Text>
            {myIssues.issues.length > 0 ? (
              <Text variant="micro" tone="faint" mono>
                {myIssues.issues.length} total
              </Text>
            ) : null}
          </View>

          {myIssues.error && myIssues.issues.length === 0 ? (
            <ErrorState
              title="Could not load your reports"
              message={myIssues.error}
              onRetry={() => myIssues.reload()}
            />
          ) : myIssues.issues.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Icon name="clipboard-text-outline" size={24} color={accent.brand} />}
                title="No reports yet"
                body="Spotted a pothole, a broken streetlight or an overflowing bin? Report it — five AI agents will take it from there."
                actionLabel="Report your first issue"
                onAction={() => router.push('/(citizen)/report')}
              />
            </Card>
          ) : (
            <View style={styles.issueList}>
              {myIssues.issues.map((issue) => (
                <IssueCard key={issue.id} issue={issue} onPress={openIssue} />
              ))}
            </View>
          )}

          {/* ── Secondary destinations ────────────────────────────────────── */}
          <View style={styles.footerLinks}>
            <Divider style={styles.footerDivider} />
            <QuickLink
              icon="trophy-outline"
              label="Karma leaderboard"
              hint={`${karma} points · ${level.next}`}
              tone={accent.amberSoft}
              onPress={() => router.push('/leaderboard')}
            />
            <QuickLink
              icon="map-marker-check-outline"
              label="Home location"
              hint={profile?.home_address ?? 'Used to find reports near you'}
              tone={accent.brand}
              onPress={() => router.push('/(citizen)/profile')}
            />
          </View>
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { gap: space.lg, paddingBottom: space.huge },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  headerText: { flex: 1, gap: 2 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: accent.brand,
    borderRadius: radius.lg,
    padding: space.lg,
    shadowColor: accent.brand,
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroBody: { flex: 1, gap: 1 },
  heroTitle: { color: '#ffffff' },
  heroSub: { color: 'rgba(255,255,255,0.85)' },
  skeletons: { gap: space.lg },
  attentionHint: { marginTop: space.md },
  nearCard: { padding: space.lg },
  nearHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md },
  nearSub: { marginTop: 2 },
  nearMap: { marginTop: space.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  issueList: { gap: space.md },
  footerLinks: { gap: space.md, marginTop: space.sm },
  footerDivider: { marginBottom: space.sm },
})
