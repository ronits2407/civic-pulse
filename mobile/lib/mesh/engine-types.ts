import type { MeshConfig } from '@/lib/mesh/config'
import type { MeshDb } from '@/lib/mesh/db'
import type { MeshIdentity } from '@/lib/mesh/identity'
import type { PeerView } from '@/lib/mesh/peers'
import type { MeshAlert, RejectReason } from '@/lib/mesh/protocol'
import type { MeshTransport, TransportError } from '@/lib/mesh/transport'

export type RelayPhase = 'stopped' | 'starting' | 'running' | 'stopping' | 'error'

export interface RelaySnapshot {
  phase: RelayPhase
  /** Peers seen nearby but not connected (includes ones waiting for the user's consent). */
  nearby: PeerView[]
  connected: PeerView[]
  /** Peers waiting for the user to allow or block them. */
  awaitingConsent: PeerView[]
  /** Outbox rows not yet acknowledged (pending + sent). */
  pendingTransfers: number
  error: TransportError | null
}

/** A timer handle the engine can cancel. Injected so tests can control time. */
export interface Clock {
  now(): number
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

export const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

export interface EngineEvents {
  /** An alert was newly stored from a peer. Fires exactly once per alert id. */
  onAlertReceived?: (alert: MeshAlert, fromNode: string) => void
  /** A frame or alert was refused. For diagnostics and the activity log. */
  onRejected?: (reason: RejectReason, fromNode: string | null) => void
  /** Anything in the persisted data changed; the UI should reload its lists. */
  onDataChanged?: () => void
  onSnapshot?: (snapshot: RelaySnapshot) => void
}

export interface EngineDeps {
  transport: MeshTransport
  db: MeshDb
  identity: MeshIdentity
  config: MeshConfig
  clock: Clock
  /** Platform CSPRNG UUID source (expo-crypto in the app). */
  randomUuid: () => string
  events?: EngineEvents
}
