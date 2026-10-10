import React, { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { DetailSection, ExpandableText } from '@/components/issues/DetailSection'
import { Chip } from '@/components/ui/Chip'
import { Notice } from '@/components/ui/Feedback'
import { Segmented } from '@/components/ui/Segmented'
import { Text } from '@/theme/Typography'
import { credibilityMeta } from '@/lib/format'
import type { DecodedIssue } from '@/lib/api/issues-repo'
import { TONE_COLOR, TONE_TINT, accent, space, type Tone } from '@/theme/tokens'

/** Agent 3's verdict: the score, which sources it checked, and its reasoning verbatim. */
export function CredibilitySection({ issue }: { issue: DecodedIssue }) {
  if (issue.credibility_score == null && !issue.reasoning) return null
  const credibility = credibilityMeta(issue.credibility_score)
  const tone = TONE_COLOR[credibility.tone as Tone]
  return (
    <DetailSection title="Credibility check" icon="shield-check-outline" tone={tone}>
      <View style={styles.head}>
        <Text variant="dataLg" style={{ color: tone }}>
          {credibility.label}
        </Text>
        <View style={styles.flags}>
          {issue.weather_checked ? <Chip label="Weather checked" color={accent.teal} tint={TONE_TINT.emerald} dense /> : null}
          {issue.web_search_checked ? <Chip label="Local news checked" color={accent.blue} tint={TONE_TINT.blue} dense /> : null}
        </View>
      </View>
      {issue.reasoning ? (
        <ExpandableText text={issue.reasoning} collapsedLines={4} />
      ) : (
        <Text variant="caption" tone="faint">
          No reasoning was recorded for this report.
        </Text>
      )}
      {issue.needs_community_verification ? (
        <Notice
          tone="amber"
          body="Credibility came in below 6/10, so neighbours confirm this report before it reaches the department."
          style={styles.inner}
        />
      ) : null}
    </DetailSection>
  )
}

/** Agent 4's civic action brief, with a language switch when a local version exists. */
export function BriefSection({ issue }: { issue: DecodedIssue }) {
  const [lang, setLang] = useState<'en' | 'local'>('en')
  if (!issue.civic_brief) return null
  const text = lang === 'local' && issue.local_civic_brief ? issue.local_civic_brief : issue.civic_brief
  return (
    <DetailSection title="Civic action brief" icon="file-document-outline">
      {issue.local_civic_brief ? (
        <View style={styles.inner}>
          <Segmented
            value={lang}
            onChange={setLang}
            options={[
              { value: 'en', label: 'English' },
              { value: 'local', label: issue.original_language ?? 'Local' },
            ]}
          />
        </View>
      ) : null}
      <ExpandableText text={text} collapsedLines={8} />
    </DetailSection>
  )
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, flexWrap: 'wrap', marginBottom: space.sm },
  flags: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  inner: { marginTop: space.sm, marginBottom: space.sm },
})
