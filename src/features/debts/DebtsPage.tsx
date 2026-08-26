import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { debtFormSchema, type DebtFormInput } from '@/schemas/forms'
import { useAccounts, useCreateDebt, useDebtBalances, useDebts } from '@/features/data/hooks'
import {
  PageHeader,
  LoadingSkeleton,
  ErrorState,
  EmptyState,
  MoneyText,
} from '@/components/ui/States'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Dialog } from '@/components/ui/Dialog'
import { getErrorMessage } from '@/lib/errors'
import { formatMoney } from '@/lib/money'
import { isLiabilityType } from '@/lib/finance'

export function DebtsPage() {
  const debts = useDebts()
  const balances = useDebtBalances()
  const accounts = useAccounts()
  const createDebt = useCreateDebt()
  const [open, setOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const liabilityAccounts = useMemo(
    () =>
      (accounts.data ?? [])
        .filter((a) => isLiabilityType(a.type))
        .map((a) => ({ value: a.id, label: `${a.name} (${a.type.replace('_', ' ')})` })),
    [accounts.data],
  )

  const form = useForm({
    resolver: zodResolver(debtFormSchema),
    defaultValues: {
      name: '',
      accountId: '',
      interestBps: 0,
      minimumPayment: '',
      dueDay: 1,
      notes: '',
    },
  })

  async function onSubmit(values: DebtFormInput) {
    setFormError(null)
    try {
      await createDebt.mutateAsync({
        name: values.name,
        accountId: values.accountId,
        interestBps: values.interestBps,
        minimumPaymentMinor: values.minimumPayment,
        dueDay: values.dueDay,
        notes: values.notes,
      })
      form.reset()
      setOpen(false)
    } catch (e) {
      setFormError(getErrorMessage(e))
    }
  }

  if (debts.isLoading || balances.isLoading || accounts.isLoading) {
    return (
      <div>
        <PageHeader title="Debts" />
        <LoadingSkeleton />
      </div>
    )
  }

  if (debts.error || balances.error || accounts.error) {
    return (
      <ErrorState
        message={getErrorMessage(debts.error ?? balances.error ?? accounts.error)}
        onRetry={() => {
          void debts.refetch()
          void balances.refetch()
          void accounts.refetch()
        }}
      />
    )
  }

  const list = balances.data ?? []
  const total = list.reduce((s, d) => s + d.balanceMinor, 0)
  const due = list.reduce((s, d) => s + d.minimumPaymentMinor, 0)
  // Only when debts exist and every balance is paid down (empty list is not a payoff).
  const allPaidOff = list.length > 0 && list.every((d) => d.balanceMinor <= 0)

  return (
    <div>
      <PageHeader
        title="Debts"
        description="Track liability balances and minimum payments. Balance always reflects the linked liability account."
        actions={<Button onClick={() => setOpen(true)}>Add debt</Button>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-xs text-[var(--muted)]">Total balance</p>
          <p className="mt-1 text-lg font-semibold">
            <MoneyText minor={total} />
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[var(--muted)]">Minimum due</p>
          <p className="mt-1 text-lg font-semibold">{formatMoney(due)}</p>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState
          title="No active debts"
          description="Create a liability account first, then link a debt record. The account balance is the source of truth."
          action={<Button onClick={() => setOpen(true)}>Add debt</Button>}
        />
      ) : (
        <div className="space-y-4">
          {allPaidOff ? (
            <EmptyState
              title="Debt-free milestone"
              description="Every tracked debt balance is paid down. Celebrate the win — and keep records for reference."
              illustration="debt-payoff"
            />
          ) : null}
          <ul className="space-y-3">
            {list.map((d) => (
              <li key={d.debtId} className="card flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">{d.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    Due day {d.dueDay} · min {formatMoney(d.minimumPaymentMinor)}
                  </p>
                </div>
                <MoneyText className="text-lg font-semibold tabular-nums" minor={d.balanceMinor} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New debt"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="debt-form" disabled={createDebt.isPending}>
              Save
            </Button>
          </div>
        }
      >
        {liabilityAccounts.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Create a credit card, loan, or liability account under Accounts first. Its balance is
            the debt balance shown here.
          </p>
        ) : (
          <form id="debt-form" className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
            <Input
              label="Name"
              error={form.formState.errors.name?.message}
              {...form.register('name')}
            />
            <Select
              label="Liability account"
              options={liabilityAccounts}
              placeholder="Select"
              error={form.formState.errors.accountId?.message}
              {...form.register('accountId')}
            />
            <p className="text-xs text-[var(--muted)]">
              Current balance is taken from this account, not a separate principal field.
            </p>
            <Input
              label="Interest (basis points)"
              type="number"
              min={0}
              hint="100 bps = 1%"
              error={form.formState.errors.interestBps?.message}
              {...form.register('interestBps')}
            />
            <Input
              label="Minimum payment"
              inputMode="decimal"
              error={form.formState.errors.minimumPayment?.message}
              {...form.register('minimumPayment')}
            />
            <Input
              label="Due day of month"
              type="number"
              min={1}
              max={31}
              error={form.formState.errors.dueDay?.message}
              {...form.register('dueDay')}
            />
            <Textarea label="Notes" {...form.register('notes')} />
            {formError ? (
              <p className="field-error" role="alert">
                {formError}
              </p>
            ) : null}
          </form>
        )}
      </Dialog>
    </div>
  )
}
