import React from 'react'
import { StyleSheet, View } from 'react-native'

import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/Feedback'
import { Text } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import { SEVERITY_LABEL, SEVERITY_TONE, STATE_SHORT, STATE_TONE, TYPE_ICON, TYPE_LABEL } from '@/components/mesh/meta'
import { DELIVERY_LABEL } from '@/lib/mesh/alerts'
import type { FeedItem } from '@/lib/mesh/feed'
import { formatCoordinates, timeAgo } from '@/lib/format'
import { accent, space, TONE_COLOR, TONE_TINT } from '@/theme/tokens'

/**
 * Received and created alerts.
 *
 * Every card says who it came from in plain terms, that it is an unverified community
 * report, and exactly what delivery evidence exists. There is deliberately no
 * "delivered" or "server confirmed" wording anywhere in this file.
 */

function expiresIn(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000))
  return minutes >= 60 ? `${Math.round(minutes / 60)}h left` : `${minutes}m left`
}

export function AlertCard({ item, now }: { item: FeedItem; now: number }) {
  const { alert } = item
  const severityTone = item.expired ? 'slate' : SEVERITY_TONE[alert.severity]
  const stateTone = STATE_TONE[item.state]
  const from = item.direction === 'local' ? 'Created on this phone' : `Received from a nearby phone · ${alert.hopCount} hop${alert.hopCount === 1 ? '' : 's'}`

  return (
    <Card
      accentColor={TONE_COLOR[severityTone]}
      style={[styles.card, item.expired && styles.expired]}
    >
      <View style={styles.head}>
        <Icon name={TYPE_ICON[alert.type]} size={20} color={TONE_COLOR[severityTone]} />
        <View style={styles.flex}>
          <Text variant="bodyTight" weight="semibold">
            {TYPE_LABEL[alert.type]}
            {item.expired ? ' · expired' : ''}
          </Text>
          <Text variant="micro" tone="faint">
            {timeAgo(new Date(alert.createdAt).toISOString())} · {item.expired ? 'no longer active' : expiresIn(alert.expiresAt - now)}
          </Text>
        </View>
        <Chip
          dense
          label={SEVERITY_LABEL[alert.severity].toUpperCase()}
          color={TONE_COLOR[severityTone]}
          tint={TONE_TINT[severityTone]}
        />
      </View>

      <Text variant="body">{alert.summary}</Text>

      {alert.latitude !== undefined && alert.longitude !== undefined ? (
        <View style={styles.meta}>
          <Icon name="map-marker-outline" size={13} color={accent.slate} />
          <Text variant="caption" tone="muted" mono>
            {formatCoordinates(alert.latitude, alert.longitude)}
          </Text>
        </View>
      ) : null}

      <Text variant="caption" tone="muted">
        {from}
      </Text>

      <View style={styles.footer}>
        <Chip dense label="UNVERIFIED COMMUNITY REPORT" color={accent.amberSoft} tint={TONE_TINT.amber} />
        <Chip
          dense
          label={STATE_SHORT[item.state]}
          color={TONE_COLOR[stateTone]}
          tint={TONE_TINT[stateTone]}
        />
      </View>
      <Text variant="micro" tone="faint">
        {evidenceLine(item)}
      </Text>
    </Card>
  )
}

/** The exact evidence behind the delivery chip, in words. */
function evidenceLine(item: FeedItem): string {
  if (item.expired) return DELIVERY_LABEL.expired
  if (item.confirmedPeers > 0) {
    const n = item.confirmedPeers
    return `${n} nearby phone${n === 1 ? '' : 's'} confirmed saving this. Other phones may not have it.`
  }
  if (item.waitingPeers > 0) return 'Queued for a nearby phone. Not confirmed yet.'
  return item.direction === 'local' ? DELIVERY_LABEL.stored_locally : DELIVERY_LABEL.received_from_peer
}

export function AlertFeed({ items }: { items: FeedItem[] }) {
  const now = Date.now()
  if (items.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Icon name="broadcast" size={24} color={accent.slate} />}
          title="No alerts yet"
          body="Alerts you create or receive from nearby phones appear here, and stay on this phone until they expire."
        />
      </Card>
    )
  }
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <AlertCard key={item.alert.id} item={item} now={now} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: space.md },
  card: { gap: space.sm },
  expired: { opacity: 0.6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
})
