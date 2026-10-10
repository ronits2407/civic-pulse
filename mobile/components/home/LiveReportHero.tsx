import React from 'react'
import { StyleSheet, View } from 'react-native'

import { Rail } from '@/components/pipeline/Rail'
import { Card } from '@/components/ui/Card'
import { PressableScale } from '@/components/ui/PressableScale'
import { Text } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import { deriveProgress } from '@/lib/pipeline'
import { slaMeta, timeAgo } from '@/lib/format'
import type { DecodedIssue } from '@/lib/api/issues-repo'
import { accent, ink, radius, space, surface } from '@/theme/tokens'

/**
 * Home's one bold element: the report you filed most recently, on deep navy, with the
 * five agents drawn across it and the step running now glowing kerb amber.
 *
 * With no reports yet it becomes the invitation to file the first one, so the most
 * important card on Home is never empty.
 */
export function LiveReportHero({
  issue,
  onOpen,
  onReport,
}: {
  issue: DecodedIssue | null
  onOpen: (issue: DecodedIssue) => void
  onReport: () => void
}) {
  if (!issue) {
    return (
      <PressableScale onPress={onReport} haptic="press" accessibilityRole="button" accessibilityLabel="Report your first issue">
        <Card variant="hero" style={styles.card}>
          <Text variant="caption" tone="inverseMuted">
            Spotted something broken?
          </Text>
          <Text variant="display" tone="inverse" style={styles.headline}>
            Report it in under a minute
          </Text>
          <Text variant="bodyTight" tone="inverseMuted">
            A photo and a sentence is enough. Five AI agents route it to the right department.
          </Text>
          <View style={styles.cta}>
            <Text variant="bodyTight" weight="semibold" tone="inverse">
              Start a report
            </Text>
            <View style={styles.arrow}>
              <Icon name="arrow-right" size={20} color={ink.base} />
            </View>
          </View>
        </Card>
      </PressableScale>
    )
  }

  const progress = deriveProgress(issue.pipeline_stage)
  const sla = slaMeta(issue.sla_deadline, issue.status)

  return (
    <PressableScale onPress={() => onOpen(issue)} haptic="tap" accessibilityRole="button" accessibilityLabel={`Your latest report: ${issue.title ?? 'report'}. ${progress.label}`}>
      <Card variant="hero" style={styles.card}>
        <View style={styles.topRow}>
          <Text variant="caption" tone="inverseMuted">
            Your latest report · {timeAgo(issue.created_at)}
          </Text>
          <View style={[styles.live, progress.failed && styles.liveFailed]}>
            <View style={[styles.liveDot, { backgroundColor: progress.failed ? '#FF8A7A' : progress.complete ? '#7BE0A6' : accent.kerb }]} />
            <Text variant="micro" weight="semibold" tone="inverse">
              {progress.failed ? 'Needs you' : progress.complete ? 'With the city' : 'Agents working'}
            </Text>
          </View>
        </View>

        <Text variant="title" tone="inverse" numberOfLines={2} style={styles.headline}>
          {issue.title?.trim() || 'Untitled report'}
        </Text>

        <Rail stage={issue.pipeline_stage} isDuplicate={Boolean(issue.cluster_id)} tone="onDark" style={styles.rail} />

        <View style={styles.footer}>
          <View style={styles.flex}>
            <Text variant="bodyTight" weight="semibold" tone="inverse" numberOfLines={1}>
              {progress.label}
            </Text>
            <Text variant="caption" tone="inverseMuted" numberOfLines={1}>
              {sla.hoursRemaining != null || sla.overdue ? `Deadline: ${sla.label}` : sla.label}
            </Text>
          </View>
          <View style={styles.arrow}>
            <Icon name="arrow-right" size={20} color={ink.base} />
          </View>
        </View>
      </Card>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  card: { padding: space.xl, gap: space.sm, borderRadius: radius.xl },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: surface.heroRaised,
  },
  liveFailed: { backgroundColor: 'rgba(255,138,122,0.18)' },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  headline: { marginTop: space.xs },
  rail: { marginTop: space.lg, marginBottom: space.sm },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  flex: { flex: 1, gap: 1 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.lg },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
