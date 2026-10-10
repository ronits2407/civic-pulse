import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Platform } from 'react-native'
import Constants, { ExecutionEnvironment } from 'expo-constants'

import { MESH_CONFIG } from '@/lib/mesh/config'
import { openMeshDb } from '@/lib/mesh/db.expo'
import type { MeshDb } from '@/lib/mesh/db'
import type { CreateAlertInput, CreateAlertOutcome, RelayEngine } from '@/lib/mesh/engine'
import type { RelaySnapshot } from '@/lib/mesh/engine-types'
import { loadFeed, type FeedItem } from '@/lib/mesh/feed'
import { checkMeshPermissions, requestMeshPermissions, type MeshPermissionStatus } from '@/lib/mesh/permissions'

/**
 * One foreground relay session, owned by the screen that calls this hook.
 *
 * Leaving the screen, or keeping the app in the background longer than the grace period,
 * stops the radios and detaches every listener. There is no background service: the relay
 * is on only while the user can see it.
 */

const EMPTY: RelaySnapshot = {
  phase: 'stopped', nearby: [], connected: [], awaitingConsent: [], pendingTransfers: 0, error: null,
}

export interface RelaySession {
  snapshot: RelaySnapshot
  feed: FeedItem[]
  permission: MeshPermissionStatus | null
  notificationsAllowed: boolean | null
  supported: boolean
  /** True inside Expo Go, which cannot load the Nearby or notification native modules. */
  expoGo: boolean
  busy: boolean
  start(): Promise<void>
  stop(): Promise<void>
  createAlert(input: CreateAlertInput): Promise<CreateAlertOutcome>
  allowPeer(endpointId: string): Promise<void>
  blockPeer(endpointId: string): Promise<void>
  recheckPermissions(): Promise<void>
}

export function useRelaySession(): RelaySession {
  // Expo Go ships only Expo's own native modules. Nearby Connections, Nitro and push
  // notifications are custom native code, so they need a development or release build.
  const expoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  const supported = Platform.OS === 'android' && !expoGo
  const [snapshot, setSnapshot] = useState<RelaySnapshot>(EMPTY)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [permission, setPermission] = useState<MeshPermissionStatus | null>(null)
  const [notificationsAllowed, setNotificationsAllowed] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  const engineRef = useRef<RelayEngine | null>(null)
  const dbRef = useRef<MeshDb | null>(null)
  const mounted = useRef(true)
  const backgroundTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reloadFeed = useCallback(async () => {
    const db = dbRef.current
    if (!db || !mounted.current) return
    try {
      const items = await loadFeed(db, Date.now())
      if (mounted.current) setFeed(items)
    } catch {
      // A failed refresh keeps the previous list on screen.
    }
  }, [])

  const stop = useCallback(async () => {
    const engine = engineRef.current
    engineRef.current = null
    if (engine) await engine.stop()
    if (mounted.current) setSnapshot(EMPTY)
  }, [])

  const recheckPermissions = useCallback(async () => {
    if (supported) setPermission(await checkMeshPermissions())
  }, [supported])

  // Open the database so stored alerts are visible even while the relay is off.
  useEffect(() => {
    mounted.current = true
    void recheckPermissions()
    void (async () => {
      if (!supported) return
      try {
        dbRef.current = await openMeshDb()
        await reloadFeed()
      } catch {
        // Storage unavailable: the screen still renders and start() will report it.
      }
    })()
    return () => {
      mounted.current = false
      if (backgroundTimer.current) clearTimeout(backgroundTimer.current)
      void stop()
    }
  }, [supported, recheckPermissions, reloadFeed, stop])

  // Foreground only: stop the relay if the app stays in the background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (backgroundTimer.current) clearTimeout(backgroundTimer.current)
        backgroundTimer.current = null
        void recheckPermissions()
        void reloadFeed()
        return
      }
      if (!engineRef.current || backgroundTimer.current) return
      backgroundTimer.current = setTimeout(() => {
        backgroundTimer.current = null
        void stop()
      }, MESH_CONFIG.backgroundGraceMs)
    })
    return () => sub.remove()
  }, [recheckPermissions, reloadFeed, stop])

  const start = useCallback(async () => {
    if (!supported || busy || engineRef.current) return
    setBusy(true)
    try {
      const status = await requestMeshPermissions()
      setPermission(status)
      if (status.state !== 'granted') return
      // Loaded on demand so merely opening this screen never touches native-only modules.
      const { configureNotifications, ensureNotificationPermission } = await import('@/lib/mesh/notify')
      const { createAppEngine } = await import('@/lib/mesh/app-engine')
      await configureNotifications()
      setNotificationsAllowed(await ensureNotificationPermission())

      const db = dbRef.current ?? (dbRef.current = await openMeshDb())
      const engine = await createAppEngine(db, {
        onSnapshot: (next) => mounted.current && setSnapshot(next),
        onDataChanged: () => void reloadFeed(),
      })
      engineRef.current = engine
      await engine.start()
      if (mounted.current) setSnapshot(engine.snapshot)
    } finally {
      if (mounted.current) setBusy(false)
    }
  }, [supported, busy, reloadFeed])

  const createAlert = useCallback(async (input: CreateAlertInput): Promise<CreateAlertOutcome> => {
    const engine = engineRef.current
    return engine ? engine.createAlert(input) : { ok: false, reason: 'relay_off' }
  }, [])

  const allowPeer = useCallback(async (id: string) => void (await engineRef.current?.allowPeer(id)), [])
  const blockPeer = useCallback(async (id: string) => void (await engineRef.current?.blockPeer(id)), [])

  return {
    snapshot, feed, permission, notificationsAllowed, supported, expoGo, busy,
    start, stop, createAlert, allowPeer, blockPeer, recheckPermissions,
  }
}
