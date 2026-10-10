import * as Crypto from 'expo-crypto'

import { MESH_CONFIG } from '@/lib/mesh/config'
import type { MeshDb } from '@/lib/mesh/db'
import { RelayEngine } from '@/lib/mesh/engine'
import { systemClock, type RelaySnapshot } from '@/lib/mesh/engine-types'
import { loadIdentity } from '@/lib/mesh/identity'
import { showAlertNotification } from '@/lib/mesh/notify'
import { claimNotification } from '@/lib/mesh/store-local'
import { NearbyTransport } from '@/lib/mesh/transport.nearby'

/**
 * Wires the relay engine to the real platform: Nearby Connections for the radio,
 * expo-crypto for the CSPRNG, expo-notifications for alerts. Tests build the engine
 * directly with a simulated transport instead; nothing else differs.
 */
export async function createAppEngine(
  db: MeshDb,
  listeners: { onSnapshot: (snapshot: RelaySnapshot) => void; onDataChanged: () => void }
): Promise<RelayEngine> {
  const identity = await loadIdentity(db, () => Crypto.randomUUID())
  return new RelayEngine({
    transport: new NearbyTransport(),
    db,
    identity,
    config: MESH_CONFIG,
    clock: systemClock,
    randomUuid: () => Crypto.randomUUID(),
    events: {
      onSnapshot: listeners.onSnapshot,
      onDataChanged: listeners.onDataChanged,
      onAlertReceived: (alert) => {
        // One notification per alert id, claimed in the database so it survives restarts
        // and cannot be repeated when the same alert arrives from a second path.
        void claimNotification(db, alert.id, Date.now()).then((first) => {
          if (first) void showAlertNotification(alert)
        })
      },
    },
  })
}
