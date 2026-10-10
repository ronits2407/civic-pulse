import React, { useCallback, useMemo, useState } from 'react'
import { RefreshControl, StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { useRouter } from 'expo-router'

import { IssueCard } from '@/components/issues/IssueCard'
import { TAB_BAR_CLEARANCE } from '@/components/navigation/PillTabBar'
import { Card } from '@/components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { layoutSpring, rise } from '@/components/ui/Motion'
import { PressableScale } from '@/components/ui/PressableScale'
import { Screen } from '@/components/ui/Screen'
import { Segmented } from '@/components/ui/Segmented'
import { Text } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useMyIssues } from '@/hooks/useIssues'
import type { DecodedIssue } from '@/lib/api/issues-repo'
import { accent, ink, space } from '@/theme/tokens'

type Filter = 'all' | 'active' | 'resolved'
const ACTIVE = new Set(['open', 'in_progress', 'community_review', 'false_closure'])

const EMPTY: Record<Filter, { title: string; body: string }> = {
  all: { title: 'No reports yet', body: 'Report a pothole, a dark streetlight or an overflowing bin. It takes under a minute.' },
  active: { title: 'Nothing active', body: 'Reports that are still being worked on appear here.' },
  resolved: { title: 'Nothing resolved yet', body: 'When the city fixes something you reported, it moves here.' },
}

/**
 * Every report you have filed. Moved off Home so Home can stay a summary: a count strip
 * on navy, a sliding filter, and the full list.
 */
export default function ReportsScreen() {
  const router = useRouter()
  const { userId } = useAuth()
  const mine = useMyIssues(userId)
  const [filter, setFilter] = useState<Filter>('all')

  const visible = useMemo(() => {
    if (filter === 'all') return mine.issues
    if (filter === 'resolved') return mine.issues.filter((i) => i.status === 'resolved' || i.status === 'closed')
    return mine.issues.filter((i) => ACTIVE.has(i.status ?? ''))
  }, [mine.issues, filter])

  const openIssue = useCallback((issue: DecodedIssue) => router.push(`/issue/${issue.id}`), [router])
  const newReport = useCallback(() => router.push('/(citizen)/report'), [router])
  const s = mine.summary

  return (
    <Screen
      scroll
      padded
      edges={['top']}
      bottomInset={TAB_BAR_CLEARANCE + space.lg}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={mine.refreshing} onRefresh={() => mine.reload({ silent: true })} tintColor={accent.brand} colors={[accent.brand]} />
      }
    >
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text variant="display" accessibilityRole="header">
            My reports
          </Text>
          <Text variant="bodyTight" tone="muted">
            {s.total === 0 ? 'Nothing filed yet' : `${s.total} filed, ${s.resolved} resolved`}
          </Text>
        </View>
        <PressableScale onPress={newReport} haptic="press" accessibilityRole="button" accessibilityLabel="Report a new issue">
          <View style={styles.add}>
            <Icon name="plus" size={26} color={ink.inverse} />
          </View>
        </PressableScale>
      </View>

      <Card variant="hero" style={styles.stats}>
        <Stat label="Under review" value={s.open} />
        <View style={styles.rule} />
        <Stat label="In progress" value={s.inProgress} />
        <View style={styles.rule} />
        <Stat label="Resolved" value={s.resolved} />
      </Card>

      <Segmented<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'All' },
          { value: 'active', label: 'Active' },
          { value: 'resolved', label: 'Resolved' },
        ]}
      />

      {mine.loading && !mine.data ? (
        <View style={styles.list}>
          <Skeleton height={190} />
          <Skeleton height={190} />
        </View>
      ) : mine.error && mine.issues.length === 0 ? (
        <ErrorState title="Could not load your reports" message={mine.error} onRetry={() => mine.reload()} />
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icon name="clipboard-text-outline" size={26} color={ink.base} />}
            title={EMPTY[filter].title}
            body={EMPTY[filter].body}
            actionLabel={filter === 'all' ? 'Report an issue' : undefined}
            onAction={filter === 'all' ? newReport : undefined}
          />
        </Card>
      ) : (
        <View style={styles.list}>
          {visible.map((issue, i) => (
            <Animated.View key={issue.id} entering={rise(i)} layout={layoutSpring}>
              <IssueCard issue={issue} onPress={openIssue} />
            </Animated.View>
          ))}
        </View>
      )}
    </Screen>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text variant="dataLg" tone="inverse">
        {value}
      </Text>
      <Text variant="caption" tone="inverseMuted">
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { gap: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.md },
  flex: { flex: 1, gap: 2 },
  add: { width: 54, height: 54, borderRadius: 27, backgroundColor: ink.base, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.lg },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  rule: { width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.14)' },
  list: { gap: space.md },
})
