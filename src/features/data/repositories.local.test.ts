import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { resetLocalMemoryForTests } from '@/data/local-store'
import { IDS } from '@/demo/seed'
import { monthKey } from '@/lib/dates'
import {
  createTransaction,
  deleteTransaction,
  fetchAccountBalances,
  fetchAccounts,
  fetchMonthlyCashFlow,
  fetchProfile,
  materializeRecurring,
  updateTransaction,
} from './repositories'

describe('repositories local CRUD + analytics (in-memory)', () => {
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

  it('seeds fictional profile and accounts including Maya Wallet', async () => {
    const profile = await fetchProfile()
    expect(profile).not.toBeNull()
    expect(profile?.displayName).toBe('Demo Explorer')
    expect(profile?.currency).toBe('PHP')
    expect(profile?.timezone).toBe('Asia/Manila')

    const accounts = await fetchAccounts()
    const names = accounts.map((a) => a.name)
    expect(names).toContain('Maya Wallet')
    expect(names).toContain('BDO Checking')
    expect(accounts.find((a) => a.id === IDS.acctMaya)?.type).toBe('e_wallet')
  })

  it('create/update/delete transaction moves balances and cash flow, then restores', async () => {
    const occurredOn = '2026-08-12'
    const month = monthKey(occurredOn)
    const amountMinor = 777_00

    const balancesBefore = await fetchAccountBalances()
    const mayaBefore = balancesBefore.find((b) => b.accountId === IDS.acctMaya)?.balanceMinor
    expect(mayaBefore).toBeTypeOf('number')

    const cashFlowBefore = await fetchMonthlyCashFlow()
    const monthBefore = cashFlowBefore.find((r) => r.month === month)
    const expenseBefore = monthBefore?.expenseMinor ?? 0

    const created = await createTransaction({
      kind: 'expense',
      status: 'posted',
      amountMinor,
      occurredOn,
      accountId: IDS.acctMaya,
      transferAccountId: null,
      categoryId: IDS.catGroceries,
      payee: 'Local CRUD probe',
      notes: null,
    })
    expect(created.id).toBeTruthy()
    expect(created.accountId).toBe(IDS.acctMaya)

    const balancesAfterCreate = await fetchAccountBalances()
    const mayaAfterCreate = balancesAfterCreate.find(
      (b) => b.accountId === IDS.acctMaya,
    )?.balanceMinor
    expect(mayaAfterCreate).toBe(mayaBefore! - amountMinor)

    const cashFlowAfterCreate = await fetchMonthlyCashFlow()
    const monthAfterCreate = cashFlowAfterCreate.find((r) => r.month === month)
    expect(monthAfterCreate?.expenseMinor).toBe(expenseBefore + amountMinor)

    const updatedAmount = 1_111_00
    await updateTransaction(created.id, {
      kind: 'expense',
      status: 'posted',
      amountMinor: updatedAmount,
      occurredOn,
      accountId: IDS.acctMaya,
      transferAccountId: null,
      categoryId: IDS.catGroceries,
      payee: 'Local CRUD probe updated',
      notes: null,
    })

    const balancesAfterUpdate = await fetchAccountBalances()
    const mayaAfterUpdate = balancesAfterUpdate.find(
      (b) => b.accountId === IDS.acctMaya,
    )?.balanceMinor
    expect(mayaAfterUpdate).toBe(mayaBefore! - updatedAmount)

    const cashFlowAfterUpdate = await fetchMonthlyCashFlow()
    const monthAfterUpdate = cashFlowAfterUpdate.find((r) => r.month === month)
    expect(monthAfterUpdate?.expenseMinor).toBe(expenseBefore + updatedAmount)

    await deleteTransaction(created.id)

    const balancesAfterDelete = await fetchAccountBalances()
    const mayaAfterDelete = balancesAfterDelete.find(
      (b) => b.accountId === IDS.acctMaya,
    )?.balanceMinor
    expect(mayaAfterDelete).toBe(mayaBefore)

    const cashFlowAfterDelete = await fetchMonthlyCashFlow()
    const monthAfterDelete = cashFlowAfterDelete.find((r) => r.month === month)
    expect(monthAfterDelete?.expenseMinor ?? 0).toBe(expenseBefore)
  })

  it('materializeRecurring returns a number without throwing', async () => {
    const created = await materializeRecurring('2026-08-20')
    expect(typeof created).toBe('number')
    expect(created).toBeGreaterThanOrEqual(0)
    expect(Number.isInteger(created)).toBe(true)
  })
})
