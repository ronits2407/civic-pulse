import React, { useCallback } from 'react'
import { RefreshControl, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'

import { ReviewCard } from '@/features/community-review/ReviewCard'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState, ErrorState, Notice, Skeleton } from '@/components/ui/Feedback'
import { Screen } from '@/components/ui/Screen'
import { Text } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import { useToast } from '@/components/feedback/ToastHost'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useReviewQueue } from '@/hooks/useReviewQueue'
import { accent, space } from '@/theme/tokens'

/**
 * Community verification.
 *
 * Wired to the existing endpoints: `GET /api/reviews` to fetch what is waiting and
 * `POST /api/reviews/[issueId]/vote` to record a verdict. Quorum, karma and any
 * pipeline resumption are decided server-side.
 *
 * One dependency is worth surfacing clearly: the reviews route matches issues within
 * 1 km of the citizen's *saved home location*, and returns an empty list when none is
 * set. Rather than showing a bare "nothing to verify", the empty state explains that
 * and offers the fix.
 */
export default function ReviewScreen() {
  const router = useRouter()
  const toast = useToast()
  const { userId, profile } = useAuth()

  const homeLocation = profile?.home_location ?? null
  const queue = useReviewQueue(userId, homeLocation)

  const handleVote = useCallback(
    async (issueId: string, verdict: boolean, comment?: string) => {
      const item = queue.allItems.find((i) => i.id === issueId)
      if (!item) throw new Error('This report is no longer in your queue.')

      const outcome = await queue.submitVote(item, verdict, comment)

      if (outcome === 'confirmed') {
        toast.success('Confirmed — it moves on to the department.', 'Community agreed')
      } else if (outcome === 'rejected') {
        toast.info('Dismissed — it will not reach a department.', 'Community disagreed')
      } else {
        toast.info('Vote recorded. Two more neighbours are needed.')
      }

      return outcome
    },
    [queue, toast]
  )

  const noHomeLocation = !homeLocation

  return (
    <Screen
      scroll
      padded
      edges={['top']}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={queue.refreshing}
          onRefresh={() => queue.reload({ silent: true })}
          tintColor={accent.brand}
          colors={[accent.brand]}
        />
      }
    >
      <View style={styles.header}>
        <Text variant="title">Verify reports</Text>
        <Text variant="caption" tone="faint">
          When an AI credibility check scores a report below 6/10, neighbours confirm
          whether it is real before a department acts on it.
        </Text>
      </View>

      <Notice
        tone="blue"
        body="You are shown reports within about 1 km of your saved home location. Votes are weighted equally and three settle a report."
        icon={<Icon name="information-outline" size={15} color={accent.blue} />}
      />

      {noHomeLocation ? (
        <Card>
          <EmptyState
            icon={<Icon name="map-marker-question-outline" size={24} color={accent.brand} />}
            title="Set your home location first"
            body="Verification is deliberately local — you only see reports you could plausibly walk past. Save a home location and nearby reports will appear here."
            actionLabel="Set home location"
            onAction={() => router.push('/(citizen)/profile')}
          />
        </Card>
      ) : queue.loading && (!queue.data || queue.data.length === 0) ? (
        <View style={styles.skeletons}>
          <Skeleton height={320} />
          <Skeleton height={320} />
        </View>
      ) : queue.error && queue.allItems.length === 0 ? (
        <ErrorState title="Could not load the review queue" message={queue.error} onRetry={() => queue.reload()} />
      ) : queue.allItems.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icon name="shield-check-outline" size={24} color={accent.brand} />}
            title="Nothing waiting on you"
            body="Every report near you has all the confirmation it needs. New ones will appear here as they come in."
            actionLabel="Refresh"
            onAction={() => queue.reload()}
          />
        </Card>
      ) : queue.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icon name="check-all" size={24} color={accent.emerald} />}
            title="All caught up"
            body={`You voted on all ${queue.totalCount} report${queue.totalCount === 1 ? '' : 's'} waiting near you. Thank you — that is real work for the city.`}
            actionLabel="Refresh the queue"
            onAction={() => queue.reload()}
          />
        </Card>
      ) : (
        queue.items.map((item) => (
          <ReviewCard
            key={item.id}
            item={item}
            submitting={queue.submittingId === item.id}
            locked={queue.localVotes[item.id]}
            onSubmit={(verdict, comment) => handleVote(item.id, verdict, comment)}
          />
        ))
      )}

      {/* History of this session's votes, so a citizen can see their own record. */}
      {Object.keys(queue.localVotes).length > 0 ? (
        <Card>
          <View style={styles.sessionHeader}>
            <Text variant="bodyTight" weight="semibold">
              Your votes this session
            </Text>
            <Button label="Done for now" size="sm" variant="ghost" onPress={() => router.push('/(citizen)')} />
          </View>
          <Text variant="caption" tone="muted">
            {Object.entries(queue.localVotes)
              .map(([, outcome]) => outcome)
              .map((outcome) =>
                outcome === 'confirmed'
                  ? 'Confirmed'
                  : outcome === 'rejected'
                    ? 'Dismissed'
                    : 'Awaiting quorum'
              )
              .join(' · ')}
          </Text>
        </Card>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { gap: space.lg, paddingBottom: space.huge },
  header: { gap: space.xs },
  skeletons: { gap: space.lg },
  sessionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, marginBottom: space.sm },
})
