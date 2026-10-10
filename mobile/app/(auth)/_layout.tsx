import { Stack } from 'expo-router'

import { pushedScreenOptions } from '@/theme/navigation'

export default function AuthLayout() {
  return <Stack screenOptions={{ ...pushedScreenOptions, headerShown: false }} />
}
