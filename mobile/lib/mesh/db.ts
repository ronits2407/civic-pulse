/**
 * Minimal async SQL surface the relay needs.
 *
 * Two implementations exist: `db.expo.ts` (expo-sqlite, used by the app) and a
 * bun:sqlite wrapper in the tests. Keeping the relay behind this interface is what lets
 * the transaction, de-duplication and restart logic be exercised against a real SQL
 * engine without a phone.
 */
export type SqlValue = string | number | null

export interface MeshDbTx {
  run(sql: string, params?: SqlValue[]): Promise<{ changes: number }>
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>
  first<T>(sql: string, params?: SqlValue[]): Promise<T | null>
}

export interface MeshDb extends MeshDbTx {
  exec(sql: string): Promise<void>
  /**
   * Run `fn` atomically. If it throws, every write made inside is rolled back.
   * Transactions are serialised: a second call waits for the first to finish.
   */
  transaction<T>(fn: (tx: MeshDbTx) => Promise<T>): Promise<T>
  close(): Promise<void>
}

export const SCHEMA_VERSION = 1

/**
 * Persistent tables.
 *
 * mesh_alerts   accepted alerts (created here or received). The row IS the durable copy.
 * mesh_seen     ids already processed; outlives the alert row so a late replay is recognised.
 * mesh_outbox   forwarding work, one row per (alert, peer node). Keyed by node id, not by
 *               transport endpoint id, because endpoint ids change on every reconnection.
 * mesh_peers    the user's consent decisions, keyed by pseudonymous node id. Nothing else about
 *               a peer is stored: endpoint ids, signal and rate counters are ephemeral and
 *               would only leak who was nearby.
 * mesh_meta     key/value (install id, schema version).
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS mesh_meta (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mesh_alerts (
  id            TEXT PRIMARY KEY NOT NULL,
  body          TEXT NOT NULL,
  type          TEXT NOT NULL,
  severity      TEXT NOT NULL,
  origin_id     TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL,
  hop_count     INTEGER NOT NULL,
  max_hops      INTEGER NOT NULL,
  direction     TEXT NOT NULL CHECK (direction IN ('local','peer')),
  received_from TEXT,
  received_at   INTEGER NOT NULL,
  notified_at   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_mesh_alerts_expires ON mesh_alerts (expires_at);
CREATE INDEX IF NOT EXISTS idx_mesh_alerts_origin  ON mesh_alerts (origin_id, received_at);
CREATE INDEX IF NOT EXISTS idx_mesh_alerts_dir     ON mesh_alerts (direction, created_at);

CREATE TABLE IF NOT EXISTS mesh_seen (
  id         TEXT PRIMARY KEY NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mesh_seen_expires ON mesh_seen (expires_at);

CREATE TABLE IF NOT EXISTS mesh_outbox (
  alert_id        TEXT NOT NULL,
  peer_node       TEXT NOT NULL,
  state           TEXT NOT NULL CHECK (state IN ('pending','sent','acked','failed')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_attempt_at INTEGER,
  acked_at        INTEGER,
  ack_kind        TEXT CHECK (ack_kind IS NULL OR ack_kind IN ('peer_ack','peer_inventory','peer_rejected')),
  created_at      INTEGER NOT NULL,
  PRIMARY KEY (alert_id, peer_node)
);
CREATE INDEX IF NOT EXISTS idx_mesh_outbox_peer ON mesh_outbox (peer_node, state);

CREATE TABLE IF NOT EXISTS mesh_peers (
  node_id       TEXT PRIMARY KEY NOT NULL,
  trust         TEXT NOT NULL CHECK (trust IN ('allowed','blocked')),
  first_seen_at INTEGER NOT NULL,
  last_seen_at  INTEGER NOT NULL
);
`

export async function migrate(db: MeshDb): Promise<void> {
  await db.exec(SCHEMA_SQL)
  await db.run('INSERT OR IGNORE INTO mesh_meta (key, value) VALUES (?, ?)', [
    'schema_version',
    String(SCHEMA_VERSION),
  ])
}
