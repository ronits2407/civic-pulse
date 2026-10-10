import { describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'

import { forwardCopy, isForwardable } from '@/lib/mesh/alerts'
import { MESH_CONFIG } from '@/lib/mesh/config'
import { encodeFrame, parseFrame, type Frame } from '@/lib/mesh/frames'
import { deriveNodeId } from '@/lib/mesh/protocol'
import { makeAlert, makeNode, NOW } from '@/lib/mesh/__tests__/helpers'

describe('forwarding policy', () => {
  const alert = makeAlert(makeNode())

  test('forwardable until expiry or hop limit', () => {
    expect(isForwardable(alert, NOW)).toBe(true)
    expect(isForwardable(alert, alert.expiresAt)).toBe(false)
    expect(isForwardable({ ...alert, hopCount: alert.maxHops }, NOW)).toBe(false)
    expect(isForwardable({ ...alert, hopCount: alert.maxHops - 1 }, NOW)).toBe(true)
  })

  test('forwardCopy keeps the id and digest and only increments hopCount', () => {
    const copy = forwardCopy(alert)
    expect(copy.id).toBe(alert.id)
    expect(copy.integrity).toEqual(alert.integrity)
    expect(copy.hopCount).toBe(alert.hopCount + 1)
  })
})

describe('frames', () => {
  const node = deriveNodeId(randomUUID())

  test('round-trips every frame type', () => {
    const id = randomUUID()
    const frames: Frame[] = [
      { t: 'hello', v: 1, node },
      { t: 'inv', v: 1, node, ids: [id] },
      { t: 'ack', v: 1, node, ids: [id], rejected: [] },
      { t: 'alerts', v: 1, node, alerts: [{ any: 'thing' }] },
    ]
    for (const frame of frames) expect(parseFrame(encodeFrame(frame)).ok).toBe(true)
  })

  test('rejects junk, wrong version, oversize, bad ids and empty batches', () => {
    const cases = [
      '{not json',
      '[]',
      JSON.stringify({ t: 'hello', v: 9, node }),
      JSON.stringify({ t: 'hello', v: 1, node: 'short' }),
      JSON.stringify({ t: 'inv', v: 1, node, ids: ['nope'] }),
      JSON.stringify({ t: 'inv', v: 1, node, ids: Array(101).fill(randomUUID()) }),
      JSON.stringify({ t: 'alerts', v: 1, node, alerts: [] }),
      JSON.stringify({ t: 'exec', v: 1, node }),
      'x'.repeat(MESH_CONFIG.frameMaxBytes + 1),
    ]
    for (const text of cases) expect(parseFrame(text).ok).toBe(false)
  })
})
