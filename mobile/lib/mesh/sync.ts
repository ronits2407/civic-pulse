import { MESH_CONFIG, type MeshConfig } from '@/lib/mesh/config'
import type { MeshDb } from '@/lib/mesh/db'
import { encodeFrame, extractAlertId, type Frame } from '@/lib/mesh/frames'
import { markPeerHas, enqueueStoredForPeer, enqueueForPeers, pruneOutbox } from '@/lib/mesh/outbox'
import { markAcked, markRejected, markSendFailed, markSent, nextBatch } from '@/lib/mesh/outbox-state'
import { byteLength, type MeshAlert, type RejectReason } from '@/lib/mesh/protocol'
import { acceptReceivedAlert } from '@/lib/mesh/store'
import { forwardCopy } from '@/lib/mesh/alerts'
import { validateAlert } from '@/lib/mesh/validate'

/**
 * Protocol steps that touch the database but not the radio or any timer. The relay engine
 * calls these; tests call them directly against a real SQLite engine.
 */

/** Ids of unexpired, still-forwardable alerts, newest first, bounded. */
export async function buildInventory(db: MeshDb, now: number, config: MeshConfig = MESH_CONFIG): Promise<string[]> {
  const rows = await db.all<{ id: string }>(
    `SELECT id FROM mesh_alerts
      WHERE expires_at > ? AND hop_count < max_hops
      ORDER BY created_at DESC LIMIT ?`,
    [now, config.inventoryMaxIds]
  )
  return rows.map((r) => r.id)
}

/**
 * The peer told us what it already holds. Record that (so we never resend those) and queue
 * everything else that is eligible. Only ids WE hold are recorded; an id we do not have
 * cannot be forwarded anyway.
 */
export async function applyPeerInventory(
  db: MeshDb,
  peerNode: string,
  ids: string[],
  now: number,
  config: MeshConfig = MESH_CONFIG
): Promise<number> {
  return db.transaction(async (tx) => {
    if (ids.length > 0) {
      const marks = ids.map(() => '?').join(',')
      const held = await tx.all<{ id: string }>(`SELECT id FROM mesh_alerts WHERE id IN (${marks})`, ids)
      await markPeerHas(tx, peerNode, held.map((r) => r.id), now)
    }
    const queued = await enqueueStoredForPeer(tx, peerNode, now)
    await pruneOutbox(tx, config)
    return queued
  })
}

export interface PreparedBatch {
  text: string
  alertIds: string[]
}

/**
 * Build the next 'alerts' frame for one peer, or null when there is nothing eligible.
 * Expired alerts and alerts at their hop limit are excluded by the query itself.
 * Each alert goes out with hopCount + 1 and an otherwise untouched envelope.
 */
export async function prepareBatch(
  db: MeshDb,
  peerNode: string,
  localNode: string,
  now: number,
  config: MeshConfig = MESH_CONFIG
): Promise<PreparedBatch | null> {
  const rows = await db.transaction((tx) => nextBatch(tx, peerNode, now, config.frameMaxAlerts, config))
  if (rows.length === 0) return null

  const alerts: MeshAlert[] = []
  const alertIds: string[] = []
  let budget = config.frameMaxBytes - 128 // frame envelope overhead
  for (const row of rows) {
    let stored: MeshAlert
    try {
      stored = JSON.parse(row.body) as MeshAlert
    } catch {
      continue
    }
    const copy = forwardCopy(stored)
    const size = byteLength(JSON.stringify(copy)) + 1
    if (size > budget) break
    budget -= size
    alerts.push(copy)
    alertIds.push(row.alert_id)
  }
  if (alerts.length === 0) return null
  const frame: Frame = { t: 'alerts', v: config.schemaVersion, node: localNode, alerts }
  return { text: encodeFrame(frame), alertIds }
}

export const recordSent = (db: MeshDb, peerNode: string, ids: string[], now: number) =>
  db.transaction((tx) => markSent(tx, peerNode, ids, now))

export const recordSendFailed = (
  db: MeshDb,
  peerNode: string,
  ids: string[],
  now: number,
  config: MeshConfig = MESH_CONFIG
) => db.transaction((tx) => markSendFailed(tx, peerNode, ids, now, config))

export const applyAck = (db: MeshDb, peerNode: string, acked: string[], rejected: string[], now: number) =>
  db.transaction(async (tx) => {
    await markAcked(tx, peerNode, acked, now)
    await markRejected(tx, peerNode, rejected)
  })

export interface AlertsFrameResult {
  /** Alerts newly stored by this frame (each deserves exactly one notification). */
  accepted: MeshAlert[]
  /** Ids to acknowledge: stored now, or already held. */
  acked: string[]
  /** Ids refused (invalid, expired, rate limited). */
  rejected: string[]
  /** Why each refusal happened, for diagnostics and abuse scoring. */
  reasons: RejectReason[]
}

/**
 * Process the alerts in one received frame. Each alert is validated on its own and stored
 * in its own transaction; the ack is only produced AFTER the corresponding commit.
 */
export async function receiveAlerts(
  db: MeshDb,
  raw: unknown[],
  fromNode: string,
  otherPeerNodes: string[],
  now: number,
  config: MeshConfig = MESH_CONFIG
): Promise<AlertsFrameResult> {
  const result: AlertsFrameResult = { accepted: [], acked: [], rejected: [], reasons: [] }
  for (const item of raw) {
    const checked = validateAlert(item, { now, config })
    const id = extractAlertId(item)
    // Our protocol never sends hop 0 (the sender always increments), so hop 0 is a lie.
    if (!checked.ok || checked.value.hopCount < 1) {
      if (id) result.rejected.push(id)
      result.reasons.push(checked.ok ? 'bad_hops' : checked.reason)
      continue
    }
    const outcome = await acceptReceivedAlert(db, checked.value, fromNode, otherPeerNodes, now, config)
    if (outcome.status === 'accepted') {
      result.accepted.push(checked.value)
      result.acked.push(checked.value.id)
    } else if (outcome.status === 'duplicate') {
      result.acked.push(checked.value.id)
    } else {
      result.rejected.push(checked.value.id)
      result.reasons.push(outcome.reason)
    }
  }
  return result
}

/** Queue a freshly stored alert for peers that connected after it was created. */
export const queueForPeers = (db: MeshDb, alertId: string, peerNodes: string[], now: number) =>
  db.transaction((tx) => enqueueForPeers(tx, alertId, peerNodes, now))
