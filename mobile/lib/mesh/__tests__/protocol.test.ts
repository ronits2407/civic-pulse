import { describe, expect, test } from 'bun:test'
import { createHash, randomUUID } from 'node:crypto'

import { buildAlert, forwardCopy } from '@/lib/mesh/alerts'
import { MESH_CONFIG } from '@/lib/mesh/config'
import { computeDigest, deriveNodeId, deriveOriginId } from '@/lib/mesh/protocol'
import { sha256Hex } from '@/lib/mesh/sha256'
import { validateAlert } from '@/lib/mesh/validate'
import { makeAlert, makeNode, NOW } from '@/lib/mesh/__tests__/helpers'

describe('sha256', () => {
  test('matches node crypto for edge-case inputs', () => {
    const inputs = ['', 'abc', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), 'x'.repeat(1000), 'नाशिक बाढ़ 🚨']
    for (const input of inputs) {
      expect(sha256Hex(input)).toBe(createHash('sha256').update(input).digest('hex'))
    }
  })
})

describe('identity', () => {
  test('node and origin ids are opaque, differ from each other, and are stable', () => {
    const install = randomUUID()
    expect(deriveNodeId(install)).toBe(deriveNodeId(install))
    expect(deriveNodeId(install)).not.toBe(deriveOriginId(install))
    expect(deriveNodeId(install)).toMatch(/^[0-9a-f]{16}$/)
    expect(deriveNodeId(install)).not.toContain(install.slice(0, 8))
  })
})

describe('validateAlert', () => {
  const node = makeNode()
  const good = () => makeAlert(node)
  const mutate = (patch: Record<string, unknown>) => validateAlert({ ...good(), ...patch }, { now: NOW })

  test('accepts a well-formed alert and round-trips through JSON', () => {
    const wire = JSON.parse(JSON.stringify(forwardCopy(good())))
    expect(validateAlert(wire, { now: NOW }).ok).toBe(true)
  })

  test('hopCount is not covered by the digest, but maxHops is', () => {
    expect(validateAlert({ ...good(), hopCount: 3 }, { now: NOW }).ok).toBe(true)
    const low = buildAlert({
      id: randomUUID(), type: 'fire', severity: 'critical', originId: node.originId,
      summary: 'Fire', now: NOW, maxHops: 2,
    })
    if (!low.ok) throw new Error('setup failed')
    // A relay trying to raise the limit invalidates the digest.
    expect(validateAlert({ ...low.value, maxHops: 5 }, { now: NOW })).toEqual({ ok: false, reason: 'bad_integrity' })
  })

  test('rejects tampering with any protected field', () => {
    const patches = [
      { summary: 'Different text' }, { severity: 'critical' }, { type: 'fire' },
      { latitude: 19.99, longitude: 73.78 }, { expiresAt: NOW + 5 * 60_000 }, { originId: 'a'.repeat(16) },
    ]
    for (const patch of patches) expect(mutate(patch).ok).toBe(false)
  })

  test('rejects malformed, wrong-version, expired, future and over-long-lived alerts', () => {
    expect(validateAlert('nope', { now: NOW })).toEqual({ ok: false, reason: 'malformed' })
    expect(validateAlert(null, { now: NOW })).toEqual({ ok: false, reason: 'malformed' })
    expect(validateAlert([], { now: NOW })).toEqual({ ok: false, reason: 'malformed' })
    expect(mutate({ schemaVersion: 2 })).toEqual({ ok: false, reason: 'unsupported_version' })
    expect(mutate({ id: 'not-a-uuid' })).toEqual({ ok: false, reason: 'bad_id' })
    const late = NOW + MESH_CONFIG.defaultTtlMs + 1
    expect(validateAlert(good(), { now: late })).toEqual({ ok: false, reason: 'expired' })
    const future = makeAlert(node, { now: NOW + 3_600_000 })
    expect(validateAlert(future, { now: NOW })).toEqual({ ok: false, reason: 'from_future' })
    expect(mutate({ expiresAt: NOW + MESH_CONFIG.maxTtlMs + 10 })).toEqual({ ok: false, reason: 'ttl_too_long' })
  })

  test('only community-sourced alerts are accepted: no relay can claim to be official', () => {
    for (const source of ['official', 'government', '', 7, null]) {
      expect(mutate({ source })).toEqual({ ok: false, reason: 'unsupported_source' })
    }
  })

  test('rejects bad hop values', () => {
    expect(mutate({ hopCount: -1 }).ok).toBe(false)
    expect(mutate({ hopCount: 6 }).ok).toBe(false)
    expect(mutate({ hopCount: 1.5 }).ok).toBe(false)
    expect(mutate({ maxHops: 99 }).ok).toBe(false)
  })

  test('rejects control characters, bidi overrides, blank and over-long summaries', () => {
    const bad = ['  ', '', 'a\u0000b', 'safe\u202Eexe.txt', 'line\nbreak', 'x'.repeat(141), ' padded ']
    for (const summary of bad) expect(mutate({ summary }).ok).toBe(false)
  })

  test('location must be a complete, in-range pair', () => {
    const bad = [{ latitude: 10 }, { longitude: 10 }, { latitude: 91, longitude: 0 }, { latitude: 'a', longitude: 1 }]
    for (const patch of bad) expect(mutate(patch).ok).toBe(false)
  })

  test('strips unknown fields so they can never be stored or forwarded', () => {
    const result = validateAlert({ ...good(), admin: true, extra: 'x' }, { now: NOW })
    expect(result.ok).toBe(true)
    if (result.ok) expect(Object.keys(result.value)).not.toContain('admin')
  })

  test('digest is deterministic and ignores hopCount', () => {
    const a = good()
    const { hopCount: _h, integrity: _i, ...base } = a
    expect(computeDigest(base)).toBe(a.integrity.digest)
  })
})
