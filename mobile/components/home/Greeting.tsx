import React from 'react'
import { StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'

import { Avatar } from '@/components/ui/Avatar'
import { PressableScale } from '@/components/ui/PressableScale'
import { Text } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import { accent, shadow, space, surface } from '@/theme/tokens'

function timeOfDay(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

/** Avatar, greeting, and a round shortcut to the offline emergency network. */
export function Greeting({ name, avatarUrl }: { name: string | null; avatarUrl: string | null }) {
  const router = useRouter()
  const firstName = (name ?? '').split(' ')[0] || 'there'
  return (
    <View style={styles.row}>
      <PressableScale onPress={() => router.push('/(citizen)/profile')} accessibilityRole="button" accessibilityLabel="Open your profile">
        <Avatar name={name} uri={avatarUrl} size={52} />
      </PressableScale>
      <View style={styles.flex}>
        <Text variant="bodyTight" tone="muted">
          {timeOfDay()},
        </Text>
        <Text variant="title" numberOfLines={1}>
          {firstName}
        </Text>
      </View>
      <PressableScale onPress={() => router.push('/emergency-network')} accessibilityRole="button" accessibilityLabel="Offline emergency alerts">
        <View style={[styles.round, shadow.card]}>
          <Icon name="broadcast" size={22} color={accent.red} />
        </View>
      </PressableScale>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.sm },
  flex: { flex: 1 },
  round: { width: 48, height: 48, borderRadius: 24, backgroundColor: surface.card, alignItems: 'center', justifyContent: 'center' },
})
