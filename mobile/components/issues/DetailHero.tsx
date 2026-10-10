import React from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { RoundButton } from '@/components/ui/TopBar'
import { CATEGORY_ICON, FALLBACK_CATEGORY_ICON, Icon } from '@/theme/icons'
import { CATEGORY_META, FALLBACK_CATEGORY } from '@/theme/tokens'

export const HERO_HEIGHT = 340

/**
 * Image-led header for the issue detail. The evidence photo fills the top of the screen;
 * pulling down stretches it and scrolling up parallaxes it away. With no photo, a large
 * category glyph on the category tint takes its place, so the layout is the same either way.
 */
export function DetailHero({
  photoUrl,
  category,
  scrollY,
  onShare,
}: {
  photoUrl: string | null
  category: string | null
  scrollY: SharedValue<number>
  onShare?: () => void
}) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const meta = (category && CATEGORY_META[category]) || FALLBACK_CATEGORY
  const icon = (category && CATEGORY_ICON[category]) || FALLBACK_CATEGORY_ICON

  const parallax = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [-HERO_HEIGHT, 0, HERO_HEIGHT], [-HERO_HEIGHT / 2, 0, HERO_HEIGHT * 0.45], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [-HERO_HEIGHT, 0], [2, 1], Extrapolation.CLAMP) },
    ],
  }))

  return (
    <>
      <Animated.View style={[styles.hero, parallax]}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} alt="Photo attached to the report" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.placeholder, { backgroundColor: meta.tint }]}>
            <Icon name={icon} size={112} color={meta.color} />
          </View>
        )}
        <View style={styles.scrim} />
      </Animated.View>

      <View pointerEvents="box-none" style={[styles.controls, { top: insets.top + 8 }]}>
        <RoundButton icon="chevron-left" onPress={() => (router.canGoBack() ? router.back() : router.replace('/(citizen)'))} accessibilityLabel="Go back" />
        {onShare ? <RoundButton icon="share-variant-outline" onPress={onShare} accessibilityLabel="Share an impact receipt" /> : null}
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  hero: { position: 'absolute', top: 0, left: 0, right: 0, height: HERO_HEIGHT, overflow: 'hidden' },
  placeholder: { alignItems: 'center', justifyContent: 'center', paddingBottom: 40 },
  scrim: { position: 'absolute', left: 0, right: 0, top: 0, height: 120, backgroundColor: 'rgba(20,28,46,0.18)' },
  controls: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', zIndex: 10 },
})
