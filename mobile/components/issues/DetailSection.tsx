import React, { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'

import { Card, Divider } from '@/components/ui/Card'
import { PressableScale } from '@/components/ui/PressableScale'
import { Text } from '@/theme/Typography'
import { Icon, type IconName } from '@/theme/icons'
import { accent, line, radius, space, surface } from '@/theme/tokens'

/**
 * Building blocks for the issue detail screen.
 *
 * The detail view carries a lot of machine output — five agents' worth of it — so the
 * structure has to do the work of separating prose from figures and current state from
 * history. Sections are titled, bordered and consistently spaced for that reason.
 */

export function DetailSection({
  title,
  icon,
  children,
  tone,
  hint,
}: {
  title: string
  icon?: IconName
  children: React.ReactNode
  tone?: string
  hint?: string
}) {
  return (
    <Card style={styles.section}>
      <View style={styles.sectionHeader}>
        {icon ? <Icon name={icon} size={15} color={tone ?? accent.slate} /> : null}
        <Text variant="heading" weight="semibold" style={{ color: tone ?? undefined }}>
          {title}
        </Text>
      </View>
      {hint ? (
        <Text variant="caption" tone="faint" style={styles.hint}>
          {hint}
        </Text>
      ) : null}
      <View style={styles.sectionBody}>{children}</View>
    </Card>
  )
}

/** Label above value. Values in mono when they are figures. */
export function InfoRow({
  label,
  value,
  mono = false,
  tone,
  last = false,
}: {
  label: string
  value: string
  mono?: boolean
  tone?: string
  last?: boolean
}) {
  return (
    <>
      <View style={styles.infoRow}>
        <Text variant="caption" tone="muted" style={styles.infoLabel}>
          {label}
        </Text>
        <Text
          variant={mono ? 'data' : 'bodyTight'}
          weight="medium"
          tone={tone ?? 'base'}
          style={styles.infoValue}
        >
          {value}
        </Text>
      </View>
      {!last ? <Divider style={styles.infoDivider} /> : null}
    </>
  )
}

/**
 * Long text with a read-more toggle.
 * Only collapses when the text is genuinely long, so short briefs are never hidden
 * behind a pointless tap.
 */
export function ExpandableText({
  text,
  collapsedLines = 5,
  mono = false,
}: {
  text: string
  collapsedLines?: number
  mono?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const isLong = text.length > 260

  return (
    <View style={styles.expandable}>
      <Text
        variant={mono ? 'data' : 'bodyTight'}
        numberOfLines={!expanded && isLong ? collapsedLines : undefined}
        style={styles.expandableText}
      >
        {text}
      </Text>
      {isLong ? (
        <PressableScale
          onPress={() => setExpanded((v) => !v)}
          haptic="tap"
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Show less' : 'Read the full text'}
        >
          <View style={styles.expandToggle}>
            <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={accent.blue} />
            <Text variant="micro" weight="semibold" style={{ color: accent.blue }}>
              {expanded ? 'Show less' : 'Read more'}
            </Text>
          </View>
        </PressableScale>
      ) : null}
    </View>
  )
}

/** Evidence image with a fixed aspect ratio so layout never jumps while loading. */
export function EvidenceImage({ uri, caption }: { uri: string; caption?: string }) {
  return (
    <View style={styles.evidence}>
      <Image source={{ uri }} style={styles.evidenceImage} contentFit="cover" transition={200} />
      {caption ? (
        <View style={styles.evidenceCaption}>
          <Icon name="camera-outline" size={12} color={accent.slate} />
          <Text variant="micro" tone="faint">
            {caption}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

/** Small pill row used for agent flags (weather checked, web searched). */
export function FlagRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.flagRow}>{children}</View>
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  hint: { marginTop: -2 },
  sectionBody: { marginTop: space.sm, gap: 0 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.lg, paddingVertical: space.md },
  infoLabel: { flexShrink: 0, minWidth: 96 },
  infoValue: { flex: 1, textAlign: 'right' },
  infoDivider: { marginVertical: 0 },
  expandable: { gap: space.sm },
  expandableText: { lineHeight: 22 },
  expandToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  evidence: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line.base,
    backgroundColor: surface.sunken,
  },
  evidenceImage: { width: '100%', aspectRatio: 4 / 3 },
  evidenceCaption: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: space.md },
  flagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
})
