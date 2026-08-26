import { describe, expect, it } from 'vitest'
import {
  budgetUsedPercent,
  categorySpending,
  chartSummaryLines,
  computeAccountBalance,
  computeNetWorth,
  debtMinimumDueTotal,
  goalProgressPercent,
  isOverspent,
  monthlyCashFlow,
} from './finance'

describe('transfers and cash flow', () => {
  it('excludes transfers and pending from cash flow', () => {
    const flow = monthlyCashFlow([
      { kind: 'income', amountMinor: 10000, status: 'posted' },
      { kind: 'expense', amountMinor: 3000, status: 'posted' },
      { kind: 'transfer', amountMinor: 5000, status: 'posted' },
      { kind: 'expense', amountMinor: 1000, status: 'pending' },
    ])
    expect(flow.incomeMinor).toBe(10000)
    expect(flow.expenseMinor).toBe(3000)
    expect(flow.netMinor).toBe(7000)
  })

  it('category spending only counts posted expenses', () => {
    const map = categorySpending([
      { kind: 'expense', categoryId: 'a', amountMinor: 100, status: 'posted' },
      { kind: 'expense', categoryId: 'a', amountMinor: 50, status: 'pending' },
      { kind: 'income', categoryId: 'b', amountMinor: 200, status: 'posted' },
      { kind: 'transfer', categoryId: null, amountMinor: 10, status: 'posted' },
    ])
    expect(map.get('a')).toBe(100)
    expect(map.has('b')).toBe(false)
  })
})

describe('balances and net worth', () => {
  it('computes asset balance', () => {
    expect(
      computeAccountBalance({
        accountType: 'checking',
        openingBalanceMinor: 10000,
        postedInflowsMinor: 5000,
        postedOutflowsMinor: 2000,
      }),
    ).toBe(13000)
  })

  it('computes net worth assets minus liabilities', () => {
    expect(
      computeNetWorth([
        { type: 'cash', balanceMinor: 5000 },
        { type: 'checking', balanceMinor: 10000 },
        { type: 'credit_card', balanceMinor: 3000 },
        { type: 'loan', balanceMinor: 2000 },
      ]),
    ).toBe(10000)
  })
})

describe('budgets goals debts', () => {
  it('budget totals and overspent flag', () => {
    expect(budgetUsedPercent(75, 100)).toBe(75)
    expect(isOverspent(110, 100)).toBe(true)
    expect(isOverspent(90, 100)).toBe(false)
  })

  it('goal progress clamps at 100', () => {
    expect(goalProgressPercent(50, 100)).toBe(50)
    expect(goalProgressPercent(150, 100)).toBe(100)
  })

  it('debt minimum due total', () => {
    expect(
      debtMinimumDueTotal([
        { minimumPaymentMinor: 1000, isActive: true },
        { minimumPaymentMinor: 500, isActive: false },
        { minimumPaymentMinor: 250, isActive: true },
      ]),
    ).toBe(1250)
  })
})

describe('chart summaries', () => {
  it('builds textual summary', () => {
    const s = chartSummaryLines(
      [
        { label: 'Food', valueMinor: 1500 },
        { label: 'Transport', valueMinor: 800 },
      ],
      (n) => `₱${(n / 100).toFixed(2)}`,
    )
    expect(s).toContain('Food')
    expect(s).toContain('Transport')
  })

  it('empty summary', () => {
    expect(chartSummaryLines([], () => '')).toMatch(/No data/)
  })
})
