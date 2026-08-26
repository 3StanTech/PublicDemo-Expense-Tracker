import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { transactionFormSchema, type TransactionFormInput } from '@/schemas/forms'
import {
  useAccounts,
  useCategories,
  useCreateTransaction,
  useDeleteTransaction,
  useTransactions,
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
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog'
import { formatDisplayDate, monthKey, todayIsoDate } from '@/lib/dates'
import { getErrorMessage } from '@/lib/errors'
import type { Transaction } from '@/types/domain'

export function TransactionsPage() {
  const [month, setMonth] = useState(monthKey(todayIsoDate()))
  const txs = useTransactions({ month })
  const accounts = useAccounts()
  const categories = useCategories()
  const createTx = useCreateTransaction()
  const deleteTx = useDeleteTransaction()
  const [open, setOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      kind: 'expense' as const,
      status: 'posted' as const,
      amount: '',
      occurredOn: todayIsoDate(),
      accountId: '',
      transferAccountId: null as string | null,
      categoryId: null as string | null,
      payee: '',
      notes: '',
    },
  })

  const kind = form.watch('kind')

  // Clear fields that are hidden for the current kind so they cannot block validation.
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

  const accountName = useMemo(() => {
    const m = new Map((accounts.data ?? []).map((a) => [a.id, a.name]))
    return (id: string) => m.get(id) ?? 'Account'
  }, [accounts.data])

  const categoryName = useMemo(() => {
    const m = new Map((categories.data ?? []).map((c) => [c.id, c.name]))
    return (id: string | null) => (id ? (m.get(id) ?? '—') : '—')
  }, [categories.data])

  async function onSubmit(values: TransactionFormInput) {
    setFormError(null)
    try {
      await createTx.mutateAsync({
        kind: values.kind,
        status: values.status,
        amountMinor: values.amount,
        occurredOn: values.occurredOn,
        accountId: values.accountId,
        transferAccountId: values.kind === 'transfer' ? (values.transferAccountId ?? null) : null,
        categoryId: values.kind === 'transfer' ? null : (values.categoryId ?? null),
        payee: values.payee,
        notes: values.notes,
      })
      form.reset({
        kind: 'expense',
        status: 'posted',
        amount: '',
        occurredOn: todayIsoDate(),
        accountId: accountOptions[0]?.value ?? '',
        transferAccountId: null,
        categoryId: null,
        payee: '',
        notes: '',
      })
      setOpen(false)
    } catch (e) {
      setFormError(getErrorMessage(e))
    }
  }

  if (txs.isLoading || accounts.isLoading || categories.isLoading) {
    return (
      <div>
        <PageHeader title="Transactions" />
        <LoadingSkeleton />
      </div>
    )
  }

  if (txs.error || accounts.error || categories.error) {
    return (
      <ErrorState
        message={getErrorMessage(txs.error ?? accounts.error ?? categories.error)}
        onRetry={() => {
          void txs.refetch()
          void accounts.refetch()
          void categories.refetch()
        }}
      />
    )
  }

  const list = txs.data ?? []

  return (
    <div>
      <PageHeader
        title="Transactions"
        description="Income, expenses, and transfers."
        actions={<Button onClick={() => setOpen(true)}>Add transaction</Button>}
      />

      <div className="mb-4 max-w-xs">
        <Input
          label="Month"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </div>

      {list.length === 0 ? (
        <EmptyState
          title="No transactions this month"
          description="Add an income, expense, or transfer. Transfers never appear in cash-flow charts."
          illustration="transactions"
          action={<Button onClick={() => setOpen(true)}>Add transaction</Button>}
        />
      ) : (
        <>
          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {list.map((t) => (
              <TransactionCard
                key={t.id}
                t={t}
                accountName={accountName}
                categoryName={categoryName}
                onDelete={() => {
                  setDeleteError(null)
                  setDeleteId(t.id)
                }}
              />
            ))}
          </ul>

          {/* Desktop table */}
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-[var(--muted)]">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Account</th>
                  <th className="px-4 py-3 font-medium">Kind</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {list.map((t) => (
                  <tr key={t.id} className="border-b border-[var(--line)]/70">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDisplayDate(t.occurredOn, 'MMM d')}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{t.payee || categoryName(t.categoryId)}</p>
                      {t.notes ? <p className="text-xs text-[var(--muted)]">{t.notes}</p> : null}
                    </td>
                    <td className="px-4 py-3">{accountName(t.accountId)}</td>
                    <td className="px-4 py-3 capitalize">
                      {t.kind}
                      {t.status === 'pending' ? ' · pending' : ''}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <MoneyText
                        minor={t.kind === 'expense' ? -t.amountMinor : t.amountMinor}
                        signed
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setDeleteError(null)
                          setDeleteId(t.id)
                        }}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New transaction"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="tx-form" disabled={createTx.isPending}>
              {createTx.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        }
      >
        <form id="tx-form" className="space-y-3" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <Select
            label="Kind"
            options={[
              { value: 'expense', label: 'Expense' },
              { value: 'income', label: 'Income' },
              { value: 'transfer', label: 'Transfer' },
            ]}
            {...form.register('kind')}
          />
          <Select
            label="Status"
            options={[
              { value: 'posted', label: 'Posted' },
              { value: 'pending', label: 'Pending' },
            ]}
            {...form.register('status')}
          />
          <Input
            label="Amount"
            inputMode="decimal"
            hint="PHP, e.g. 250.00"
            error={form.formState.errors.amount?.message}
            {...form.register('amount')}
          />
          <Input
            label="Date"
            type="date"
            error={form.formState.errors.occurredOn?.message}
            {...form.register('occurredOn')}
          />
          <Select
            label={kind === 'transfer' ? 'From account' : 'Account'}
            options={accountOptions}
            placeholder="Select account"
            error={form.formState.errors.accountId?.message}
            {...form.register('accountId')}
          />
          {kind === 'transfer' ? (
            <Select
              label="To account"
              options={accountOptions}
              placeholder="Select destination"
              error={form.formState.errors.transferAccountId?.message}
              {...form.register('transferAccountId')}
            />
          ) : (
            <Select
              label="Category"
              options={categoryOptions}
              placeholder="Optional"
              error={form.formState.errors.categoryId?.message}
              {...form.register('categoryId')}
            />
          )}
          <Input
            label="Payee"
            error={form.formState.errors.payee?.message}
            {...form.register('payee')}
          />
          <Textarea
            label="Notes"
            error={form.formState.errors.notes?.message}
            {...form.register('notes')}
          />
          {formError ? (
            <p className="field-error" role="alert">
              {formError}
            </p>
          ) : null}
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete transaction?"
        message="This permanently removes the transaction. Account balances will update."
        onClose={() => {
          if (deleteTx.isPending) return
          setDeleteId(null)
          setDeleteError(null)
        }}
        loading={deleteTx.isPending}
        error={deleteError}
        onConfirm={async () => {
          if (!deleteId) return
          setDeleteError(null)
          try {
            await deleteTx.mutateAsync(deleteId)
            setDeleteId(null)
          } catch (e) {
            setDeleteError(getErrorMessage(e, 'Failed to delete transaction'))
          }
        }}
      />
    </div>
  )
}

function TransactionCard({
  t,
  accountName,
  categoryName,
  onDelete,
}: {
  t: Transaction
  accountName: (id: string) => string
  categoryName: (id: string | null) => string
  onDelete: () => void
}) {
  return (
    <li className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{t.payee || categoryName(t.categoryId) || t.kind}</p>
          <p className="text-xs text-[var(--muted)]">
            {formatDisplayDate(t.occurredOn)} · {accountName(t.accountId)}
            {t.kind === 'transfer' && t.transferAccountId
              ? ` → ${accountName(t.transferAccountId)}`
              : ''}
          </p>
          <p className="mt-1 text-xs capitalize text-[var(--muted)]">
            {t.kind}
            {t.status === 'pending' ? ' · pending' : ''}
          </p>
        </div>
        <div className="text-right">
          <MoneyText
            className="text-base font-semibold tabular-nums"
            minor={t.kind === 'expense' ? -t.amountMinor : t.amountMinor}
            signed
          />
          <Button variant="ghost" className="mt-1 !min-h-9 !px-2 text-xs" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>
    </li>
  )
}
