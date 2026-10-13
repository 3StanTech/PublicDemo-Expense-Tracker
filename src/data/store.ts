import { closeLocalStore, getLocalStore, type DemoStore } from '@/data/local-store'

export type { DemoStore, SyncState, SyncStatus } from '@/data/local-store'

let storePromise: Promise<DemoStore> | null = null

/**
 * The app's store: Firestore in the browser build (loaded on demand so the
 * Firebase SDK stays out of the initial bundle), the local store under Vitest.
 */
export function getStore(): Promise<DemoStore> {
  if (import.meta.env.MODE === 'test') return getLocalStore()
  if (!storePromise) {
    storePromise = import('@/data/firestore-store').then((module) => module.createFirestoreStore())
    // A failed chunk load can be retried on the next call.
    storePromise.catch(() => {
      storePromise = null
    })
  }
  return storePromise
}

/** Closes the open store and drops the singleton so the next getStore() recreates it. */
export async function closeStore(): Promise<void> {
  if (import.meta.env.MODE === 'test') return closeLocalStore()
  const pending = storePromise
  storePromise = null
  if (pending) await (await pending).close()
}
