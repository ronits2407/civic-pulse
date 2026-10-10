import * as SQLite from 'expo-sqlite'

import { migrate, type MeshDb, type MeshDbTx, type SqlValue } from '@/lib/mesh/db'

/**
 * expo-sqlite adapter.
 *
 * Transactions use `withExclusiveTransactionAsync`, which gives the task its own
 * connection-bound `Transaction` object. Anything not issued through that object runs
 * outside the transaction, so the relay only ever touches `tx` inside `transaction()`.
 */
function wrap(source: SQLite.SQLiteDatabase): MeshDbTx {
  return {
    async run(sql, params = []) {
      const result = await source.runAsync(sql, params)
      return { changes: result.changes }
    },
    all<T>(sql: string, params: SqlValue[] = []) {
      return source.getAllAsync<T>(sql, params)
    },
    first<T>(sql: string, params: SqlValue[] = []) {
      return source.getFirstAsync<T>(sql, params)
    },
  }
}

export async function openMeshDb(name = 'civicpulse-mesh.db'): Promise<MeshDb> {
  const native = await SQLite.openDatabaseAsync(name)
  // WAL keeps readers (the UI) from blocking the writer (the relay).
  await native.execAsync('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;')

  const base = wrap(native)
  const db: MeshDb = {
    ...base,
    exec: (sql) => native.execAsync(sql),
    async transaction<T>(fn: (tx: MeshDbTx) => Promise<T>): Promise<T> {
      let result!: T
      await native.withExclusiveTransactionAsync(async (txn) => {
        result = await fn(wrap(txn))
      })
      return result
    },
    close: () => native.closeAsync(),
  }
  await migrate(db)
  return db
}
