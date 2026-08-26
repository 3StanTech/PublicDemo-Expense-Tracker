import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { accountFormSchema, type AccountFormInput } from '@/schemas/forms'
import {
  useAccounts,
  useAccountBalances,
  useCreateAccount,
  useCreateCategory,
  useCategories,
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
import { getErrorMessage } from '@/lib/errors'
import { minorToDecimalString } from '@/lib/money'
import type { AccountType } from '@/types/domain'
import { categoryFormSchema, type CategoryFormInput } from '@/schemas/forms'

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'e_wallet', label: 'E-wallet' },
  { value: 'investment', label: 'Investment' },
  { value: 'property', label: 'Property' },
  { value: 'credit_card', label: 'Credit card' },
  { value: 'loan', label: 'Loan' },
  { value: 'asset', label: 'Other asset' },
  { value: 'liability', label: 'Other liability' },
]

export function AccountsPage() {
  const accounts = useAccounts()
  const balances = useAccountBalances()
  const categories = useCategories()
  const createAccount = useCreateAccount()
  const createCategory = useCreateCategory()
  const [open, setOpen] = useState(false)
  const [catOpen, setCatOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      name: '',
      type: 'checking' as AccountType,
      openingBalance: '0.00',
      notes: '',
    },
  })

  const catForm = useForm({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: { name: '', kind: 'expense' as const, color: '#059669' },
  })

  const balanceMap = new Map((balances.data ?? []).map((b) => [b.accountId, b.balanceMinor]))

  async function onSubmit(values: AccountFormInput) {
    setFormError(null)
    try {
      await createAccount.mutateAsync({
        name: values.name,
        type: values.type,
        openingBalanceMinor: values.openingBalance,
        notes: values.notes,
      })
      form.reset({ name: '', type: 'checking', openingBalance: '0.00', notes: '' })
      setOpen(false)
    } catch (e) {
      setFormError(getErrorMessage(e))
    }
  }

  async function onCatSubmit(values: CategoryFormInput) {
    setFormError(null)
    try {
      await createCategory.mutateAsync({
        name: values.name,
        kind: values.kind,
        color: values.color,
      })
      catForm.reset({ name: '', kind: 'expense', color: '#059669' })
      setCatOpen(false)
    } catch (e) {
      setFormError(getErrorMessage(e))
    }
  }

  if (accounts.isLoading || balances.isLoading || categories.isLoading) {
    return (
      <div>
        <PageHeader title="Accounts" />
        <LoadingSkeleton />
      </div>
    )
  }

  if (accounts.error || balances.error || categories.error) {
    return (
      <ErrorState
        message={getErrorMessage(accounts.error ?? balances.error ?? categories.error)}
        onRetry={() => {
          void accounts.refetch()
          void balances.refetch()
          void categories.refetch()
        }}
      />
    )
  }

  const list = accounts.data ?? []

  return (
    <div>
      <PageHeader
        title="Accounts"
        description="Cash, banks, wallets, and liabilities you own."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setCatOpen(true)}>
              Add category
            </Button>
            <Button onClick={() => setOpen(true)}>Add account</Button>
          </div>
        }
      />

      {list.length === 0 ? (
        <EmptyState
          title="No accounts yet"
          description="Create your first account to start tracking balances."
          action={<Button onClick={() => setOpen(true)}>Add account</Button>}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((a) => {
            const bal = balanceMap.get(a.id) ?? a.openingBalanceMinor
            return (
              <li key={a.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{a.name}</p>
                    <p className="text-xs capitalize text-[var(--muted)]">
                      {a.type.replace('_', ' ')}
                    </p>
                  </div>
                  <MoneyText className="text-lg font-semibold tabular-nums" minor={bal} />
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Opening {minorToDecimalString(a.openingBalanceMinor)} PHP
                </p>
              </li>
            )
          })}
        </ul>
      )}

      <section className="mt-8" aria-labelledby="cats-heading">
        <h2 id="cats-heading" className="mb-3 text-base font-semibold">
          Categories
        </h2>
        {categories.isLoading ? (
          <LoadingSkeleton rows={2} />
        ) : (
          <ul className="flex flex-wrap gap-2">
            {(categories.data ?? []).map((c) => (
              <li
                key={c.id}
                className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-sm"
              >
                <span
                  className="mr-2 inline-block h-2 w-2 rounded-full"
                  style={{ background: c.color ?? '#059669' }}
                  aria-hidden
                />
                {c.name}
                <span className="ml-1 text-xs text-[var(--muted)]">({c.kind})</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New account"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="account-form" disabled={createAccount.isPending}>
              {createAccount.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        }
      >
        <form id="account-form" className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
          <Input
            label="Name"
            error={form.formState.errors.name?.message}
            {...form.register('name')}
          />
          <Select
            label="Type"
            options={ACCOUNT_TYPES}
            error={form.formState.errors.type?.message}
            {...form.register('type')}
          />
          <Input
            label="Opening balance"
            inputMode="decimal"
            hint="PHP, up to 2 decimal places"
            error={form.formState.errors.openingBalance?.message}
            {...form.register('openingBalance')}
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

      <Dialog
        open={catOpen}
        onClose={() => setCatOpen(false)}
        title="New category"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCatOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="category-form" disabled={createCategory.isPending}>
              Save
            </Button>
          </div>
        }
      >
        <form id="category-form" className="space-y-3" onSubmit={catForm.handleSubmit(onCatSubmit)}>
          <Input
            label="Name"
            error={catForm.formState.errors.name?.message}
            {...catForm.register('name')}
          />
          <Select
            label="Kind"
            options={[
              { value: 'expense', label: 'Expense' },
              { value: 'income', label: 'Income' },
            ]}
            {...catForm.register('kind')}
          />
          <Input label="Color" type="color" {...catForm.register('color')} />
        </form>
      </Dialog>
    </div>
  )
}
