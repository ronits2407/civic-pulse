import React from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { useRouter } from 'expo-router'

import { PressableScale } from '@/components/ui/PressableScale'
import { Text } from '@/theme/Typography'
import { Icon, type IconName } from '@/theme/icons'
import { ink, radius, shadow, space, surface } from '@/theme/tokens'

/**
 * Floating round icon button: back, share, close. White on paper, translucent white on
 * a photo or navy, so it reads on any surface.
 */
export function RoundButton({
  icon,
  onPress,
  accessibilityLabel,
  onDark = false,
}: {
  icon: IconName
  onPress: () => void
  accessibilityLabel: string
  onDark?: boolean
}) {
  return (
    <PressableScale onPress={onPress} haptic="tap" accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      <View style={[styles.round, onDark ? styles.roundDark : shadow.card]}>
        <Icon name={icon} size={22} color={onDark ? ink.inverse : ink.base} />
      </View>
    </PressableScale>
  )
}

/**
 * Pushed-screen header. Native headers are off app-wide; this sits in the content so the
 * page title can be set large, as type, instead of in a thin system bar.
 */
export function TopBar({
  title,
  subtitle,
  right,
  onBack,
  style,
}: {
  title?: string
  subtitle?: string
  right?: React.ReactNode
  onBack?: () => void
  style?: StyleProp<ViewStyle>
}) {
  const router = useRouter()
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/(citizen)')))
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.row}>
        <RoundButton icon="chevron-left" onPress={back} accessibilityLabel="Go back" />
        <View style={styles.flex} />
        {right}
      </View>
      {title ? (
        <View style={styles.titles}>
          <Text variant="display" accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="bodyTight" tone="muted">
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg, paddingTop: space.sm },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  titles: { gap: space.xs },
  round: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundDark: { backgroundColor: 'rgba(255,255,255,0.18)' },
})
