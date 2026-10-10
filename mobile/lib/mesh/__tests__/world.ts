import { randomUUID } from 'node:crypto'

import { MESH_CONFIG, type MeshConfig } from '@/lib/mesh/config'
import type { Clock } from '@/lib/mesh/engine-types'
import { RelayEngine } from '@/lib/mesh/engine'
import { loadIdentity, type MeshIdentity } from '@/lib/mesh/identity'
import { setTrust } from '@/lib/mesh/peers'
import type { MeshAlert } from '@/lib/mesh/protocol'
import { claimNotification } from '@/lib/mesh/store-local'
import { NOW, openTestDb } from '@/lib/mesh/__tests__/helpers'
import { SimNetwork, SimTransport, settle } from '@/lib/mesh/__tests__/sim'
import type { MeshDb } from '@/lib/mesh/db'

/** Deterministic clock: time only moves when a test says so. */
export class ManualClock implements Clock {
  t = NOW
  private timers: { at: number; fn: () => void }[] = []
  now = () => this.t
  setTimeout(fn: () => void, ms: number): unknown {
    const handle = { at: this.t + ms, fn }
    this.timers.push(handle)
    return handle
  }
  clearTimeout(handle: unknown): void {
    this.timers = this.timers.filter((x) => x !== handle)
  }
  /** Move time forward, firing timers in order and letting async work settle between them. */
  async advance(ms: number): Promise<void> {
    const target = this.t + ms
    await settle()
    for (;;) {
      const due = this.timers.filter((x) => x.at <= target).sort((a, b) => a.at - b.at)[0]
      if (!due) break
      this.timers = this.timers.filter((x) => x !== due)
      this.t = Math.max(this.t, due.at)
      due.fn()
      await settle()
    }
    this.t = target
    await settle()
  }
}

export interface SimNode {
  id: string
  db: MeshDb
  transport: SimTransport
  engine: RelayEngine
  identity: MeshIdentity
  installId: string
  /** Alerts reported to the UI as newly received. */
  received: MeshAlert[]
  /** Notifications actually "shown" (claimed exactly once per alert id). */
  notified: string[]
}

export interface WorldOptions {
  config?: MeshConfig
}

export class World {
  readonly net = new SimNetwork()
  readonly clock = new ManualClock()
  readonly nodes = new Map<string, SimNode>()
  constructor(private readonly options: WorldOptions = {}) {}

  /** Create a phone. Passing an existing node's db + installId simulates an app restart. */
  async add(id: string, restartOf?: SimNode): Promise<SimNode> {
    const db = restartOf?.db ?? (await openTestDb())
    const installId = restartOf?.installId ?? randomUUID()
    const identity = await loadIdentity(db, () => installId)
    const transport = new SimTransport(id, this.net)
    const received: MeshAlert[] = restartOf?.received ?? []
    const notified: string[] = restartOf?.notified ?? []
    const node: SimNode = { id, db, transport, identity, installId, received, notified, engine: null as never }
    node.engine = new RelayEngine({
      transport, db, identity, clock: this.clock, randomUuid: randomUUID,
      config: this.options.config ?? MESH_CONFIG,
      events: {
        onAlertReceived: (alert) => {
          received.push(alert)
          // Mirrors the app: one notification per alert id, claimed in the database.
          void claimNotification(db, alert.id, this.clock.now()).then((first) => {
            if (first) notified.push(alert.id)
          })
        },
      },
    })
    this.nodes.set(id, node)
    return node
  }

  get(id: string): SimNode {
    const node = this.nodes.get(id)
    if (!node) throw new Error(`no node ${id}`)
    return node
  }

  /** Put phones in radio range of each other. */
  near(...pairs: [string, string][]): void {
    for (const [a, b] of pairs) this.net.setRange(a, b, true)
  }

  /** Record that each phone's user already allowed the other (skips the consent prompt). */
  async trust(...pairs: [string, string][]): Promise<void> {
    for (const [a, b] of pairs) {
      await setTrust(this.get(a).db, this.get(b).identity.nodeId, 'allowed', this.clock.now())
      await setTrust(this.get(b).db, this.get(a).identity.nodeId, 'allowed', this.clock.now())
    }
  }

  async startAll(...ids: string[]): Promise<void> {
    for (const id of ids) await this.get(id).engine.start()
    await this.clock.advance(100)
  }

  /** Let time pass in steps so dials, handshakes and retries all get to run. */
  run(ms: number): Promise<void> {
    return this.clock.advance(ms)
  }
}

export const countRows = async (db: MeshDb, sql: string, params: (string | number)[] = []): Promise<number> =>
  (await db.first<{ n: number }>(sql, params))!.n
