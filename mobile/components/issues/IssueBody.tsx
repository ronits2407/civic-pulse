import React from 'react'
import { StyleSheet, View } from 'react-native'

import { BriefSection, CredibilitySection } from '@/components/issues/AgentSections'
import { DetailSection, FlagRow, InfoRow } from '@/components/issues/DetailSection'
import { Timeline } from '@/components/pipeline/Timeline'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Notice } from '@/components/ui/Feedback'
import { Rise } from '@/components/ui/Motion'
import { Text } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import { formatCoordinates, formatDateTime } from '@/lib/format'
import { deriveProgress } from '@/lib/pipeline'
import type { DecodedIssue } from '@/lib/api/issues-repo'
import { CATEGORY_META, FALLBACK_CATEGORY, TONE_COLOR, TONE_TINT, accent, space } from '@/theme/tokens'

/**
 * Everything below the status panel, in the order a citizen asks: what did I say, what
 * did the agents make of it, what will the city do, who has it, and when.
 * Machine output is never relabelled into something prettier than it is.
 */
export function IssueBody({
  issue,
  departmentName,
  onReceipt,
}: {
  issue: DecodedIssue
  departmentName: string | null
  onReceipt: () => void
}) {
  const categoryMeta = (issue.category && CATEGORY_META[issue.category]) || FALLBACK_CATEGORY
  const progress = deriveProgress(issue.pipeline_stage)
  const translated = issue.original_language && issue.original_language.toLowerCase() !== 'english'

  return (
    <View style={styles.stack}>
      {issue.description ? (
        <Rise index={1}>
          <DetailSection title="Your report" icon="text-box-outline">
            <Text variant="body" style={styles.prose}>
              {issue.description}
            </Text>
            {translated ? (
              <FlagRow>
                <Chip label={`Written in ${issue.original_language}`} color={accent.blue} tint={TONE_TINT.blue} dense />
              </FlagRow>
            ) : null}
          </DetailSection>
        </Rise>
      ) : null}

      {issue.cluster_id ? (
        <Notice
          tone="blue"
          title="Merged with a nearby report"
          body="The same problem was already reported within 200 m, so this was merged into that case and the department sees it once."
          icon={<Icon name="layers-outline" size={16} color={accent.blue} />}
        />
      ) : null}

      <Rise index={2}>
        <DetailSection title="What the agents did" icon="robot-outline">
          <Timeline stage={issue.pipeline_stage} isDuplicate={Boolean(issue.cluster_id)} />
        </DetailSection>
      </Rise>

      <Rise index={3}>
        <CredibilitySection issue={issue} />
      </Rise>

      <Rise index={4}>
        <BriefSection issue={issue} />
      </Rise>

      <Rise index={5}>
        <DetailSection title="Assignment" icon="office-building-outline">
          <InfoRow
            label="Category"
            value={issue.subcategory ? `${categoryMeta.label}, ${issue.subcategory.replace(/_/g, ' ')}` : categoryMeta.label}
          />
          <InfoRow label="Department" value={departmentName ?? 'Not yet assigned'} />
          <InfoRow
            label="Pipeline stage"
            value={issue.pipeline_stage ?? 'not started'}
            mono
            tone={progress.failed ? TONE_COLOR.red : undefined}
          />
          <InfoRow label="Reported" value={formatDateTime(issue.created_at)} />
          <InfoRow
            label="Coordinates"
            value={issue.location ? formatCoordinates(issue.location.lat, issue.location.lng) : 'Unknown'}
            mono
          />
          <InfoRow
            label="Resolved"
            value={issue.resolved_at ? formatDateTime(issue.resolved_at) : 'Not yet'}
            tone={issue.resolved_at ? TONE_COLOR.emerald : undefined}
            last
          />
        </DetailSection>
      </Rise>

      {issue.status === 'resolved' ? (
        <Button label="Share an impact receipt" onPress={onReceipt} size="lg" fullWidth trailingArrow />
      ) : null}

      <Text variant="micro" tone="faint" center>
        Report {issue.id.slice(0, 8)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  prose: { lineHeight: 25 },
})
