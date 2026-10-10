import React from 'react'
import { RefreshControl, StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'

import { Podium } from '@/components/leaderboard/Podium'
import { Avatar } from '@/components/ui/Avatar'
import { Card, Divider } from '@/components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { rise } from '@/components/ui/Motion'
import { Screen } from '@/components/ui/Screen'
import { TopBar } from '@/components/ui/TopBar'
import { Text } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useLeaderboard } from '@/hooks/useLeaderboard'
import { karmaLevel } from '@/lib/format'
import { accent, radius, space, surface, TONE_TINT } from '@/theme/tokens'

/**
 * Karma leaderboard, served by `/api/leaderboard` (which enriches names and avatars with
 * the service-role key; the client must not make that query itself). Your own rank comes
 * first, then a podium for the top three, then everyone else.
 */
export default function LeaderboardScreen() {
  const { userId } = useAuth()
  const { data, loading, error, reload, refreshing } = useLeaderboard(userId)
  const entries = data?.leaderboard ?? []
  const stats = data?.currentUserStats
  const rest = entries.slice(3)

  return (
    <Screen
      scroll
      padded
      edges={['top', 'bottom']}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload({ silent: true })} tintColor={accent.brand} colors={[accent.brand]} />}
    >
      <TopBar title="Leaderboard" subtitle="Karma is earned for reporting, verifying neighbours' reports, and getting your own reports fixed." />

      {stats ? (
        <Card variant="hero" style={styles.own}>
          <View>
            <Text variant="caption" tone="inverseMuted">
              Your rank
            </Text>
            <Text variant="hero" tone="inverse">
              #{stats.rank}
            </Text>
          </View>
          <View style={styles.ownRight}>
            <Text variant="dataLg" style={{ color: accent.kerb }}>
              {stats.karma_score}
            </Text>
            <Text variant="caption" tone="inverseMuted">
              {karmaLevel(stats.karma_score).name}
            </Text>
          </View>
        </Card>
      ) : null}

      {loading && !data ? (
        <Skeleton height={260} />
      ) : error && !data ? (
        <ErrorState title="Could not load the leaderboard" message={error} onRetry={() => reload()} />
      ) : entries.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icon name="trophy-outline" size={26} color={accent.amberSoft} />}
            title="No rankings yet"
            body="Nobody has earned karma here yet. File a report and you will be first."
          />
        </Card>
      ) : (
        <>
          <Podium entries={entries} meId={userId} />
          {rest.length > 0 ? (
            <Card padded={false} style={styles.board}>
              {rest.map((entry, i) => {
                const me = entry.id === userId
                return (
                  <Animated.View key={entry.id} entering={rise(i)}>
                    {i > 0 ? <Divider /> : null}
                    <View style={[styles.row, me && styles.rowMe]}>
                      <Text variant="data" tone="faint" style={styles.rank}>
                        {i + 4}
                      </Text>
                      <Avatar name={entry.name} uri={entry.picture} size={40} />
                      <View style={styles.flex}>
                        <Text variant="bodyTight" weight="semibold" numberOfLines={1}>
                          {entry.name}
                          {me ? ' (you)' : ''}
                        </Text>
                        <Text variant="caption" tone="faint">
                          {karmaLevel(entry.karma_score).name}
                        </Text>
                      </View>
                      <Text variant="data">{entry.karma_score}</Text>
                    </View>
                  </Animated.View>
                )
              })}
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { gap: space.lg, paddingBottom: space.huge },
  own: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', padding: space.xl, borderRadius: radius.xl },
  ownRight: { alignItems: 'flex-end', gap: 2 },
  board: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  rowMe: { backgroundColor: TONE_TINT.amber },
  rank: { width: 24, textAlign: 'center' },
  flex: { flex: 1, gap: 1 },
})
