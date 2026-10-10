import React from 'react'
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import { Button } from '@/components/ui/Button'
import { PressableScale } from '@/components/ui/PressableScale'
import { Text } from '@/theme/Typography'
import { accent, line, radius, space, surface, TONE_TINT, type Tone } from '@/theme/tokens'
import { TONE_COLOR } from '@/theme/tokens'

/**
 * Loading, empty and error states.
 *
 * These are treated as first-class screens rather than afterthoughts: an empty home
 * screen is the first thing a new citizen sees, and a failed upload is the moment
 * they are most likely to give up. Each one says what happened and what to do next.
 */

export function Spinner({ color = accent.brand }: { color?: string }) {
  return <ActivityIndicator size="small" color={color} />
}

/** Inline loading row for refreshes that should not blank the screen. */
export function LoadingRow({ label = 'Loading' }: { label?: string }) {
  return (
    <View style={styles.loadingRow}>
      <Spinner />
      <Text variant="bodyTight" tone="muted">
        {label}
      </Text>
    </View>
  )
}

/** Full-area loading state for first paint. */
export function LoadingState({ label = 'Loading', style }: { label?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.centered, style]}>
      <Spinner />
      <Text variant="bodyTight" tone="muted" style={{ marginTop: space.md }}>
        {label}
      </Text>
    </View>
  )
}

/**
 * Skeleton block for list placeholders.
 * Deliberately static: a shimmer would run continuously on a screen the user is
 * about to leave, which is exactly the kind of decoration we avoid.
 */
export function Skeleton({ height = 92, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.skeleton, { height }, style]} />
}

export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  onAction,
  style,
}: {
  icon?: React.ReactNode
  title: string
  body?: string
  actionLabel?: string
  onAction?: () => void
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View style={[styles.stateBox, style]}>
      {icon ? <View style={styles.iconWell}>{icon}</View> : null}
      <Text variant="heading" weight="semibold" center>
        {title}
      </Text>
      {body ? (
        <Text variant="bodyTight" tone="muted" center style={styles.stateBody}>
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} size="sm" style={{ marginTop: space.lg }} />
      ) : null}
    </View>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try again',
  style,
}: {
  title?: string
  message?: string | null
  onRetry?: () => void
  retryLabel?: string
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View style={[styles.stateBox, style]}>
      <Text variant="heading" weight="semibold" center style={{ color: accent.redSoft }}>
        {title}
      </Text>
      {message ? (
        <Text variant="bodyTight" tone="muted" center style={styles.stateBody}>
          {message}
        </Text>
      ) : null}
      {onRetry ? (
        <Button label={retryLabel} onPress={onRetry} size="sm" variant="secondary" style={{ marginTop: space.lg }} />
      ) : null}
    </View>
  )
}

/**
 * Inline notice — used for permission explanations, offline warnings and
 * "saved on device" states. Tone maps to the same semantic colours as chips.
 */
export function Notice({
  tone = 'blue',
  title,
  body,
  icon,
  actionLabel,
  onAction,
  style,
}: {
  tone?: Tone
  title?: string
  body: string
  icon?: React.ReactNode
  actionLabel?: string
  onAction?: () => void
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View style={[styles.notice, { backgroundColor: TONE_TINT[tone], borderColor: TONE_COLOR[tone] + '3d' }, style]}>
      <View style={styles.noticeRow}>
        {icon ? <View style={styles.noticeIcon}>{icon}</View> : null}
        <View style={styles.noticeText}>
          {title ? (
            <Text variant="bodyTight" weight="semibold" style={{ color: TONE_COLOR[tone] }}>
              {title}
            </Text>
          ) : null}
          <Text variant="caption" tone="muted" style={{ lineHeight: 18 }}>
            {body}
          </Text>
        </View>
      </View>
      {actionLabel && onAction ? (
        <PressableScale onPress={onAction} haptic="tap" accessibilityRole="button" style={styles.noticeAction}>
          <Text variant="caption" weight="semibold" style={{ color: TONE_COLOR[tone] }}>
            {actionLabel}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxl },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.lg },
  skeleton: {
    borderRadius: radius.lg,
    backgroundColor: surface.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line.soft,
    width: '100%',
  },
  stateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.huge,
    paddingHorizontal: space.xl,
    gap: space.xs,
  },
  iconWell: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surface.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line.base,
    marginBottom: space.md,
  },
  stateBody: { maxWidth: 320, marginTop: space.xs },
  notice: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.md,
    gap: space.sm,
  },
  noticeRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  noticeIcon: { paddingTop: 1 },
  noticeText: { flex: 1, gap: 2 },
  noticeAction: { alignSelf: 'flex-start', paddingVertical: 2 },
})
