import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { budgetFormSchema, type BudgetFormInput } from '@/schemas/forms'
import { useBudgetActuals, useCategories, useCreateBudget } from '@/features/data/hooks'
import { PageHeader, LoadingSkeleton, ErrorState, EmptyState } from '@/components/ui/States'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Dialog } from '@/components/ui/Dialog'
import { BudgetProgressBars } from '@/components/charts/FinanceCharts'
import { monthKey, todayIsoDate } from '@/lib/dates'
import { getErrorMessage } from '@/lib/errors'
import { formatMoney } from '@/lib/money'
import { isOverspent } from '@/lib/finance'

export function BudgetsPage() {
  const [month, setMonth] = useState(monthKey(todayIsoDate()))
  const actuals = useBudgetActuals(month)
  const categories = useCategories()
  const createBudget = useCreateBudget()
  const [open, setOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      categoryId: '',
      month,
      amount: '',
    },
  })

  const expenseCategories = useMemo(
    () =>
      (categories.data ?? [])
        .filter((c) => c.kind === 'expense')
        .map((c) => ({ value: c.id, label: c.name })),
    [categories.data],
  )

  async function onSubmit(values: BudgetFormInput) {
    setFormError(null)
    try {
      await createBudget.mutateAsync({
        categoryId: values.categoryId,
        month: values.month,
        amountMinor: values.amount,
      })
      form.reset({ categoryId: '', month, amount: '' })
      setOpen(false)
    } catch (e) {
      setFormError(getErrorMessage(e))
    }
  }

  if (actuals.isLoading || categories.isLoading) {
    return (
      <div>
        <PageHeader title="Budgets" />
        <LoadingSkeleton />
      </div>
    )
  }

  if (actuals.error || categories.error) {
    return (
      <ErrorState
        message={getErrorMessage(actuals.error ?? categories.error)}
        onRetry={() => {
          void actuals.refetch()
          void categories.refetch()
        }}
      />
    )
  }

  const rows = actuals.data ?? []
  const totalBudget = rows.reduce((s, r) => s + r.budgetMinor, 0)
  const totalSpent = rows.reduce((s, r) => s + r.spentMinor, 0)

  return (
    <div>
      <PageHeader
        title="Budgets"
        description="Plan monthly spending by expense category."
        actions={<Button onClick={() => setOpen(true)}>Add budget</Button>}
      />

      <div className="mb-4 max-w-xs">
        <Input
          label="Month"
          type="month"
          value={month}
          onChange={(e) => {
            setMonth(e.target.value)
            form.setValue('month', e.target.value)
          }}
        />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-xs text-[var(--muted)]">Total budget</p>
          <p className="mt-1 text-lg font-semibold">{formatMoney(totalBudget)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[var(--muted)]">Total spent</p>
          <p
            className={`mt-1 text-lg font-semibold ${isOverspent(totalSpent, totalBudget) ? 'text-danger' : ''}`}
          >
            {isOverspent(totalSpent, totalBudget) ? <span aria-hidden="true">⚠ </span> : null}
            {formatMoney(totalSpent)}
            {isOverspent(totalSpent, totalBudget) ? (
              <span className="sr-only"> (overspent)</span>
            ) : null}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No budgets for this month"
          description="Set a limit for an expense category to track progress."
          action={<Button onClick={() => setOpen(true)}>Add budget</Button>}
        />
      ) : (
        <div className="space-y-4">
          {totalBudget > 0 &&
          totalSpent >= 0 &&
          !isOverspent(totalSpent, totalBudget) &&
          rows.every((r) => !isOverspent(r.spentMinor, r.budgetMinor)) ? (
            <EmptyState
              title="On track this month"
              description="Every category is within its budget. Keep the good habits going."
              illustration="budget-celebration"
            />
          ) : null}
          <div className="card p-4">
            <BudgetProgressBars data={rows} />
          </div>
        </div>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New budget"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="budget-form" disabled={createBudget.isPending}>
              Save
            </Button>
          </div>
        }
      >
        <form id="budget-form" className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
          <Select
            label="Category"
            options={expenseCategories}
            placeholder="Select expense category"
            error={form.formState.errors.categoryId?.message}
            {...form.register('categoryId')}
          />
          <Input
            label="Month"
            type="month"
            error={form.formState.errors.month?.message}
            {...form.register('month')}
          />
          <Input
            label="Amount"
            inputMode="decimal"
            error={form.formState.errors.amount?.message}
            {...form.register('amount')}
          />
          {formError ? (
            <p className="field-error" role="alert">
              {formError}
            </p>
          ) : null}
        </form>
      </Dialog>
    </div>
  )
}
