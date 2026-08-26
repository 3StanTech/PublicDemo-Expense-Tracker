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

/** IndexedDB database name — also used by demo reset. */
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

type LocalRecord = LocalEntityByCollection[LocalCollection]

const stores: LocalCollection[] = [
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

const memoryStores = new Map<LocalCollection, Map<string, LocalRecord>>()

function clone<T>(value: T): T {
  return structuredClone(value)
}

export class LocalStore {
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
              for (const store of stores) {
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
    await this.put('profiles', demoProfile, false)
    for (const row of demoCategories) await this.put('categories', row, false)
    for (const row of demoAccounts) await this.put('accounts', row, false)
    for (const row of demoTransactions) await this.put('transactions', row, false)
    for (const row of demoBudgets) await this.put('budgets', row, false)
    for (const row of demoRecurringRules) await this.put('recurringRules', row, false)
    for (const row of demoSavingsGoals) await this.put('savingsGoals', row, false)
    for (const row of demoGoalContributions) await this.put('goalContributions', row, false)
    for (const row of demoDebts) await this.put('debts', row, false)
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
