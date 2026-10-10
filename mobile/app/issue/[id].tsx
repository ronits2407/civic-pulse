import React, { useEffect, useMemo, useState } from 'react'
import { RefreshControl, StyleSheet, View } from 'react-native'
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { DetailHero, HERO_HEIGHT } from '@/components/issues/DetailHero'
import { IssueBody } from '@/components/issues/IssueBody'
import { StatusPanel } from '@/components/issues/StatusPanel'
import { Chip, StatusPill } from '@/components/ui/Chip'
import { EmptyState, ErrorState, LoadingState, Notice } from '@/components/ui/Feedback'
import { Rise } from '@/components/ui/Motion'
import { Screen } from '@/components/ui/Screen'
import { TopBar } from '@/components/ui/TopBar'
import { Text } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import { fetchDepartments } from '@/lib/api/issues-repo'
import { timeAgo } from '@/lib/format'
import { useIssueDetail } from '@/hooks/useIssueDetail'
import { CATEGORY_META, FALLBACK_CATEGORY, TONE_COLOR, TONE_TINT, accent, ink, radius, space, surface } from '@/theme/tokens'
import type { Department } from '@/types/civicpulse'

/**
 * Issue detail. The evidence photo fills the top; a rounded paper sheet slides over it
 * carrying the title, the live status panel, and everything the agents produced.
 */
export default function IssueDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>()
  const issueId = typeof params.id === 'string' ? params.id : null
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const { issue, loading, error, reload, refreshing, realtime, retry, retrying, retryError, canRetry } = useIssueDetail(issueId)
  const [departments, setDepartments] = useState<Department[]>([])
  const scrollY = useSharedValue(0)
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y)
  })

  // Departments are near-static reference data; one fetch per mount is plenty.
  useEffect(() => {
    let cancelled = false
    fetchDepartments()
      .then((rows) => !cancelled && setDepartments(rows))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const departmentName = useMemo(
    () => (issue?.department_id ? departments.find((d) => d.id === issue.department_id)?.name ?? null : null),
    [issue?.department_id, departments]
  )

  if (!issueId || (!loading && !error && !issue)) {
    return (
      <Screen padded edges={['top']}>
        <TopBar />
        <EmptyState title="Report not found" body="It may have been removed, or this link does not point at a report." actionLabel="Back to home" onAction={() => router.replace('/(citizen)')} />
      </Screen>
    )
  }
  if (loading && !issue) {
    return (
      <Screen padded edges={['top']}>
        <TopBar />
        <LoadingState label="Loading report" />
      </Screen>
    )
  }
  if (error && !issue) {
    return (
      <Screen padded edges={['top']}>
        <TopBar />
        <ErrorState title="Could not load this report" message={error} onRetry={() => reload()} />
      </Screen>
    )
  }
  if (!issue) return null

  const meta = (issue.category && CATEGORY_META[issue.category]) || FALLBACK_CATEGORY
  const openReceipt = () => router.push({ pathname: '/receipt', params: { issueId: issue.id } })

  return (
    <View style={styles.root}>
      <DetailHero photoUrl={issue.photo_url} category={issue.category} scrollY={scrollY} onShare={issue.status === 'resolved' ? openReceipt : undefined} />

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: HERO_HEIGHT - radius.xl - 8, paddingBottom: insets.bottom + space.huge }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload({ silent: true })} tintColor={accent.brand} colors={[accent.brand]} progressViewOffset={insets.top + 40} />}
      >
        <View style={styles.sheet}>
          <Rise index={0} style={styles.identity}>
            <View style={styles.chips}>
              <StatusPill status={issue.status} />
              <Chip label={meta.label} color={meta.color} tint={meta.tint} />
              {issue.is_emergency ? <Chip label="Emergency" color={TONE_COLOR.red} tint={TONE_TINT.red} /> : null}
            </View>
            <Text variant="display">{issue.title?.trim() || 'Untitled report'}</Text>
            <View style={styles.metaLine}>
              <Icon name="map-marker-outline" size={16} color={ink.faint} />
              <Text variant="bodyTight" tone="muted" numberOfLines={2} style={styles.flex}>
                {issue.address?.trim() || 'Location recorded'}
              </Text>
            </View>
            <Text variant="caption" tone="faint">
              Reported {timeAgo(issue.created_at)}
              {issue.resolved_at ? `, resolved ${timeAgo(issue.resolved_at)}` : ''}
            </Text>
          </Rise>

          <Rise index={1}>
            <StatusPanel issue={issue} live={realtime === 'live'} canRetry={canRetry} retrying={retrying} onRetry={retry} />
          </Rise>
          {retryError ? <Notice tone="red" title="Could not restart" body={retryError} /> : null}

          <IssueBody issue={issue} departmentName={departmentName} onReceipt={openReceipt} />
        </View>
      </Animated.ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: surface.canvas },
  sheet: {
    backgroundColor: surface.canvas,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    gap: space.lg,
    minHeight: 600,
  },
  identity: { gap: space.sm, paddingHorizontal: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  metaLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  flex: { flex: 1 },
})
