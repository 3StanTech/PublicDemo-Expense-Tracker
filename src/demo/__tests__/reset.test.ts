import { describe, expect, it, vi } from 'vitest'
import { LOCAL_DATABASE_NAME } from '@/data/local-store'
import { resetDemoData } from '../reset'

describe('resetDemoData', () => {
  it('closes the store, deletes the IndexedDB database by name, and reloads', async () => {
    const closeStore = vi.fn().mockResolvedValue(undefined)
    const deleteDatabase = vi.fn().mockResolvedValue(undefined)
    const reload = vi.fn()

    await resetDemoData({ closeStore, deleteDatabase, reload })

    expect(closeStore).toHaveBeenCalledOnce()
    expect(deleteDatabase).toHaveBeenCalledWith(LOCAL_DATABASE_NAME)
    expect(reload).toHaveBeenCalledOnce()
  })

  it('uses injected closeStore before delete + reload', async () => {
    const closeStore = vi.fn().mockResolvedValue(undefined)
    const deleteDatabase = vi.fn().mockResolvedValue(undefined)
    const reload = vi.fn()

    await resetDemoData({ closeStore, deleteDatabase, reload })

    const closeOrder = closeStore.mock.invocationCallOrder[0]
    const deleteOrder = deleteDatabase.mock.invocationCallOrder[0]
    const reloadOrder = reload.mock.invocationCallOrder[0]
    expect(closeOrder).toBeDefined()
    expect(deleteOrder).toBeDefined()
    expect(reloadOrder).toBeDefined()
    expect(closeOrder!).toBeLessThan(deleteOrder!)
    expect(deleteOrder!).toBeLessThan(reloadOrder!)
  })

  it('targets the fundsicles public-demo database name', () => {
    expect(LOCAL_DATABASE_NAME).toBe('fundsicles-public-demo')
  })
})
