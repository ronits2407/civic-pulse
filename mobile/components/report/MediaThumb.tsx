import React from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'

import { PressableScale } from '@/components/ui/PressableScale'
import { Text } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import { accent, radius, space, surface } from '@/theme/tokens'

/**
 * Attached-evidence thumbnail with a remove control.
 *
 * The remove target is a full 32pt hit area sitting on the thumbnail rather than a
 * small × glyph, because this is the control a user reaches for in a hurry when they
 * picked the wrong photo.
 */
export function MediaThumb({
  uri,
  kind,
  onRemove,
  busy = false,
  label,
}: {
  uri: string
  kind: 'image' | 'video'
  onRemove: () => void
  busy?: boolean
  label?: string
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.frame}>
        {kind === 'image' ? (
          <Image source={{ uri }} style={styles.image} contentFit="cover" transition={160} />
        ) : (
          <View style={styles.videoFrame}>
            <Icon name="video-outline" size={22} color={accent.teal} />
            <Text variant="micro" tone="muted" numberOfLines={1} style={styles.videoLabel}>
              Video attached
            </Text>
          </View>
        )}

        {busy ? (
          <View style={styles.busyOverlay}>
            <ActivityIndicator size="small" color={accent.brand} />
          </View>
        ) : null}

        <PressableScale
          onPress={onRemove}
          haptic="warn"
          accessibilityRole="button"
          accessibilityLabel={`Remove ${kind}`}
          style={styles.remove}
        >
          <View style={styles.removeInner}>
            <Icon name="close" size={13} color="#ffffff" />
          </View>
        </PressableScale>
      </View>

      {label ? (
        <Text variant="micro" tone="faint" numberOfLines={1} style={styles.caption}>
          {label}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  frame: {
    width: 96,
    height: 96,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: surface.mist,
  },
  image: { width: '100%', height: '100%' },
  videoFrame: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, padding: space.sm },
  videoLabel: { textAlign: 'center' },
  busyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  remove: { position: 'absolute', top: 4, right: 4 },
  removeInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,28,46,0.82)',
  },
  caption: { width: 96, textAlign: 'center' },
})
