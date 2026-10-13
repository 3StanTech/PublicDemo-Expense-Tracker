import { openDB, type IDBPDatabase } from 'idb'
import {
  demoAccounts,
  demoBudgets,
  demoCategories,
  demoDebts,
  demoGoalContributions,
  demoProfile,
  demoRecurringRules,
  demoSavingsGoals,
  demoTransactions,
} from '@/demo/seed'
import type {
  Account,
  Budget,
  Category,
  Debt,
  GoalContribution,
  Profile,
  RecurringRule,
  SavingsGoal,
  Transaction,
} from '@/types/domain'

/**
 * IndexedDB database name of the local store. The browser build now keeps data
 * in Firestore; demo reset still deletes this database so data saved by the
 * earlier local-only demo does not linger.
 */
export const LOCAL_DATABASE_NAME = 'fundsicles-public-demo'

export type LocalCollection =
  | 'profiles'
  | 'categories'
  | 'accounts'
  | 'transactions'
  | 'budgets'
  | 'recurringRules'
  | 'savingsGoals'
  | 'goalContributions'
  | 'debts'

export type LocalEntityByCollection = {
  profiles: Profile
  categories: Category
  accounts: Account
  transactions: Transaction
  budgets: Budget
  recurringRules: RecurringRule
  savingsGoals: SavingsGoal
  goalContributions: GoalContribution
  debts: Debt
}

export type LocalRecord = LocalEntityByCollection[LocalCollection]

export const LOCAL_COLLECTIONS: readonly LocalCollection[] = [
  'profiles',
  'categories',
  'accounts',
  'transactions',
  'budgets',
  'recurringRules',
  'savingsGoals',
  'goalContributions',
  'debts',
]

/** Sample rows every visitor starts from, per collection. */
export function seedRows(): { [C in LocalCollection]: LocalEntityByCollection[C][] } {
  return {
    profiles: [demoProfile],
    categories: demoCategories,
    accounts: demoAccounts,
    transactions: demoTransactions,
    budgets: demoBudgets,
    recurringRules: demoRecurringRules,
    savingsGoals: demoSavingsGoals,
    goalContributions: demoGoalContributions,
    debts: demoDebts,
  }
}

/**
 * - `loading`: no server snapshot yet (sample data and cached changes are shown).
 * - `synced`: the latest snapshot came from the server.
 * - `offline`: working from the device cache; writes sync when back online.
 * - `error`: sign-in, the listener or a write failed; `retrySync()` tries again.
 */
export type SyncState = 'loading' | 'synced' | 'offline' | 'error'

export type SyncStatus = {
  state: SyncState
  /** Writes applied on this device that the server has not acknowledged yet. */
  hasPendingWrites: boolean
  /** Visitor-facing reason when `state` is `error`. */
  error: string | null
}

/** Storage surface used by the repositories and the demo UI. */
export interface DemoStore {
  /** Resolves when writes can be accepted (signed in and first snapshot seen). */
  readonly ready: Promise<void>
  readonly syncStatus: SyncStatus
  list<C extends LocalCollection>(collection: C): Promise<LocalEntityByCollection[C][]>
  get<C extends LocalCollection>(
    collection: C,
    id: string,
  ): Promise<LocalEntityByCollection[C] | null>
  put<C extends LocalCollection>(
    collection: C,
    entity: LocalEntityByCollection[C],
  ): Promise<LocalEntityByCollection[C]>
  remove<C extends LocalCollection>(
    collection: C,
    id: string,
  ): Promise<LocalEntityByCollection[C] | null>
  /** Called when stored data changed outside the caller's own awaited writes. */
  subscribe(listener: () => void): () => void
  subscribeSyncStatus(listener: (status: SyncStatus) => void): () => void
  retrySync(): void
  /** Removes every visitor change so the sample data shows again. */
  clearVisitorData(): Promise<void>
  close(): Promise<void>
}

const SYNCED: SyncStatus = { state: 'synced', hasPendingWrites: false, error: null }

const memoryStores = new Map<LocalCollection, Map<string, LocalRecord>>()

function clone<T>(value: T): T {
  return structuredClone(value)
}

/** IndexedDB (or in-memory) store with no sync; used by the test suite. */
export class LocalStore implements DemoStore {
  readonly ready: Promise<void> = Promise.resolve()
  readonly syncStatus: SyncStatus = SYNCED
  private readonly database: IDBPDatabase | null
  private closed = false

  private constructor(database: IDBPDatabase | null) {
    this.database = database
  }

  static async create(): Promise<LocalStore> {
    const database =
      typeof indexedDB === 'undefined'
        ? null
        : await openDB(LOCAL_DATABASE_NAME, 1, {
            upgrade(db) {
              for (const store of LOCAL_COLLECTIONS) {
                if (!db.objectStoreNames.contains(store)) {
                  db.createObjectStore(store, { keyPath: 'id' })
                }
              }
            },
          })
    const store = new LocalStore(database)
    await store.seedIfEmpty()
    return store
  }

  private async seedIfEmpty(): Promise<void> {
    if ((await this.list('profiles')).length > 0) return
    const seed = seedRows()
    for (const collection of LOCAL_COLLECTIONS) {
      for (const row of seed[collection]) await this.put(collection, row, false)
    }
  }

  async list<C extends LocalCollection>(collection: C): Promise<LocalEntityByCollection[C][]> {
    this.assertOpen()
    if (this.database) {
      return (await this.database.getAll(collection)).map(clone) as LocalEntityByCollection[C][]
    }
    const entries = memoryStores.get(collection) ?? new Map<string, LocalRecord>()
    memoryStores.set(collection, entries)
    return [...entries.values()].map(clone) as LocalEntityByCollection[C][]
  }

  async get<C extends LocalCollection>(
    collection: C,
    id: string,
  ): Promise<LocalEntityByCollection[C] | null> {
    this.assertOpen()
    const value = this.database
      ? await this.database.get(collection, id)
      : memoryStores.get(collection)?.get(id)
    return value ? (clone(value) as LocalEntityByCollection[C]) : null
  }

  async put<C extends LocalCollection>(
    collection: C,
    entity: LocalEntityByCollection[C],
    _announce = true,
  ): Promise<LocalEntityByCollection[C]> {
    this.assertOpen()
    const saved = clone(entity)
    if (this.database) {
      await this.database.put(collection, saved)
    } else {
      const entries = memoryStores.get(collection) ?? new Map<string, LocalRecord>()
      entries.set(saved.id, saved)
      memoryStores.set(collection, entries)
    }
    return clone(saved)
  }

  async remove<C extends LocalCollection>(
    collection: C,
    id: string,
  ): Promise<LocalEntityByCollection[C] | null> {
    this.assertOpen()
    const existing = await this.get(collection, id)
    if (!existing) return null
    if (this.database) await this.database.delete(collection, id)
    else memoryStores.get(collection)?.delete(id)
    return existing
  }

  subscribe(_listener: () => void): () => void {
    return () => undefined
  }

  subscribeSyncStatus(_listener: (status: SyncStatus) => void): () => void {
    return () => undefined
  }

  retrySync(): void {}

  async clearVisitorData(): Promise<void> {
    this.assertOpen()
    for (const collection of LOCAL_COLLECTIONS) {
      if (this.database) await this.database.clear(collection)
      else memoryStores.delete(collection)
    }
    await this.seedIfEmpty()
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    this.database?.close()
  }

  private assertOpen(): void {
    if (this.closed) throw new Error('Local store is closed.')
  }
}

let storePromise: Promise<LocalStore> | null = null
let activeStore: LocalStore | null = null

/** Singleton local store (IndexedDB, or in-memory when indexedDB is unavailable). */
export function getLocalStore(): Promise<LocalStore> {
  if (!storePromise) {
    storePromise = LocalStore.create().then((store) => {
      activeStore = store
      return store
    })
  }
  return storePromise
}

/** Close the open store and drop the singleton so the next getLocalStore() recreates it. */
export async function closeLocalStore(): Promise<void> {
  const pending = storePromise
  storePromise = null
  const store = activeStore
  activeStore = null
  if (store) await store.close()
  else if (pending) {
    const resolved = await pending
    await resolved.close()
  }
}

/** Clear memory-backed collections and the singleton (vitest / jsdom). */
export function resetLocalMemoryForTests(): void {
  memoryStores.clear()
  storePromise = null
  activeStore = null
}
