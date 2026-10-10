import React, { useEffect } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { Text } from '@/theme/Typography'
import { getRail, type PipelineNodeState } from '@/lib/pipeline'
import { accent, ink, motion, space } from '@/theme/tokens'

/**
 * The agent pipeline rail: CivicPulse's signature.
 *
 * Five agents handle every report. They are drawn as one track with a fill that grows to
 * the furthest finished step and a kerb-amber node that breathes on the step running now.
 * This is the one place the bold accent appears, so "amber" always means "an agent is
 * working on this right now".
 */

export type RailTone = 'onDark' | 'onLight'

const COLORS: Record<RailTone, Record<PipelineNodeState, string> & { track: string; fill: string }> = {
  onDark: {
    done: '#FFFFFF',
    active: accent.kerb,
    pending: 'rgba(255,255,255,0.22)',
    failed: '#FF8A7A',
    skipped: 'rgba(255,255,255,0.14)',
    track: 'rgba(255,255,255,0.14)',
    fill: 'rgba(255,255,255,0.85)',
  },
  onLight: {
    done: ink.base,
    active: accent.kerb,
    pending: '#D8D5CD',
    failed: accent.red,
    skipped: '#E4E1D9',
    track: '#E7E4DD',
    fill: ink.base,
  },
}

const NODE = 12

function Node({ state, tone }: { state: PipelineNodeState; tone: RailTone }) {
  const pulse = useSharedValue(0)
  useEffect(() => {
    if (state !== 'active') {
      pulse.set(0)
      return
    }
    pulse.set(withRepeat(
      withSequence(
        withTiming(1, { duration: 1000, reduceMotion: ReduceMotion.System }),
        withTiming(0, { duration: 1000, reduceMotion: ReduceMotion.System })
      ),
      -1,
      false
    ))
  }, [state, pulse])

  const halo = useAnimatedStyle(() => ({
    opacity: 0.18 + pulse.value * 0.35,
    transform: [{ scale: 1.4 + pulse.value * 0.9 }],
  }))

  const c = COLORS[tone]
  const hollow = state === 'pending' || state === 'skipped'
  return (
    <View style={styles.nodeWrap}>
      {state === 'active' ? <Animated.View style={[styles.halo, { backgroundColor: c.active }, halo]} /> : null}
      <View
        style={[
          styles.node,
          { backgroundColor: hollow ? 'transparent' : c[state], borderColor: c[state] },
          state === 'skipped' && styles.dashed,
        ]}
      />
    </View>
  )
}

export interface RailProps {
  stage: string | null | undefined
  isDuplicate?: boolean
  showLabels?: boolean
  tone?: RailTone
  style?: StyleProp<ViewStyle>
}

export function Rail({ stage, isDuplicate = false, showLabels = true, tone = 'onLight', style }: RailProps) {
  const rail = getRail(stage, isDuplicate)
  const c = COLORS[tone]

  // Fill reaches the last finished (or currently running) node.
  let reached = -1
  rail.forEach((entry, i) => {
    if (entry.state === 'done' || entry.state === 'active' || entry.state === 'failed') reached = i
  })
  const target = reached <= 0 ? 0 : reached / (rail.length - 1)

  const fill = useSharedValue(0)
  useEffect(() => {
    fill.set(withSpring(target, { ...motion.softSpring, reduceMotion: ReduceMotion.System }))
  }, [target, fill])
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }))

  return (
    <View
      style={style}
      accessibilityRole="progressbar"
      accessibilityLabel={`Agent pipeline: ${rail.map((r) => `${r.node.short} ${r.state}`).join(', ')}`}
    >
      <View style={styles.trackRow}>
        <View style={[styles.track, { backgroundColor: c.track }]}>
          <Animated.View style={[styles.fill, { backgroundColor: c.fill }, fillStyle]} />
        </View>
        <View style={styles.nodes}>
          {rail.map((entry) => (
            <Node key={entry.node.stage} state={entry.state} tone={tone} />
          ))}
        </View>
      </View>
      {showLabels ? (
        <View style={styles.labels}>
          {rail.map((entry, i) => (
            <Text
              key={entry.node.stage}
              variant="micro"
              weight={entry.state === 'active' ? 'bold' : 'medium'}
              numberOfLines={1}
              style={[
                styles.label,
                i === 0 && styles.labelFirst,
                i === rail.length - 1 && styles.labelLast,
                {
                  color:
                    entry.state === 'active'
                      ? tone === 'onDark' ? accent.kerb : accent.amber
                      : entry.state === 'failed'
                        ? c.failed
                        : tone === 'onDark'
                          ? entry.state === 'done' ? ink.inverse : ink.inverseMuted
                          : entry.state === 'done' ? ink.base : ink.faint,
                },
              ]}
            >
              {entry.node.short}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  trackRow: { height: NODE * 2.6, justifyContent: 'center' },
  track: { position: 'absolute', left: NODE / 2, right: NODE / 2, height: 3, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  nodes: { flexDirection: 'row', justifyContent: 'space-between' },
  nodeWrap: { width: NODE, height: NODE, alignItems: 'center', justifyContent: 'center' },
  node: { width: NODE, height: NODE, borderRadius: NODE / 2, borderWidth: 2 },
  dashed: { borderStyle: 'dashed' },
  halo: { position: 'absolute', width: NODE, height: NODE, borderRadius: NODE / 2 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xs },
  label: { width: 64, textAlign: 'center', marginHorizontal: -26 },
  labelFirst: { textAlign: 'left', marginLeft: 0, width: 52 },
  labelLast: { textAlign: 'right', marginRight: 0, width: 52 },
})
