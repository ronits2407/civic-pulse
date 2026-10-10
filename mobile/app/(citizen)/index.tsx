import React, { useCallback, useMemo } from 'react'
import { RefreshControl, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'

import { AroundYou } from '@/components/home/AroundYou'
import { Greeting } from '@/components/home/Greeting'
import { LiveReportHero } from '@/components/home/LiveReportHero'
import { QuickTiles } from '@/components/home/QuickTiles'
import { IssueCard } from '@/components/issues/IssueCard'
import { TAB_BAR_CLEARANCE } from '@/components/navigation/PillTabBar'
import { ErrorState, Notice, Skeleton } from '@/components/ui/Feedback'
import { Rise } from '@/components/ui/Motion'
import { PressableScale } from '@/components/ui/PressableScale'
import { Screen } from '@/components/ui/Screen'
import { Text } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useMyIssues } from '@/hooks/useIssues'
import { useNearbyIssues } from '@/hooks/useNearbyIssues'
import { useReviewQueue } from '@/hooks/useReviewQueue'
import type { DecodedIssue } from '@/lib/api/issues-repo'
import { accent, space, surface } from '@/theme/tokens'

/**
 * Home. One question per band: who am I, what is happening to my report, what can I do,
 * what needs me, what is going on around me.
 */
export default function HomeScreen() {
  const router = useRouter()
  const { userId, displayName, avatarUrl, profile } = useAuth()

  const myIssues = useMyIssues(userId)
  const origin = profile?.home_location ?? null
  const nearby = useNearbyIssues(origin)
  const review = useReviewQueue(userId, origin)

  const latest = myIssues.issues[0] ?? null
  const failed = useMemo(
    () => myIssues.issues.filter((i) => i.pipeline_stage?.endsWith('_failed')),
    [myIssues.issues]
  )

  const openIssue = useCallback((issue: DecodedIssue) => router.push(`/issue/${issue.id}`), [router])
  const report = useCallback(() => router.push('/(citizen)/report'), [router])
  const refreshing = myIssues.refreshing || nearby.refreshing || review.refreshing
  const onRefresh = useCallback(() => {
    myIssues.reload({ silent: true })
    nearby.reload({ silent: true })
    review.reload({ silent: true })
  }, [myIssues, nearby, review])

  return (
    <Screen
      scroll
      padded
      edges={['top']}
      bottomInset={TAB_BAR_CLEARANCE + space.lg}
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
      <Rise index={0}>
        <Greeting name={displayName} avatarUrl={avatarUrl} />
      </Rise>

      {myIssues.realtime === 'unavailable' ? (
        <Notice
          tone="amber"
          title="Live updates paused"
          body="Statuses may be a little behind. Pull down to refresh."
          icon={<Icon name="wifi-off" size={16} color={accent.amberSoft} />}
          actionLabel="Refresh now"
          onAction={onRefresh}
        />
      ) : null}

      {myIssues.loading && !myIssues.data ? (
        <Skeleton height={236} />
      ) : myIssues.error && myIssues.issues.length === 0 ? (
        <ErrorState title="Could not load your reports" message={myIssues.error} onRetry={() => myIssues.reload()} />
      ) : (
        <Rise index={1}>
          <LiveReportHero issue={latest} onOpen={openIssue} onReport={report} />
        </Rise>
      )}

      <Rise index={2}>
        <QuickTiles
          tiles={[
            { key: 'report', icon: 'plus', label: 'Report', primary: true, onPress: report },
            { key: 'verify', icon: 'shield-check-outline', label: 'Verify', badge: review.totalCount, onPress: () => router.push('/(citizen)/review') },
            { key: 'map', icon: 'map-marker-radius-outline', label: 'City map', onPress: () => router.push('/(citizen)/map') },
            { key: 'alerts', icon: 'broadcast', label: 'Offline alerts', danger: true, onPress: () => router.push('/emergency-network') },
          ]}
        />
      </Rise>

      {failed.length > 0 ? (
        <Notice
          tone="red"
          title={failed.length === 1 ? 'A report got stuck' : `${failed.length} reports got stuck`}
          body="An agent could not finish. Open it to restart the pipeline from where it stopped."
          icon={<Icon name="alert-circle-outline" size={16} color={accent.red} />}
          actionLabel="Open report"
          onAction={() => openIssue(failed[0])}
        />
      ) : null}

      <Rise index={3}>
        <AroundYou origin={origin} nearby={nearby} />
      </Rise>

      {myIssues.issues.length > 1 ? (
        <Rise index={4} style={styles.stack}>
          <View style={styles.sectionHead}>
            <Text variant="heading">Earlier reports</Text>
            <PressableScale onPress={() => router.push('/(citizen)/reports')} accessibilityRole="button" accessibilityLabel="See all your reports">
              <Text variant="label" weight="semibold" style={{ color: accent.blue }}>
                See all
              </Text>
            </PressableScale>
          </View>
          {myIssues.issues.slice(1, 3).map((issue) => (
            <IssueCard key={issue.id} issue={issue} onPress={openIssue} />
          ))}
        </Rise>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { gap: space.lg },
  stack: { gap: space.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
})
