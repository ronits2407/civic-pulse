import React, { useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'

import { SeverityMeter } from '@/components/issues/SeverityMeter'
import { Button } from '@/components/ui/Button'
import { Card, Divider } from '@/components/ui/Card'
import { CategoryChip, Chip } from '@/components/ui/Chip'
import { Input } from '@/components/ui/Input'
import { Notice } from '@/components/ui/Feedback'
import { PressableScale } from '@/components/ui/PressableScale'
import { Text } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import { credibilityMeta, formatDistance, timeAgo } from '@/lib/format'
import type { VoteOutcome } from '@/lib/api/contracts'
import type { ReviewQueueItem } from '@/hooks/useReviewQueue'
import { TONE_COLOR, TONE_TINT, accent, ink, radius, space, surface, type Tone } from '@/theme/tokens'

/**
 * One community-verification card.
 *
 * The card's job is to give a stranger enough context to make an honest call in under
 * a minute: what is claimed, what the classifier thought, how credible Agent 3 judged
 * it and why, and how far away it is. The verdict buttons stay locked until a decision
 * is submitted, and the resolved state reports exactly what the server decided —
 * including that quorum may not be reached yet.
 */

const OUTCOME_COPY: Record<VoteOutcome, { title: string; body: string; tone: Tone }> = {
  confirmed: {
    title: 'Confirmed',
    body: 'Thank you. This report has the community backing it needs and moves forward to the department.',
    tone: 'emerald',
  },
  rejected: {
    title: 'Dismissed',
    body: 'Noted — the community does not think this report is valid, so it will not reach a department.',
    tone: 'rose',
  },
  pending: {
    title: 'Vote recorded',
    body: 'Three votes are needed to settle a report. Yours is in — the outcome now depends on your neighbours.',
    tone: 'blue',
  },
}

export function ReviewCard({
  item,
  onSubmit,
  submitting,
  locked,
}: {
  item: ReviewQueueItem
  onSubmit: (verdict: boolean, comment?: string) => Promise<VoteOutcome>
  submitting: boolean
  locked: VoteOutcome | undefined
}) {
  const [commentOpen, setCommentOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  const credibility = credibilityMeta(item.credibility_score)

  const submit = useCallback(
    async (verdict: boolean) => {
      setError(null)
      try {
        await onSubmit(verdict, commentOpen ? comment : undefined)
      } catch (err: any) {
        setError(err?.message ?? 'Could not record your vote.')
      }
    },
    [onSubmit, commentOpen, comment]
  )

  return (
    <Card style={styles.card}>
      {item.photo_url ? (
        <Image source={{ uri: item.photo_url }} style={styles.photo} contentFit="cover" transition={200} />
      ) : (
        <View style={styles.noPhoto}>
          <Icon name="image-off-outline" size={18} color={ink.faint} />
          <Text variant="caption" tone="faint">
            No photo was attached
          </Text>
        </View>
      )}

      <View style={styles.topRow}>
        <CategoryChip category={item.category} dense />
        <View style={styles.topRight}>
          {item.distanceMetres != null ? (
            <Chip
              label={`${formatDistance(item.distanceMetres)} away`}
              color={TONE_COLOR.slate}
              tint={TONE_TINT.slate}
              dense
            />
          ) : null}
          <Text variant="micro" tone="faint">
            {timeAgo(item.created_at)}
          </Text>
        </View>
      </View>

      <Text variant="title">
        {item.title?.trim() || 'Untitled report'}
      </Text>

      <Text variant="bodyTight" style={styles.description} numberOfLines={6}>
        {item.description}
      </Text>

      <Divider />

      {/* Agent view */}
      <View style={styles.agentBlock}>
        <SeverityMeter severity={item.severity} isEmergency={item.is_emergency ?? undefined} />

        <View style={styles.credibilityRow}>
          <Icon name="shield-check-outline" size={14} color={TONE_COLOR[credibility.tone as Tone]} />
          <Text variant="caption" weight="semibold" style={{ color: TONE_COLOR[credibility.tone as Tone] }}>
            {credibility.label} credibility
          </Text>
        </View>

        {item.reasoning ? (
          <View style={styles.reasoningBox}>
            <Text variant="caption" weight="semibold">
              Why this needs you
            </Text>
            <Text variant="caption" tone="muted" style={styles.reasoningText}>
              {item.reasoning}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Outcome or verdict */}
      {locked ? (
        <Notice
          tone={OUTCOME_COPY[locked].tone}
          title={OUTCOME_COPY[locked].title}
          body={OUTCOME_COPY[locked].body}
          icon={
            <Icon
              name={locked === 'rejected' ? 'close-circle-outline' : 'check-circle-outline'}
              size={15}
              color={TONE_COLOR[OUTCOME_COPY[locked].tone]}
            />
          }
        />
      ) : (
        <>
          {commentOpen ? (
            <Input
              label="Add a note (optional)"
              placeholder="What did you see?"
              value={comment}
              onChangeText={setComment}
              multiline
              maxLength={280}
              editable={!submitting}
              hint="Notes help the reporter understand the decision."
            />
          ) : (
            <PressableScale
              onPress={() => setCommentOpen(true)}
              haptic="tap"
              accessibilityRole="button"
              accessibilityLabel="Add a note"
            >
              <View style={styles.addNote}>
                <Icon name="comment-plus-outline" size={14} color={accent.blue} />
                <Text variant="micro" weight="semibold" style={{ color: accent.blue }}>
                  Add a note
                </Text>
              </View>
            </PressableScale>
          )}

          {error ? <Notice tone="red" body={error} /> : null}

          <View style={styles.verdictRow}>
            <Button
              label="It's real"
              onPress={() => submit(true)}
              loading={submitting}
              disabled={submitting}
              size="lg"
              style={styles.verdictButton}
              icon={<Icon name="check" size={18} color={ink.inverse} />}
            />
            <Button
              label="Not there"
              onPress={() => submit(false)}
              loading={submitting}
              disabled={submitting}
              variant="danger"
              size="lg"
              style={styles.verdictButton}
              icon={<Icon name="close" size={18} color={accent.red} />}
            />
          </View>

          <Text variant="micro" tone="faint" center>
            Three votes settle a report. You earn 2 karma for taking part.
          </Text>
        </>
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: space.md, padding: space.md, paddingBottom: space.lg },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  photo: { width: '100%', aspectRatio: 16 / 10, borderRadius: radius.md + 2 },
  noPhoto: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.xxl,
    borderRadius: radius.md + 2,
    backgroundColor: surface.sunken,
  },
  description: { lineHeight: 22 },
  agentBlock: { gap: space.md },
  credibilityRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reasoningBox: {
    gap: 4,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: surface.mist,
  },
  reasoningText: { lineHeight: 19 },
  addNote: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: space.xs },
  verdictRow: { flexDirection: 'row', gap: space.md },
  verdictButton: { flex: 1 },
})
