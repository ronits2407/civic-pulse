import React from 'react'
import { Modal, Pressable, StyleSheet, View } from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Button } from '@/components/ui/Button'
import { Divider } from '@/components/ui/Card'
import { Text } from '@/theme/Typography'
import { formatCoordinates } from '@/lib/format'
import { radius, space, surface } from '@/theme/tokens'

/** Final check before submitting: exactly what the agents will receive. */
export function ReviewSheet({
  visible,
  onClose,
  onSubmit,
  text,
  imageUri,
  videoUri,
  address,
  lat,
  lng,
}: {
  visible: boolean
  onClose: () => void
  onSubmit: () => void
  text: string
  imageUri: string | null
  videoUri: string | null
  address: string | null
  lat: number | null
  lng: number | null
}) {
  const insets = useSafeAreaInsets()
  const evidence = [imageUri ? 'Photo' : null, videoUri ? 'Video' : null].filter(Boolean).join(' and ') || 'None'
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close review" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
        <View style={styles.grabber} />
        <Text variant="title">Check before you submit</Text>
        <Text variant="bodyTight" tone="muted">
          This is exactly what the five agents will receive.
        </Text>

        <View style={styles.summary}>
          {imageUri ? <Image source={{ uri: imageUri }} style={styles.photo} contentFit="cover" alt="The photo you attached" /> : null}
          <Row label="Description" value={text} />
          <Divider />
          <Row label="Evidence" value={evidence} />
          <Divider />
          <Row label="Location" value={address ?? 'Not set'} />
          {lat != null && lng != null ? (
            <Text variant="micro" tone="faint" mono>
              {formatCoordinates(lat, lng)}
            </Text>
          ) : null}
        </View>

        <Button label="Submit report" onPress={onSubmit} size="lg" fullWidth trailingArrow />
        <Button label="Keep editing" onPress={onClose} variant="ghost" fullWidth />
      </View>
    </Modal>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="caption" tone="faint">
        {label}
      </Text>
      <Text variant="bodyTight" numberOfLines={4}>
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,28,46,0.45)' },
  sheet: {
    backgroundColor: surface.canvas,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    gap: space.md,
  },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#D6D2C9', marginBottom: space.sm },
  summary: { backgroundColor: surface.card, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  photo: { width: '100%', height: 140, borderRadius: radius.md },
  row: { gap: 2 },
})
