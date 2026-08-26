import { LOCAL_DATABASE_NAME, closeLocalStore } from '@/data/local-store'

export type ResetDemoDataOptions = {
  /** Close the open local store before deleting the database. */
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

/**
 * Closes local storage, deletes the IndexedDB database, and reloads so
 * getLocalStore() re-seeds sample data from scratch.
 */
export async function resetDemoData(options: ResetDemoDataOptions = {}): Promise<void> {
  const close = options.closeStore ?? closeLocalStore
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
