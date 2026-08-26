import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  contributionFormSchema,
  goalFormSchema,
  type ContributionFormInput,
  type GoalFormInput,
} from '@/schemas/forms'
import { useAddContribution, useCreateGoal, useGoals } from '@/features/data/hooks'
import { PageHeader, LoadingSkeleton, ErrorState, EmptyState } from '@/components/ui/States'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Dialog } from '@/components/ui/Dialog'
import { todayIsoDate } from '@/lib/dates'
import { getErrorMessage } from '@/lib/errors'
import { formatMoney } from '@/lib/money'
import { goalProgressPercent } from '@/lib/finance'
import type { SavingsGoal } from '@/types/domain'

export function GoalsPage() {
  const goals = useGoals()
  const createGoal = useCreateGoal()
  const addContribution = useAddContribution()
  const [open, setOpen] = useState(false)
  const [contribGoal, setContribGoal] = useState<SavingsGoal | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm({
    resolver: zodResolver(goalFormSchema),
    defaultValues: { name: '', targetAmount: '', targetDate: '', notes: '' },
  })

  const contribForm = useForm({
    resolver: zodResolver(contributionFormSchema),
    defaultValues: { amount: '', contributedOn: todayIsoDate(), notes: '' },
  })

  async function onSubmit(values: GoalFormInput) {
    setFormError(null)
    try {
      await createGoal.mutateAsync({
        name: values.name,
        targetAmountMinor: values.targetAmount,
        targetDate: values.targetDate,
        notes: values.notes,
      })
      form.reset()
      setOpen(false)
    } catch (e) {
      setFormError(getErrorMessage(e))
    }
  }

  async function onContribute(values: ContributionFormInput) {
    if (!contribGoal) return
    setFormError(null)
    try {
      await addContribution.mutateAsync({
        goalId: contribGoal.id,
        amountMinor: values.amount,
        contributedOn: values.contributedOn,
        notes: values.notes,
      })
      contribForm.reset({ amount: '', contributedOn: todayIsoDate(), notes: '' })
      setContribGoal(null)
    } catch (e) {
      setFormError(getErrorMessage(e))
    }
  }

  if (goals.isLoading) {
    return (
      <div>
        <PageHeader title="Goals" />
        <LoadingSkeleton />
      </div>
    )
  }

  if (goals.error) {
    return (
      <ErrorState message={getErrorMessage(goals.error)} onRetry={() => void goals.refetch()} />
    )
  }

  const list = goals.data ?? []

  return (
    <div>
      <PageHeader
        title="Goals"
        description="Track savings targets. Contributions update goal progress only — not account balances."
        actions={<Button onClick={() => setOpen(true)}>Add goal</Button>}
      />

      {list.length === 0 ? (
        <EmptyState
          title="No savings goals"
          description="Create a goal like Emergency fund or Vacation."
          illustration="goals"
          action={<Button onClick={() => setOpen(true)}>Add goal</Button>}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((g) => {
            const pct = goalProgressPercent(g.currentAmountMinor, g.targetAmountMinor)
            return (
              <li key={g.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{g.name}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {formatMoney(g.currentAmountMinor)} of {formatMoney(g.targetAmountMinor)}
                      {g.targetDate ? ` · by ${g.targetDate}` : ''}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-primary-700">{pct}%</span>
                </div>
                <div className="mt-3 h-2.5 rounded-full bg-stone-200">
                  <div
                    className="h-full rounded-full bg-primary-600"
                    style={{ width: `${pct}%` }}
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${g.name} ${pct} percent complete`}
                  />
                </div>
                <Button variant="secondary" className="mt-3" onClick={() => setContribGoal(g)}>
                  Add contribution
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New savings goal"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="goal-form" disabled={createGoal.isPending}>
              Save
            </Button>
          </div>
        }
      >
        <form id="goal-form" className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
          <Input
            label="Name"
            error={form.formState.errors.name?.message}
            {...form.register('name')}
          />
          <Input
            label="Target amount"
            inputMode="decimal"
            error={form.formState.errors.targetAmount?.message}
            {...form.register('targetAmount')}
          />
          <Input label="Target date" type="date" {...form.register('targetDate')} />
          <Textarea label="Notes" {...form.register('notes')} />
          {formError && !contribGoal ? (
            <p className="field-error" role="alert">
              {formError}
            </p>
          ) : null}
        </form>
      </Dialog>

      <Dialog
        open={Boolean(contribGoal)}
        onClose={() => setContribGoal(null)}
        title={contribGoal ? `Contribute to ${contribGoal.name}` : 'Contribute'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setContribGoal(null)}>
              Cancel
            </Button>
            <Button type="submit" form="contrib-form" disabled={addContribution.isPending}>
              Save
            </Button>
          </div>
        }
      >
        <p className="mb-3 text-sm text-[var(--muted)]">
          Contributions do not change account balances — log spending separately if needed.
        </p>
        <form
          id="contrib-form"
          className="space-y-3"
          onSubmit={contribForm.handleSubmit(onContribute)}
        >
          <Input
            label="Amount"
            inputMode="decimal"
            error={contribForm.formState.errors.amount?.message}
            {...contribForm.register('amount')}
          />
          <Input
            label="Date"
            type="date"
            error={contribForm.formState.errors.contributedOn?.message}
            {...contribForm.register('contributedOn')}
          />
          <Textarea label="Notes" {...contribForm.register('notes')} />
          {formError && contribGoal ? (
            <p className="field-error" role="alert">
              {formError}
            </p>
          ) : null}
        </form>
      </Dialog>
    </div>
  )
}
