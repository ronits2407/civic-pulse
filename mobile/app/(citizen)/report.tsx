import React, { useState } from 'react'
import { ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'

import { LocationPickerSheet } from '@/components/map/LocationPickerSheet'
import { ActionTile, StepCard } from '@/components/report/StepCard'
import { MediaThumb } from '@/components/report/MediaThumb'
import { ReviewSheet } from '@/components/report/ReviewSheet'
import { SubmittedView } from '@/components/report/SubmittedView'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Feedback'
import { Screen } from '@/components/ui/Screen'
import { TopBar } from '@/components/ui/TopBar'
import { PressableScale } from '@/components/ui/PressableScale'
import { Text, useFontStack } from '@/theme/Typography'
import { Icon } from '@/theme/icons'
import { useAuth } from '@/lib/auth/AuthProvider'
import { formatCoordinates } from '@/lib/format'
import { MAX_DESCRIPTION, MIN_DESCRIPTION, useReportSubmit } from '@/features/reporting/useReportSubmit'
import { accent, ink, radius, space, surface } from '@/theme/tokens'

/**
 * Report an issue: three numbered steps (describe, add evidence, set the place), then a
 * review sheet. The draft persists on the device until the server accepts it. All the
 * behaviour lives in useReportSubmit; this file is layout only.
 */
export default function ReportScreen() {
  const router = useRouter()
  const { userId } = useAuth()
  const r = useReportSubmit(userId)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const font = useFontStack()

  if (r.submittedIssueId) {
    const id = r.submittedIssueId
    return <SubmittedView onTrack={() => router.replace(`/issue/${id}`)} onHome={() => router.replace('/(citizen)')} />
  }

  const { draft, busy } = r
  const described = r.trimmedLength >= MIN_DESCRIPTION
  const located = draft.lat != null && draft.lng != null
  const hasMedia = Boolean(draft.imageUri || draft.videoUri)

  return (
    <Screen scroll padded avoidKeyboard edges={['top', 'bottom']} contentContainerStyle={styles.content}>
      <TopBar title="Report an issue" subtitle="Write in any language. A photo helps, but is optional." />

      {r.restoredFrom ? (
        <Notice
          tone="blue"
          title="Draft restored"
          body="We kept what you started earlier on this device. Nothing has been sent yet."
          icon={<Icon name="content-save-outline" size={16} color={accent.blue} />}
          actionLabel="Dismiss"
          onAction={r.dismissRestoredNotice}
        />
      ) : null}

      <StepCard
        step={1}
        title="What is the problem?"
        done={described}
        right={
          <Text variant="micro" mono tone={r.trimmedLength > MAX_DESCRIPTION - 50 ? accent.amber : 'faint'}>
            {r.trimmedLength}/{MAX_DESCRIPTION}
          </Text>
        }
      >
        <View style={styles.textWell}>
          <ScrollView style={styles.textScroll} keyboardShouldPersistTaps="handled">
            <TextInput
              value={draft.text}
              onChangeText={(t) => r.update({ text: t.slice(0, MAX_DESCRIPTION) })}
              editable={!busy}
              multiline
              textAlignVertical="top"
              placeholder="e.g. Large pothole by the school gate on Gangapur Road. Two bikes fell here this week."
              placeholderTextColor={ink.faint}
              selectionColor={accent.brand}
              accessibilityLabel="Describe the problem"
              style={[styles.textArea, { fontFamily: font.regular }]}
            />
          </ScrollView>
        </View>
      </StepCard>

      <StepCard step={2} title="Add a photo" hint="Photos make classification and the credibility check more accurate." done={hasMedia} optional>
        <View style={styles.tiles}>
          <ActionTile icon="camera-outline" label="Camera" onPress={() => r.pickImage('camera')} disabled={busy} />
          <ActionTile icon="image-outline" label="Gallery" onPress={() => r.pickImage('library')} disabled={busy} />
          <ActionTile icon="video-outline" label="Video" onPress={r.pickVideo} disabled={busy} />
        </View>
        {hasMedia ? (
          <View style={styles.thumbs}>
            {draft.imageUri ? <MediaThumb uri={draft.imageUri} kind="image" label="Photo" onRemove={r.removeImage} /> : null}
            {draft.videoUri ? <MediaThumb uri={draft.videoUri} kind="video" label="Video" onRemove={r.removeVideo} /> : null}
          </View>
        ) : null}
      </StepCard>

      <StepCard step={3} title="Where is it?" hint="The duplicate check only looks within 200 m, so an accurate pin matters." done={located}>
        {located ? (
          <View style={styles.place}>
            <View style={styles.placeIcon}>
              <Icon name="map-marker-check-outline" size={20} color={ink.inverse} />
            </View>
            <View style={styles.flex}>
              <Text variant="bodyTight" weight="semibold" numberOfLines={2}>
                {draft.address ?? 'Location recorded'}
              </Text>
              <Text variant="micro" mono tone="faint">
                {formatCoordinates(draft.lat as number, draft.lng as number)} · {draft.locationMode === 'gps' ? 'GPS' : 'Map pin'}
              </Text>
            </View>
            <PressableScale onPress={() => setPickerOpen(true)} haptic="tap" accessibilityRole="button" accessibilityLabel="Adjust location">
              <Text variant="label" weight="semibold" style={{ color: accent.blue }}>
                Adjust
              </Text>
            </PressableScale>
          </View>
        ) : null}
        <View style={styles.tiles}>
          <ActionTile
            icon={r.locating ? 'crosshairs' : 'crosshairs-gps'}
            label={r.locating ? 'Locating…' : 'Use GPS'}
            onPress={r.useCurrentLocation}
            disabled={busy || r.locating}
          />
          <ActionTile icon="map-marker-outline" label="Pick on map" onPress={() => setPickerOpen(true)} disabled={busy} />
        </View>
      </StepCard>

      {r.permissionIssue ? (
        <Notice
          tone="amber"
          title="Permission needed"
          body={r.permissionIssue}
          icon={<Icon name="shield-alert-outline" size={16} color={accent.amberSoft} />}
          actionLabel="Dismiss"
          onAction={() => r.setPermissionIssue(null)}
        />
      ) : null}

      {r.error ? (
        <Notice tone="red" title="Not submitted" body={r.error} icon={<Icon name="alert-circle-outline" size={16} color={accent.red} />} />
      ) : null}

      <View style={styles.actions}>
        <Button
          label={busy ? (r.phase === 'uploading' ? 'Uploading evidence' : 'Filing your report') : r.validation.ok ? 'Review and submit' : 'Complete the steps above'}
          onPress={() => (r.validation.ok ? setReviewOpen(true) : r.setError(r.validation.message))}
          size="lg"
          fullWidth
          trailingArrow={r.validation.ok && !busy}
          loading={busy}
        />
        <Text variant="caption" tone="faint" center>
          Your report is saved on this device until you submit it.
        </Text>
      </View>

      <ReviewSheet
        visible={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onSubmit={() => {
          setReviewOpen(false)
          r.submit()
        }}
        text={draft.text.trim()}
        imageUri={draft.imageUri}
        videoUri={draft.videoUri}
        address={draft.address}
        lat={draft.lat}
        lng={draft.lng}
      />

      <LocationPickerSheet
        visible={pickerOpen}
        initial={located ? { lat: draft.lat as number, lng: draft.lng as number } : null}
        onClose={() => setPickerOpen(false)}
        onConfirm={(point, address) => {
          r.setLocation(point.lat, point.lng, address, 'map')
          setPickerOpen(false)
        }}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { gap: space.lg, paddingBottom: space.xxl },
  textWell: { borderRadius: radius.md, backgroundColor: surface.sunken, overflow: 'hidden' },
  // Bounded so the multiline field cannot grow to swallow the screen on Android.
  textScroll: { maxHeight: 180 },
  textArea: { minHeight: 130, color: ink.base, fontSize: 16, lineHeight: 24, padding: space.lg },
  tiles: { flexDirection: 'row', gap: space.sm },
  thumbs: { flexDirection: 'row', gap: space.md, flexWrap: 'wrap' },
  place: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: surface.mist },
  placeIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: ink.base, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: 2 },
  actions: { gap: space.sm, marginTop: space.sm },
})
