import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshControl, StyleSheet, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'

import {
  DetailSection,
  EvidenceImage,
  ExpandableText,
  FlagRow,
  InfoRow,
} from '@/components/issues/DetailSection'
import { SeverityMeter } from '@/components/issues/SeverityMeter'
import { PipelineTimeline } from '@/components/pipeline/PipelineRail'
import { Button } from '@/components/ui/Button'
import { Card, Divider } from '@/components/ui/Card'
import { CategoryChip, Chip, StatusPill } from '@/components/ui/Chip'
import { EmptyState, ErrorState, LoadingState, Notice } from '@/components/ui/Feedback'
import { Screen } from '@/components/ui/Screen'
import { Text } from '@/theme/Typography'
import { CATEGORY_ICON, FALLBACK_CATEGORY_ICON, Icon } from '@/theme/icons'
import { fetchDepartments } from '@/lib/api/issues-repo'
import { credibilityMeta, formatCoordinates, formatDateTime, slaMeta, timeAgo } from '@/lib/format'
import { deriveProgress } from '@/lib/pipeline'
import { useIssueDetail } from '@/hooks/useIssueDetail'
import {
  CATEGORY_META,
  FALLBACK_CATEGORY,
  TONE_COLOR,
  TONE_TINT,
  accent,
  ink,
  space,
  type Tone,
} from '@/theme/tokens'
import type { Department } from '@/types/civicpulse'

/**
 * Issue detail.
 *
 * This screen is where the product's claim is cashed: everything the six agents
 * produced is shown, in the order a citizen would ask about it. Current state first
 * (status, SLA, pipeline), then the evidence and what the agents made of it, then the
 * action brief, then the bookkeeping.
 *
 * Machine output is never relabelled into something prettier than it is — a failed
 * stage says it failed.
 */
export default function IssueDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>()
  const issueId = typeof params.id === 'string' ? params.id : null
  const router = useRouter()

  const { issue, loading, error, reload, refreshing, realtime, retry, retrying, retryError, canRetry } =
    useIssueDetail(issueId)

  const [departments, setDepartments] = useState<Department[]>([])
  const [briefLanguage, setBriefLanguage] = useState<'en' | 'local'>('en')

  // Departments are near-static reference data; one fetch per mount is plenty.
  useEffect(() => {
    let cancelled = false
    fetchDepartments()
      .then((rows) => {
        if (!cancelled) setDepartments(rows)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const departmentName = useMemo(() => {
    if (!issue?.department_id) return null
    return departments.find((d) => d.id === issue.department_id)?.name ?? null
  }, [issue?.department_id, departments])

  const onRefresh = useCallback(() => reload({ silent: true }), [reload])

  if (!issueId) {
    return (
      <Screen padded>
        <EmptyState title="Report not found" body="This link does not point at a report." />
      </Screen>
    )
  }

  if (loading && !issue) {
    return (
      <Screen padded>
        <LoadingState label="Loading report" />
      </Screen>
    )
  }

  if (error && !issue) {
    return (
      <Screen padded>
        <ErrorState title="Could not load this report" message={error} onRetry={() => reload()} />
      </Screen>
    )
  }

  if (!issue) {
    return (
      <Screen padded>
        <EmptyState
          title="Report not found"
          body="It may have been removed, or you may not have access to it."
          actionLabel="Back to home"
          onAction={() => router.replace('/(citizen)')}
        />
      </Screen>
    )
  }

  const categoryMeta = (issue.category && CATEGORY_META[issue.category]) || FALLBACK_CATEGORY
  const categoryIcon = (issue.category && CATEGORY_ICON[issue.category]) || FALLBACK_CATEGORY_ICON
  const progress = deriveProgress(issue.pipeline_stage)
  const sla = slaMeta(issue.sla_deadline, issue.status)
  const credibility = credibilityMeta(issue.credibility_score)
  const isDuplicate = Boolean(issue.cluster_id)
  const hasLocalBrief = Boolean(issue.local_civic_brief)

  return (
    <>
      {/* Title in the native header keeps the screen anchored while scrolling. */}
      <Stack.Screen options={{ title: issue.title?.trim() || 'Report detail' }} />

      <Screen
        scroll
        padded
        edges={['bottom']}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent.brand} colors={[accent.brand]} />
        }
      >
        {/* ── Identity ─────────────────────────────────────────────────────── */}
        <View style={styles.identityRow}>
          <StatusPill status={issue.status} />
          <CategoryChip category={issue.category} />
          {issue.is_emergency ? (
            <Chip label="Emergency" color={TONE_COLOR.red} tint={TONE_TINT.red} dense />
          ) : null}
        </View>

        <Text variant="title">{issue.title?.trim() || 'Untitled report'}</Text>

        <View style={styles.metaLine}>
          <Icon name="map-marker-outline" size={13} color={ink.faint} />
          <Text variant="caption" tone="muted" numberOfLines={2} style={styles.metaText}>
            {issue.address?.trim() || 'Location recorded'}
          </Text>
        </View>

        <View style={styles.metaLine}>
          <Icon name="clock-outline" size={13} color={ink.faint} />
          <Text variant="caption" tone="faint">
            Reported {timeAgo(issue.created_at)}
            {issue.resolved_at ? ` · resolved ${timeAgo(issue.resolved_at)}` : ''}
          </Text>
        </View>

        {/* ── Live state ───────────────────────────────────────────────────── */}
        <Card style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={styles.statusText}>
              <Text variant="heading" weight="semibold">
                {progress.label}
              </Text>
              <Text variant="caption" tone="faint">
                {progress.detail}
              </Text>
            </View>
            <Chip
              label={realtime === 'live' ? 'Live' : 'Snapshot'}
              color={realtime === 'live' ? TONE_COLOR.emerald : TONE_COLOR.amber}
              tint={realtime === 'live' ? TONE_TINT.emerald : TONE_TINT.amber}
              dense
              icon={
                <View
                  style={[
                    styles.liveDot,
                    { backgroundColor: realtime === 'live' ? TONE_COLOR.emerald : TONE_COLOR.amber },
                  ]}
                />
              }
            />
          </View>

          <Divider style={styles.cardDivider} />

          <View style={styles.slaRow}>
            <View style={styles.slaCell}>
              <Text variant="micro" weight="medium" tone="faint">
                RESOLUTION DEADLINE
              </Text>
              <Text
                variant="dataLg"
                weight="semibold"
                style={{ color: TONE_COLOR[sla.tone as Tone] }}
              >
                {sla.label}
              </Text>
              {issue.sla_deadline ? (
                <Text variant="micro" tone="faint">
                  due {formatDateTime(issue.sla_deadline)}
                </Text>
              ) : null}
            </View>
            <View style={styles.slaCell}>
              <Text variant="micro" weight="medium" tone="faint">
                SEVERITY
              </Text>
              <SeverityMeter severity={issue.severity} isEmergency={issue.is_emergency} />
            </View>
          </View>

          {progress.failed && canRetry ? (
            <>
              <Divider style={styles.cardDivider} />
              <View style={styles.retryBlock}>
                <Text variant="caption" tone="muted">
                  The pipeline stopped at this step. Restarting it re-runs from where it
                  failed rather than from the beginning.
                </Text>
                <Button
                  label="Restart pipeline"
                  onPress={retry}
                  loading={retrying}
                  variant="secondary"
                  size="sm"
                  icon={<Icon name="refresh" size={15} color={ink.base} />}
                />
              </View>
            </>
          ) : null}
        </Card>

        {retryError ? <Notice tone="red" body={retryError} title="Could not restart" /> : null}

        {/* ── Evidence ─────────────────────────────────────────────────────── */}
        {issue.photo_url ? (
          <EvidenceImage uri={issue.photo_url} caption="Photo attached to the original report" />
        ) : null}

        {issue.description ? (
          <DetailSection title="Your report" icon="text-box-outline">
            <Text variant="bodyTight" style={styles.prose}>
              {issue.description}
            </Text>
            {issue.original_language && issue.original_language.toLowerCase() !== 'english' ? (
              <FlagRow>
                <Chip label={`Written in ${issue.original_language}`} color={accent.blue} tint={TONE_TINT.blue} dense />
              </FlagRow>
            ) : null}
          </DetailSection>
        ) : null}

        {/* ── Agent reasoning ──────────────────────────────────────────────── */}
        <DetailSection
          title="What the agents did"
          icon="robot-outline"
          hint="Each agent writes its result to the report as it runs."
          tone={accent.brand}
        >
          <PipelineTimeline stage={issue.pipeline_stage} isDuplicate={isDuplicate} />
        </DetailSection>

        {/* ── Duplicate / cluster ──────────────────────────────────────────── */}
        {isDuplicate ? (
          <Notice
            tone="blue"
            title="Merged with a nearby report"
            body="Agent 2 found the same problem already reported within 200 m and merged this into that case, so the department sees it once."
            icon={<Icon name="layers-outline" size={15} color={accent.blue} />}
          />
        ) : null}

        {/* ── Credibility ──────────────────────────────────────────────────── */}
        {issue.credibility_score != null || issue.reasoning ? (
          <DetailSection title="Credibility check" icon="shield-check-outline" tone={TONE_COLOR[credibility.tone as Tone]}>
            <View style={styles.credibilityHeader}>
              <Text variant="dataLg" weight="semibold" style={{ color: TONE_COLOR[credibility.tone as Tone] }}>
                {credibility.label}
              </Text>
              <View style={styles.credibilityFlags}>
                {issue.weather_checked ? (
                  <Chip label="Weather" color={accent.teal} tint={TONE_TINT.emerald} dense />
                ) : null}
                {issue.web_search_checked ? (
                  <Chip label="Local news" color={accent.blue} tint={TONE_TINT.blue} dense />
                ) : null}
              </View>
            </View>
            {issue.reasoning ? (
              <ExpandableText text={issue.reasoning} collapsedLines={4} />
            ) : (
              <Text variant="caption" tone="faint">
                No reasoning recorded for this report.
              </Text>
            )}
            {issue.needs_community_verification ? (
              <Notice
                tone="amber"
                body="Credibility came in below 6/10, so this report waits for neighbours to confirm it before reaching the department."
                style={styles.innerNotice}
              />
            ) : null}
          </DetailSection>
        ) : null}

        {/* ── Action brief ─────────────────────────────────────────────────── */}
        {issue.civic_brief ? (
          <DetailSection title="Civic action brief" icon="file-document-outline" tone={accent.brand}>
            {hasLocalBrief ? (
              <View style={styles.briefToggle}>
                <Button
                  label="English"
                  size="sm"
                  variant={briefLanguage === 'en' ? 'primary' : 'subtle'}
                  onPress={() => setBriefLanguage('en')}
                />
                <Button
                  label={issue.original_language ?? 'Local'}
                  size="sm"
                  variant={briefLanguage === 'local' ? 'primary' : 'subtle'}
                  onPress={() => setBriefLanguage('local')}
                />
              </View>
            ) : null}
            <ExpandableText
              text={
                briefLanguage === 'local' && issue.local_civic_brief
                  ? issue.local_civic_brief
                  : issue.civic_brief
              }
              collapsedLines={8}
            />
          </DetailSection>
        ) : null}

        {/* ── Routing ──────────────────────────────────────────────────────── */}
        <DetailSection title="Assignment" icon="office-building-outline">
          <InfoRow
            label="Category"
            value={
              issue.subcategory
                ? `${categoryMeta.label} · ${issue.subcategory.replace(/_/g, ' ')}`
                : categoryMeta.label
            }
          />
          <InfoRow label="Department" value={departmentName ?? 'Not yet assigned'} />
          <InfoRow
            label="Pipeline stage"
            value={issue.pipeline_stage ?? 'not started'}
            mono
            tone={progress.failed ? TONE_COLOR.red : undefined}
          />
          <InfoRow label="Cluster" value={issue.cluster_id ? issue.cluster_id.slice(0, 8) : 'None'} mono last />
        </DetailSection>

        {/* ── Timeline ─────────────────────────────────────────────────────── */}
        <DetailSection title="Timeline" icon="clock-outline">
          <InfoRow label="Reported" value={formatDateTime(issue.created_at)} />
          <InfoRow
            label="Location"
            value={issue.location ? formatCoordinates(issue.location.lat, issue.location.lng) : 'Unknown'}
            mono
          />
          {issue.sla_deadline ? <InfoRow label="Deadline" value={formatDateTime(issue.sla_deadline)} /> : null}
          <InfoRow
            label="Resolved"
            value={issue.resolved_at ? formatDateTime(issue.resolved_at) : 'Not resolved'}
            tone={issue.resolved_at ? TONE_COLOR.emerald : undefined}
            last
          />
        </DetailSection>

        {/* ── Receipt ──────────────────────────────────────────────────────── */}
        {issue.status === 'resolved' ? (
          <Card style={styles.receiptCard}>
            <View style={styles.receiptRow}>
              <View style={styles.receiptText}>
                <Text variant="heading" weight="semibold">
                  This one is done
                </Text>
                <Text variant="caption" tone="faint">
                  Generate a shareable impact receipt for it.
                </Text>
              </View>
              <Button
                label="Receipt"
                size="sm"
                onPress={() => router.push({ pathname: '/receipt', params: { issueId: issue.id } })}
                icon={<Icon name="share-variant-outline" size={15} color="#ffffff" />}
              />
            </View>
          </Card>
        ) : null}

        {/* ── Category footer ──────────────────────────────────────────────── */}
        <View style={styles.footerRow}>
          <Icon name={categoryIcon} size={13} color={categoryMeta.color} />
          <Text variant="micro" tone="faint">
            {categoryMeta.label} · report {issue.id.slice(0, 8)}
          </Text>
        </View>
      </Screen>
    </>
  )
}

const styles = StyleSheet.create({
  content: { gap: space.lg, paddingBottom: space.huge },
  identityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  metaLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: -space.sm },
  metaText: { flex: 1 },
  statusCard: { gap: space.md },
  statusHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md },
  statusText: { flex: 1, gap: 3 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  cardDivider: { marginVertical: 0 },
  slaRow: { flexDirection: 'row', gap: space.lg },
  slaCell: { flex: 1, gap: space.xs },
  retryBlock: { gap: space.md },
  prose: { lineHeight: 22 },
  credibilityHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, flexWrap: 'wrap', marginBottom: space.xs },
  credibilityFlags: { flexDirection: 'row', gap: space.sm },
  innerNotice: { marginTop: space.md },
  briefToggle: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  receiptCard: { gap: space.md },
  receiptRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  receiptText: { flex: 1, gap: 2 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: space.sm },
})
