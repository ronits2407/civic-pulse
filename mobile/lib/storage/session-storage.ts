import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'

/**
 * Supabase session storage backed by the Android Keystore.
 *
 * Why this exists: a Supabase auth session is a JSON blob carrying the access
 * token and refresh token. Two constraints push us past the obvious solution:
 *
 *  1. Android's SecureStore rejects values above ~2048 bytes, and a session with
 *     JWT claims comfortably exceeds that. So values are split into chunks with a
 *     companion count key.
 *  2. SecureStore is unavailable on web and can throw on some locked/uninitialised
 *     devices. AsyncStorage is used as a per-operation fallback so a failed
 *     keystore write can never silently log the user out.
 *
 * Everything here is best-effort: a storage failure is reported to the caller by
 * returning null / throwing, and the auth layer surfaces it as a real error rather
 * than pretending the session was saved.
 */

const CHUNK_SIZE = 1800
const COUNT_SUFFIX = '.__n'

function chunkCountKey(key: string) {
  return key + COUNT_SUFFIX
}

/** SecureStore only accepts keys matching [A-Za-z0-9._-]; Supabase keys already do. */
function chunkKey(key: string, index: number) {
  return `${key}.${index}`
}

async function secureGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key)
  } catch {
    return null
  }
}

async function secureSet(key: string, value: string): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(key, value)
    return true
  } catch {
    return false
  }
}

async function secureDelete(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key)
  } catch {
    // Deleting a key that is already gone is not an error for our purposes.
  }
}

async function readChunkCount(key: string): Promise<number> {
  const raw = await secureGet(chunkCountKey(key))
  if (!raw) return 0
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

async function clearChunks(key: string, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await secureDelete(chunkKey(key, i))
  }
  await secureDelete(chunkCountKey(key))
}

/** Minimal interface Supabase's `auth.storage` option expects. */
export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const count = await readChunkCount(key)

    if (count > 0) {
      const parts: string[] = []
      for (let i = 0; i < count; i++) {
        const part = await secureGet(chunkKey(key, i))
        // A missing chunk means a partially written session; treat it as absent
        // and clean up rather than handing Supabase a truncated token.
        if (part == null) {
          await clearChunks(key, count)
          return null
        }
        parts.push(part)
      }
      return parts.join('')
    }

    // Keys written before chunking existed (or the AsyncStorage fallback).
    const legacy = await secureGet(key)
    if (legacy != null) return legacy
    return AsyncStorage.getItem(key)
  },

  async setItem(key: string, value: string): Promise<void> {
    const previousCount = await readChunkCount(key)
    await clearChunks(key, previousCount)
    await AsyncStorage.removeItem(key)

    const chunks: string[] = []
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE))
    }

    let wroteAll = true
    for (let i = 0; i < chunks.length; i++) {
      if (!(await secureSet(chunkKey(key, i), chunks[i]))) {
        wroteAll = false
        break
      }
    }

    if (wroteAll && (await secureSet(chunkCountKey(key), String(chunks.length)))) {
      return
    }

    // Keystore refused (or is unavailable). Fall back to AsyncStorage so the
    // session survives within this install, and do not leave half a blob behind.
    await clearChunks(key, chunks.length)
    await AsyncStorage.setItem(key, value)
  },

  async removeItem(key: string): Promise<void> {
    const count = await readChunkCount(key)
    await clearChunks(key, count)
    await secureDelete(key)
    await AsyncStorage.removeItem(key)
  },
}

/**
 * Non-secret key/value storage for report drafts.
 * Drafts hold nothing sensitive, so plain AsyncStorage is correct here and avoids
 * burning keystore chunks on a potentially large media list.
 */
export const draftStorage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
}
