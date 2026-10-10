import React, { useCallback } from 'react'
import { Alert, Linking, RefreshControl, StyleSheet, View } from 'react-native'

import { Button } from '@/components/ui/Button'
import { Card, Divider } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { ErrorState, LoadingState, Notice } from '@/components/ui/Feedback'
import { Screen } from '@/components/ui/Screen'
import { Text } from '@/theme/Typography'
import { Icon, type IconName } from '@/theme/icons'
import { useAuth } from '@/lib/auth/AuthProvider'
import { fetchOperationsSummary } from '@/lib/api/admin-repo'
import { env } from '@/lib/env'
import { useAsync } from '@/hooks/useAsync'
import { accent, ink, line, radius, space, surface, TONE_COLOR, TONE_TINT, type Tone } from '@/theme/tokens'

/**
 * Municipal entry point.
 *
 * Deliberately not a port of the web admin dashboard. It does three honest things: it
 * proves the role boundary works, it shows real numbers from the live database, and it
 * hands over to the web console that already implements the full workflow.
 *
 * The counts are the ones a municipal user actually triages by: how much is open, how
 * much is breaching its SLA, how much is stuck awaiting community verification, and how
 * many pipeline runs failed and need a retry.
 */

export default function MunicipalityHomeScreen() {
  const { displayName, email, signOut } = useAuth()
  const summary = useAsync(fetchOperationsSummary, [])

  const openWebConsole = useCallback(() => {
    if (!env.apiUrl) {
      Alert.alert('Backend not configured', 'Set EXPO_PUBLIC_API_URL so the console URL can be built.')
      return
    }
    Linking.openURL(`${env.apiUrl}/admin/dashboard`)
  }, [])

  const confirmSignOut = useCallback(() => {
    Alert.alert('Sign out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ])
  }, [signOut])

  const data = summary.data

  const metrics: { label: string; value: number | null; tone: Tone; icon: IconName; hint: string }[] = [
    { label: 'Open', value: data?.open ?? null, tone: 'blue', icon: 'inbox-outline', hint: 'Awaiting triage' },
    { label: 'In progress', value: data?.inProgress ?? null, tone: 'amber', icon: 'progress-wrench', hint: 'Assigned to a crew' },
    { label: 'Overdue', value: data?.overdue ?? null, tone: 'red', icon: 'timer-alert-outline', hint: 'Past SLA deadline' },
    { label: 'Unverified', value: data?.communityReview ?? null, tone: 'rose', icon: 'account-question-outline', hint: 'Awaiting community quorum' },
    { label: 'Failed runs', value: data?.failed ?? null, tone: 'slate', icon: 'robot-off-outline', hint: 'Pipeline needs a retry' },
  ]

  return (
    <Screen
      scroll
      padded
      avoidKeyboard
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={summary.refreshing}
          onRefresh={() => summary.reload({ silent: true })}
          tintColor={accent.brand}
          colors={[accent.brand]}
        />
      }
    >
      <Card style={styles.identityCard}>
        <View style={styles.identityRow}>
          <View style={styles.identityText}>
            <Text variant="title" numberOfLines={1}>
              {displayName ?? 'Municipal user'}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {email ?? 'Signed in'}
            </Text>
          </View>
          <Chip label="Municipal" color={TONE_COLOR.blue} tint={TONE_TINT.blue} dense />
        </View>
      </Card>

      {summary.loading && !data ? (
        <LoadingState label="Reading the queue" />
      ) : summary.error && !data ? (
        <ErrorState
          title="Could not read the queue"
          message={summary.error}
          onRetry={() => summary.reload()}
        />
      ) : (
        <Card style={styles.metricsCard}>
          <Text variant="micro" weight="medium" tone="faint">
            Live queue
          </Text>
          <View style={styles.metricsGrid}>
            {metrics.map((metric, index) => (
              <View key={metric.label} style={[styles.metric, index % 2 === 0 && styles.metricLeft]}>
                <View style={styles.metricTop}>
                  <Icon name={metric.icon} size={15} color={TONE_COLOR[metric.tone]} />
                  <Text variant="micro" weight="medium" tone="muted">
                    {metric.label}
                  </Text>
                </View>
                <Text variant="display" weight="bold" mono tone={TONE_COLOR[metric.tone]}>
                  {metric.value ?? '—'}
                </Text>
                <Text variant="micro" tone="faint">
                  {metric.hint}
                </Text>
              </View>
            ))}
          </View>
          <Divider style={styles.divider} />
          <Text variant="caption" tone="faint">
            {data ? `${data.total} issues tracked in total.` : 'Totals unavailable.'}
          </Text>
        </Card>
      )}

      <Notice
        tone="blue"
        title="The full console runs on the web"
        body="Triage, internal comments, SLA tracking, the TSP field-crew route planner and Agent 5 predictive hotspots are implemented in the existing admin dashboard. This native screen is the entry point until that work is ported."
        icon={<Icon name="information-outline" size={15} color={accent.blue} />}
      />

      <View style={styles.actions}>
        <Button
          label="Open the web console"
          onPress={openWebConsole}
          size="lg"
          fullWidth
          icon={<Icon name="open-in-new" size={17} color="#ffffff" />}
        />
        <Button label="Sign out" onPress={confirmSignOut} variant="danger" fullWidth />
      </View>

      <Text variant="micro" tone="faint" mono center>
        {env.apiUrl || 'backend not configured'}
      </Text>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { gap: space.lg, paddingBottom: space.huge },
  identityCard: { backgroundColor: surface.card },
  identityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  identityText: { flex: 1, gap: 3 },
  metricsCard: { gap: space.md },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.lg },
  metric: {
    width: '50%',
    gap: 2,
    paddingLeft: space.lg,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: line.base,
  },
  metricLeft: { paddingLeft: 0, borderLeftWidth: 0 },
  metricTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  divider: { marginVertical: space.xs },
  actions: { gap: space.md },
})
