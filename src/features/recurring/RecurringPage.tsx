import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { recurringFormSchema, type RecurringFormInput } from '@/schemas/forms'
import {
  useAccounts,
  useCategories,
  useCreateRecurring,
  useMaterializeRecurring,
  useRecurring,
  useUpdateRecurring,
} from '@/features/data/hooks'
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
import { todayIsoDate } from '@/lib/dates'
import { getErrorMessage } from '@/lib/errors'

export function RecurringPage() {
  const rules = useRecurring()
  const accounts = useAccounts()
  const categories = useCategories()
  const createRule = useCreateRecurring()
  const updateRule = useUpdateRecurring()
  const materialize = useMaterializeRecurring()
  const [open, setOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null)

  const form = useForm({
    resolver: zodResolver(recurringFormSchema),
    defaultValues: {
      name: '',
      kind: 'expense' as const,
      amount: '',
      accountId: '',
      transferAccountId: null as string | null,
      categoryId: null as string | null,
      payee: '',
      notes: '',
      frequency: 'monthly' as const,
      intervalCount: 1,
      startDate: todayIsoDate(),
      endDate: null as string | null,
      status: 'active' as const,
    },
  })

  const kind = form.watch('kind')

  useEffect(() => {
    if (kind === 'transfer') {
      form.setValue('categoryId', null)
      form.clearErrors('categoryId')
    } else {
      form.setValue('transferAccountId', null)
      form.clearErrors('transferAccountId')
    }
  }, [kind, form])

  const accountOptions = useMemo(
    () => (accounts.data ?? []).map((a) => ({ value: a.id, label: a.name })),
    [accounts.data],
  )
  const categoryOptions = useMemo(() => {
    const k = kind === 'income' ? 'income' : 'expense'
    return (categories.data ?? [])
      .filter((c) => c.kind === k)
      .map((c) => ({ value: c.id, label: c.name }))
  }, [categories.data, kind])

  async function onSubmit(values: RecurringFormInput) {
    setFormError(null)
    try {
      await createRule.mutateAsync({
        name: values.name,
        kind: values.kind,
        amountMinor: values.amount,
        accountId: values.accountId,
        transferAccountId: values.kind === 'transfer' ? (values.transferAccountId ?? null) : null,
        categoryId: values.kind === 'transfer' ? null : (values.categoryId ?? null),
        payee: values.payee,
        notes: values.notes,
        frequency: values.frequency,
        intervalCount: values.intervalCount,
        startDate: values.startDate,
        endDate: values.endDate,
        status: values.status,
      })
      form.reset()
      setOpen(false)
    } catch (e) {
      setFormError(getErrorMessage(e))
    }
  }

  async function onMaterialize() {
    setInfo(null)
    setStatusError(null)
    try {
      const n = await materialize.mutateAsync()
      setInfo(`Materialized ${n} transaction${n === 1 ? '' : 's'}.`)
    } catch (e) {
      setStatusError(getErrorMessage(e))
    }
  }

  async function toggleStatus(id: string, status: 'active' | 'paused') {
    if (pendingStatusId) return
    setStatusError(null)
    setPendingStatusId(id)
    try {
      await updateRule.mutateAsync({
        id,
        patch: { status: status === 'active' ? 'paused' : 'active' },
      })
    } catch (e) {
      setStatusError(getErrorMessage(e, 'Failed to update recurring status'))
    } finally {
      setPendingStatusId(null)
    }
  }

  if (rules.isLoading || accounts.isLoading || categories.isLoading) {
    return (
      <div>
        <PageHeader title="Recurring" />
        <LoadingSkeleton />
      </div>
    )
  }

  if (rules.error || accounts.error || categories.error) {
    return (
      <ErrorState
        message={getErrorMessage(rules.error ?? accounts.error ?? categories.error)}
        onRetry={() => {
          void rules.refetch()
          void accounts.refetch()
          void categories.refetch()
        }}
      />
    )
  }

  const list = rules.data ?? []

  return (
    <div>
      <PageHeader
        title="Recurring"
        description="Rules that create transactions on a schedule. Monthly dates clamp to short months."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onMaterialize} disabled={materialize.isPending}>
              {materialize.isPending ? 'Running…' : 'Materialize due'}
            </Button>
            <Button onClick={() => setOpen(true)}>Add rule</Button>
          </div>
        }
      />

      {info ? (
        <p className="mb-4 text-sm text-primary-800" role="status">
          {info}
        </p>
      ) : null}
      {statusError ? (
        <p className="mb-4 field-error" role="alert">
          {statusError}
        </p>
      ) : null}
      {formError && !open ? (
        <p className="mb-4 field-error" role="alert">
          {formError}
        </p>
      ) : null}

      {list.length === 0 ? (
        <EmptyState
          title="No recurring rules"
          description="Automate rent, salary, or subscription transactions."
          action={<Button onClick={() => setOpen(true)}>Add rule</Button>}
        />
      ) : (
        <ul className="space-y-3">
          {list.map((r) => (
            <li
              key={r.id}
              className="card flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold">{r.name}</p>
                <p className="text-xs text-[var(--muted)]">
                  {r.frequency} · every {r.intervalCount} · {r.status} · starts {r.startDate}
                  {r.lastMaterializedOn ? ` · last ${r.lastMaterializedOn}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <MoneyText className="font-semibold tabular-nums" minor={r.amountMinor} />
                <Button
                  variant="secondary"
                  disabled={pendingStatusId === r.id || updateRule.isPending}
                  onClick={() => void toggleStatus(r.id, r.status)}
                >
                  {pendingStatusId === r.id
                    ? 'Updating…'
                    : r.status === 'active'
                      ? 'Pause'
                      : 'Resume'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New recurring rule"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="rec-form" disabled={createRule.isPending}>
              Save
            </Button>
          </div>
        }
      >
        <form id="rec-form" className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
          <Input
            label="Name"
            error={form.formState.errors.name?.message}
            {...form.register('name')}
          />
          <Select
            label="Kind"
            options={[
              { value: 'expense', label: 'Expense' },
              { value: 'income', label: 'Income' },
              { value: 'transfer', label: 'Transfer' },
            ]}
            {...form.register('kind')}
          />
          <Input
            label="Amount"
            inputMode="decimal"
            error={form.formState.errors.amount?.message}
            {...form.register('amount')}
          />
          <Select
            label="Account"
            options={accountOptions}
            placeholder="Select"
            error={form.formState.errors.accountId?.message}
            {...form.register('accountId')}
          />
          {kind === 'transfer' ? (
            <Select
              label="Destination"
              options={accountOptions}
              placeholder="Select"
              {...form.register('transferAccountId')}
            />
          ) : (
            <Select
              label="Category"
              options={categoryOptions}
              placeholder="Optional"
              {...form.register('categoryId')}
            />
          )}
          <Select
            label="Frequency"
            options={[
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' },
              { value: 'yearly', label: 'Yearly' },
            ]}
            {...form.register('frequency')}
          />
          <Input
            label="Interval"
            type="number"
            min={1}
            max={365}
            error={form.formState.errors.intervalCount?.message}
            {...form.register('intervalCount')}
          />
          <Input
            label="Start date"
            type="date"
            error={form.formState.errors.startDate?.message}
            {...form.register('startDate')}
          />
          <Input label="End date" type="date" {...form.register('endDate')} />
          <Textarea label="Notes" {...form.register('notes')} />
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
