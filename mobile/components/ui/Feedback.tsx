import React, { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { Button } from '@/components/ui/Button'
import { PressableScale } from '@/components/ui/PressableScale'
import { Text } from '@/theme/Typography'
import { accent, radius, space, surface, TONE_COLOR, TONE_TINT, type Tone } from '@/theme/tokens'

/**
 * Loading, empty and error states.
 *
 * Each one says what happened and what to do next. Empty states are invitations to act;
 * errors explain the cause and offer the fix, without apologising.
 */

export function Spinner({ color = accent.brand }: { color?: string }) {
  return <ActivityIndicator size="small" color={color} />
}

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

/** Placeholder block that breathes slowly while content loads. Static if motion is reduced. */
export function Skeleton({ height = 92, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  const pulse = useSharedValue(0)
  useEffect(() => {
    pulse.set(withRepeat(withTiming(1, { duration: 900, reduceMotion: ReduceMotion.System }), -1, true))
  }, [pulse])
  const animated = useAnimatedStyle(() => ({ opacity: 0.55 + pulse.value * 0.45 }))
  return <Animated.View style={[styles.skeleton, { height }, animated, style]} />
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
      <Text variant="heading" center>
        {title}
      </Text>
      {body ? (
        <Text variant="bodyTight" tone="muted" center style={styles.stateBody}>
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} size="sm" style={{ marginTop: space.lg }} /> : null}
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
      <Text variant="heading" center style={{ color: accent.red }}>
        {title}
      </Text>
      {message ? (
        <Text variant="bodyTight" tone="muted" center style={styles.stateBody}>
          {message}
        </Text>
      ) : null}
      {onRetry ? <Button label={retryLabel} onPress={onRetry} size="sm" variant="secondary" style={{ marginTop: space.lg }} /> : null}
    </View>
  )
}

/** Inline notice for permission explanations, offline warnings and "saved on device" states. */
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
    <View style={[styles.notice, { backgroundColor: TONE_TINT[tone] }, style]}>
      <View style={styles.noticeRow}>
        {icon ? <View style={styles.noticeIcon}>{icon}</View> : null}
        <View style={styles.noticeText}>
          {title ? (
            <Text variant="bodyTight" weight="semibold" style={{ color: TONE_COLOR[tone] }}>
              {title}
            </Text>
          ) : null}
          <Text variant="caption" tone="muted" style={{ lineHeight: 19 }}>
            {body}
          </Text>
        </View>
      </View>
      {actionLabel && onAction ? (
        <PressableScale onPress={onAction} haptic="tap" accessibilityRole="button" style={styles.noticeAction}>
          <Text variant="caption" weight="bold" style={{ color: TONE_COLOR[tone] }}>
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
  skeleton: { borderRadius: radius.lg, backgroundColor: '#E6E3DB', width: '100%' },
  stateBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: space.huge, paddingHorizontal: space.xl, gap: space.xs },
  iconWell: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surface.mist,
    marginBottom: space.md,
  },
  stateBody: { maxWidth: 320, marginTop: space.xs },
  notice: { borderRadius: radius.md, padding: space.lg, gap: space.sm },
  noticeRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  noticeIcon: { paddingTop: 2 },
  noticeText: { flex: 1, gap: 2 },
  noticeAction: { alignSelf: 'flex-start', paddingVertical: 2, paddingLeft: 28 },
})
