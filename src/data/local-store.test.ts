import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  LocalStore,
  getLocalStore,
  resetLocalMemoryForTests,
} from '@/data/local-store'
import { DEMO_USER_ID, demoAccounts, demoProfile } from '@/demo/seed'

describe('local store (in-memory)', () => {
  let previousIndexedDB: unknown

  beforeAll(() => {
    previousIndexedDB = globalThis.indexedDB
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      writable: true,
      value: undefined,
    })
  })

  afterAll(() => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      writable: true,
      value: previousIndexedDB,
    })
  })

  beforeEach(() => {
    resetLocalMemoryForTests()
  })

  it('getLocalStore returns a singleton and LocalStore.create seeds in memory', async () => {
    const first = await getLocalStore()
    const second = await getLocalStore()
    expect(first).toBe(second)

    const created = await LocalStore.create()
    const profiles = await created.list('profiles')
    expect(profiles).toEqual([demoProfile])
    expect(profiles[0]?.id).toBe(DEMO_USER_ID)

    const accounts = await created.list('accounts')
    expect(accounts).toHaveLength(demoAccounts.length)
    expect(accounts.map((a) => a.name)).toContain('Maya Wallet')
  })

  it('seedIfEmpty is idempotent when profiles already exist', async () => {
    const store = await LocalStore.create()
    const beforeAccounts = await store.list('accounts')
    const beforeTx = await store.list('transactions')

    await store.put('accounts', {
      ...beforeAccounts[0]!,
      notes: 'mutated-after-seed',
    })

    const again = await LocalStore.create()
    const afterAccounts = await again.list('accounts')
    const afterTx = await again.list('transactions')
    const afterProfiles = await again.list('profiles')

    expect(afterProfiles).toHaveLength(1)
    expect(afterAccounts).toHaveLength(beforeAccounts.length)
    expect(afterTx).toHaveLength(beforeTx.length)
    expect(afterAccounts.find((a) => a.id === beforeAccounts[0]!.id)?.notes).toBe(
      'mutated-after-seed',
    )
  })
})
