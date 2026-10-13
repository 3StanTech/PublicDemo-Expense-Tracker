import { endOfMonth, format, parseISO } from 'date-fns'
import { DEMO_USER_ID } from '@/demo/seed'
import { getStore as getLocalStore } from '@/data/store'
import {
  categorySpending,
  computeAccountBalance,
  computeNetWorth,
  isLiabilityType,
  monthlyCashFlow,
} from '@/lib/finance'
import {
  generateOccurrences,
  monthDateBounds,
  monthKey,
  nowInManila,
  todayIsoDate,
} from '@/lib/dates'
import type {
  Account,
  AccountBalance,
  Budget,
  BudgetActualRow,
  Category,
  CategorySpendRow,
  Debt,
  DebtBalanceRow,
  GoalContribution,
  MonthlyCashFlowRow,
  NetWorthPoint,
  Profile,
  RecurringRule,
  SavingsGoal,
  Transaction,
} from '@/types/domain'

function newId(): string {
  return crypto.randomUUID()
}

function nowIso(): string {
  return new Date().toISOString()
}

function manilaDateFromIso(iso: string): string {
  return format(nowInManila(parseISO(iso)), 'yyyy-MM-dd')
}

function monthEndIso(dateStr: string): string {
  return format(endOfMonth(parseISO(dateStr)), 'yyyy-MM-dd')
}

function sortByName<T extends { name: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name))
}

function postedFlowForAccount(
  accountId: string,
  txs: readonly Transaction[],
  asOf?: string,
): { postedInflowsMinor: number; postedOutflowsMinor: number } {
  let postedInflowsMinor = 0
  let postedOutflowsMinor = 0
  for (const t of txs) {
    if (t.status !== 'posted') continue
    if (asOf && t.occurredOn > asOf) continue
    if (t.accountId !== accountId && t.transferAccountId !== accountId) continue

    if (t.kind === 'income' && t.accountId === accountId) {
      postedInflowsMinor += t.amountMinor
    } else if (t.kind === 'expense' && t.accountId === accountId) {
      postedOutflowsMinor += t.amountMinor
    } else if (t.kind === 'transfer' && t.accountId === accountId) {
      postedOutflowsMinor += t.amountMinor
    } else if (t.kind === 'transfer' && t.transferAccountId === accountId) {
      postedInflowsMinor += t.amountMinor
    }
  }
  return { postedInflowsMinor, postedOutflowsMinor }
}

function balanceForAccount(
  account: Account,
  txs: readonly Transaction[],
  asOf?: string,
): number {
  const flow = postedFlowForAccount(account.id, txs, asOf)
  return computeAccountBalance({
    accountType: account.type,
    openingBalanceMinor: account.openingBalanceMinor,
    ...flow,
  })
}

// --- Profile ---
export async function fetchProfile(): Promise<Profile | null> {
  const store = await getLocalStore()
  return store.get('profiles', DEMO_USER_ID)
}

export async function updateProfile(displayName: string | null): Promise<Profile> {
  const store = await getLocalStore()
  const current = await store.get('profiles', DEMO_USER_ID)
  if (!current) throw new Error('Profile not found')
  return store.put('profiles', {
    ...current,
    displayName,
    updatedAt: nowIso(),
  })
}

// --- Categories ---
export async function fetchCategories(): Promise<Category[]> {
  const store = await getLocalStore()
  return sortByName((await store.list('categories')).filter((c) => !c.isArchived))
}

export async function createCategory(input: {
  name: string
  kind: 'income' | 'expense'
  color: string | null
}): Promise<Category> {
  const store = await getLocalStore()
  const ts = nowIso()
  return store.put('categories', {
    id: newId(),
    userId: DEMO_USER_ID,
    name: input.name,
    kind: input.kind,
    color: input.color,
    icon: null,
    isArchived: false,
    createdAt: ts,
    updatedAt: ts,
  })
}

export async function archiveCategory(id: string): Promise<void> {
  const store = await getLocalStore()
  const current = await store.get('categories', id)
  if (!current) throw new Error('Category not found')
  await store.put('categories', {
    ...current,
    isArchived: true,
    updatedAt: nowIso(),
  })
}

// --- Accounts ---
export async function fetchAccounts(): Promise<Account[]> {
  const store = await getLocalStore()
  return sortByName((await store.list('accounts')).filter((a) => !a.isArchived))
}

export async function createAccount(input: {
  name: string
  type: Account['type']
  openingBalanceMinor: number
  notes: string | null
}): Promise<Account> {
  const store = await getLocalStore()
  const ts = nowIso()
  return store.put('accounts', {
    id: newId(),
    userId: DEMO_USER_ID,
    name: input.name,
    type: input.type,
    currency: 'PHP',
    openingBalanceMinor: input.openingBalanceMinor,
    isArchived: false,
    archivedAt: null,
    notes: input.notes,
    createdAt: ts,
    updatedAt: ts,
  })
}

export async function updateAccount(
  id: string,
  input: Partial<{
    name: string
    type: Account['type']
    openingBalanceMinor: number
    notes: string | null
    isArchived: boolean
  }>,
): Promise<Account> {
  const store = await getLocalStore()
  const current = await store.get('accounts', id)
  if (!current) throw new Error('Account not found')
  const ts = nowIso()
  const isArchived = input.isArchived ?? current.isArchived
  return store.put('accounts', {
    ...current,
    name: input.name ?? current.name,
    type: input.type ?? current.type,
    openingBalanceMinor: input.openingBalanceMinor ?? current.openingBalanceMinor,
    notes: input.notes !== undefined ? input.notes : current.notes,
    isArchived,
    archivedAt: isArchived ? (current.archivedAt ?? ts) : null,
    updatedAt: ts,
  })
}

export async function fetchAccountBalances(): Promise<AccountBalance[]> {
  const store = await getLocalStore()
  const [accounts, txs] = await Promise.all([
    store.list('accounts'),
    store.list('transactions'),
  ])
  return accounts.map((account) => ({
    accountId: account.id,
    balanceMinor: balanceForAccount(account, txs),
  }))
}

// --- Transactions ---
export async function fetchTransactions(filters?: {
  month?: string
  accountId?: string
}): Promise<Transaction[]> {
  const store = await getLocalStore()
  let rows = await store.list('transactions')

  if (filters?.accountId) {
    rows = rows.filter((t) => t.accountId === filters.accountId)
  }
  if (filters?.month) {
    const { start, endExclusive } = monthDateBounds(filters.month)
    rows = rows.filter((t) => t.occurredOn >= start && t.occurredOn < endExclusive)
  }

  rows.sort((a, b) => {
    if (a.occurredOn !== b.occurredOn) return b.occurredOn.localeCompare(a.occurredOn)
    return b.createdAt.localeCompare(a.createdAt)
  })
  return rows.slice(0, 500)
}

export async function createTransaction(input: {
  kind: Transaction['kind']
  status: Transaction['status']
  amountMinor: number
  occurredOn: string
  accountId: string
  transferAccountId: string | null
  categoryId: string | null
  payee: string | null
  notes: string | null
}): Promise<Transaction> {
  const store = await getLocalStore()
  const ts = nowIso()
  return store.put('transactions', {
    id: newId(),
    userId: DEMO_USER_ID,
    kind: input.kind,
    status: input.status,
    amountMinor: input.amountMinor,
    occurredOn: input.occurredOn,
    accountId: input.accountId,
    transferAccountId: input.transferAccountId,
    categoryId: input.categoryId,
    payee: input.payee,
    notes: input.notes,
    recurringRuleId: null,
    createdAt: ts,
    updatedAt: ts,
  })
}

export async function updateTransaction(
  id: string,
  input: {
    kind: Transaction['kind']
    status: Transaction['status']
    amountMinor: number
    occurredOn: string
    accountId: string
    transferAccountId: string | null
    categoryId: string | null
    payee: string | null
    notes: string | null
  },
): Promise<Transaction> {
  const store = await getLocalStore()
  const current = await store.get('transactions', id)
  if (!current) throw new Error('Transaction not found')
  return store.put('transactions', {
    ...current,
    ...input,
    updatedAt: nowIso(),
  })
}

export async function deleteTransaction(id: string): Promise<void> {
  const store = await getLocalStore()
  await store.remove('transactions', id)
}

// --- Budgets ---
export async function fetchBudgets(month?: string): Promise<Budget[]> {
  const store = await getLocalStore()
  let rows = await store.list('budgets')
  if (month) rows = rows.filter((b) => b.month === month)
  return rows.sort((a, b) => b.month.localeCompare(a.month))
}

export async function createBudget(input: {
  categoryId: string
  month: string
  amountMinor: number
}): Promise<Budget> {
  const store = await getLocalStore()
  const ts = nowIso()
  return store.put('budgets', {
    id: newId(),
    userId: DEMO_USER_ID,
    categoryId: input.categoryId,
    month: input.month,
    amountMinor: input.amountMinor,
    createdAt: ts,
    updatedAt: ts,
  })
}

export async function updateBudget(id: string, amountMinor: number): Promise<Budget> {
  const store = await getLocalStore()
  const current = await store.get('budgets', id)
  if (!current) throw new Error('Budget not found')
  return store.put('budgets', {
    ...current,
    amountMinor,
    updatedAt: nowIso(),
  })
}

export async function deleteBudget(id: string): Promise<void> {
  const store = await getLocalStore()
  await store.remove('budgets', id)
}

export async function fetchBudgetActuals(month?: string): Promise<BudgetActualRow[]> {
  const store = await getLocalStore()
  const [budgets, categories, txs] = await Promise.all([
    store.list('budgets'),
    store.list('categories'),
    store.list('transactions'),
  ])
  const categoryNames = new Map(categories.map((c) => [c.id, c.name]))
  const rows = (month ? budgets.filter((b) => b.month === month) : budgets).map((b) => {
    const { start, endExclusive } = monthDateBounds(b.month)
    const spent = categorySpending(
      txs.filter((t) => t.occurredOn >= start && t.occurredOn < endExclusive),
    )
    return {
      budgetId: b.id,
      categoryId: b.categoryId,
      categoryName: categoryNames.get(b.categoryId) ?? 'Unknown',
      month: b.month,
      budgetMinor: b.amountMinor,
      spentMinor: spent.get(b.categoryId) ?? 0,
    }
  })
  return rows
}

// --- Recurring ---
export async function fetchRecurringRules(): Promise<RecurringRule[]> {
  const store = await getLocalStore()
  return sortByName(await store.list('recurringRules'))
}

export async function createRecurringRule(input: {
  name: string
  kind: RecurringRule['kind']
  amountMinor: number
  accountId: string
  transferAccountId: string | null
  categoryId: string | null
  payee: string | null
  notes: string | null
  frequency: RecurringRule['frequency']
  intervalCount: number
  startDate: string
  endDate: string | null
  status: RecurringRule['status']
}): Promise<RecurringRule> {
  const store = await getLocalStore()
  const ts = nowIso()
  return store.put('recurringRules', {
    id: newId(),
    userId: DEMO_USER_ID,
    name: input.name,
    kind: input.kind,
    amountMinor: input.amountMinor,
    accountId: input.accountId,
    transferAccountId: input.transferAccountId,
    categoryId: input.categoryId,
    payee: input.payee,
    notes: input.notes,
    frequency: input.frequency,
    intervalCount: input.intervalCount,
    startDate: input.startDate,
    endDate: input.endDate,
    status: input.status,
    lastMaterializedOn: null,
    createdAt: ts,
    updatedAt: ts,
  })
}

export async function updateRecurringRule(
  id: string,
  patch: Partial<{
    name: string
    status: RecurringRule['status']
    amountMinor: number
    endDate: string | null
  }>,
): Promise<RecurringRule> {
  const store = await getLocalStore()
  const current = await store.get('recurringRules', id)
  if (!current) throw new Error('Recurring rule not found')
  return store.put('recurringRules', {
    ...current,
    name: patch.name ?? current.name,
    status: patch.status ?? current.status,
    amountMinor: patch.amountMinor ?? current.amountMinor,
    endDate: patch.endDate !== undefined ? patch.endDate : current.endDate,
    updatedAt: nowIso(),
  })
}

export async function deleteRecurringRule(id: string): Promise<void> {
  const store = await getLocalStore()
  await store.remove('recurringRules', id)
}

/**
 * Client-side materialization: active rules only (max 50), max 200 new entries,
 * asOf cannot be after Manila today. Idempotent via recurringRuleId + occurredOn.
 */
export async function materializeRecurring(asOf?: string): Promise<number> {
  const manilaToday = todayIsoDate()
  const effectiveAsOf = asOf ?? manilaToday
  if (effectiveAsOf > manilaToday) {
    throw new Error('asOf cannot be after the current Manila calendar date')
  }

  const store = await getLocalStore()
  const [rules, txs] = await Promise.all([
    store.list('recurringRules'),
    store.list('transactions'),
  ])

  const active = rules.filter((r) => r.status === 'active').slice(0, 50)
  const existingKeys = new Set(
    txs
      .filter((t) => t.recurringRuleId)
      .map((t) => `${t.recurringRuleId}:${t.occurredOn}`),
  )

  let created = 0
  const maxEntries = 200

  for (const rule of active) {
    if (created >= maxEntries) break

    const dueDates = generateOccurrences({
      startDate: rule.startDate,
      endDate: rule.endDate,
      frequency: rule.frequency,
      interval: rule.intervalCount,
      asOf: effectiveAsOf,
      lastMaterialized: rule.lastMaterializedOn,
    })

    let lastOn = rule.lastMaterializedOn
    for (const occurredOn of dueDates) {
      if (created >= maxEntries) break
      const key = `${rule.id}:${occurredOn}`
      if (!existingKeys.has(key)) {
        const ts = nowIso()
        await store.put('transactions', {
          id: newId(),
          userId: DEMO_USER_ID,
          kind: rule.kind,
          status: 'posted',
          amountMinor: rule.amountMinor,
          occurredOn,
          accountId: rule.accountId,
          transferAccountId: rule.transferAccountId,
          categoryId: rule.categoryId,
          payee: rule.payee,
          notes: rule.notes,
          recurringRuleId: rule.id,
          createdAt: ts,
          updatedAt: ts,
        })
        existingKeys.add(key)
        created += 1
      }
      lastOn = occurredOn
    }

    if (lastOn !== rule.lastMaterializedOn) {
      await store.put('recurringRules', {
        ...rule,
        lastMaterializedOn: lastOn,
        updatedAt: nowIso(),
      })
    }
  }

  return created
}

// --- Goals ---
export async function fetchGoals(): Promise<SavingsGoal[]> {
  const store = await getLocalStore()
  return sortByName((await store.list('savingsGoals')).filter((g) => !g.isArchived))
}

export async function createGoal(input: {
  name: string
  targetAmountMinor: number
  targetDate: string | null
  notes: string | null
}): Promise<SavingsGoal> {
  const store = await getLocalStore()
  const ts = nowIso()
  return store.put('savingsGoals', {
    id: newId(),
    userId: DEMO_USER_ID,
    name: input.name,
    targetAmountMinor: input.targetAmountMinor,
    currentAmountMinor: 0,
    targetDate: input.targetDate,
    notes: input.notes,
    isArchived: false,
    createdAt: ts,
    updatedAt: ts,
  })
}

export async function updateGoal(
  id: string,
  patch: Partial<{
    name: string
    targetAmountMinor: number
    targetDate: string | null
    notes: string | null
    isArchived: boolean
  }>,
): Promise<SavingsGoal> {
  const store = await getLocalStore()
  const current = await store.get('savingsGoals', id)
  if (!current) throw new Error('Goal not found')
  return store.put('savingsGoals', {
    ...current,
    name: patch.name ?? current.name,
    targetAmountMinor: patch.targetAmountMinor ?? current.targetAmountMinor,
    targetDate: patch.targetDate !== undefined ? patch.targetDate : current.targetDate,
    notes: patch.notes !== undefined ? patch.notes : current.notes,
    isArchived: patch.isArchived ?? current.isArchived,
    updatedAt: nowIso(),
  })
}

export async function addContribution(input: {
  goalId: string
  amountMinor: number
  contributedOn: string
  notes: string | null
}): Promise<GoalContribution> {
  const store = await getLocalStore()
  const goal = await store.get('savingsGoals', input.goalId)
  if (!goal) throw new Error('Goal not found')

  const ts = nowIso()
  const contribution = await store.put('goalContributions', {
    id: newId(),
    userId: DEMO_USER_ID,
    goalId: input.goalId,
    amountMinor: input.amountMinor,
    contributedOn: input.contributedOn,
    notes: input.notes,
    createdAt: ts,
  })

  await store.put('savingsGoals', {
    ...goal,
    currentAmountMinor: goal.currentAmountMinor + input.amountMinor,
    updatedAt: ts,
  })

  return contribution
}

// --- Debts ---
export async function fetchDebts(): Promise<Debt[]> {
  const store = await getLocalStore()
  return sortByName((await store.list('debts')).filter((d) => d.isActive))
}

export async function createDebt(input: {
  name: string
  accountId: string
  interestBps: number
  minimumPaymentMinor: number
  dueDay: number
  notes: string | null
}): Promise<Debt> {
  const store = await getLocalStore()
  const account = await store.get('accounts', input.accountId)
  if (!account) throw new Error('Liability account not found')
  if (!isLiabilityType(account.type)) {
    throw new Error('Debt must link to a liability account')
  }

  const ts = nowIso()
  return store.put('debts', {
    id: newId(),
    userId: DEMO_USER_ID,
    name: input.name,
    accountId: input.accountId,
    originalPrincipalMinor: account.openingBalanceMinor,
    interestBps: input.interestBps,
    minimumPaymentMinor: input.minimumPaymentMinor,
    dueDay: input.dueDay,
    notes: input.notes,
    isActive: true,
    createdAt: ts,
    updatedAt: ts,
  })
}

export async function updateDebt(
  id: string,
  patch: Partial<{
    name: string
    interestBps: number
    minimumPaymentMinor: number
    dueDay: number
    notes: string | null
    isActive: boolean
  }>,
): Promise<Debt> {
  const store = await getLocalStore()
  const current = await store.get('debts', id)
  if (!current) throw new Error('Debt not found')
  return store.put('debts', {
    ...current,
    name: patch.name ?? current.name,
    interestBps: patch.interestBps ?? current.interestBps,
    minimumPaymentMinor: patch.minimumPaymentMinor ?? current.minimumPaymentMinor,
    dueDay: patch.dueDay ?? current.dueDay,
    notes: patch.notes !== undefined ? patch.notes : current.notes,
    isActive: patch.isActive ?? current.isActive,
    updatedAt: nowIso(),
  })
}

export async function fetchDebtBalances(): Promise<DebtBalanceRow[]> {
  const store = await getLocalStore()
  const [debts, accounts, txs] = await Promise.all([
    store.list('debts'),
    store.list('accounts'),
    store.list('transactions'),
  ])
  const accountById = new Map(accounts.map((a) => [a.id, a]))
  return debts
    .filter((d) => d.isActive)
    .map((d) => {
      const account = accountById.get(d.accountId)
      if (!account) {
        throw new Error(`Debt ${d.id} is missing linked liability account`)
      }
      return {
        debtId: d.id,
        name: d.name,
        balanceMinor: balanceForAccount(account, txs),
        minimumPaymentMinor: d.minimumPaymentMinor,
        dueDay: d.dueDay,
      }
    })
}

// --- Analytics (in-process) ---
export async function fetchMonthlyCashFlow(): Promise<MonthlyCashFlowRow[]> {
  const store = await getLocalStore()
  const txs = await store.list('transactions')
  const byMonth = new Map<string, Transaction[]>()
  for (const t of txs) {
    const key = monthKey(t.occurredOn)
    const bucket = byMonth.get(key) ?? []
    bucket.push(t)
    byMonth.set(key, bucket)
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, monthTxs]) => {
      const flow = monthlyCashFlow(monthTxs)
      return {
        month,
        incomeMinor: flow.incomeMinor,
        expenseMinor: flow.expenseMinor,
      }
    })
}

export async function fetchCategorySpending(month: string): Promise<CategorySpendRow[]> {
  const store = await getLocalStore()
  const [txs, categories] = await Promise.all([
    store.list('transactions'),
    store.list('categories'),
  ])
  const { start, endExclusive } = monthDateBounds(month)
  const spent = categorySpending(
    txs.filter((t) => t.occurredOn >= start && t.occurredOn < endExclusive),
  )
  const names = new Map(categories.map((c) => [c.id, c.name]))
  return [...spent.entries()]
    .map(([categoryId, amountMinor]) => ({
      categoryId,
      categoryName: names.get(categoryId) ?? 'Unknown',
      amountMinor,
    }))
    .sort((a, b) => b.amountMinor - a.amountMinor)
}

export async function fetchNetWorthHistory(): Promise<NetWorthPoint[]> {
  const store = await getLocalStore()
  const [accounts, txs] = await Promise.all([
    store.list('accounts'),
    store.list('transactions'),
  ])

  const asOfSet = new Set<string>()
  for (const t of txs) {
    if (t.status === 'posted') asOfSet.add(monthEndIso(t.occurredOn))
  }
  for (const a of accounts) {
    asOfSet.add(monthEndIso(manilaDateFromIso(a.createdAt)))
  }

  const points: NetWorthPoint[] = []
  for (const asOf of [...asOfSet].sort()) {
    const included = accounts.filter((a) => {
      const createdOn = manilaDateFromIso(a.createdAt)
      if (createdOn > asOf) return false
      if (a.archivedAt) {
        const archivedOn = manilaDateFromIso(a.archivedAt)
        if (archivedOn <= asOf) return false
      }
      return true
    })
    const balances = included.map((a) => ({
      type: a.type,
      balanceMinor: balanceForAccount(a, txs, asOf),
    }))
    points.push({
      asOf,
      netWorthMinor: computeNetWorth(balances),
    })
  }
  return points
}
