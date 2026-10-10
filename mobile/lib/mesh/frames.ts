import { MESH_CONFIG, type MeshConfig } from '@/lib/mesh/config'
import { byteLength, isNodeId, isRecord, isUuid, type Validation } from '@/lib/mesh/protocol'

/**
 * Wire frames exchanged between two connected phones.
 *
 * Every frame carries the sender's node id. Nearby does not promise that separate byte
 * payloads arrive in order, so no frame may depend on an earlier "hello" having arrived.
 */
export type Frame =
  | { t: 'hello'; v: number; node: string }
  | { t: 'inv'; v: number; node: string; ids: string[] }
  | { t: 'alerts'; v: number; node: string; alerts: unknown[] }
  | { t: 'ack'; v: number; node: string; ids: string[]; rejected: string[] }

function idList(value: unknown, max: number): string[] | null {
  if (!Array.isArray(value) || value.length > max) return null
  const out: string[] = []
  for (const id of value) {
    if (!isUuid(id)) return null
    out.push(id.toLowerCase())
  }
  return out
}

/** Parse and bound an untrusted frame. Alerts inside stay `unknown`: each is validated on its own. */
export function parseFrame(text: string, config: MeshConfig = MESH_CONFIG): Validation<Frame> {
  if (typeof text !== 'string') return { ok: false, reason: 'malformed' }
  if (byteLength(text) > config.frameMaxBytes) return { ok: false, reason: 'too_large' }

  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  if (!isRecord(raw)) return { ok: false, reason: 'malformed' }
  if (raw.v !== config.schemaVersion) return { ok: false, reason: 'unsupported_version' }
  if (!isNodeId(raw.node)) return { ok: false, reason: 'malformed' }
  const node = raw.node
  const v = raw.v as number

  switch (raw.t) {
    case 'hello':
      return { ok: true, value: { t: 'hello', v, node } }
    case 'inv': {
      const ids = idList(raw.ids, config.inventoryMaxIds)
      return ids ? { ok: true, value: { t: 'inv', v, node, ids } } : { ok: false, reason: 'malformed' }
    }
    case 'alerts': {
      if (!Array.isArray(raw.alerts) || raw.alerts.length === 0 || raw.alerts.length > config.frameMaxAlerts) {
        return { ok: false, reason: 'malformed' }
      }
      return { ok: true, value: { t: 'alerts', v, node, alerts: raw.alerts } }
    }
    case 'ack': {
      const ids = idList(raw.ids ?? [], config.frameMaxAlerts)
      const rejected = idList(raw.rejected ?? [], config.frameMaxAlerts)
      if (!ids || !rejected) return { ok: false, reason: 'malformed' }
      return { ok: true, value: { t: 'ack', v, node, ids, rejected } }
    }
    default:
      return { ok: false, reason: 'malformed' }
  }
}

export const encodeFrame = (frame: Frame): string => JSON.stringify(frame)

/** Best-effort id extraction from an invalid alert, so the sender can stop retrying it. */
export function extractAlertId(input: unknown): string | null {
  return isRecord(input) && isUuid(input.id) ? input.id.toLowerCase() : null
}
