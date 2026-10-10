import React, { useCallback, useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native'

import { Choice } from '@/components/mesh/Choice'
import {
  HAZARD_SEVERITIES,
  HAZARD_TYPES,
  REJECT_MESSAGE,
  SEVERITY_LABEL,
  TYPE_ICON,
  TYPE_LABEL,
} from '@/components/mesh/meta'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Text } from '@/theme/Typography'
import { MESH_CONFIG } from '@/lib/mesh/config'
import type { CreateAlertInput, CreateAlertOutcome } from '@/lib/mesh/engine'
import type { AlertSeverity, AlertType } from '@/lib/mesh/protocol'
import { validateSummary } from '@/lib/mesh/validate'
import { getCurrentPoint, requestLocationPermission } from '@/lib/location/geo'
import { accent, ink, line, radius, space, surface } from '@/theme/tokens'

/** Local public hazard alert: fixed categories, validated with the same rules a receiver applies. */
interface Props {
  visible: boolean
  onClose: () => void
  onSend: (input: CreateAlertInput) => Promise<CreateAlertOutcome>
}

export function HazardSheet({ visible, onClose, onSend }: Props) {
  const [type, setType] = useState<AlertType>('flood')
  const [severity, setSeverity] = useState<AlertSeverity>('warning')
  const [summary, setSummary] = useState('')
  const [shareLocation, setShareLocation] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (visible) {
      setSummary('')
      setError(null)
      setSending(false)
    }
  }, [visible])

  const send = useCallback(async () => {
    const text = summary.trim()
    if (!validateSummary(text).ok) return setError(REJECT_MESSAGE.bad_summary)
    setSending(true)
    setError(null)
    try {
      let point: { lat: number; lng: number } | null = null
      if (shareLocation && (await requestLocationPermission()) === 'granted') {
        point = await getCurrentPoint({ timeoutMs: 8_000 }).catch(() => null)
      }
      const location = point ? { latitude: point.lat, longitude: point.lng } : {}
      const result = await onSend({ type, severity, summary: text, ...location })
      if (result.ok) onClose()
      else setError(REJECT_MESSAGE[result.reason] ?? 'Could not create the alert.')
    } finally {
      setSending(false)
    }
  }, [summary, shareLocation, type, severity, onSend, onClose])

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.sheet} accessibilityViewIsModal>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Text variant="title" weight="bold">
              Report a hazard nearby
            </Text>
            <Text variant="caption" tone="muted">
              Shared as an unverified community report with phones near you. Not an official warning.
            </Text>

            <Text variant="label" weight="semibold" tone="muted">
              WHAT IS HAPPENING
            </Text>
            <View style={styles.chips}>
              {HAZARD_TYPES.map((t) => (
                <Choice key={t} selected={type === t} label={TYPE_LABEL[t]} icon={TYPE_ICON[t]} onPress={() => setType(t)} />
              ))}
            </View>

            <Text variant="label" weight="semibold" tone="muted">
              HOW SERIOUS
            </Text>
            <View style={styles.chips}>
              {HAZARD_SEVERITIES.map((s) => (
                <Choice key={s} selected={severity === s} label={SEVERITY_LABEL[s]} onPress={() => setSeverity(s)} />
              ))}
            </View>

            <Input
              label="Short description"
              value={summary}
              onChangeText={setSummary}
              maxLength={MESH_CONFIG.summaryMaxChars}
              placeholder="e.g. Water knee-deep on College Road"
              hint={`${summary.trim().length}/${MESH_CONFIG.summaryMaxChars}. No names or phone numbers.`}
              error={error}
              multiline
            />

            <View style={styles.toggle}>
              <View style={styles.flex}>
                <Text variant="bodyTight" weight="semibold">
                  Include the location
                </Text>
                <Text variant="caption" tone="muted">
                  Helps others judge if it affects them.
                </Text>
              </View>
              <Switch
                value={shareLocation}
                onValueChange={setShareLocation}
                trackColor={{ false: line.base, true: accent.brandDim }}
                thumbColor={shareLocation ? accent.brand : ink.muted}
                accessibilityLabel="Include the location"
              />
            </View>

            <Button label="Send to nearby phones" size="lg" fullWidth loading={sending} onPress={() => void send()} />
            <Button label="Cancel" variant="secondary" size="lg" fullWidth onPress={onClose} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    maxHeight: '90%',
    backgroundColor: surface.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line.base,
  },
  content: { padding: space.xl, gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: surface.sunken,
    minHeight: 56,
  },
})
