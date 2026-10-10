import { describe, expect, test } from 'bun:test'

import { MESH_CONFIG } from '@/lib/mesh/config'
import { DELIVERY_LABEL } from '@/lib/mesh/alerts'
import { countRows, World } from '@/lib/mesh/__tests__/world'

const flood = { type: 'flood', severity: 'warning', summary: 'Water rising on College Road' } as const
const HALF_HOUR = 30 * 60_000

async function pair(world = new World()): Promise<World> {
  await world.add('A')
  await world.add('B')
  world.near(['A', 'B'])
  await world.trust(['A', 'B'])
  return world
}

describe('expiry and hop limits (Test D)', () => {
  test('an expired alert is never forwarded to a phone that connects later', async () => {
    const w = await pair()
    await w.startAll('A')
    expect((await w.get('A').engine.createAlert(flood)).ok).toBe(true)
    await w.run(HALF_HOUR + 60_000)

    await w.startAll('B')
    await w.run(20_000)
    expect(w.get('B').received.length).toBe(0)
    expect(w.net.count('A', 'B', 'alerts')).toBe(0)
    // It is still on A for history, but the inventory A offers is empty.
    expect(await countRows(w.get('A').db, 'SELECT COUNT(*) AS n FROM mesh_alerts')).toBe(1)
  })

  test('an alert at its hop limit is shown to the receiver but not passed on', async () => {
    const w = new World({ config: { ...MESH_CONFIG, maxHops: 1 } })
    for (const id of ['A', 'B', 'C']) await w.add(id)
    w.near(['A', 'B'], ['B', 'C'])
    await w.trust(['A', 'B'], ['B', 'C'])
    await w.startAll('A', 'B', 'C')
    await w.run(12_000)

    await w.get('A').engine.createAlert(flood)
    await w.run(3_000)
    expect(w.get('B').received.length).toBe(1)
    expect(w.get('B').received[0].hopCount).toBe(1)
    expect(w.get('C').received.length).toBe(0)
    expect(w.net.count('B', 'C', 'alerts')).toBe(0)
  })

  test('the receiver never presents an old alert as new: it is not notified after expiry', async () => {
    const w = await pair()
    await w.startAll('A', 'B')
    await w.run(12_000)
    await w.get('A').engine.createAlert(flood)
    await w.run(2_000)
    expect(w.get('B').notified.length).toBe(1)
    await w.run(HALF_HOUR + 60_000)
    expect(w.get('B').notified.length).toBe(1)
    expect(w.net.count('A', 'B', 'alerts')).toBe(1)
  })
})

describe('persistence and interruption (Test E)', () => {
  test('an alert created offline survives a sender restart and is delivered later', async () => {
    const w = await pair()
    await w.startAll('A')
    const a1 = w.get('A')
    expect((await a1.engine.createAlert(flood)).ok).toBe(true)
    await a1.engine.stop()

    const a2 = await w.add('A', a1)
    expect(a2.identity.nodeId).toBe(a1.identity.nodeId)
    await w.startAll('A', 'B')
    await w.run(15_000)
    expect(w.get('B').received.length).toBe(1)
  })

  test('a receiver restart neither re-notifies nor causes a resend', async () => {
    const w = await pair()
    await w.startAll('A', 'B')
    await w.run(12_000)
    await w.get('A').engine.createAlert(flood)
    await w.run(2_000)
    const b1 = w.get('B')
    expect(b1.notified.length).toBe(1)
    const sentBefore = w.net.count('A', 'B', 'alerts')

    await b1.engine.stop()
    const b2 = await w.add('B', b1)
    await w.startAll('B')
    await w.run(20_000)
    expect(await countRows(b2.db, 'SELECT COUNT(*) AS n FROM mesh_alerts')).toBe(1)
    expect(b2.notified.length).toBe(1)
    expect(w.net.count('A', 'B', 'alerts')).toBe(sentBefore)
  })

  test('a frame that is sent but never arrives is retried, and is never shown as delivered', async () => {
    const w = await pair()
    await w.startAll('A', 'B')
    await w.run(12_000)
    w.net.swallowFrom.add('A')
    await w.get('A').engine.createAlert(flood)
    await w.run(2_000)

    const row = () =>
      w.get('A').db.first<{ state: string; ack_kind: string | null }>(
        'SELECT state, ack_kind FROM mesh_outbox WHERE peer_node = ?',
        [w.get('B').identity.nodeId]
      )
    expect(w.get('B').received.length).toBe(0)
    // Transport accepted the bytes, but there is no acknowledgement: not delivered.
    expect(await row()).toMatchObject({ state: 'sent', ack_kind: null })

    w.net.swallowFrom.delete('A')
    await w.run(MESH_CONFIG.retryIntervalMs + 2_000)
    expect(w.get('B').received.length).toBe(1)
    expect(await row()).toMatchObject({ state: 'acked', ack_kind: 'peer_ack' })
  })

  test('a link that drops mid-transfer is re-established and the alert is delivered', async () => {
    const w = await pair()
    await w.startAll('A', 'B')
    await w.run(12_000)
    w.net.swallowFrom.add('A')
    await w.get('A').engine.createAlert(flood)
    await w.run(1_000)

    w.net.breakLink('A', 'B')
    w.net.swallowFrom.delete('A')
    await w.run(1_000)
    w.net.setRange('A', 'B', true)
    await w.run(60_000)
    expect(w.get('B').received.length).toBe(1)
    expect(w.get('B').notified.length).toBe(1)
  })
})

describe('honest delivery vocabulary', () => {
  test('there is no server-confirmed state, so none can be shown', () => {
    expect(Object.keys(DELIVERY_LABEL)).not.toContain('server_confirmed')
  })
})
