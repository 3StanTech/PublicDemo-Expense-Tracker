import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatMoney } from '@/lib/money'
import { formatMonthLabel } from '@/lib/dates'
import { chartSummaryLines } from '@/lib/finance'
import { EmptyState } from '@/components/ui/States'

const COLORS = [
  '#059669',
  '#0D9488',
  '#0891B2',
  '#2563EB',
  '#7C3AED',
  '#DB2777',
  '#EA580C',
  '#CA8A04',
]

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Keyboard-focusable data path for chart visuals (summary + table). */
function AccessibleChartFrame({
  focusLabel,
  summary,
  visual,
  tableCaption,
  tableHeaders,
  tableRows,
  visualClassName = 'h-64 w-full',
}: {
  focusLabel: string
  summary: string
  visual: React.ReactNode
  tableCaption: string
  tableHeaders: string[]
  tableRows: string[][]
  visualClassName?: string
}) {
  return (
    <div className="space-y-3">
      <div
        className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2"
        tabIndex={0}
        role="group"
        aria-label={focusLabel}
        data-testid="chart-focus-region"
      >
        <p className="sr-only" data-testid="chart-summary">
          {summary}
        </p>
        <div className={visualClassName} role="img" aria-label={focusLabel}>
          {visual}
        </div>
      </div>
      <div
        className="overflow-x-auto rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2"
        tabIndex={0}
        role="region"
        aria-label={`${tableCaption} data table`}
        data-testid="chart-data-table"
      >
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{tableCaption}</caption>
          <thead>
            <tr className="border-b border-[var(--line)] text-[var(--muted)]">
              {tableHeaders.map((h) => (
                <th key={h} scope="col" className="px-2 py-1 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((r, i) => (
              <tr key={i} className="border-b border-[var(--line)]/60">
                {r.map((c, j) => (
                  <td key={j} className="px-2 py-1">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function IncomeExpenseBars({
  data,
}: {
  data: Array<{ month: string; incomeMinor: number; expenseMinor: number }>
}) {
  const hasCashFlow = data.some((d) => d.incomeMinor > 0 || d.expenseMinor > 0)
  if (data.length === 0 || !hasCashFlow) {
    return (
      <EmptyState
        title="No cash-flow data yet"
        description="Post income and expense transactions to see the last six months. Transfers are excluded."
        illustration="cash-flow"
      />
    )
  }

  const chartData = data.map((d) => ({
    month: d.month,
    label: formatMonthLabel(d.month),
    income: d.incomeMinor / 100,
    expense: d.expenseMinor / 100,
    incomeMinor: d.incomeMinor,
    expenseMinor: d.expenseMinor,
  }))

  const summary = chartData
    .map(
      (d) =>
        `${d.label}: income ${formatMoney(d.incomeMinor)}, expense ${formatMoney(d.expenseMinor)}`,
    )
    .join('; ')

  return (
    <AccessibleChartFrame
      focusLabel="Income versus expense bar chart. Tab to the data table for keyboard-accessible values."
      summary={summary}
      visual={
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} width={48} />
            <Tooltip
              formatter={(value) => formatMoney(Math.round(Number(value) * 100))}
              contentStyle={{ borderRadius: 8, borderColor: '#e7e5e4' }}
            />
            <Legend />
            <Bar
              dataKey="income"
              name="Income"
              fill="#059669"
              radius={[4, 4, 0, 0]}
              isAnimationActive={!prefersReducedMotion()}
            />
            <Bar
              dataKey="expense"
              name="Expense"
              fill="#DC2626"
              radius={[4, 4, 0, 0]}
              isAnimationActive={!prefersReducedMotion()}
            />
          </BarChart>
        </ResponsiveContainer>
      }
      tableCaption="Income versus expense by month"
      tableHeaders={['Month', 'Income', 'Expense']}
      tableRows={chartData.map((d) => [
        d.label,
        formatMoney(d.incomeMinor),
        formatMoney(d.expenseMinor),
      ])}
    />
  )
}

export function CategoryDonut({
  data,
}: {
  data: Array<{ categoryName: string; amountMinor: number }>
}) {
  if (data.length === 0) {
    return (
      <EmptyState
        title="No category spending"
        description="Expense transactions with categories will appear here for the current month."
      />
    )
  }

  const chartData = data.map((d) => ({
    name: d.categoryName,
    value: d.amountMinor / 100,
    amountMinor: d.amountMinor,
  }))

  const summary = chartSummaryLines(
    data.map((d) => ({ label: d.categoryName, valueMinor: d.amountMinor })),
    formatMoney,
  )

  return (
    <AccessibleChartFrame
      focusLabel="Category spending donut chart. Tab to the data table for keyboard-accessible values."
      summary={summary}
      visual={
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius="45%"
              outerRadius="75%"
              paddingAngle={2}
              isAnimationActive={!prefersReducedMotion()}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatMoney(Math.round(Number(value) * 100))}
              contentStyle={{ borderRadius: 8, borderColor: '#e7e5e4' }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      }
      tableCaption="Category spending"
      tableHeaders={['Category', 'Amount']}
      tableRows={chartData.map((d) => [d.name, formatMoney(d.amountMinor)])}
    />
  )
}

export function NetWorthLine({ data }: { data: Array<{ asOf: string; netWorthMinor: number }> }) {
  if (data.length === 0) {
    return (
      <EmptyState
        title="No net-worth history yet"
        description="Add accounts and posted transactions to build a twelve-month net worth trail."
      />
    )
  }

  const chartData = data.map((d) => ({
    asOf: d.asOf,
    value: d.netWorthMinor / 100,
    netWorthMinor: d.netWorthMinor,
  }))

  const summary = chartSummaryLines(
    data.map((d) => ({ label: d.asOf, valueMinor: d.netWorthMinor })),
    formatMoney,
  )

  return (
    <AccessibleChartFrame
      focusLabel="Net worth line chart. Tab to the data table for keyboard-accessible values."
      summary={summary}
      visual={
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
            <XAxis dataKey="asOf" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} width={48} />
            <Tooltip
              formatter={(value) => formatMoney(Math.round(Number(value) * 100))}
              contentStyle={{ borderRadius: 8, borderColor: '#e7e5e4' }}
            />
            <Line
              type="monotone"
              dataKey="value"
              name="Net worth"
              stroke="#059669"
              strokeWidth={2}
              dot={{ r: 3 }}
              isAnimationActive={!prefersReducedMotion()}
            />
          </LineChart>
        </ResponsiveContainer>
      }
      tableCaption="Net worth history"
      tableHeaders={['Date', 'Net worth']}
      tableRows={chartData.map((d) => [d.asOf, formatMoney(d.netWorthMinor)])}
    />
  )
}

export function BudgetProgressBars({
  data,
}: {
  data: Array<{
    categoryName: string
    budgetMinor: number
    spentMinor: number
  }>
}) {
  if (data.length === 0) {
    return (
      <EmptyState
        title="No budgets this month"
        description="Set category budgets to track spending progress."
      />
    )
  }

  const summary = data
    .map(
      (b) =>
        `${b.categoryName}: spent ${formatMoney(b.spentMinor)} of ${formatMoney(b.budgetMinor)}`,
    )
    .join('; ')

  return (
    <AccessibleChartFrame
      focusLabel="Budget progress bars. Tab to the data table for keyboard-accessible values."
      summary={summary}
      visualClassName="w-full"
      visual={
        <ul className="space-y-4 px-1 py-2">
          {data.map((b) => {
            const pct = b.budgetMinor > 0 ? Math.min(100, (b.spentMinor / b.budgetMinor) * 100) : 0
            const over = b.spentMinor > b.budgetMinor
            return (
              <li key={b.categoryName}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">
                    {over ? <span aria-hidden="true">⚠ </span> : null}
                    {b.categoryName}
                    {over ? <span className="sr-only"> (overspent)</span> : null}
                  </span>
                  <span className={over ? 'font-semibold text-danger' : 'text-[var(--muted)]'}>
                    {formatMoney(b.spentMinor)} / {formatMoney(b.budgetMinor)}
                  </span>
                </div>
                <div
                  className="h-2.5 overflow-hidden rounded-full bg-stone-200"
                  role="progressbar"
                  aria-valuenow={Math.round(pct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${b.categoryName} budget used ${pct.toFixed(0)} percent`}
                >
                  <div
                    className={`h-full rounded-full ${over ? 'bg-danger' : 'bg-primary-600'}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      }
      tableCaption="Budget actuals"
      tableHeaders={['Category', 'Spent', 'Budget']}
      tableRows={data.map((b) => [
        b.categoryName,
        formatMoney(b.spentMinor),
        formatMoney(b.budgetMinor),
      ])}
    />
  )
}
