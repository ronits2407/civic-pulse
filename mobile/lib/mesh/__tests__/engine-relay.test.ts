import { describe, expect, test } from 'bun:test'

import { countRows, World } from '@/lib/mesh/__tests__/world'

const flood = { type: 'flood', severity: 'warning', summary: 'Water rising on College Road' } as const

async function line(): Promise<World> {
  const w = new World()
  for (const id of ['A', 'B', 'C']) await w.add(id)
  w.near(['A', 'B'], ['B', 'C']) // A and C are deliberately OUT of range of each other
  await w.trust(['A', 'B'], ['B', 'C'])
  await w.startAll('A', 'B', 'C')
  await w.run(12_000)
  return w
}

describe('direct transfer (Test A)', () => {
  test('B receives an alert created on A, with one notification and a peer acknowledgement', async () => {
    const w = new World()
    await w.add('A')
    await w.add('B')
    w.near(['A', 'B'])
    await w.trust(['A', 'B'])
    await w.startAll('A', 'B')
    await w.run(12_000)
    expect(w.get('A').engine.snapshot.connected.length).toBe(1)

    const out = await w.get('A').engine.createAlert(flood)
    expect(out.ok).toBe(true)
    await w.run(2_000)

    const b = w.get('B')
    expect(b.received.length).toBe(1)
    expect(b.received[0].hopCount).toBe(1)
    expect(b.notified.length).toBe(1)
    expect(await countRows(b.db, 'SELECT COUNT(*) AS n FROM mesh_alerts')).toBe(1)

    // A knows the peer ACKNOWLEDGED storage: that is the only delivery evidence it has.
    const row = await w.get('A').db.first<{ state: string; ack_kind: string }>(
      'SELECT state, ack_kind FROM mesh_outbox WHERE peer_node = ?',
      [b.identity.nodeId]
    )
    expect(row).toMatchObject({ state: 'acked', ack_kind: 'peer_ack' })
  })

  test('an alert created while alone is stored locally and reaches nobody', async () => {
    const w = new World()
    const a = await w.add('A')
    await w.startAll('A')
    const out = await a.engine.createAlert(flood)
    expect(out.ok).toBe(true)
    await w.run(5_000)
    expect(await countRows(a.db, 'SELECT COUNT(*) AS n FROM mesh_alerts')).toBe(1)
    expect(await countRows(a.db, "SELECT COUNT(*) AS n FROM mesh_outbox WHERE state = 'acked'")).toBe(0)
    expect(w.net.log.length).toBe(0)
  })
})

describe('three-phone relay (Test B, simulated)', () => {
  test('A to C only through B, with no direct A-C traffic, hop count 2', async () => {
    const w = await line()
    expect(w.get('B').engine.snapshot.connected.length).toBe(2)
    expect(w.get('A').engine.snapshot.connected.length).toBe(1)

    await w.get('A').engine.createAlert(flood)
    await w.run(2_000)

    const c = w.get('C')
    expect(c.received.length).toBe(1)
    expect(c.received[0].hopCount).toBe(2)
    expect(c.received[0].id).toBe(w.get('B').received[0].id) // same event id end to end
    expect(c.notified.length).toBe(1)
    // The honest path: it went A -> B -> C, and A and C never exchanged a single frame.
    expect(w.net.talked('A', 'C')).toBe(false)
    expect(w.net.count('A', 'B', 'alerts')).toBeGreaterThanOrEqual(1)
    expect(w.net.count('B', 'C', 'alerts')).toBeGreaterThanOrEqual(1)
    // B never echoed it back to A, where it came from.
    expect(w.net.count('B', 'A', 'alerts')).toBe(0)
  })

  test('a late joiner is caught up from the store (store-carry-forward)', async () => {
    const w = new World()
    for (const id of ['A', 'B', 'C']) await w.add(id)
    w.near(['A', 'B'])
    await w.trust(['A', 'B'], ['B', 'C'])
    await w.startAll('A', 'B')
    await w.run(12_000)
    await w.get('A').engine.createAlert(flood)
    await w.run(2_000)
    expect(w.get('C').received.length).toBe(0)

    // C walks into range of B only, long after A is gone from the picture.
    w.near(['B', 'C'])
    await w.get('C').engine.start()
    await w.run(15_000)
    expect(w.get('C').received.length).toBe(1)
    expect(w.get('C').received[0].hopCount).toBe(2)
    expect(w.net.talked('A', 'C')).toBe(false)
  })
})

describe('duplicate suppression (Test C)', () => {
  test('an alert reaching B over two paths is stored once and notified once', async () => {
    const w = new World()
    for (const id of ['A', 'B', 'C']) await w.add(id)
    w.near(['A', 'B'], ['A', 'C'], ['B', 'C'])
    await w.trust(['A', 'B'], ['A', 'C'], ['B', 'C'])
    await w.startAll('A', 'B', 'C')
    await w.run(20_000)

    await w.get('A').engine.createAlert(flood)
    await w.run(3_000)

    for (const id of ['B', 'C']) {
      const node = w.get(id)
      expect(node.received.length).toBe(1)
      expect(node.notified.length).toBe(1)
      expect(await countRows(node.db, 'SELECT COUNT(*) AS n FROM mesh_alerts')).toBe(1)
    }
    // A created it, so it must never be told about it by anyone else.
    expect(w.get('A').received.length).toBe(0)
    expect(w.net.count('B', 'A', 'alerts')).toBe(0)
    expect(w.net.count('C', 'A', 'alerts')).toBe(0)
  })
})
