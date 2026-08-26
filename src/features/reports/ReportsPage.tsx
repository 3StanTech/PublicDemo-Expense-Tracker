import { useMemo, useState } from 'react'
import {
  useCashFlow,
  useCategorySpending,
  useNetWorthHistory,
  useBudgetActuals,
} from '@/features/data/hooks'
import { PageHeader, LoadingSkeleton, ErrorState } from '@/components/ui/States'
import {
  BudgetProgressBars,
  CategoryDonut,
  IncomeExpenseBars,
  NetWorthLine,
} from '@/components/charts/FinanceCharts'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { lastNMonths, monthKey, todayIsoDate } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { getErrorMessage } from '@/lib/errors'

export function ReportsPage() {
  const [month, setMonth] = useState(monthKey(todayIsoDate()))
  const cashFlow = useCashFlow()
  const category = useCategorySpending(month)
  const netWorth = useNetWorthHistory()
  const budgets = useBudgetActuals(month)

  const cashFlow6 = useMemo(() => {
    const months = lastNMonths(6)
    return months.map((m) => {
      const row = (cashFlow.data ?? []).find((c) => c.month === m)
      return {
        month: m,
        incomeMinor: row?.incomeMinor ?? 0,
        expenseMinor: row?.expenseMinor ?? 0,
      }
    })
  }, [cashFlow.data])

  const loading =
    cashFlow.isLoading || category.isLoading || netWorth.isLoading || budgets.isLoading
  const error = cashFlow.error || category.error || netWorth.error || budgets.error

  function exportCsv() {
    const rows = [
      ['month', 'income_minor', 'expense_minor'],
      ...(cashFlow.data ?? []).map((r) => [r.month, String(r.incomeMinor), String(r.expenseMinor)]),
    ]
    const csv = rows.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fundsicles-cashflow-${todayIsoDate()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Reports" />
        <LoadingSkeleton rows={5} />
      </div>
    )
  }

  if (error) {
    return (
      <ErrorState
        message={getErrorMessage(error)}
        onRetry={() => {
          void cashFlow.refetch()
          void category.refetch()
          void netWorth.refetch()
          void budgets.refetch()
        }}
      />
    )
  }

  const income = cashFlow6.reduce((s, r) => s + r.incomeMinor, 0)
  const expense = cashFlow6.reduce((s, r) => s + r.expenseMinor, 0)

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Charts use local demo aggregates. Transfers are excluded from cash flow and category spend."
        actions={
          <Button variant="secondary" onClick={exportCsv}>
            Export cash-flow CSV
          </Button>
        }
      />

      <div className="mb-4 max-w-xs">
        <Input
          label="Focus month"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-xs text-[var(--muted)]">6-mo income</p>
          <p className="mt-1 text-lg font-semibold">{formatMoney(income)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[var(--muted)]">6-mo expenses</p>
          <p className="mt-1 text-lg font-semibold">{formatMoney(expense)}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4" aria-labelledby="r-cf">
          <h2 id="r-cf" className="mb-3 font-semibold">
            Income vs expenses
          </h2>
          <IncomeExpenseBars data={cashFlow6} />
        </section>
        <section className="card p-4" aria-labelledby="r-cat">
          <h2 id="r-cat" className="mb-3 font-semibold">
            Category spending
          </h2>
          <CategoryDonut data={category.data ?? []} />
        </section>
        <section className="card p-4" aria-labelledby="r-nw">
          <h2 id="r-nw" className="mb-3 font-semibold">
            Net worth history
          </h2>
          <NetWorthLine data={(netWorth.data ?? []).slice(-12)} />
        </section>
        <section className="card p-4" aria-labelledby="r-bud">
          <h2 id="r-bud" className="mb-3 font-semibold">
            Budget actuals
          </h2>
          <BudgetProgressBars data={budgets.data ?? []} />
        </section>
      </div>
    </div>
  )
}
