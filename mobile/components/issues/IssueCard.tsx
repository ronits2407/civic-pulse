import React from 'react'
import { StyleSheet, View } from 'react-native'

import { SeverityMeter } from '@/components/issues/SeverityMeter'
import { Chip, CategoryChip, StatusPill } from '@/components/ui/Chip'
import { Card } from '@/components/ui/Card'
import { PressableScale } from '@/components/ui/PressableScale'
import { PipelineRail } from '@/components/pipeline/PipelineRail'
import { Text } from '@/theme/Typography'
import { CATEGORY_ICON, FALLBACK_CATEGORY_ICON, Icon } from '@/theme/icons'


import { slaMeta, timeAgo } from '@/lib/format'
import { deriveProgress } from '@/lib/pipeline'
import { CATEGORY_META, FALLBACK_CATEGORY, ink, space, TONE_COLOR, TONE_TINT, type Tone } from '@/theme/tokens'
import type { DecodedIssue } from '@/lib/api/issues-repo'

/**
 * A citizen's report, summarised.
 *
 * Reading order is deliberate: what and where (title, place), how bad (severity),
 * how far along (pipeline rail), and when (timestamp). The pipeline rail is the last
 * visual band before the edge of the card so it acts as the card's footer — the same
 * position on every card, so scanning a list feels like reading an instrument panel.
 */

export function IssueCard({
  issue,
  onPress,
  index = 0,
}: {
  issue: DecodedIssue
  onPress: (issue: DecodedIssue) => void
  /** Position in the list — revealed with a small stagger on mount. */
  index?: number
}) {
  const categoryMeta = (issue.category && CATEGORY_META[issue.category]) || FALLBACK_CATEGORY
  const categoryIcon = (issue.category && CATEGORY_ICON[issue.category]) || FALLBACK_CATEGORY_ICON
  const isDuplicate = Boolean(issue.cluster_id)
  const progress = deriveProgress(issue.pipeline_stage)
  const sla = slaMeta(issue.sla_deadline, issue.status)

  const title = issue.title?.trim() || 'Untitled report'

  return (
    <PressableScale
      onPress={() => onPress(issue)}
      haptic="tap"
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${categoryMeta.label}. ${progress.label}.`}
    >
      <Card accentColor={categoryMeta.color} style={styles.card}>
        {/* Category + status */}
        <View style={styles.topRow}>
          <View style={styles.topLeft}>
            <Icon name={categoryIcon} size={13} color={categoryMeta.color} />
            <CategoryChip category={issue.category} dense />
          </View>
          <StatusPill status={issue.status} dense />
        </View>

        {/* Title */}
        <Text variant="heading" weight="semibold" numberOfLines={2} style={styles.title}>
          {title}
        </Text>

        {/* Location */}
        <View style={styles.locationRow}>
          <Icon name="map-marker-outline" size={13} color={ink.faint} />
          <Text variant="caption" tone="muted" numberOfLines={1} style={styles.locationText}>
            {issue.address?.trim() || 'Location recorded'}
          </Text>
        </View>

        {/* Severity + SLA */}
        <View style={styles.metricsRow}>
          <View style={styles.severityCol}>
            <SeverityMeter severity={issue.severity} isEmergency={issue.is_emergency} />
          </View>
          <Chip
            label={sla.label}
            color={TONE_COLOR[sla.tone as Tone]}
            tint={TONE_TINT[sla.tone as Tone]}
            dense
            icon={<Icon name="clock-outline" size={11} color={TONE_COLOR[sla.tone as Tone]} />}
          />
        </View>

        {/* Signature rail + timestamp */}
        <View style={styles.footer}>
          <PipelineRail
            stage={issue.pipeline_stage}
            isDuplicate={isDuplicate}
            showLabels
            style={styles.rail}
          />
        </View>

        <View style={styles.metaRow}>
          <Text variant="micro" tone="faint" numberOfLines={1} style={styles.progressText}>
            {progress.label}
          </Text>
          <Text variant="micro" tone="faint" numberOfLines={1}>
            {timeAgo(issue.created_at)}
          </Text>
        </View>
      </Card>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  title: { marginTop: -2 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: -4 },
  locationText: { flex: 1 },
  metricsRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md },
  severityCol: { flex: 1, maxWidth: '58%' },
  footer: { marginTop: space.xs },
  rail: { paddingHorizontal: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, marginTop: -space.xs },
  progressText: { flexShrink: 1 },
})
