import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Icon, type IconName } from '@/theme/icons'
import { Text } from '@/theme/Typography'
import { haptics } from '@/lib/haptics'
import { accent, line, radius, space, surface, TONE_COLOR, TONE_TINT, type Tone } from '@/theme/tokens'

/**
 * Toast notifications.
 *
 * A small hand-rolled host instead of a library: the app needs exactly one toast
 * shape and one animation, and this keeps the dependency graph honest. One message
 * is shown at a time — a queue of stacked banners on a phone is noise, and the most
 * recent event is nearly always the one that matters.
 */

export interface ToastOptions {
  title?: string
  message: string
  tone?: Tone
  /** Milliseconds on screen. Errors get longer because they carry more to read. */
  durationMs?: number
}

interface ToastState extends Required<Pick<ToastOptions, 'message' | 'tone' | 'durationMs'>> {
  id: number
  title?: string
}

interface ToastContextValue {
  show: (options: ToastOptions) => void
  success: (message: string, title?: string) => void
  error: (message: string, title?: string) => void
  info: (message: string, title?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TONE_ICON: Record<string, IconName> = {
  emerald: 'check-circle-outline',
  red: 'alert-circle-outline',
  amber: 'alert-outline',
  blue: 'information-outline',
  slate: 'information-outline',
  rose: 'alert-circle-outline',
}

function ToastCard({ toast, onDone }: { toast: ToastState; onDone: () => void }) {
  const progress = useSharedValue(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    progress.value = withTiming(1, { duration: 220, reduceMotion: ReduceMotion.System })
    timer.current = setTimeout(onDone, toast.durationMs)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [toast.id, toast.durationMs, onDone, progress])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * -14 }],
  }))

  const color = TONE_COLOR[toast.tone]

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: TONE_TINT[toast.tone], borderColor: color + '59' },
        animatedStyle,
      ]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <Icon name={TONE_ICON[toast.tone] ?? 'information-outline'} size={17} color={color} />
      <View style={styles.toastBody}>
        {toast.title ? (
          <Text variant="bodyTight" weight="semibold" style={{ color }}>
            {toast.title}
          </Text>
        ) : null}
        <Text variant="caption" tone="base" style={styles.toastMessage}>
          {toast.message}
        </Text>
      </View>
    </Animated.View>
  )
}

export function ToastHost({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const counter = useRef(0)
  const insets = useSafeAreaInsets()

  const show = useCallback((options: ToastOptions) => {
    const tone = options.tone ?? 'blue'
    if (tone === 'emerald') haptics.success()
    else if (tone === 'red' || tone === 'rose') haptics.error()
    else if (tone === 'amber') haptics.warn()

    counter.current += 1
    setToast({
      id: counter.current,
      message: options.message,
      title: options.title,
      tone,
      durationMs: options.durationMs ?? (tone === 'red' || tone === 'rose' ? 5200 : 3400),
    })
  }, [])

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (message, title) => show({ message, title, tone: 'emerald' }),
      error: (message, title) => show({ message, title, tone: 'red' }),
      info: (message, title) => show({ message, title, tone: 'blue' }),
    }),
    [show]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <View pointerEvents="none" style={[styles.host, { top: insets.top + space.sm }]}>
          <ToastCard toast={toast} onDone={() => setToast((current) => (current?.id === toast.id ? null : current))} />
        </View>
      ) : null}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastHost>')
  return ctx
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: space.lg, right: space.lg, zIndex: 1000 },
  toast: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: surface.raised,
    borderColor: line.base,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  toastBody: { flex: 1, gap: 2 },
  toastMessage: { lineHeight: 18 },
})
