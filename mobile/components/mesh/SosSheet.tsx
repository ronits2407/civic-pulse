import React, { useCallback, useEffect, useState } from 'react'
import { Modal, Pressable, StyleSheet, Switch, View } from 'react-native'

import { Button } from '@/components/ui/Button'
import { Text } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import { REJECT_MESSAGE } from '@/components/mesh/meta'
import type { CreateAlertInput, CreateAlertOutcome } from '@/lib/mesh/engine'
import { getCurrentPoint, requestLocationPermission } from '@/lib/location/geo'
import { accent, ink, line, radius, space, surface } from '@/theme/tokens'

/**
 * SOS confirmation.
 *
 * An SOS is never one tap. The sheet states plainly who will see it and that it is not a
 * call to emergency services, and exact location is OFF unless the user turns it on.
 * Pressing Send is the only way an SOS is created: received alerts never reach this code.
 */

interface Props {
  visible: boolean
  relayOn: boolean
  onClose: () => void
  onSend: (input: CreateAlertInput) => Promise<CreateAlertOutcome>
}

export function SosSheet({ visible, relayOn, onClose, onSend }: Props) {
  const [shareLocation, setShareLocation] = useState(false)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (visible) {
      setShareLocation(false)
      setMessage(null)
      setSending(false)
    }
  }, [visible])

  const send = useCallback(async () => {
    setSending(true)
    setMessage(null)
    try {
      let point: { lat: number; lng: number } | null = null
      if (shareLocation) {
        if ((await requestLocationPermission()) === 'granted') {
          point = await getCurrentPoint({ timeoutMs: 8_000 }).catch(() => null)
        }
        if (!point) setMessage('Location was not available, so the SOS was sent without it.')
      }
      const result = await onSend({
        type: 'sos',
        severity: 'critical',
        summary: point ? 'SOS: I need help. Location included.' : 'SOS: I need help.',
        ...(point ? { latitude: point.lat, longitude: point.lng } : {}),
      })
      if (result.ok) onClose()
      else setMessage(REJECT_MESSAGE[result.reason] ?? 'Could not create the SOS.')
    } finally {
      setSending(false)
    }
  }, [shareLocation, onSend, onClose])

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cancel SOS" />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.title}>
            <Icon name="alert-octagon-outline" size={26} color={accent.redSoft} />
            <Text variant="title" weight="bold">
              Send an SOS?
            </Text>
          </View>

          <Text variant="body" tone="muted">
            Phones near you that have the relay on will get a loud alert, and may pass it on.
          </Text>
          <Text variant="bodyTight" weight="semibold" style={{ color: accent.amberSoft }}>
            This does not call the police, fire brigade or an ambulance. If you can, call 112.
          </Text>

          <View style={styles.toggle}>
            <View style={styles.flex}>
              <Text variant="bodyTight" weight="semibold">
                Include my exact location
              </Text>
              <Text variant="caption" tone="muted">
                Anyone who receives it will see it. Off by default.
              </Text>
            </View>
            <Switch
              value={shareLocation}
              onValueChange={setShareLocation}
              trackColor={{ false: line.base, true: accent.brandDim }}
              thumbColor={shareLocation ? accent.brand : ink.muted}
              accessibilityLabel="Include my exact location"
            />
          </View>

          {!relayOn ? (
            <Text variant="caption" style={{ color: accent.amberSoft }}>
              The relay is off. Turn it on first, or this SOS will only be saved on this phone.
            </Text>
          ) : null}
          {message ? (
            <Text variant="caption" style={{ color: accent.redSoft }} accessibilityLiveRegion="polite">
              {message}
            </Text>
          ) : null}

          <Button label="Send SOS" variant="primary" size="lg" fullWidth loading={sending} onPress={() => void send()} style={styles.sendButton} accessibilityLabel="Send SOS to nearby phones" />
          <Button label="Cancel" variant="secondary" size="lg" fullWidth onPress={onClose} />
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: surface.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line.base,
    padding: space.xl,
    gap: space.md,
  },
  title: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: surface.sunken,
    minHeight: 56,
  },
  sendButton: { backgroundColor: accent.red, borderColor: accent.red },
})
