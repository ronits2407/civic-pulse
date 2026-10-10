import React from 'react'
import { StyleSheet, View } from 'react-native'

import { Card } from '@/components/ui/Card'
import { PressableScale } from '@/components/ui/PressableScale'
import { Text } from '@/theme/Typography'
import { Icon, type IconName } from '@/theme/icons'
import { accent, ink, radius, space, surface } from '@/theme/tokens'

export interface QuickTile {
  key: string
  icon: IconName
  label: string
  onPress: () => void
  /** Small count bubble, e.g. reports waiting for you to verify. */
  badge?: number
  /** The primary tile is filled navy; only one tile should be primary. */
  primary?: boolean
  /** Emergency tiles get a red icon well. */
  danger?: boolean
}

/**
 * Round quick-access tiles: the four things people do from Home. One is filled (Report),
 * the rest sit on mist, so the primary action is obvious without a second hero.
 */
export function QuickTiles({ tiles }: { tiles: QuickTile[] }) {
  return (
    <Card style={styles.card}>
      <Text variant="heading">Quick access</Text>
      <View style={styles.row}>
        {tiles.map((tile) => (
          <PressableScale
            key={tile.key}
            onPress={tile.onPress}
            haptic="tap"
            accessibilityRole="button"
            accessibilityLabel={tile.badge ? `${tile.label}, ${tile.badge} waiting` : tile.label}
            style={styles.tile}
          >
            <View
              style={[
                styles.well,
                tile.primary && styles.wellPrimary,
                tile.danger && styles.wellDanger,
              ]}
            >
              <Icon
                name={tile.icon}
                size={24}
                color={tile.primary ? ink.inverse : tile.danger ? accent.red : ink.base}
              />
              {tile.badge ? (
                <View style={styles.badge}>
                  <Text variant="micro" weight="bold" tone="inverse">
                    {tile.badge > 9 ? '9+' : tile.badge}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text variant="caption" weight="medium" center numberOfLines={2} style={styles.label}>
              {tile.label}
            </Text>
          </PressableScale>
        ))}
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: space.lg, paddingBottom: space.md },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  tile: { alignItems: 'center', width: 76, gap: space.sm },
  well: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: surface.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wellPrimary: { backgroundColor: ink.base },
  wellDanger: { backgroundColor: '#FBE7E4' },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    backgroundColor: accent.red,
    borderWidth: 2,
    borderColor: surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { lineHeight: 16 },
})
