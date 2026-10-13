import { LOCAL_DATABASE_NAME } from '@/data/local-store'
import { closeStore, getStore } from '@/data/store'

export type ResetDemoDataOptions = {
  /** Remove the visitor's saved changes (defaults to the app store's). */
  clearVisitorData?: () => Promise<void>
  /** Close the open store before deleting the old local database. */
  closeStore?: () => Promise<void>
  /** Override IndexedDB deletion (tests). */
  deleteDatabase?: (name: string) => Promise<void>
  /** Override page reload (tests). */
  reload?: () => void
}

function defaultDeleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      resolve()
      return
    }
    const request = indexedDB.deleteDatabase(name)
    request.addEventListener('success', () => resolve())
    request.addEventListener('error', () =>
      reject(request.error ?? new Error('Failed to delete demo database')),
    )
    // Another connection may briefly block; treat blocked as success so reload can proceed.
    request.addEventListener('blocked', () => resolve())
  })
}

async function defaultClearVisitorData(): Promise<void> {
  const store = await getStore()
  await store.clearVisitorData()
}

/**
 * Removes the visitor's saved changes (waiting for the server), closes the
 * store, deletes the earlier local-only demo database, and reloads so the
 * sample data shows from scratch. Throws if the changes could not be removed.
 */
export async function resetDemoData(options: ResetDemoDataOptions = {}): Promise<void> {
  const clear = options.clearVisitorData ?? defaultClearVisitorData
  await clear()

  const close = options.closeStore ?? closeStore
  await close()

  const deleteDatabase = options.deleteDatabase ?? defaultDeleteDatabase
  await deleteDatabase(LOCAL_DATABASE_NAME)

  const reload =
    options.reload ??
    (() => {
      window.location.reload()
    })
  reload()
}
