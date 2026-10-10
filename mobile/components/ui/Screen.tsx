import React from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { SafeAreaView, type Edge } from 'react-native-safe-area-context'

import { surface, space } from '@/theme/tokens'

/**
 * Standard page container.
 *
 * Owns the three things every screen gets wrong if left to its own devices: safe
 * area insets, the keyboard on Android (where a form at the bottom of the screen
 * would otherwise be covered), and the scroll container's bottom padding so the
 * last card is not hidden behind the tab bar.
 */

export interface ScreenProps {
  children: React.ReactNode
  /** Wrap content in a ScrollView. Off for screens that own their own list. */
  scroll?: boolean
  /** Apply the standard horizontal gutter. Default true. */
  padded?: boolean
  /** Which safe-area edges to respect. Tabs screens usually want the top only. */
  edges?: readonly Edge[]
  background?: string
  contentContainerStyle?: StyleProp<ViewStyle>
  refreshControl?: React.ReactElement<RefreshControlProps>
  /** Extra bottom padding for content that sits above a tab bar. */
  bottomInset?: number
  /** Keep the keyboard from covering the bottom of the screen. */
  avoidKeyboard?: boolean
  style?: StyleProp<ViewStyle>
}

export function Screen({
  children,
  scroll = false,
  padded = true,
  edges = ['top'] as const,
  background = surface.canvas,
  contentContainerStyle,
  refreshControl,
  bottomInset = space.xxxl,
  avoidKeyboard = false,
  style,
}: ScreenProps) {
  const inner = scroll ? (
    <ScrollView
      contentContainerStyle={[
        padded && styles.padded,
        { paddingBottom: bottomInset },
        contentContainerStyle,
      ]}
      refreshControl={refreshControl}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padded && styles.padded, style]}>{children}</View>
  )

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: background }]} edges={edges}>
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  padded: { paddingHorizontal: space.lg },
})
