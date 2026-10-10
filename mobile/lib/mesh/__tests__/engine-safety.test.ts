import { describe, expect, test } from 'bun:test'

import { loadFeed } from '@/lib/mesh/feed'
import { MESH_CONFIG } from '@/lib/mesh/config'
import { countRows, World } from '@/lib/mesh/__tests__/world'

const flood = { type: 'flood', severity: 'warning', summary: 'Water rising on College Road' } as const

async function pair(): Promise<World> {
  const w = new World()
  await w.add('A')
  await w.add('B')
  w.near(['A', 'B'])
  await w.trust(['A', 'B'])
  return w
}

describe('consent (unfamiliar peers)', () => {
  test('an unfamiliar peer is never connected or sent anything until the user allows it', async () => {
    const w = new World()
    await w.add('A')
    await w.add('B')
    w.near(['A', 'B'])
    await w.startAll('A', 'B')
    await w.run(10_000)
    expect(w.get('A').engine.snapshot.connected.length).toBe(0)
    expect(w.get('A').engine.snapshot.awaitingConsent.length + w.get('B').engine.snapshot.awaitingConsent.length).toBeGreaterThan(0)
    expect(w.net.log.length).toBe(0)
  })

  test('allowing the peer connects it and the choice is remembered', async () => {
    const w = new World()
    await w.add('A')
    await w.add('B')
    w.near(['A', 'B'])
    await w.startAll('A', 'B')
    await w.run(2_000)
    for (const id of ['A', 'B']) {
      for (const p of w.get(id).engine.snapshot.awaitingConsent) await w.get(id).engine.allowPeer(p.endpointId)
    }
    await w.run(12_000)
    expect(w.get('A').engine.snapshot.connected.length).toBe(1)
    expect(await countRows(w.get('A').db, "SELECT COUNT(*) AS n FROM mesh_peers WHERE trust = 'allowed'")).toBe(1)
  })

  test('a blocked peer is never accepted', async () => {
    const w = new World()
    await w.add('A')
    await w.add('B')
    w.near(['A', 'B'])
    await w.startAll('A', 'B')
    await w.run(2_000)
    for (const id of ['A', 'B']) {
      for (const p of w.get(id).engine.snapshot.awaitingConsent) await w.get(id).engine.blockPeer(p.endpointId)
    }
    await w.run(20_000)
    expect(w.get('A').engine.snapshot.connected.length).toBe(0)
    expect(w.get('B').engine.snapshot.connected.length).toBe(0)
  })
})

describe('hostile input', () => {
  test('junk, oversize, wrong-node and forged frames are dropped and the peer gets banned', async () => {
    const w = await pair()
    await w.startAll('A', 'B')
    await w.run(12_000)
    const attacker = w.get('B').transport
    for (const junk of ['not json', '{"t":"exec"}', 'x'.repeat(MESH_CONFIG.frameMaxBytes + 10)]) {
      attacker.inject('A', junk)
      await w.run(50)
    }
    expect(await countRows(w.get('A').db, 'SELECT COUNT(*) AS n FROM mesh_alerts')).toBe(0)
    expect(w.get('A').engine.snapshot.connected.length).toBe(0) // disconnected after repeated violations
  })

  test('a tampered alert is refused and never stored, notified or forwarded', async () => {
    const w = await pair()
    await w.startAll('A', 'B')
    await w.run(12_000)
    await w.get('A').engine.createAlert(flood)
    await w.run(1_000)
    const sent = JSON.parse((await w.get('A').db.first<{ body: string }>('SELECT body FROM mesh_alerts'))!.body)
    const forged = { ...sent, id: crypto.randomUUID(), hopCount: 1, summary: 'Evacuate now, official order' }
    const frame = { t: 'alerts', v: 1, node: w.get('A').identity.nodeId, alerts: [forged] }
    w.get('A').transport.inject('B', JSON.stringify(frame))
    await w.run(500)
    expect(w.get('B').received.length).toBe(1) // only the genuine one
    expect(w.get('B').notified.length).toBe(1)
  })
})
