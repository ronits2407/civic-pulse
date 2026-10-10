/**
 * Neighborhood Emergency Network - tunable policy.
 *
 * These are EXPERIMENTAL prototype settings chosen to exercise the relay logic in a
 * test. They are not validated emergency-response values and must not be presented as
 * such. Every one of them is a bound: queues, sizes, rates and lifetimes are capped so
 * a hostile or buggy peer cannot exhaust a low-end phone.
 */
export const MESH_CONFIG = {
  /** Wire/schema version. Bumped on any incompatible change; unknown versions are rejected. */
  schemaVersion: 1,

  // -- Relay policy ------------------------------------------------------------
  /** Hops an alert may travel beyond its origin. */
  maxHops: 5,
  /** Default lifetime of a new alert. */
  defaultTtlMs: 30 * 60 * 1000,
  /** Longest lifetime a received alert may claim, so no alert can live indefinitely. */
  maxTtlMs: 2 * 60 * 60 * 1000,
  /** Tolerated clock difference between phones (alerts "from the future"). */
  clockSkewMs: 5 * 60 * 1000,
  /** Expired ids are kept briefly so a late replay is still recognised as already seen. */
  seenGraceMs: 10 * 60 * 1000,
  /** Expired alerts stay in the history list this long. They are never forwarded or notified. */
  historyRetentionMs: 24 * 60 * 60 * 1000,

  // -- Size limits ---------------------------------------------------------------
  summaryMaxChars: 140,
  /** One serialized alert envelope. */
  alertMaxBytes: 1024,
  /** One wire frame. Nearby's bytes payload ceiling is ~32 KB; stay well below it. */
  frameMaxBytes: 16 * 1024,
  /** Alerts per frame. */
  frameMaxAlerts: 12,
  /** Ids in one inventory. */
  inventoryMaxIds: 100,

  // -- Storage bounds ------------------------------------------------------------
  maxStoredAlerts: 100,
  maxOutboxRows: 600,

  // -- Rate limits ---------------------------------------------------------------
  /** Inbound frames per peer per window. */
  peerFramesPerWindow: 40,
  peerWindowMs: 10_000,
  /** Violations before a peer is disconnected. */
  peerMaxViolations: 3,
  /** How long a misbehaving peer is ignored for the rest of the session. */
  banMs: 5 * 60_000,
  /** The relay is stopped if the app has been in the background longer than this. */
  backgroundGraceMs: 30_000,
  /** Alerts accepted from one origin id per minute (anti-spam). */
  originAlertsPerMinute: 6,
  /** Alerts pushed to one peer per minute. */
  peerSendsPerMinute: 60,
  /** Alerts this device may create. Persisted, so a restart does not reset it. */
  localAlertsPerHour: 6,
  /** Minimum gap between two SOS alerts from this device. */
  sosCooldownMs: 60_000,

  // -- Connection management -----------------------------------------------------
  maxConnectedPeers: 4,
  /** The phone with the larger node id waits this long for the other to connect before it dials. */
  fallbackDialDelayMs: 8_000,
  /** requestConnection has no failure event in the library, so we time it out ourselves. */
  connectTimeoutMs: 20_000,
  reconnectBackoffMs: [2_000, 5_000, 15_000, 30_000] as readonly number[],
  /** An unfamiliar peer that is not allowed or blocked within this time is dropped. */
  consentTimeoutMs: 60_000,
  /** Failed dials before the relay stops retrying a peer until it is rediscovered. */
  maxDialAttempts: 6,
  /** Transfer attempts before an outbox row is marked failed. */
  maxSendAttempts: 5,
  /** Re-send unacknowledged outbox rows this often while a peer stays connected. */
  retryIntervalMs: 15_000,
} as const

type Widen<T> = T extends number ? number : T

/** Same shape as MESH_CONFIG with literal numbers widened, so tests can override limits. */
export type MeshConfig = { readonly [K in keyof typeof MESH_CONFIG]: Widen<(typeof MESH_CONFIG)[K]> }
