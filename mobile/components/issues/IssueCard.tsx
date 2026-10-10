import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'

import { Chip, StatusPill } from '@/components/ui/Chip'
import { Card } from '@/components/ui/Card'
import { PressableScale } from '@/components/ui/PressableScale'
import { Rail } from '@/components/pipeline/Rail'
import { Text } from '@/theme/Typography'
import { CATEGORY_ICON, FALLBACK_CATEGORY_ICON, Icon } from '@/theme/icons'
import { severityMeta, slaMeta, timeAgo } from '@/lib/format'
import { deriveProgress } from '@/lib/pipeline'
import { CATEGORY_META, FALLBACK_CATEGORY, radius, space, TONE_COLOR, TONE_TINT, type Tone } from '@/theme/tokens'
import type { DecodedIssue } from '@/lib/api/issues-repo'

/**
 * A citizen's report, summarised.
 *
 * Photo (or category tile) on the left, so a list scans by picture first. Then what and
 * where, a status pill and SLA, and the agent rail as a footer in the same place on
 * every card, so a list reads like an instrument panel.
 */
export function IssueCard({
  issue,
  onPress,
}: {
  issue: DecodedIssue
  onPress: (issue: DecodedIssue) => void
  /** Kept for call-site compatibility; entrance animation is applied by the list. */
  index?: number
}) {
  const categoryMeta = (issue.category && CATEGORY_META[issue.category]) || FALLBACK_CATEGORY
  const categoryIcon = (issue.category && CATEGORY_ICON[issue.category]) || FALLBACK_CATEGORY_ICON
  const isDuplicate = Boolean(issue.cluster_id)
  const progress = deriveProgress(issue.pipeline_stage)
  const sla = slaMeta(issue.sla_deadline, issue.status)
  const severity = severityMeta(issue.severity, issue.is_emergency)
  const title = issue.title?.trim() || 'Untitled report'

  return (
    <PressableScale
      onPress={() => onPress(issue)}
      haptic="tap"
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${categoryMeta.label}. ${progress.label}.`}
    >
      <Card style={styles.card}>
        <View style={styles.top}>
          {issue.photo_url ? (
            <Image source={{ uri: issue.photo_url }} style={styles.thumb} contentFit="cover" transition={200} alt={`Photo of ${title}`} />
          ) : (
            <View style={[styles.thumb, styles.thumbIcon, { backgroundColor: categoryMeta.tint }]}>
              <Icon name={categoryIcon} size={26} color={categoryMeta.color} />
            </View>
          )}
          <View style={styles.text}>
            <Text variant="caption" weight="semibold" style={{ color: categoryMeta.color }} numberOfLines={1}>
              {categoryMeta.label}
              {issue.severity ? `  ·  ${severity.label}` : ''}
            </Text>
            <Text variant="heading" numberOfLines={2}>
              {title}
            </Text>
            <Text variant="caption" tone="faint" numberOfLines={1}>
              {issue.address?.trim() || 'Location recorded'}  ·  {timeAgo(issue.created_at)}
            </Text>
          </View>
        </View>

        <View style={styles.pills}>
          <StatusPill status={issue.status} dense />
          <Chip
            label={sla.label}
            color={TONE_COLOR[sla.tone as Tone]}
            tint={TONE_TINT[sla.tone as Tone]}
            dense
            icon={<Icon name="clock-outline" size={12} color={TONE_COLOR[sla.tone as Tone]} />}
          />
          {issue.is_emergency ? <Chip label="Emergency" color={TONE_COLOR.red} tint={TONE_TINT.red} dense /> : null}
        </View>

        <Rail stage={issue.pipeline_stage} isDuplicate={isDuplicate} style={styles.rail} />
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {progress.label}
        </Text>
      </Card>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  top: { flexDirection: 'row', gap: space.md },
  thumb: { width: 76, height: 76, borderRadius: radius.md },
  thumbIcon: { alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2, justifyContent: 'center' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  rail: { marginTop: space.xs },
})
