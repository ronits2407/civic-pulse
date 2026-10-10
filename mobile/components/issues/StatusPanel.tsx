import React from 'react'
import { StyleSheet, View } from 'react-native'

import { SeverityMeter } from '@/components/issues/SeverityMeter'
import { Rail } from '@/components/pipeline/Rail'
import { Button } from '@/components/ui/Button'
import { Card, Divider } from '@/components/ui/Card'
import { Text } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import { deriveProgress } from '@/lib/pipeline'
import { formatDateTime, slaMeta } from '@/lib/format'
import type { DecodedIssue } from '@/lib/api/issues-repo'
import { accent, ink, radius, space, surface } from '@/theme/tokens'

/**
 * The live state of a report on navy: what the agents are doing, the deadline and the
 * severity, plus a restart control when a step failed. This mirrors Home's hero card so
 * the same report always looks the same.
 */
export function StatusPanel({
  issue,
  live,
  canRetry,
  retrying,
  onRetry,
}: {
  issue: DecodedIssue
  live: boolean
  canRetry: boolean
  retrying: boolean
  onRetry: () => void
}) {
  const progress = deriveProgress(issue.pipeline_stage)
  const sla = slaMeta(issue.sla_deadline, issue.status)

  return (
    <Card variant="hero" style={styles.card}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <Text variant="heading" tone="inverse">
            {progress.label}
          </Text>
          <Text variant="caption" tone="inverseMuted">
            {progress.detail}
          </Text>
        </View>
        <View style={styles.live}>
          <View style={[styles.dot, { backgroundColor: live ? '#7BE0A6' : accent.kerb }]} />
          <Text variant="micro" weight="semibold" tone="inverse">
            {live ? 'Live' : 'Snapshot'}
          </Text>
        </View>
      </View>

      <Rail stage={issue.pipeline_stage} isDuplicate={Boolean(issue.cluster_id)} tone="onDark" />

      <Divider inverse />

      <View style={styles.figures}>
        <View style={styles.flex}>
          <Text variant="caption" tone="inverseMuted">
            Deadline
          </Text>
          <Text variant="dataLg" tone="inverse">
            {sla.label}
          </Text>
          {issue.sla_deadline ? (
            <Text variant="micro" tone="inverseMuted">
              Due {formatDateTime(issue.sla_deadline)}
            </Text>
          ) : null}
        </View>
        <View style={styles.severity}>
          <Text variant="caption" tone="inverseMuted">
            Severity
          </Text>
          <View style={styles.meterWell}>
            <SeverityMeter severity={issue.severity} isEmergency={issue.is_emergency} />
          </View>
        </View>
      </View>

      {progress.failed && canRetry ? (
        <View style={styles.retry}>
          <Text variant="caption" tone="inverseMuted">
            The pipeline stopped at this step. Restarting re-runs it from where it failed, not from the beginning.
          </Text>
          <Button
            label="Restart pipeline"
            onPress={onRetry}
            loading={retrying}
            variant="secondary"
            size="sm"
            icon={<Icon name="refresh" size={16} color={ink.base} />}
          />
        </View>
      ) : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: space.lg, padding: space.xl, borderRadius: radius.xl },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  flex: { flex: 1, gap: 2 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: surface.heroRaised },
  dot: { width: 7, height: 7, borderRadius: 4 },
  figures: { flexDirection: 'row', gap: space.lg },
  severity: { flex: 1.2, gap: space.xs },
  meterWell: { backgroundColor: surface.card, borderRadius: radius.sm, padding: space.sm },
  retry: { gap: space.md, alignItems: 'flex-start' },
})
