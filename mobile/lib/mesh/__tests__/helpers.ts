import { Database } from 'bun:sqlite'
import { randomUUID } from 'node:crypto'

import { buildAlert } from '@/lib/mesh/alerts'
import { migrate, type MeshDb, type MeshDbTx, type SqlValue } from '@/lib/mesh/db'
import { deriveNodeId, deriveOriginId, type AlertType, type MeshAlert } from '@/lib/mesh/protocol'

/**
 * bun:sqlite implementation of MeshDb: a REAL SQL engine (the same SQLite family
 * expo-sqlite wraps), so transactions, constraints and rollbacks behave authentically.
 * Transactions are serialised the same way the app's exclusive transactions are.
 */
export async function openTestDb(): Promise<MeshDb & { raw: Database }> {
  const raw = new Database(':memory:')
  const tx: MeshDbTx = {
    async run(sql, params = []) {
      return { changes: raw.query(sql).run(...params).changes }
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      return raw.query(sql).all(...params) as T[]
    },
    async first<T>(sql: string, params: SqlValue[] = []) {
      return (raw.query(sql).get(...params) ?? null) as T | null
    },
  }
  let chain: Promise<unknown> = Promise.resolve()
  const db: MeshDb & { raw: Database } = {
    ...tx,
    raw,
    async exec(sql) {
      raw.exec(sql)
    },
    transaction<T>(fn: (t: MeshDbTx) => Promise<T>): Promise<T> {
      const run = async (): Promise<T> => {
        raw.exec('BEGIN IMMEDIATE')
        try {
          const out = await fn(tx)
          raw.exec('COMMIT')
          return out
        } catch (error) {
          raw.exec('ROLLBACK')
          throw error
        }
      }
      const next = chain.then(run, run)
      chain = next.catch(() => undefined)
      return next
    },
    async close() {
      raw.close()
    },
  }
  await migrate(db)
  return db
}

export interface TestNode {
  installId: string
  nodeId: string
  originId: string
}

export const makeNode = (): TestNode => {
  const installId = randomUUID()
  return { installId, nodeId: deriveNodeId(installId), originId: deriveOriginId(installId) }
}

export const NOW = 1_800_000_000_000

export function makeAlert(
  node: TestNode,
  overrides: Partial<{ type: AlertType; now: number; ttlMs: number; maxHops: number; summary: string }> = {}
): MeshAlert {
  const built = buildAlert({
    id: randomUUID(),
    type: overrides.type ?? 'flood',
    severity: 'warning',
    originId: node.originId,
    summary: overrides.summary ?? 'Water rising on College Road',
    now: overrides.now ?? NOW,
    ttlMs: overrides.ttlMs,
    maxHops: overrides.maxHops,
  })
  if (!built.ok) throw new Error(`test alert invalid: ${built.reason}`)
  return built.value
}
