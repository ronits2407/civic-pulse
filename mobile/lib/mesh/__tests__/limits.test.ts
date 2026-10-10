import { describe, expect, test } from 'bun:test'

import { forwardCopy } from '@/lib/mesh/alerts'
import { MESH_CONFIG } from '@/lib/mesh/config'
import { acceptReceivedAlert } from '@/lib/mesh/store'
import { storeLocalAlert } from '@/lib/mesh/store-local'
import { makeAlert, makeNode, NOW, openTestDb } from '@/lib/mesh/__tests__/helpers'

const sender = makeNode()
const peerB = makeNode()

const count = async (db: Awaited<ReturnType<typeof openTestDb>>, table: string) =>
  (await db.first<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))!.n

describe('abuse limits', () => {
  test('one origin cannot flood the store', async () => {
    const db = await openTestDb()
    const spammer = makeNode()
    let accepted = 0
    let limited = 0
    for (let i = 0; i < MESH_CONFIG.originAlertsPerMinute + 4; i++) {
      const out = await acceptReceivedAlert(db, forwardCopy(makeAlert(spammer)), peerB.nodeId, [], NOW)
      if (out.status === 'accepted') accepted++
      if (out.status === 'rejected' && out.reason === 'rate_limited') limited++
    }
    expect(accepted).toBe(MESH_CONFIG.originAlertsPerMinute)
    expect(limited).toBe(4)
  })

  test('the store is capped; locally created alerts are never evicted', async () => {
    const db = await openTestDb()
    const config = { ...MESH_CONFIG, maxStoredAlerts: 5, originAlertsPerMinute: 1000 }
    const mine = makeAlert(sender)
    await storeLocalAlert(db, mine, [], NOW, config)
    for (let i = 0; i < 12; i++) {
      await acceptReceivedAlert(db, forwardCopy(makeAlert(makeNode())), peerB.nodeId, [], NOW + i, config)
    }
    expect(await count(db, 'mesh_alerts')).toBeLessThanOrEqual(5)
    expect(await db.first('SELECT 1 FROM mesh_alerts WHERE id = ?', [mine.id])).not.toBeNull()
  })

  test('SOS has a cooldown that is enforced from the database', async () => {
    const db = await openTestDb()
    const first = makeAlert(sender, { type: 'sos', summary: 'Need help' })
    expect((await storeLocalAlert(db, first, [], NOW)).status).toBe('created')
    const second = makeAlert(sender, { type: 'sos', summary: 'Need help again' })
    expect(await storeLocalAlert(db, second, [], NOW + 5_000)).toEqual({
      status: 'rejected',
      reason: 'sos_cooldown',
    })
  })

  test('local creation is capped per hour', async () => {
    const db = await openTestDb()
    for (let i = 0; i < MESH_CONFIG.localAlertsPerHour; i++) {
      const t = NOW + i
      expect((await storeLocalAlert(db, makeAlert(sender, { now: t }), [], t)).status).toBe('created')
    }
    const t = NOW + 100
    const over = await storeLocalAlert(db, makeAlert(sender, { now: t }), [], t)
    expect(over).toEqual({ status: 'rejected', reason: 'rate_limited' })
    // An hour later the window has moved on.
    const later = NOW + 3_700_000
    expect((await storeLocalAlert(db, makeAlert(sender, { now: later }), [], later)).status).toBe('created')
  })

  test('a locally created alert is queued for connected peers and marked seen', async () => {
    const db = await openTestDb()
    const out = await storeLocalAlert(db, makeAlert(sender), [peerB.nodeId], NOW)
    expect(out).toEqual({ status: 'created', queuedFor: 1 })
    expect(await count(db, 'mesh_seen')).toBe(1)
  })
})
