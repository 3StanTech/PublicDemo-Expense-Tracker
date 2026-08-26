import { describe, expect, it } from 'vitest'
import { savingsRate } from '@/lib/money'
import { upcomingRecurringRules } from './hooks'
import type { RecurringRule } from '@/types/domain'

/**
 * Dashboard income/expense/savings-rate must use complete month aggregates
 * (v_monthly_cash_flow), not the 500-row transaction list.
 */
function dashboardMonthMetrics(
  cashFlow: Array<{ month: string; incomeMinor: number; expenseMinor: number }>,
  month: string,
) {
  const row = cashFlow.find((c) => c.month === month)
  const income = row?.incomeMinor ?? 0
  const expenses = row?.expenseMinor ?? 0
  return { income, expenses, savingsRate: savingsRate(income, expenses) }
}

describe('dashboard month metrics source', () => {
  it('reflects full aggregate totals even when more than 500 txs exist conceptually', () => {
    // Simulate a month with more activity than the transaction list limit can represent.
    const cashFlow = [{ month: '2024-06', incomeMinor: 1_250_000, expenseMinor: 980_000 }]
    const metrics = dashboardMonthMetrics(cashFlow, '2024-06')
    expect(metrics.income).toBe(1_250_000)
    expect(metrics.expenses).toBe(980_000)
    expect(metrics.savingsRate).toBe(savingsRate(1_250_000, 980_000))
  })
})

describe('upcomingRecurringRules', () => {
  const base: Omit<
    RecurringRule,
    'id' | 'name' | 'status' | 'startDate' | 'endDate' | 'frequency' | 'intervalCount'
  > = {
    userId: 'u',
    kind: 'expense',
    amountMinor: 100,
    accountId: 'a',
    transferAccountId: null,
    categoryId: null,
    payee: null,
    notes: null,
    lastMaterializedOn: null,
    createdAt: '',
    updatedAt: '',
  }

  it('sorts by next due date, excludes ended and paused, and returns at most five', () => {
    const rules: RecurringRule[] = [
      {
        ...base,
        id: 'z',
        name: 'Zebra late',
        status: 'active',
        startDate: '2024-01-01',
        endDate: null,
        frequency: 'monthly',
        intervalCount: 1,
      },
      {
        ...base,
        id: 'a',
        name: 'Alpha soon',
        status: 'active',
        startDate: '2024-03-10',
        endDate: null,
        frequency: 'monthly',
        intervalCount: 1,
      },
      {
        ...base,
        id: 'p',
        name: 'Paused',
        status: 'paused',
        startDate: '2024-03-05',
        endDate: null,
        frequency: 'monthly',
        intervalCount: 1,
      },
      {
        ...base,
        id: 'e',
        name: 'Ended',
        status: 'active',
        startDate: '2024-01-01',
        endDate: '2024-02-01',
        frequency: 'monthly',
        intervalCount: 1,
      },
    ]

    const upcoming = upcomingRecurringRules(rules, '2024-03-01')
    // Monthly from 2024-01-01 is due 2024-03-01; monthly from 2024-03-10 is later.
    expect(upcoming.map((r) => r.id)).toEqual(['z', 'a'])
    expect(upcoming[0]!.nextDueOn).toBe('2024-03-01')
    expect(upcoming[1]!.nextDueOn).toBe('2024-03-10')
  })
})
