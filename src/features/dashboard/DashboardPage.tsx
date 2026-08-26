import { Link } from 'react-router-dom'
import { useDashboardData } from '@/features/data/hooks'
import { PageHeader, LoadingSkeleton, ErrorState, MoneyText } from '@/components/ui/States'
import {
  BudgetProgressBars,
  CategoryDonut,
  IncomeExpenseBars,
  NetWorthLine,
} from '@/components/charts/FinanceCharts'
import { formatMoney } from '@/lib/money'
import { formatDisplayDate, lastNMonths, monthKey, todayIsoDate } from '@/lib/dates'
import { goalProgressPercent } from '@/lib/finance'
import { getErrorMessage } from '@/lib/errors'

export function DashboardPage() {
  const d = useDashboardData()
  const months6 = lastNMonths(6)
  const cashFlow6 = months6.map((m) => {
    const row = d.cashFlow.find((c) => c.month === m)
    return {
      month: m,
      incomeMinor: row?.incomeMinor ?? 0,
      expenseMinor: row?.expenseMinor ?? 0,
    }
  })
  const nw12 = d.netWorthHistory.slice(-12)

  if (d.isLoading) {
    return (
      <div>
        <PageHeader title="Home" description="Your money at a glance." />
        <LoadingSkeleton rows={6} />
      </div>
    )
  }

  if (d.error) {
    return (
      <div>
        <PageHeader title="Home" />
        <ErrorState message={getErrorMessage(d.error)} onRetry={d.refetchAll} />
      </div>
    )
  }

  const budgetPct = d.budgetTotal > 0 ? Math.round((d.budgetSpent / d.budgetTotal) * 1000) / 10 : 0
  const upcoming = d.upcoming

  return (
    <div>
      <PageHeader
        title="Home"
        description={`As of ${formatDisplayDate(todayIsoDate())} · Asia/Manila · PHP`}
      />

      <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Net worth" minor={d.netWorth} />
        <MetricCard label="Income (month)" minor={d.income} tone="positive" />
        <MetricCard label="Expenses (month)" minor={d.expenses} tone="negative" />
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            Savings rate
          </p>
          <p className="mt-2 text-xl font-semibold tabular-nums">{d.savingsRate}%</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            Budget used
          </p>
          <p className="mt-2 text-xl font-semibold tabular-nums">
            {d.budgetTotal === 0 ? '—' : `${budgetPct}%`}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {formatMoney(d.budgetSpent)} of {formatMoney(d.budgetTotal)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            Debt total
          </p>
          <p className="mt-2 text-xl font-semibold tabular-nums">
            <MoneyText minor={d.debtTotal} />
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Min. due {formatMoney(d.debtDue)}</p>
        </div>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="card p-4" aria-labelledby="cf-heading">
          <h2 id="cf-heading" className="mb-3 text-base font-semibold">
            Income vs expenses (6 months)
          </h2>
          <IncomeExpenseBars data={cashFlow6} />
        </section>

        <section className="card p-4" aria-labelledby="cat-heading">
          <h2 id="cat-heading" className="mb-3 text-base font-semibold">
            Spending by category ({monthKey(todayIsoDate())})
          </h2>
          <CategoryDonut data={d.categorySpending} />
        </section>

        <section className="card p-4" aria-labelledby="nw-heading">
          <h2 id="nw-heading" className="mb-3 text-base font-semibold">
            Net worth trend
          </h2>
          <NetWorthLine data={nw12} />
        </section>

        <section className="card p-4" aria-labelledby="bud-heading">
          <h2 id="bud-heading" className="mb-3 text-base font-semibold">
            Budget progress
          </h2>
          <BudgetProgressBars data={d.budgetActuals} />
        </section>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="card p-4" aria-labelledby="goals-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="goals-heading" className="text-base font-semibold">
              Goals
            </h2>
            <Link className="text-sm text-primary-700 underline" to="/app/goals">
              View all
            </Link>
          </div>
          {d.goals.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No savings goals yet.</p>
          ) : (
            <ul className="space-y-3">
              {d.goals.slice(0, 4).map((g) => {
                const pct = goalProgressPercent(g.currentAmountMinor, g.targetAmountMinor)
                return (
                  <li key={g.id}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{g.name}</span>
                      <span className="text-[var(--muted)]">{pct}%</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-stone-200">
                      <div
                        className="h-full rounded-full bg-primary-600"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="card p-4" aria-labelledby="rec-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="rec-heading" className="text-base font-semibold">
              Upcoming recurring
            </h2>
            <Link className="text-sm text-primary-700 underline" to="/app/recurring">
              Manage
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No active recurring rules.</p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {upcoming.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-[var(--muted)]">
                      Due {formatDisplayDate(r.nextDueOn, 'MMM d')} · {r.frequency} · every{' '}
                      {r.intervalCount}
                    </p>
                  </div>
                  <MoneyText minor={r.amountMinor} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  minor,
  tone,
}: {
  label: string
  minor: number
  tone?: 'positive' | 'negative'
}) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p
        className={[
          'mt-2 text-xl font-semibold tabular-nums',
          tone === 'positive' ? 'text-primary-700' : '',
          tone === 'negative' ? 'text-danger' : '',
        ].join(' ')}
      >
        <MoneyText minor={minor} negativeIndicator={minor < 0} />
      </p>
    </div>
  )
}
