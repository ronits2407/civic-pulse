import React, { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated'

import { Rail } from '@/components/pipeline/Rail'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Rise } from '@/components/ui/Motion'
import { Screen } from '@/components/ui/Screen'
import { Text } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import { haptics } from '@/lib/haptics'
import { accent, ink, motion, radius, space } from '@/theme/tokens'

/**
 * Confirmation after the server accepted the report. The check mark springs in, then the
 * same navy rail from Home shows the first agent already working, so the citizen sees
 * exactly what they will see when they come back.
 */
export function SubmittedView({ onTrack, onHome }: { onTrack: () => void; onHome: () => void }) {
  const pop = useSharedValue(0)
  useEffect(() => {
    haptics.success()
    pop.set(withDelay(80, withSpring(1, { ...motion.spring, reduceMotion: ReduceMotion.System })))
  }, [pop])
  const markStyle = useAnimatedStyle(() => ({ transform: [{ scale: 0.4 + pop.value * 0.6 }], opacity: pop.value }))

  return (
    <Screen padded scroll edges={['top', 'bottom']} contentContainerStyle={styles.content}>
      <Animated.View style={[styles.mark, markStyle]}>
        <Icon name="check" size={44} color={ink.inverse} />
      </Animated.View>

      <Rise index={1} style={styles.copy}>
        <Text variant="display" center>
          Your report is in
        </Text>
        <Text variant="body" tone="muted" center>
          The agents are working on it now. Classification, the duplicate check and the credibility check usually finish within a minute.
        </Text>
      </Rise>

      <Rise index={2}>
        <Card variant="hero" style={styles.rail}>
          <Text variant="caption" tone="inverseMuted">
            Live progress
          </Text>
          <Rail stage="agent0_translation" tone="onDark" />
          <Text variant="caption" tone="inverseMuted">
            You can close the app. The pipeline runs on the server and Home updates live.
          </Text>
        </Card>
      </Rise>

      <Rise index={3} style={styles.actions}>
        <Button label="Track this report" onPress={onTrack} size="lg" fullWidth trailingArrow />
        <Button label="Back to home" onPress={onHome} variant="ghost" fullWidth />
      </Rise>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', gap: space.xl },
  mark: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: accent.emerald,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  copy: { gap: space.sm, alignItems: 'center', paddingHorizontal: space.md },
  rail: { gap: space.md, padding: space.xl },
  actions: { gap: space.xs },
})
