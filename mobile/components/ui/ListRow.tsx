import React from 'react'
import { StyleSheet, View } from 'react-native'

import { Card, Divider } from '@/components/ui/Card'
import { PressableScale } from '@/components/ui/PressableScale'
import { Text } from '@/theme/Typography'
import { Icon, type IconName } from '@/theme/icons'
import { ink, radius, space, surface } from '@/theme/tokens'

/** A tappable settings-style row: round icon well, label, hint, chevron. */
export function ListRow({
  icon,
  label,
  hint,
  onPress,
  iconColor = ink.base,
  iconBg = surface.mist,
  trailing,
}: {
  icon: IconName
  label: string
  hint?: string
  onPress?: () => void
  iconColor?: string
  iconBg?: string
  trailing?: React.ReactNode
}) {
  const body = (
    <View style={styles.row}>
      <View style={[styles.well, { backgroundColor: iconBg }]}>
        <Icon name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.text}>
        <Text variant="bodyTight" weight="semibold" numberOfLines={1}>
          {label}
        </Text>
        {hint ? (
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {hint}
          </Text>
        ) : null}
      </View>
      {trailing ?? (onPress ? <Icon name="chevron-right" size={22} color={ink.faint} /> : null)}
    </View>
  )
  if (!onPress) return body
  return (
    <PressableScale onPress={onPress} haptic="tap" scaleTo={0.98} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint}>
      {body}
    </PressableScale>
  )
}

/** A white card grouping several ListRows with inset dividers. */
export function ListGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(Boolean)
  return (
    <View style={styles.group}>
      {title ? (
        <Text variant="label" weight="semibold" tone="muted" style={styles.groupTitle}>
          {title}
        </Text>
      ) : null}
      <Card style={styles.card}>
        {items.map((child, i) => (
          <React.Fragment key={i}>
            {i > 0 ? <Divider style={styles.divider} /> : null}
            {child}
          </React.Fragment>
        ))}
      </Card>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, minHeight: 64 },
  well: { width: 42, height: 42, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 1 },
  group: { gap: space.sm },
  groupTitle: { marginLeft: space.sm },
  card: { paddingVertical: space.xs },
  divider: { marginLeft: 54, width: 'auto' },
})
