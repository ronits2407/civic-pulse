import React, { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'

import { Text } from '@/theme/Typography'
import { accent, ink, line, radius } from '@/theme/tokens'

/**
 * Profile avatar.
 *
 * Falls back to initials rather than a generic silhouette: with Google sign-in the
 * picture often loads late or not at all, and initials are more recognisable than a
 * placeholder glyph. A failed image never leaves a broken frame on screen.
 */

export function Avatar({
  name,
  uri,
  size = 40,
}: {
  name?: string | null
  uri?: string | null
  size?: number
}) {
  const [failed, setFailed] = useState(false)

  const initials = (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  const showImage = Boolean(uri) && !failed

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: radius.pill },
        showImage ? null : styles.initialsBg,
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: uri as string }}
          style={{ width: size, height: size }}
          contentFit="cover"
          transition={180}
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text variant={size > 48 ? 'heading' : 'bodyTight'} weight="semibold" style={styles.initialsText}>
          {initials || '•'}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line.base,
    backgroundColor: '#10161d',
  },
  initialsBg: { backgroundColor: 'rgba(45,164,78,0.14)', borderColor: 'rgba(45,164,78,0.4)' },
  initialsText: { color: ink.base },
})
