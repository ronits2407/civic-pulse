import { File } from 'expo-file-system'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'

import { supabase } from '@/lib/supabase/client'

/**
 * Media handling for the report flow.
 *
 * Two decisions worth stating:
 *
 *  1. Images are downscaled and re-encoded before upload. A modern phone camera
 *     produces 3–6 MB files; on Indian mobile data that is a 20-second upload for a
 *     photo that a municipal clerk reads on a laptop. 1600 px at quality 0.7 keeps
 *     the evidence legible at a fraction of the size.
 *  2. Uploads go to the same `issue-media` bucket and the same
 *     `<userId>/<timestamp>-<name>` path convention the web app uses, so the two
 *     clients produce interchangeable records and the same Storage RLS policies apply.
 *
 * Progress is reported in named stages rather than bytes. Supabase's upload API does
 * not expose a byte-level callback, and inventing a fake percentage would be worse
 * than telling the truth about which step is running.
 */

export type UploadStage = 'preparing' | 'uploading' | 'finalising'
export type MediaKind = 'image' | 'video'

export interface UploadedMedia {
  publicUrl: string
  path: string
  /** Final size in bytes, when the platform reports it. */
  bytes: number | null
}

const BUCKET = 'issue-media'
const MAX_IMAGE_WIDTH = 1600
const IMAGE_QUALITY = 0.7

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  webm: 'video/webm',
}

function extensionOf(uri: string, fallback: string): string {
  const clean = uri.split('?')[0]
  const match = clean.match(/\.([A-Za-z0-9]{2,5})$/)
  return match ? match[1].toLowerCase() : fallback
}

function guessMimeType(uri: string, kind: MediaKind): string {
  const ext = extensionOf(uri, kind === 'image' ? 'jpg' : 'mp4')
  return MIME_BY_EXTENSION[ext] ?? (kind === 'image' ? 'image/jpeg' : 'video/mp4')
}

/**
 * Downscale and re-encode a picked image.
 * Returns the original URI unchanged if manipulation fails — a slightly large photo
 * is a much better outcome than a failed report.
 */
async function compressImage(uri: string): Promise<string> {
  try {
    const context = ImageManipulator.manipulate(uri)
    context.resize({ width: MAX_IMAGE_WIDTH })
    const rendered = await context.renderAsync()
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: IMAGE_QUALITY })
    return saved?.uri ?? uri
  } catch {
    return uri
  }
}

/** Read a local file into an ArrayBuffer — what Supabase Storage accepts directly. */
async function readBytes(uri: string): Promise<ArrayBuffer> {
  const file = new File(uri)
  return file.arrayBuffer()
}

function buildObjectPath(userId: string, kind: MediaKind, uri: string): string {
  const ext = extensionOf(uri, kind === 'image' ? 'jpg' : 'mp4')
  // Mirrors the web app's `${user.id}/${Date.now()}-${name}` convention.
  return `${userId}/${Date.now()}-${kind}.${kind === 'image' ? 'jpg' : ext}`
}

/**
 * Upload one piece of evidence and return its public URL.
 * Throws with a message written for the citizen, not for a developer.
 */
export async function uploadIssueMedia(params: {
  uri: string
  userId: string
  kind: MediaKind
  onStage?: (stage: UploadStage) => void
}): Promise<UploadedMedia> {
  const { uri, userId, kind, onStage } = params

  onStage?.('preparing')
  const preparedUri = kind === 'image' ? await compressImage(uri) : uri

  let bytes: ArrayBuffer
  try {
    bytes = await readBytes(preparedUri)
  } catch (err: any) {
    throw new Error(
      `Could not read the ${kind === 'image' ? 'photo' : 'video'} from this device. Try choosing it again.`
    )
  }

  if (bytes.byteLength === 0) {
    throw new Error(`The selected ${kind} appears to be empty.`)
  }

  const path = buildObjectPath(userId, kind, preparedUri)
  const contentType = guessMimeType(preparedUri, kind)

  onStage?.('uploading')
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    upsert: false,
  })

  if (error) {
    // 413 / payload errors are worth calling out separately — they are the most
    // common real-world failure on mobile networks and the least actionable as-is.
    const message = /payload|too large|exceed/i.test(error.message)
      ? `This ${kind} is too large to upload. Try a shorter video or a smaller photo.`
      : `Upload failed: ${error.message}`
    throw new Error(message)
  }

  onStage?.('finalising')
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  if (!data?.publicUrl) {
    throw new Error('Upload finished but no public URL came back. Please try again.')
  }

  return { publicUrl: data.publicUrl, path, bytes: bytes.byteLength }
}
