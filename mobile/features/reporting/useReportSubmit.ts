import { useCallback, useMemo, useState } from 'react'
import * as ImagePicker from 'expo-image-picker'

import { useToast } from '@/components/feedback/ToastHost'
import { reportsApi } from '@/lib/api/endpoints'
import { getCurrentPoint, requestLocationPermission, resolveAddress } from '@/lib/location/geo'
import { uploadIssueMedia } from '@/lib/media/upload'
import { useReportDraft, type LocationMode } from '@/features/reporting/useReportDraft'

/**
 * Everything the report flow does, separate from how it looks.
 *
 * Same contract as before the redesign: media goes to the `issue-media` bucket, then
 * `POST /api/reports/process` files the issue. Nothing is reported as filed unless the
 * server said so, and uploaded media URLs are cached so a retry never re-uploads.
 */

export const MIN_DESCRIPTION = 10
export const MAX_DESCRIPTION = 1200

export type Phase = 'uploading' | 'submitting'

function errorMessage(err: unknown): string | undefined {
  return err instanceof Error && err.message ? err.message : undefined
}

export function useReportSubmit(userId: string | null) {
  const toast = useToast()
  const { draft, update, clearDraft, restoredFrom, dismissRestoredNotice } = useReportDraft()

  const [phase, setPhase] = useState<Phase | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [permissionIssue, setPermissionIssue] = useState<string | null>(null)
  const [submittedIssueId, setSubmittedIssueId] = useState<string | null>(null)
  // Upload results are cached so a failed POST can be retried without re-uploading.
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [uploadedVideo, setUploadedVideo] = useState<string | null>(null)

  const trimmedLength = draft.text.trim().length

  const setLocation = useCallback(
    (lat: number, lng: number, address: string, mode: LocationMode) => update({ lat, lng, address, locationMode: mode }),
    [update]
  )

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
      } catch (err) {
        setPermissionIssue(errorMessage(err) ?? 'Could not open the camera or gallery.')
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
    } catch (err) {
      setPermissionIssue(errorMessage(err) ?? 'Could not open the gallery for video.')
    }
  }, [update])

  const removeImage = useCallback(() => {
    update({ imageUri: null })
    setUploadedImage(null)
  }, [update])

  const removeVideo = useCallback(() => {
    update({ videoUri: null })
    setUploadedVideo(null)
  }, [update])

  const useCurrentLocation = useCallback(async () => {
    setLocating(true)
    setPermissionIssue(null)
    try {
      const permission = await requestLocationPermission()
      if (permission === 'denied') {
        setPermissionIssue('Location access is off for CivicPulse. You can still place the pin on the map instead.')
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
      setPermissionIssue('Could not get a GPS fix. Try again outdoors, or drop the pin on the map manually.')
    } finally {
      setLocating(false)
    }
  }, [setLocation, toast])

  const validation = useMemo(() => {
    if (trimmedLength < MIN_DESCRIPTION) {
      return { ok: false, message: `Describe the problem in at least ${MIN_DESCRIPTION} characters.` }
    }
    if (draft.lat == null || draft.lng == null) {
      return { ok: false, message: 'Set the location so the right field team can find it.' }
    }
    return { ok: true, message: null as string | null }
  }, [trimmedLength, draft.lat, draft.lng])

  const submit = useCallback(async () => {
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
    try {
      let imageUrl = uploadedImage
      let videoUrl = uploadedVideo
      if (draft.imageUri && !imageUrl) {
        setPhase('uploading')
        imageUrl = (await uploadIssueMedia({ uri: draft.imageUri, userId, kind: 'image' })).publicUrl
        setUploadedImage(imageUrl)
      }
      if (draft.videoUri && !videoUrl) {
        setPhase('uploading')
        videoUrl = (await uploadIssueMedia({ uri: draft.videoUri, userId, kind: 'video' })).publicUrl
        setUploadedVideo(videoUrl)
      }
      setPhase('submitting')
      const response = await reportsApi.process({
        text: draft.text.trim(),
        userId,
        imageUrl,
        videoUrl,
        coordinates: { lat: draft.lat as number, lng: draft.lng as number, address: draft.address ?? undefined },
      })
      // Only now is it true that the report was filed.
      await clearDraft()
      setSubmittedIssueId(response.issueId)
      toast.success('Report filed. The agents are on it.', 'Submitted')
    } catch (err) {
      setError(errorMessage(err) ?? 'Could not submit the report. Your draft has been kept.')
    } finally {
      setPhase(null)
    }
  }, [phase, userId, validation, uploadedImage, uploadedVideo, draft, clearDraft, toast])

  return {
    draft,
    update,
    restoredFrom,
    dismissRestoredNotice,
    phase,
    busy: phase !== null,
    error,
    setError,
    locating,
    permissionIssue,
    setPermissionIssue,
    submittedIssueId,
    trimmedLength,
    validation,
    setLocation,
    pickImage,
    pickVideo,
    removeImage,
    removeVideo,
    useCurrentLocation,
    submit,
  }
}
