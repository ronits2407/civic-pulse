import React, { useCallback, useMemo, useState } from 'react'
import { Modal, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LocationPickerSheet } from '@/components/map/LocationPickerSheet'
import { PipelineRail } from '@/components/pipeline/PipelineRail'
import { MediaThumb } from '@/components/report/MediaThumb'
import { Button } from '@/components/ui/Button'
import { Card, Divider } from '@/components/ui/Card'
import { Notice } from '@/components/ui/Feedback'
import { Screen } from '@/components/ui/Screen'
import { PressableScale } from '@/components/ui/PressableScale'
import { Text, useFontStack } from '@/theme/Typography'
import { Icon, type IconName } from '@/theme/icons'
import { useToast } from '@/components/feedback/ToastHost'
import { useAuth } from '@/lib/auth/AuthProvider'
import { reportsApi } from '@/lib/api/endpoints'
import { formatCoordinates } from '@/lib/format'
import { getCurrentPoint, requestLocationPermission, resolveAddress } from '@/lib/location/geo'
import { uploadIssueMedia } from '@/lib/media/upload'
import { useReportDraft, type LocationMode } from '@/features/reporting/useReportDraft'
import { accent, ink, line, radius, space, surface } from '@/theme/tokens'

/**
 * Report an issue.
 *
 * The web flow rebuilt for a phone, with the same contract: media goes to the
 * `issue-media` Storage bucket, then `POST /api/reports/process` files the issue and
 * starts the LangGraph pipeline in the background.
 *
 * Two behaviours are deliberate and worth stating:
 *
 *  - Nothing is ever reported as successfully filed unless the server said so. If an
 *    upload or the POST fails, the draft is kept and the failure is explained.
 *  - Media URLs already uploaded in a previous attempt are reused, so a retry after a
 *    network drop does not upload the same photo twice.
 */

const MIN_DESCRIPTION = 10
const MAX_DESCRIPTION = 1200

type Phase = 'uploading' | 'submitting'

function EvidenceButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: IconName
  label: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic="tap"
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.evidenceButtonWrap}
    >
      <View style={[styles.evidenceButton, disabled && styles.disabled] as any}>
        <Icon name={icon} size={19} color={accent.brand} />
        <Text variant="micro" weight="medium" style={styles.evidenceLabel}>
          {label}
        </Text>
      </View>
    </PressableScale>
  )
}

export default function ReportScreen() {
  const router = useRouter()
  const toast = useToast()
  const insets = useSafeAreaInsets()
  const { userId } = useAuth()

  const { draft, update, clearDraft, restoredFrom, dismissRestoredNotice } = useReportDraft()

  const [phase, setPhase] = useState<Phase | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [locating, setLocating] = useState(false)
  const [permissionIssue, setPermissionIssue] = useState<string | null>(null)
  const [voiceUnavailable, setVoiceUnavailable] = useState(false)
  const [submittedIssueId, setSubmittedIssueId] = useState<string | null>(null)

  // Upload results are cached so a failed POST can be retried without re-uploading.
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [uploadedVideo, setUploadedVideo] = useState<string | null>(null)

  const description = draft.text
  const trimmedLength = description.trim().length

  const setLocation = useCallback(
    (lat: number, lng: number, address: string, mode: LocationMode) => {
      update({ lat, lng, address, locationMode: mode })
    },
    [update]
  )

  // ── Media ─────────────────────────────────────────────────────────────────
  const pickImage = useCallback(
    async (source: 'camera' | 'library') => {
      setPermissionIssue(null)
      try {
        const permission =
          source === 'camera'
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync()

        if (!permission.granted) {
          setPermissionIssue(
            source === 'camera'
              ? 'Camera access is off. Turn it on in Settings to photograph the issue, or attach a photo from your gallery.'
              : 'Photo access is off. Turn it on in Settings to attach an existing photo.'
          )
          return
        }

        const result =
          source === 'camera'
            ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
            : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 })

        if (result.canceled || !result.assets?.length) return
        update({ imageUri: result.assets[0].uri })
        // A newly chosen photo invalidates any previously uploaded one.
        setUploadedImage(null)
      } catch (err: any) {
        setPermissionIssue(err?.message ?? 'Could not open the camera or gallery.')
      }
    },
    [update]
  )

  const pickVideo = useCallback(async () => {
    setPermissionIssue(null)
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        setPermissionIssue('Video access is off. Turn it on in Settings to attach a video.')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 })
      if (result.canceled || !result.assets?.length) return
      update({ videoUri: result.assets[0].uri })
      setUploadedVideo(null)
    } catch (err: any) {
      setPermissionIssue(err?.message ?? 'Could not open the gallery for video.')
    }
  }, [update])

  // ── Location ──────────────────────────────────────────────────────────────
  const useCurrentLocation = useCallback(async () => {
    setLocating(true)
    setPermissionIssue(null)
    try {
      const permission = await requestLocationPermission()
      if (permission === 'denied') {
        setPermissionIssue(
          'Location access is off for CivicPulse. You can still place the pin on the map instead.'
        )
        return
      }
      if (permission === 'unavailable') {
        setPermissionIssue('Location services are turned off on this device.')
        return
      }
      const point = await getCurrentPoint()
      const address = await resolveAddress(point)
      setLocation(point.lat, point.lng, address, 'gps')
      toast.success('Location captured.')
    } catch {
      setPermissionIssue(
        'Could not get a GPS fix. Try again outdoors, or drop the pin on the map manually.'
      )
    } finally {
      setLocating(false)
    }
  }, [setLocation, toast])

  const handleVoice = useCallback(() => {
    setVoiceUnavailable(true)
    toast.info('Voice input is not available in this build. Type your description instead.')
  }, [toast])

  // ── Validation ────────────────────────────────────────────────────────────
  const validation = useMemo(() => {
    if (trimmedLength < MIN_DESCRIPTION) {
      return { ok: false, message: `Describe the problem in at least ${MIN_DESCRIPTION} characters.` }
    }
    if (draft.lat == null || draft.lng == null) {
      return { ok: false, message: 'Set the location so the right field team can find it.' }
    }
    return { ok: true, message: null as string | null }
  }, [trimmedLength, draft.lat, draft.lng])

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (phase) return
    if (!userId) {
      setError('You need to be signed in to submit a report.')
      return
    }
    if (!validation.ok) {
      setError(validation.message)
      return
    }

    setError(null)
    setReviewOpen(false)

    try {
      let imageUrl = uploadedImage
      let videoUrl = uploadedVideo

      if (draft.imageUri && !imageUrl) {
        setPhase('uploading')
        const uploaded = await uploadIssueMedia({ uri: draft.imageUri, userId, kind: 'image' })
        imageUrl = uploaded.publicUrl
        setUploadedImage(imageUrl)
      }

      if (draft.videoUri && !videoUrl) {
        setPhase('uploading')
        const uploaded = await uploadIssueMedia({ uri: draft.videoUri, userId, kind: 'video' })
        videoUrl = uploaded.publicUrl
        setUploadedVideo(videoUrl)
      }

      setPhase('submitting')
      const response = await reportsApi.process({
        text: draft.text.trim(),
        userId,
        imageUrl,
        videoUrl,
        coordinates: {
          lat: draft.lat as number,
          lng: draft.lng as number,
          address: draft.address ?? undefined,
        },
      })

      // Only now is it true that the report was filed.
      await clearDraft()
      setSubmittedIssueId(response.issueId)
      toast.success('Report filed. The pipeline is running.', 'Submitted')
    } catch (err: any) {
      setError(err?.message ?? 'Could not submit the report. Your draft has been kept.')
    } finally {
      setPhase(null)
    }
  }, [phase, userId, validation, uploadedImage, uploadedVideo, draft, clearDraft, toast])

  // ── Submitted confirmation ────────────────────────────────────────────────
  if (submittedIssueId) {
    return (
      <Screen padded scroll edges={['top']} contentContainerStyle={styles.submittedContent}>
        <View style={styles.successMark}>
          <Icon name="check-circle-outline" size={30} color={accent.brand} />
        </View>
        <Text variant="title" center>
          Your report is in
        </Text>
        <Text variant="bodyTight" tone="muted" center style={styles.successBody}>
          Five agents are processing it now. Classification, duplicate checks and the
          credibility review usually finish within a minute.
        </Text>

        <Card style={styles.railCard}>
          <PipelineRail stage="agent0_translation" showLabels />
          <Divider style={styles.railDivider} />
          <Text variant="caption" tone="faint">
            You can safely close the app — the pipeline runs on the server.
          </Text>
        </Card>

        <View style={styles.submittedActions}>
          <Button
            label="Track this report"
            onPress={() => router.replace(`/issue/${submittedIssueId}`)}
            size="lg"
            fullWidth
          />
          <Button
            label="Back to home"
            onPress={() => router.replace('/(citizen)')}
            variant="secondary"
            size="lg"
            fullWidth
          />
        </View>
      </Screen>
    )
  }

  const busy = phase !== null

  return (
    <Screen
      scroll
      padded
      avoidKeyboard
      edges={['top']}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} haptic="tap" accessibilityLabel="Go back">
          <View style={styles.backButton}>
            <Icon name="arrow-left" size={19} color={ink.base} />
          </View>
        </PressableScale>
        <View style={styles.headerText}>
          <Text variant="title">Report an issue</Text>
          <Text variant="caption" tone="faint">
            Any language · photo optional
          </Text>
        </View>
      </View>

      {/* Restored draft */}
      {restoredFrom ? (
        <Notice
          tone="blue"
          title="Draft restored"
          body="We kept what you had started earlier on this device. Nothing has been sent yet."
          icon={<Icon name="content-save-outline" size={15} color={accent.blue} />}
          actionLabel="Dismiss"
          onAction={dismissRestoredNotice}
        />
      ) : null}

      {/* Description */}
      <View>
        <View style={styles.sectionHeader}>
          <Text variant="heading" weight="semibold">
            What is the problem?
          </Text>
          <Text variant="micro" mono tone={trimmedLength > MAX_DESCRIPTION ? 'base' : 'faint'}>
            {trimmedLength}/{MAX_DESCRIPTION}
          </Text>
        </View>
        <View style={styles.textAreaWrap}>
          <ScrollView
            style={styles.textAreaScroll}
            contentContainerStyle={styles.textAreaInner}
            keyboardShouldPersistTaps="handled"
          >
            <DescriptionField
              value={description}
              onChangeText={(text) => update({ text: text.slice(0, MAX_DESCRIPTION) })}
              editable={!busy}
            />
          </ScrollView>
        </View>

        <PressableScale onPress={handleVoice} haptic="tap" accessibilityLabel="Voice input">
          <View style={styles.voiceRow}>
            <Icon name="microphone-outline" size={16} color={ink.muted} />
            <Text variant="caption" tone="muted">
              {voiceUnavailable ? 'Voice input unavailable — type instead' : 'Dictate instead of typing'}
            </Text>
          </View>
        </PressableScale>
      </View>

      {/* Evidence */}
      <View>
        <Text variant="heading" weight="semibold" style={styles.sectionTitle}>
          Evidence
        </Text>
        <Text variant="caption" tone="faint" style={styles.sectionHint}>
          A photo makes classification and credibility checking noticeably more accurate.
        </Text>

        <View style={styles.evidenceRow}>
          <EvidenceButton icon="camera-outline" label="Take photo" onPress={() => pickImage('camera')} disabled={busy} />
          <EvidenceButton icon="image-outline" label="Gallery" onPress={() => pickImage('library')} disabled={busy} />
          <EvidenceButton icon="video-outline" label="Video" onPress={pickVideo} disabled={busy} />
        </View>

        {(draft.imageUri || draft.videoUri) && (
          <View style={styles.thumbs}>
            {draft.imageUri ? (
              <MediaThumb
                uri={draft.imageUri}
                kind="image"
                label="Photo"
                onRemove={() => {
                  update({ imageUri: null })
                  setUploadedImage(null)
                }}
              />
            ) : null}
            {draft.videoUri ? (
              <MediaThumb
                uri={draft.videoUri}
                kind="video"
                label="Video"
                onRemove={() => {
                  update({ videoUri: null })
                  setUploadedVideo(null)
                }}
              />
            ) : null}
          </View>
        )}
      </View>

      {/* Location */}
      <View>
        <Text variant="heading" weight="semibold" style={styles.sectionTitle}>
          Location
        </Text>
        <Text variant="caption" tone="faint" style={styles.sectionHint}>
          Duplicate detection only looks within 200 m, so an accurate pin matters.
        </Text>

        <View style={styles.evidenceRow}>
          <EvidenceButton
            icon={locating ? 'crosshairs' : 'crosshairs-gps'}
            label={locating ? 'Locating…' : 'Use GPS'}
            onPress={useCurrentLocation}
            disabled={busy || locating}
          />
          <EvidenceButton icon="map-marker-outline" label="Pick on map" onPress={() => setPickerOpen(true)} disabled={busy} />
        </View>

        {draft.lat != null && draft.lng != null ? (
          <Card variant="sunken" style={styles.locationCard}>
            <View style={styles.locationRow}>
              <Icon name="map-marker-check-outline" size={16} color={accent.brand} />
              <View style={styles.locationBody}>
                <Text variant="bodyTight" weight="medium" numberOfLines={2}>
                  {draft.address ?? 'Location recorded'}
                </Text>
                <Text variant="micro" mono tone="faint">
                  {formatCoordinates(draft.lat, draft.lng)} · {draft.locationMode === 'gps' ? 'GPS' : 'Map pin'}
                </Text>
              </View>
              <PressableScale
                onPress={() => setPickerOpen(true)}
                haptic="tap"
                accessibilityLabel="Adjust location"
              >
                <View style={styles.adjustButton}>
                  <Text variant="micro" weight="semibold" style={{ color: accent.blue }}>
                    Adjust
                  </Text>
                </View>
              </PressableScale>
            </View>
          </Card>
        ) : null}
      </View>

      {permissionIssue ? (
        <Notice
          tone="amber"
          title="Permission needed"
          body={permissionIssue}
          icon={<Icon name="shield-alert-outline" size={15} color={accent.amberSoft} />}
          actionLabel="Dismiss"
          onAction={() => setPermissionIssue(null)}
        />
      ) : null}

      {error ? (
        <Notice
          tone="red"
          title="Report not submitted"
          body={error}
          icon={<Icon name="alert-circle-outline" size={15} color={accent.redSoft} />}
          actionLabel="Dismiss"
          onAction={() => setError(null)}
        />
      ) : null}

      {/* Actions */}
      <View style={styles.actions}>
        {uploadedImage || uploadedVideo ? (
          <Notice
            tone="blue"
            body="Your evidence uploaded successfully but the report was not filed yet. Submitting again will reuse it."
          />
        ) : null}
        <Button
          label={validation.ok ? 'Review and submit' : 'Complete the report'}
          onPress={() => (validation.ok ? setReviewOpen(true) : setError(validation.message))}
          size="lg"
          fullWidth
          disabled={busy}
          loading={busy}
        />
        <Text variant="micro" tone="faint" center>
          {phase === 'uploading'
            ? 'Uploading evidence…'
            : phase === 'submitting'
              ? 'Filing your report…'
              : 'Your report is saved on this device until you submit it.'}
        </Text>
      </View>

      {/* Review sheet */}
      <Modal visible={reviewOpen} animationType="slide" transparent onRequestClose={() => setReviewOpen(false)} statusBarTranslucent>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
            <Text variant="title">Check before you submit</Text>
            <Text variant="caption" tone="faint">
              This is exactly what the five agents will receive.
            </Text>

            <Card variant="sunken" style={styles.reviewCard}>
              <ReviewRow label="Description" value={description.trim()} />
              <Divider style={styles.reviewDivider} />
              <ReviewRow
                label="Evidence"
                value={
                  [draft.imageUri ? 'Photo' : null, draft.videoUri ? 'Video' : null]
                    .filter(Boolean)
                    .join(' + ') || 'None'
                }
              />
              <Divider style={styles.reviewDivider} />
              <ReviewRow label="Location" value={draft.address ?? 'Not set'} />
              <Divider style={styles.reviewDivider} />
              <ReviewRow
                label="Coordinates"
                value={
                  draft.lat != null && draft.lng != null
                    ? formatCoordinates(draft.lat, draft.lng)
                    : 'Not set'
                }
                mono
              />
            </Card>

            <View style={styles.sheetActions}>
              <Button
                label="Submit report"
                onPress={handleSubmit}
                size="lg"
                fullWidth
                icon={<Icon name="send-outline" size={17} color="#ffffff" />}
              />
              <Button label="Keep editing" onPress={() => setReviewOpen(false)} variant="ghost" fullWidth />
            </View>
          </View>
        </View>
      </Modal>

      <LocationPickerSheet
        visible={pickerOpen}
        initial={draft.lat != null && draft.lng != null ? { lat: draft.lat, lng: draft.lng } : null}
        onClose={() => setPickerOpen(false)}
        onConfirm={(point, address) => {
          setLocation(point.lat, point.lng, address, 'map')
          setPickerOpen(false)
        }}
      />
    </Screen>
  )
}

/**
 * The description field.
 *
 * A multiline `TextInput` inside an explicitly bounded scroll view: without the bound
 * the field grows unbounded (swallowing the whole screen) on Android, which is the
 * classic long-text-entry layout bug. The font family comes from the stack so the
 * field matches the surrounding type even if custom fonts failed to load.
 */
function DescriptionField({
  value,
  onChangeText,
  editable,
}: {
  value: string
  onChangeText: (text: string) => void
  editable: boolean
}) {
  const fontStack = useFontStack()

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      editable={editable}
      multiline
      textAlignVertical="top"
      placeholder="e.g. Large pothole near the school gate on Gangapur Road — two bikes fell here this week."
      placeholderTextColor={ink.faint}
      selectionColor={accent.brand}
      style={[styles.textArea, { fontFamily: fontStack.regular }]}
    />
  )
}

function ReviewRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.reviewRow}>
      <Text variant="micro" weight="medium" tone="faint">
        {label}
      </Text>
      <Text variant={mono ? 'data' : 'bodyTight'} numberOfLines={4} style={styles.reviewValue}>
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { gap: space.xl, paddingBottom: space.huge },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: surface.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line.base,
  },
  headerText: { flex: 1, gap: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionTitle: { marginBottom: 2 },
  sectionHint: { marginBottom: space.md },
  textAreaWrap: {
    marginTop: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: line.base,
    backgroundColor: surface.sunken,
    overflow: 'hidden',
  },
  textAreaScroll: { maxHeight: 168 },
  textAreaInner: { padding: space.md },
  textArea: {
    minHeight: 130,
    color: ink.base,
    fontSize: 16,
    lineHeight: 23,
    padding: 0,
  },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.md },
  evidenceRow: { flexDirection: 'row', gap: space.md },
  evidenceButtonWrap: { flex: 1 },
  evidenceButton: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: surface.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line.base,
    minHeight: 74,
  },
  evidenceLabel: { color: ink.muted },
  disabled: { opacity: 0.5 },
  thumbs: { flexDirection: 'row', gap: space.md, marginTop: space.md, flexWrap: 'wrap' },
  locationCard: { marginTop: space.md },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  locationBody: { flex: 1, gap: 2 },
  adjustButton: {
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(9,105,218,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(9,105,218,0.4)',
  },
  actions: { gap: space.md },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: surface.canvas,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line.base,
    padding: space.lg,
    gap: space.md,
    maxHeight: '88%',
  },
  reviewCard: { gap: space.md },
  reviewRow: { gap: 3 },
  reviewValue: { flexShrink: 1 },
  reviewDivider: { marginVertical: -space.sm },
  sheetActions: { gap: space.sm, marginTop: space.sm },
  submittedContent: { flexGrow: 1, justifyContent: 'center', gap: space.lg },
  successMark: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(45,164,78,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(45,164,78,0.45)',
  },
  successBody: { maxWidth: 340, alignSelf: 'center' },
  railCard: { gap: space.lg },
  railDivider: { marginVertical: space.xs },
  submittedActions: { gap: space.md, marginTop: space.sm },
})
