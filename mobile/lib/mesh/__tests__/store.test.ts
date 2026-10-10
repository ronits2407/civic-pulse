import { describe, expect, test } from 'bun:test'

import { forwardCopy } from '@/lib/mesh/alerts'
import { acceptReceivedAlert } from '@/lib/mesh/store'
import { claimNotification } from '@/lib/mesh/store-local'
import { makeAlert, makeNode, NOW, openTestDb } from '@/lib/mesh/__tests__/helpers'

const sender = makeNode()
const peerB = makeNode()
const peerC = makeNode()

const count = async (db: Awaited<ReturnType<typeof openTestDb>>, table: string) =>
  (await db.first<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))!.n

describe('receiving an alert', () => {
  test('stores the alert, marks it seen and queues forwards in one step', async () => {
    const db = await openTestDb()
    const alert = forwardCopy(makeAlert(sender))
    const out = await acceptReceivedAlert(db, alert, peerB.nodeId, [peerC.nodeId], NOW)

    expect(out).toEqual({ status: 'accepted', forwardedTo: 1 })
    expect(await count(db, 'mesh_alerts')).toBe(1)
    expect(await count(db, 'mesh_seen')).toBe(1)
    const rows = await db.all<{ peer_node: string; state: string; ack_kind: string | null }>(
      'SELECT peer_node, state, ack_kind FROM mesh_outbox ORDER BY peer_node'
    )
    // The sender is marked as already having it; only the OTHER peer is pending.
    expect(rows.find((r) => r.peer_node === peerB.nodeId)).toMatchObject({ state: 'acked', ack_kind: 'peer_inventory' })
    expect(rows.find((r) => r.peer_node === peerC.nodeId)).toMatchObject({ state: 'pending' })
  })

  test('never queues the alert back to the peer it came from', async () => {
    const db = await openTestDb()
    await acceptReceivedAlert(db, forwardCopy(makeAlert(sender)), peerB.nodeId, [peerB.nodeId], NOW)
    expect((await db.all('SELECT * FROM mesh_outbox WHERE state = ?', ['pending'])).length).toBe(0)
  })

  test('a duplicate is stored once, queues nothing new and reports duplicate', async () => {
    const db = await openTestDb()
    const alert = forwardCopy(makeAlert(sender))
    await acceptReceivedAlert(db, alert, peerB.nodeId, [peerC.nodeId], NOW)
    const before = await count(db, 'mesh_outbox')

    const again = await acceptReceivedAlert(db, alert, peerC.nodeId, [peerB.nodeId], NOW + 1000)
    expect(again).toEqual({ status: 'duplicate' })
    expect(await count(db, 'mesh_alerts')).toBe(1)
    // The second path only teaches us that peer C also has it; nothing new is pending for C.
    const pendingForC = await db.first(
      `SELECT * FROM mesh_outbox WHERE peer_node = ? AND state = 'pending'`,
      [peerC.nodeId]
    )
    expect(pendingForC).toBeNull()
    expect(await count(db, 'mesh_outbox')).toBe(before)
  })

  test('an alert at its hop limit is stored and shown but never queued for forwarding', async () => {
    const db = await openTestDb()
    const atLimit = { ...makeAlert(sender, { maxHops: 2 }), hopCount: 2 }
    const out = await acceptReceivedAlert(db, atLimit, peerB.nodeId, [peerC.nodeId], NOW)
    expect(out).toEqual({ status: 'accepted', forwardedTo: 0 })
    expect(await db.first(`SELECT 1 FROM mesh_outbox WHERE state = 'pending'`)).toBeNull()
  })

  test('a failure mid-transaction rolls EVERYTHING back (no seen id without an alert)', async () => {
    const db = await openTestDb()
    const alert = forwardCopy(makeAlert(sender))
    // Fail the outbox write AFTER the alert and seen rows were already written.
    db.raw.exec(`CREATE TRIGGER boom BEFORE INSERT ON mesh_outbox BEGIN SELECT RAISE(ABORT, 'disk full'); END;`)
    await expect(acceptReceivedAlert(db, alert, peerB.nodeId, [peerC.nodeId], NOW)).rejects.toBeDefined()
    expect(await count(db, 'mesh_alerts')).toBe(0)
    expect(await count(db, 'mesh_seen')).toBe(0)

    // Once the fault clears the same alert is accepted: it was not poisoned.
    db.raw.exec('DROP TRIGGER boom')
    const retry = await acceptReceivedAlert(db, alert, peerB.nodeId, [peerC.nodeId], NOW)
    expect(retry.status).toBe('accepted')
  })

  test('concurrent arrivals of one alert over two paths store it once', async () => {
    const db = await openTestDb()
    const alert = forwardCopy(makeAlert(sender))
    const results = await Promise.all([
      acceptReceivedAlert(db, alert, peerB.nodeId, [peerC.nodeId], NOW),
      acceptReceivedAlert(db, alert, peerC.nodeId, [peerB.nodeId], NOW),
    ])
    expect(results.filter((r) => r.status === 'accepted').length).toBe(1)
    expect(results.filter((r) => r.status === 'duplicate').length).toBe(1)
    expect(await count(db, 'mesh_alerts')).toBe(1)
  })
})

describe('notifications', () => {
  test('exactly one notification is claimable per alert, however often it arrives', async () => {
    const db = await openTestDb()
    const alert = forwardCopy(makeAlert(sender))
    await acceptReceivedAlert(db, alert, peerB.nodeId, [], NOW)
    await acceptReceivedAlert(db, alert, peerC.nodeId, [], NOW + 1)
    const claims = await Promise.all([1, 2, 3].map(() => claimNotification(db, alert.id, NOW + 2)))
    expect(claims.filter(Boolean).length).toBe(1)
  })
})
