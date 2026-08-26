import { describe, expect, it } from 'vitest'
import {
  DEMO_USER_ID,
  IDS,
  demoAccounts,
  demoBudgets,
  demoCategories,
  demoDebts,
  demoGoalContributions,
  demoProfile,
  demoRecurringRules,
  demoSavingsGoals,
  demoTransactions,
} from '../seed'

describe('demo seed integrity', () => {
  it('uses a fixed demo user id across profile and owned rows', () => {
    expect(demoProfile.id).toBe(DEMO_USER_ID)
    expect(demoProfile.currency).toBe('PHP')
    expect(demoProfile.locale).toBe('en-PH')
    expect(demoProfile.timezone).toBe('Asia/Manila')

    for (const row of [
      ...demoCategories,
      ...demoAccounts,
      ...demoTransactions,
      ...demoBudgets,
      ...demoRecurringRules,
      ...demoSavingsGoals,
      ...demoGoalContributions,
      ...demoDebts,
    ]) {
      expect(row.userId, `${'name' in row ? row.name : row.id}`).toBe(DEMO_USER_ID)
    }
  })

  it('seeds known fictional PHP accounts used by the smoke suite', () => {
    const names = demoAccounts.map((account) => account.name)
    expect(names).toContain('Maya Wallet')
    expect(names).toContain('BDO Checking')
    expect(names).toContain('Wallet Cash')
    expect(demoAccounts.every((account) => account.currency === 'PHP')).toBe(true)
    expect(demoAccounts.find((account) => account.id === IDS.acctMaya)?.type).toBe('e_wallet')
    expect(demoAccounts.find((account) => account.id === IDS.acctBdo)?.type).toBe('checking')
  })

  it('keeps account, category, and transfer foreign keys resolvable', () => {
    const accountIds = new Set(demoAccounts.map((account) => account.id))
    const categoryIds = new Set(demoCategories.map((category) => category.id))

    for (const tx of demoTransactions) {
      expect(accountIds.has(tx.accountId), `tx ${tx.id} account`).toBe(true)
      if (tx.transferAccountId) {
        expect(accountIds.has(tx.transferAccountId), `tx ${tx.id} transfer`).toBe(true)
      }
      if (tx.categoryId) {
        expect(categoryIds.has(tx.categoryId), `tx ${tx.id} category`).toBe(true)
      }
      expect(tx.amountMinor).toBeGreaterThan(0)
      expect(Number.isInteger(tx.amountMinor)).toBe(true)
    }
  })

  it('includes a known seed payee and a populated transaction history', () => {
    expect(demoTransactions.length).toBeGreaterThanOrEqual(10)
    expect(demoTransactions.some((tx) => tx.payee === 'Sample Mart')).toBe(true)
    expect(demoTransactions.some((tx) => tx.kind === 'income')).toBe(true)
    expect(demoTransactions.some((tx) => tx.kind === 'expense')).toBe(true)
  })

  it('links budgets, goals, debts, and recurring rules to seeded entities', () => {
    const accountIds = new Set(demoAccounts.map((account) => account.id))
    const categoryIds = new Set(demoCategories.map((category) => category.id))
    const goalIds = new Set(demoSavingsGoals.map((goal) => goal.id))

    expect(demoBudgets.length).toBeGreaterThan(0)
    for (const budget of demoBudgets) {
      expect(categoryIds.has(budget.categoryId)).toBe(true)
      expect(budget.amountMinor).toBeGreaterThan(0)
    }

    expect(demoRecurringRules.length).toBeGreaterThan(0)
    for (const rule of demoRecurringRules) {
      expect(accountIds.has(rule.accountId)).toBe(true)
    }

    expect(demoSavingsGoals.length).toBeGreaterThan(0)
    for (const contribution of demoGoalContributions) {
      expect(goalIds.has(contribution.goalId)).toBe(true)
      expect(contribution.amountMinor).toBeGreaterThan(0)
    }

    expect(demoDebts.length).toBeGreaterThan(0)
    for (const debt of demoDebts) {
      expect(accountIds.has(debt.accountId)).toBe(true)
    }
  })

  it('is deterministic across repeated imports', async () => {
    const again = await import('../seed')
    expect(again.demoAccounts).toEqual(demoAccounts)
    expect(again.demoTransactions).toEqual(demoTransactions)
    expect(again.demoBudgets).toEqual(demoBudgets)
  })
})
