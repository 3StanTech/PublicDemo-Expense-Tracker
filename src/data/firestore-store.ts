import {
  collection as collectionRef,
  doc,
  getDocsFromCache,
  getDocsFromServer,
  increment,
  onSnapshot,
  serverTimestamp,
  waitForPendingWrites,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type QuerySnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { getFirebase, onMemoryCacheFallback, signInVisitor, storedVisitorId } from '@/data/firebase'
import {
  LOCAL_COLLECTIONS,
  seedRows,
  type DemoStore,
  type LocalCollection,
  type LocalEntityByCollection,
  type LocalRecord,
  type Persistence,
  type SyncStatus,
} from '@/data/local-store'

/*
 * Data model: every visitor starts from the sample data bundled with the app.
 * Their edits live in one subcollection, `demos/{uid}/changes`, one document per
 * changed record, id `<collection>~<recordId>`; `deleted: true` hides a record.
 * The profile `demos/{uid}` counts every batch (`writes`) and every change
 * document created (`docs`), and `last` names the change document the batch
 * wrote. Firestore rules enforce those counters as the visitor's write budget,
 * so each put/remove is exactly one batch with exactly one change document.
 */

const READY_TIMEOUT_MS = 20_000
/** Change documents deleted per reset batch (plus the one profile update). */
const RESET_BATCH_SIZE = 100

const CONNECT_ERROR = 'Could not reach the demo service. Your changes are not being saved.'
const SYNC_ERROR = 'Lost the connection to the demo service.'
const WRITE_ERROR = 'A change could not be saved to the demo service.'
const RESET_OFFLINE_ERROR = 'Resetting needs an internet connection.'

type ChangeEntry =
  | { collection: LocalCollection; id: string; deleted: true }
  | { collection: LocalCollection; id: string; deleted: false; record: LocalRecord }

type ChangeData =
  | { collection: LocalCollection; deleted: true }
  | { collection: LocalCollection; deleted: false; record: LocalRecord }

function clone<T>(value: T): T {
  return structuredClone(value)
}

function changeKey(collection: LocalCollection, id: string): string {
  return `${collection}~${id}`
}

function isCollection(value: unknown): value is LocalCollection {
  return typeof value === 'string' && (LOCAL_COLLECTIONS as readonly string[]).includes(value)
}

function parseChange(key: string, data: DocumentData): ChangeEntry | null {
  const separator = key.indexOf('~')
  const collection = key.slice(0, separator)
  const id = key.slice(separator + 1)
  if (separator <= 0 || !id || !isCollection(collection) || data.collection !== collection) {
    return null
  }
  if (data.deleted === true) return { collection, id, deleted: true }
  const record: unknown = data.record
  if (data.deleted !== false || typeof record !== 'object' || record === null) return null
  return { collection, id, deleted: false, record: record as LocalRecord }
}

function compareIds(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Timed out connecting to the demo service.')),
      ms,
    )
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/** Live listeners on one visitor's demo space. */
type Connection = {
  uid: string
  profileRef: DocumentReference
  unsubscribe: Unsubscribe[]
}

export class FirestoreStore implements DemoStore {
  private readonly seed = new Map<LocalCollection, Map<string, LocalRecord>>()
  /** Change documents by key, as of the latest snapshot (or the cache before it). */
  private changes = new Map<string, ChangeEntry>()
  private readyPromise: Promise<void>
  private connection: Connection | null = null
  private connecting: Promise<Connection> | null = null
  /** Whether `demos/{uid}` exists, including this device's unacknowledged writes. */
  private profileExists = false
  private hasAnySnapshot = false
  private hasServerSnapshot = false
  private fromCache = true
  private hasPendingWrites = false
  private error: string | null = null
  private persistence: Persistence = 'device'
  private readonly stopCacheWatch: () => void
  private status: SyncStatus = {
    state: 'loading',
    hasPendingWrites: false,
    error: null,
    persistence: 'device',
  }
  /** Resolvers for writes waiting to show up in the local cache, by change key. */
  private readonly applyWaiters = new Map<string, () => void>()
  /** Serializes writes so each batch sees the counters left by the one before. */
  private writeChain: Promise<unknown> = Promise.resolve()
  private readonly dataListeners = new Set<() => void>()
  private readonly statusListeners = new Set<(status: SyncStatus) => void>()
  private closed = false

  constructor() {
    const seed = seedRows()
    for (const name of LOCAL_COLLECTIONS) {
      this.seed.set(name, new Map(seed[name].map((row) => [row.id, row as LocalRecord])))
    }
    this.readyPromise = this.startReady()
    void this.loadCachedChanges()
    // 'device' until Firestore itself reports falling back to a memory cache
    // (IndexedDB blocked, out of quota or an incompatible cache); unsent changes
    // are then lost on reload.
    this.stopCacheWatch = onMemoryCacheFallback(() => {
      this.persistence = 'memory'
      this.updateStatus()
    })
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleNetworkChange)
      window.addEventListener('offline', this.handleNetworkChange)
    }
  }

  get ready(): Promise<void> {
    return this.readyPromise
  }

  get syncStatus(): SyncStatus {
    return this.status
  }

  /*
   * Reads never wait for Auth or the network: they answer from the sample data
   * and the changes known so far, and subscribers are told when the cache or a
   * server snapshot brings more.
   */
  async list<C extends LocalCollection>(collection: C): Promise<LocalEntityByCollection[C][]> {
    const rows = new Map(this.seed.get(collection))
    for (const change of this.changes.values()) {
      if (change.collection !== collection) continue
      if (change.deleted) rows.delete(change.id)
      else rows.set(change.id, change.record)
    }
    return [...rows.values()].sort(compareIds).map(clone) as LocalEntityByCollection[C][]
  }

  async get<C extends LocalCollection>(
    collection: C,
    id: string,
  ): Promise<LocalEntityByCollection[C] | null> {
    const change = this.changes.get(changeKey(collection, id))
    const value = change
      ? change.deleted
        ? undefined
        : change.record
      : this.seed.get(collection)?.get(id)
    return value ? (clone(value) as LocalEntityByCollection[C]) : null
  }

  async put<C extends LocalCollection>(
    collection: C,
    entity: LocalEntityByCollection[C],
  ): Promise<LocalEntityByCollection[C]> {
    const saved = clone(entity)
    await this.ready
    await this.serialize(() =>
      this.writeChange(changeKey(collection, saved.id), {
        collection,
        deleted: false,
        record: saved,
      }),
    )
    return clone(saved)
  }

  async remove<C extends LocalCollection>(
    collection: C,
    id: string,
  ): Promise<LocalEntityByCollection[C] | null> {
    await this.ready
    return this.serialize(async () => {
      const existing = await this.get(collection, id)
      if (!existing) return null
      await this.writeChange(changeKey(collection, id), { collection, deleted: true })
      return existing
    })
  }

  subscribe(listener: () => void): () => void {
    this.dataListeners.add(listener)
    return () => this.dataListeners.delete(listener)
  }

  subscribeSyncStatus(listener: (status: SyncStatus) => void): () => void {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  retrySync(): void {
    if (this.closed) return
    this.error = null
    // Replace the promise before notifying, so listeners read the new attempt.
    this.readyPromise = this.startReady()
    this.updateStatus()
  }

  /**
   * Deletes every change document the server holds, a batch at a time; each
   * batch also bumps the profile's `writes`. The list comes from the server
   * after this device's pending writes are acknowledged, so changes made in
   * other tabs or still in flight are included. The profile and its counters
   * stay, so a reset does not refill the write budget. Waits for the server so
   * failures surface.
   */
  async clearVisitorData(): Promise<void> {
    if (isBrowserOffline()) throw new Error(RESET_OFFLINE_ERROR)
    await this.ready
    await this.serialize(async () => {
      const { db } = getFirebase()
      const connection = this.requireConnection()
      await waitForPendingWrites(db)
      const snapshot = await getDocsFromServer(
        collectionRef(db, 'demos', connection.uid, 'changes'),
      )
      const keys = snapshot.docs.map((change) => change.id)
      for (let start = 0; start < keys.length; start += RESET_BATCH_SIZE) {
        const batch = writeBatch(db)
        for (const key of keys.slice(start, start + RESET_BATCH_SIZE)) {
          batch.delete(doc(db, 'demos', connection.uid, 'changes', key))
        }
        batch.update(connection.profileRef, { writes: increment(1), updatedAt: serverTimestamp() })
        await batch.commit()
      }
    })
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    this.stopCacheWatch()
    this.detach()
    this.dataListeners.clear()
    this.statusListeners.clear()
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleNetworkChange)
      window.removeEventListener('offline', this.handleNetworkChange)
    }
  }

  /** Reads this visitor's cached changes from the device only (no network). */
  private async loadCachedChanges(): Promise<void> {
    try {
      const uid = await storedVisitorId()
      if (!uid) return
      const { db } = getFirebase()
      const snapshot = await getDocsFromCache(collectionRef(db, 'demos', uid, 'changes'))
      // A listener snapshot may already have landed; it is newer than this read.
      if (this.hasAnySnapshot || snapshot.empty) return
      this.changes = this.entriesFrom(snapshot)
      this.emitData()
    } catch {
      // No usable cache: the sample data shows until the first snapshot lands,
      // and the connection attempt reports the failure in the sync status.
    }
  }

  private startReady(): Promise<void> {
    const ready = withTimeout(this.connect(), READY_TIMEOUT_MS).then(
      () => {
        // Tell listeners the attempt settled, even when the status is unchanged.
        if (this.readyPromise === ready) this.updateStatus(true)
      },
      (error: unknown) => {
        if (this.readyPromise === ready) {
          this.error = CONNECT_ERROR
          this.updateStatus(true)
        }
        throw error
      },
    )
    // Readers that never write must not see an unhandled rejection.
    ready.catch(() => undefined)
    return ready
  }

  /** Signs in and attaches both listeners; resolves on their first snapshots. */
  private connect(): Promise<Connection> {
    // A pending attempt (even one that outlived a timeout) is reused, so a
    // retry never attaches a second pair of listeners.
    if (this.connecting) return this.connecting
    if (this.connection) return Promise.resolve(this.connection)
    this.connecting = this.openConnection().finally(() => {
      this.connecting = null
    })
    return this.connecting
  }

  private async openConnection(): Promise<Connection> {
    const uid = await signInVisitor()
    if (this.closed) throw new Error('Store is closed.')
    const { db } = getFirebase()
    const profileRef = doc(db, 'demos', uid)
    const connection: Connection = { uid, profileRef, unsubscribe: [] }

    await new Promise<void>((resolve, reject) => {
      let changesSeen = false
      let profileSeen = false
      const settle = () => {
        if (changesSeen && profileSeen) resolve()
      }
      const onError = () => {
        this.detach()
        this.fail(SYNC_ERROR)
        reject(new Error(SYNC_ERROR))
      }
      connection.unsubscribe.push(
        onSnapshot(
          collectionRef(db, 'demos', uid, 'changes'),
          { includeMetadataChanges: true },
          (snapshot) => {
            this.applyChanges(snapshot)
            changesSeen = true
            settle()
          },
          onError,
        ),
        onSnapshot(
          profileRef,
          (snapshot) => {
            this.profileExists = snapshot.exists()
            profileSeen = true
            settle()
          },
          onError,
        ),
      )
      this.connection = connection
    })
    return connection
  }

  private applyChanges(snapshot: QuerySnapshot): void {
    this.hasAnySnapshot = true
    this.changes = this.entriesFrom(snapshot)
    this.fromCache = snapshot.metadata.fromCache
    this.hasPendingWrites = snapshot.metadata.hasPendingWrites
    if (!this.fromCache) this.hasServerSnapshot = true

    if (this.applyWaiters.size > 0) {
      for (const change of snapshot.docs) {
        if (!change.metadata.hasPendingWrites) continue
        const resolve = this.applyWaiters.get(change.id)
        if (resolve) {
          this.applyWaiters.delete(change.id)
          resolve()
        }
      }
    }

    this.updateStatus()
    if (snapshot.docChanges().length > 0) this.emitData()
  }

  private entriesFrom(snapshot: QuerySnapshot): Map<string, ChangeEntry> {
    const entries = new Map<string, ChangeEntry>()
    for (const change of snapshot.docs) {
      const entry = parseChange(change.id, change.data())
      if (entry) entries.set(change.id, entry)
    }
    return entries
  }

  /**
   * One batch: the change document plus the profile counters. Resolves once the
   * batch is applied to the local cache; the server acknowledgement is not
   * awaited. A rejection (for example the write budget is used up) sets the
   * error status, and the listener rolls the cache back to the server state.
   */
  private async writeChange(key: string, data: ChangeData): Promise<void> {
    const { db } = getFirebase()
    const connection = this.requireConnection()
    const isNew = !this.changes.has(key)
    const batch = writeBatch(db)
    batch.set(doc(db, 'demos', connection.uid, 'changes', key), {
      ...data,
      updatedAt: serverTimestamp(),
    })
    if (this.profileExists) {
      batch.update(connection.profileRef, {
        writes: increment(1),
        updatedAt: serverTimestamp(),
        last: key,
        ...(isNew ? { docs: increment(1) } : {}),
      })
    } else {
      batch.set(connection.profileRef, {
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        writes: 1,
        docs: 1,
        last: key,
      })
      // The profile listener may report it after the next write starts.
      this.profileExists = true
    }

    const applied = new Promise<void>((resolve) => this.applyWaiters.set(key, resolve))
    const settle = () => {
      const resolve = this.applyWaiters.get(key)
      this.applyWaiters.delete(key)
      resolve?.()
    }
    batch.commit().then(settle, () => {
      settle()
      this.fail(WRITE_ERROR)
      this.emitData()
    })
    await applied
  }

  private serialize<T>(task: () => Promise<T>): Promise<T> {
    const run = this.writeChain.then(task)
    this.writeChain = run.catch(() => undefined)
    return run
  }

  private requireConnection(): Connection {
    if (!this.connection) throw new Error(CONNECT_ERROR)
    return this.connection
  }

  private detach(): void {
    const connection = this.connection
    this.connection = null
    for (const unsubscribe of connection?.unsubscribe ?? []) unsubscribe()
    // Nothing will report these writes now; release their callers.
    for (const resolve of this.applyWaiters.values()) resolve()
    this.applyWaiters.clear()
  }

  private fail(message: string): void {
    this.error = message
    this.updateStatus()
  }

  private readonly handleNetworkChange = () => {
    this.updateStatus()
  }

  private updateStatus(force = false): void {
    const state = this.error
      ? 'error'
      : !this.fromCache
        ? 'synced'
        : this.hasServerSnapshot || isBrowserOffline()
          ? 'offline'
          : 'loading'
    const next: SyncStatus = {
      state,
      hasPendingWrites: this.hasPendingWrites,
      error: this.error,
      persistence: this.persistence,
    }
    const current = this.status
    if (
      !force &&
      current.state === next.state &&
      current.persistence === next.persistence &&
      current.hasPendingWrites === next.hasPendingWrites &&
      current.error === next.error
    ) {
      return
    }
    this.status = next
    for (const listener of this.statusListeners) listener(next)
  }

  private emitData(): void {
    for (const listener of this.dataListeners) listener()
  }
}

export function createFirestoreStore(): FirestoreStore {
  return new FirestoreStore()
}
