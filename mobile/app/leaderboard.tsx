import React from 'react'
import { RefreshControl, StyleSheet, View } from 'react-native'

import { Avatar } from '@/components/ui/Avatar'
import { Card, Divider } from '@/components/ui/Card'
import { EmptyState, ErrorState, LoadingState, Notice } from '@/components/ui/Feedback'
import { Screen } from '@/components/ui/Screen'
import { Text } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useLeaderboard } from '@/hooks/useLeaderboard'
import { karmaLevel } from '@/lib/format'
import { accent, line, radius, space, surface, TONE_COLOR, TONE_TINT } from '@/theme/tokens'

/**
 * Karma leaderboard.
 *
 * Served by the existing `/api/leaderboard` route, which enriches entries with display
 * names and avatars using the service-role key. The mobile client cannot and must not
 * make that query itself.
 *
 * Gamification is kept deliberately secondary in this app: it is reachable from Home
 * and Profile, but never blocks or precedes reporting and tracking.
 */
export default function LeaderboardScreen() {
  const { userId } = useAuth()
  const { data, loading, error, reload, refreshing } = useLeaderboard(userId)

  const entries = data?.leaderboard ?? []
  const stats = data?.currentUserStats

  return (
    <Screen
      scroll
      padded
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => reload({ silent: true })}
          tintColor={accent.brand}
          colors={[accent.brand]}
        />
      }
    >
      {/* The citizen's own standing comes first — that is the reason they opened this. */}
      {stats ? (
        <Card style={styles.ownCard}>
          <View style={styles.ownRow}>
            <View style={styles.ownRank}>
              <Text variant="micro" weight="medium" tone="faint">
                YOUR RANK
              </Text>
              <Text variant="display" weight="bold" mono style={{ color: accent.brand }}>
                #{stats.rank}
              </Text>
            </View>
            <View style={styles.ownStats}>
              <Text variant="micro" weight="medium" tone="faint">
                KARMA
              </Text>
              <Text variant="dataLg" weight="semibold" mono>
                {stats.karma_score}
              </Text>
              <Text variant="micro" tone="faint">
                {karmaLevel(stats.karma_score).name}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      <Notice
        tone="blue"
        body="Karma is earned for reporting, verifying neighbours' reports and having your own reports resolved."
        icon={<Icon name="information-outline" size={15} color={accent.blue} />}
      />

      {loading && !data ? (
        <LoadingState label="Loading rankings" />
      ) : error && !data ? (
        <ErrorState title="Could not load the leaderboard" message={error} onRetry={() => reload()} />
      ) : entries.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icon name="trophy-outline" size={24} color={accent.amberSoft} />}
            title="No rankings yet"
            body="Nobody has earned karma in this deployment yet. File a report and you will be first."
          />
        </Card>
      ) : (
        <Card padded={false} style={styles.boardCard}>
          {entries.map((entry, index) => {
            const isMe = entry.id === userId
            const rank = index + 1
            const medalColor =
              rank === 1 ? '#f2cc60' : rank === 2 ? '#c9d1d9' : rank === 3 ? '#e0a06a' : undefined

            return (
              <View key={entry.id}>
                <View style={[styles.row, isMe && styles.rowMe]}>
                  <View style={styles.rankCell}>
                    {medalColor ? (
                      <Icon name="medal-outline" size={18} color={medalColor} />
                    ) : (
                      <Text variant="data" tone="faint" mono>
                        {rank}
                      </Text>
                    )}
                  </View>

                  <Avatar name={entry.name} uri={entry.picture} size={36} />

                  <View style={styles.rowBody}>
                    <Text variant="bodyTight" weight={isMe ? 'semibold' : 'medium'} numberOfLines={1}>
                      {entry.name}
                      {isMe ? ' (you)' : ''}
                    </Text>
                    <Text variant="micro" tone="faint">
                      {karmaLevel(entry.karma_score).name}
                    </Text>
                  </View>

                  <Text variant="data" weight="semibold" mono style={{ color: isMe ? accent.brand : undefined }}>
                    {entry.karma_score}
                  </Text>
                </View>
                {index < entries.length - 1 ? <Divider /> : null}
              </View>
            )
          })}
        </Card>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { gap: space.lg, paddingBottom: space.huge },
  ownCard: { backgroundColor: surface.card },
  ownRow: { flexDirection: 'row', alignItems: 'center', gap: space.xl },
  ownRank: { gap: 2 },
  ownStats: { gap: 2, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: line.base, paddingLeft: space.xl },
  boardCard: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  rowMe: { backgroundColor: 'rgba(45,164,78,0.08)' },
  rankCell: { width: 26, alignItems: 'center' },
  rowBody: { flex: 1, gap: 1 },
})
