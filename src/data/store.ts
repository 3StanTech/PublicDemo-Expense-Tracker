import {
  closeLocalStore,
  getLocalStore,
  seedRows,
  type DemoStore,
  type LocalCollection,
  type LocalEntityByCollection,
  type SyncStatus,
} from '@/data/local-store'

export type { DemoStore, Persistence, SyncState, SyncStatus } from '@/data/local-store'

const LOADING: SyncStatus = {
  state: 'loading',
  hasPendingWrites: false,
  error: null,
  persistence: 'device',
}

const LOAD_ERROR = 'Could not load the demo service. Your changes are not being saved.'

function compareIds(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * Stands in for the Firestore store while its chunk (the Firebase SDK) is
 * still downloading. Reads answer from the sample data at once, the same rows
 * a first-time visitor sees; writes wait for the real store. When it arrives,
 * every call is delegated to it and subscribers get one data change so their
 * queries refetch with the visitor's saved changes.
 */
class DeferredFirestoreStore implements DemoStore {
  private real: DemoStore | null = null
  private loading: Promise<DemoStore>
  private loadFailed = false
  private closed = false
  /** Subscribers, with their unsubscribe from the real store once it exists. */
  private readonly dataListeners = new Map<() => void, (() => void) | null>()
  private readonly statusListeners = new Map<(status: SyncStatus) => void, (() => void) | null>()
  private readyBeforeLoad: Promise<void>

  constructor() {
    this.loading = this.load()
    this.readyBeforeLoad = this.readyAfterLoad()
  }

  get ready(): Promise<void> {
    return this.real ? this.real.ready : this.readyBeforeLoad
  }

  get syncStatus(): SyncStatus {
    if (this.real) return this.real.syncStatus
    return this.loadFailed ? { ...LOADING, state: 'error', error: LOAD_ERROR } : LOADING
  }

  async list<C extends LocalCollection>(collection: C): Promise<LocalEntityByCollection[C][]> {
    if (this.real) return this.real.list(collection)
    const rows = seedRows()[collection] as LocalEntityByCollection[C][]
    return [...rows].sort(compareIds).map((row) => structuredClone(row))
  }

  async get<C extends LocalCollection>(
    collection: C,
    id: string,
  ): Promise<LocalEntityByCollection[C] | null> {
    if (this.real) return this.real.get(collection, id)
    const rows = seedRows()[collection] as LocalEntityByCollection[C][]
    const row = rows.find((candidate) => candidate.id === id)
    return row ? structuredClone(row) : null
  }

  async put<C extends LocalCollection>(
    collection: C,
    entity: LocalEntityByCollection[C],
  ): Promise<LocalEntityByCollection[C]> {
    return (await this.loading).put(collection, entity)
  }

  async remove<C extends LocalCollection>(
    collection: C,
    id: string,
  ): Promise<LocalEntityByCollection[C] | null> {
    return (await this.loading).remove(collection, id)
  }

  async clearVisitorData(): Promise<void> {
    return (await this.loading).clearVisitorData()
  }

  subscribe(listener: () => void): () => void {
    this.dataListeners.set(listener, this.real ? this.real.subscribe(listener) : null)
    return () => {
      this.dataListeners.get(listener)?.()
      this.dataListeners.delete(listener)
    }
  }

  subscribeSyncStatus(listener: (status: SyncStatus) => void): () => void {
    this.statusListeners.set(listener, this.real ? this.real.subscribeSyncStatus(listener) : null)
    return () => {
      this.statusListeners.get(listener)?.()
      this.statusListeners.delete(listener)
    }
  }

  retrySync(): void {
    if (this.real) {
      this.real.retrySync()
      return
    }
    if (!this.loadFailed || this.closed) return
    // The chunk failed to download: try again, replacing `ready` before notifying.
    this.loadFailed = false
    this.loading = this.load()
    this.readyBeforeLoad = this.readyAfterLoad()
    this.notifyStatus()
  }

  async close(): Promise<void> {
    this.closed = true
    for (const unsubscribe of this.dataListeners.values()) unsubscribe?.()
    for (const unsubscribe of this.statusListeners.values()) unsubscribe?.()
    this.dataListeners.clear()
    this.statusListeners.clear()
    if (this.real) await this.real.close()
  }

  /** Starts the chunk download at once; hands over to the real store when it lands. */
  private load(): Promise<DemoStore> {
    const loading = import('@/data/firestore-store').then(
      (module) => {
        const real = module.createFirestoreStore()
        this.real = real
        if (this.closed) {
          void real.close()
          return real
        }
        for (const listener of this.dataListeners.keys()) {
          this.dataListeners.set(listener, real.subscribe(listener))
        }
        for (const listener of this.statusListeners.keys()) {
          this.statusListeners.set(listener, real.subscribeSyncStatus(listener))
        }
        this.notifyStatus()
        // Sample data was served so far; refetch with the visitor's changes.
        for (const listener of this.dataListeners.keys()) listener()
        return real
      },
      (error: unknown) => {
        this.loadFailed = true
        this.notifyStatus()
        throw error
      },
    )
    // Readers that never write must not see an unhandled rejection.
    loading.catch(() => undefined)
    return loading
  }

  private readyAfterLoad(): Promise<void> {
    const ready = this.loading.then((real) => real.ready)
    ready.catch(() => undefined)
    return ready
  }

  private notifyStatus(): void {
    const status = this.syncStatus
    for (const listener of this.statusListeners.keys()) listener(status)
  }
}

let store: DemoStore | null = null

/**
 * The app's store: Firestore in the browser build, the local store under
 * Vitest. The Firebase SDK is a separate chunk that starts downloading on the
 * first call, while reads already answer from the sample data.
 */
export function getStore(): Promise<DemoStore> {
  if (import.meta.env.MODE === 'test') return getLocalStore()
  store ??= new DeferredFirestoreStore()
  return Promise.resolve(store)
}

/** Closes the open store and drops the singleton so the next getStore() recreates it. */
export async function closeStore(): Promise<void> {
  if (import.meta.env.MODE === 'test') return closeLocalStore()
  const current = store
  store = null
  if (current) await current.close()
}
