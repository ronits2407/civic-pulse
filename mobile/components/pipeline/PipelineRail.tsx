import React, { useEffect } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { Text } from '@/theme/Typography'
import { getRail, type PipelineNodeState } from '@/lib/pipeline'
import { accent, line, radius, space, surface } from '@/theme/tokens'

/**
 * The agent pipeline rail — CivicPulse's signature motif.
 *
 * Every report is processed by five chained agents. Showing that journey as a
 * literal rail (rather than a generic "status" word) is the single most
 * characteristic thing this product does, so it repeats on the home list, the
 * detail screen and the post-submit confirmation. A citizen learns one visual idea
 * and can then read the state of any report at a glance.
 */

const NODE_COLOR: Record<PipelineNodeState, string> = {
  done: accent.brand,
  active: accent.amberSoft,
  pending: '#39414d',
  failed: accent.redSoft,
  skipped: '#4b5563',
}

const NODE_SIZE = 10

function Node({ state, index }: { state: PipelineNodeState; index: number }) {
  const pulse = useSharedValue(0)

  useEffect(() => {
    if (state !== 'active') {
      pulse.value = 0
      return
    }
    // One slow, low-amplitude breath — enough to show work in progress without
    // becoming a distraction that never stops.
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, reduceMotion: ReduceMotion.System }),
        withTiming(0, { duration: 900, reduceMotion: ReduceMotion.System })
      ),
      -1,
      false
    )
  }, [state, pulse])

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.16 + pulse.value * 0.4,
    transform: [{ scale: 1 + pulse.value * 0.7 }],
  }))

  const color = NODE_COLOR[state]
  const filled = state === 'done' || state === 'active' || state === 'failed'

  return (
    <View style={styles.nodeWrap}>
      {state === 'active' ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.halo,
            { backgroundColor: NODE_COLOR.active, borderColor: NODE_COLOR.active },
            haloStyle,
          ]}
        />
      ) : null}
      <View
        style={[
          styles.node,
          {
            borderColor: filled ? color : line.base,
            backgroundColor: filled ? color : 'transparent',
          },
          state === 'skipped' && styles.nodeSkipped,
        ]}
      />
    </View>
  )
}

export interface PipelineRailProps {
  stage: string | null | undefined
  isDuplicate?: boolean
  /** Show the 2–3 word label under each node. */
  showLabels?: boolean
  style?: StyleProp<ViewStyle>
}

export function PipelineRail({
  stage,
  isDuplicate = false,
  showLabels = true,
  style,
}: PipelineRailProps) {
  const rail = getRail(stage, isDuplicate)

  return (
    <View
      style={[styles.rail, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={`Pipeline: ${rail
        .map((r) => `${r.node.short} ${r.state}`)
        .join(', ')}`}
    >
      {rail.map((entry, index) => (
        <React.Fragment key={entry.node.stage}>
          {index > 0 ? (
            <View
              style={[
                styles.connector,
                {
                  backgroundColor:
                    rail[index - 1].state === 'done' || entry.state === 'done'
                      ? accent.brand + '80'
                      : line.base,
                },
              ]}
            />
          ) : null}
          <View style={styles.column}>
            <Node state={entry.state} index={index} />
            {showLabels ? (
              <Text
                variant="micro"
                weight="medium"
                tone={entry.state === 'pending' ? 'faint' : entry.state === 'active' ? 'base' : 'muted'}
                numberOfLines={1}
                style={styles.nodeLabel}
              >
                {entry.node.short}
              </Text>
            ) : null}
          </View>
        </React.Fragment>
      ))}
    </View>
  )
}

/**
 * Full-height version for the issue detail screen: same data, with each agent's
 * plain-language explanation and a state label. This is where a citizen finds out
 * what actually happened to their report.
 */
export function PipelineTimeline({
  stage,
  isDuplicate = false,
  style,
}: PipelineRailProps) {
  const rail = getRail(stage, isDuplicate)

  return (
    <View style={[styles.timeline, style]}>
      {rail.map((entry, index) => {
        const color = NODE_COLOR[entry.state]
        const stateLabel =
          entry.state === 'done'
            ? 'Done'
            : entry.state === 'active'
              ? 'In progress'
              : entry.state === 'failed'
                ? 'Failed'
                : entry.state === 'skipped'
                  ? 'Skipped'
                  : 'Waiting'

        const isLast = index === rail.length - 1

        return (
          <View key={entry.node.stage} style={styles.timelineRow}>
            <View style={styles.timelineGutter}>
              <View
                style={[
                  styles.timelineNode,
                  { borderColor: color, backgroundColor: entry.state === 'pending' ? 'transparent' : color },
                ]}
              />
              {!isLast ? (
                <View
                  style={[
                    styles.timelineConnector,
                    { backgroundColor: entry.state === 'done' ? accent.brand + '66' : line.soft },
                  ]}
                />
              ) : null}
            </View>

            <View style={styles.timelineBody}>
              <View style={styles.timelineHeader}>
                <Text variant="bodyTight" weight="semibold" numberOfLines={1} style={styles.timelineTitle}>
                  {entry.node.title}
                </Text>
                <Text variant="micro" weight="semibold" style={{ color }}>
                  {stateLabel}
                </Text>
              </View>
              <Text variant="caption" tone="faint" style={styles.timelineDetail}>
                {entry.node.detail}
              </Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  rail: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { alignItems: 'center', width: 52 },
  nodeWrap: { width: NODE_SIZE, height: NODE_SIZE, alignItems: 'center', justifyContent: 'center' },
  node: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 2,
  },
  nodeSkipped: { borderStyle: 'dashed' },
  halo: {
    position: 'absolute',
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 2,
  },
  connector: { flex: 1, height: 2, marginTop: NODE_SIZE / 2 - 1, borderRadius: 1 },
  nodeLabel: { marginTop: space.xs, textAlign: 'center' },
  timeline: { gap: 0 },
  timelineRow: { flexDirection: 'row', gap: space.md },
  timelineGutter: { alignItems: 'center', width: 14 },
  timelineNode: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, marginTop: 5 },
  timelineConnector: { width: 2, flex: 1, marginTop: 2, borderRadius: 1 },
  timelineBody: { flex: 1, paddingBottom: space.lg },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  timelineTitle: { flex: 1 },
  timelineDetail: { marginTop: 3, lineHeight: 17 },
})
