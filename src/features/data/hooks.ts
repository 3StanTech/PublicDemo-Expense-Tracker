import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-client'
import { useAuth } from '@/features/auth/AuthProvider'
import * as repo from './repositories'
import { monthKey, nextDueOccurrence, todayIsoDate } from '@/lib/dates'
import { computeNetWorth } from '@/lib/finance'
import { savingsRate } from '@/lib/money'
import type { Account, RecurringRule } from '@/types/domain'

function useEnabled() {
  const { user, configured } = useAuth()
  return Boolean(user && configured)
}

export function useProfile() {
  const enabled = useEnabled()
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: repo.fetchProfile,
    enabled,
  })
}

export function useAccounts() {
  const enabled = useEnabled()
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: repo.fetchAccounts,
    enabled,
  })
}

export function useAccountBalances() {
  const enabled = useEnabled()
  return useQuery({
    queryKey: queryKeys.accountBalances,
    queryFn: repo.fetchAccountBalances,
    enabled,
  })
}

export function useCategories() {
  const enabled = useEnabled()
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: repo.fetchCategories,
    enabled,
  })
}

export function useTransactions(filters?: { month?: string; accountId?: string }) {
  const enabled = useEnabled()
  return useQuery({
    queryKey: queryKeys.transactions(filters),
    queryFn: () => repo.fetchTransactions(filters),
    enabled,
  })
}

export function useBudgets(month?: string) {
  const enabled = useEnabled()
  return useQuery({
    queryKey: queryKeys.budgets(month),
    queryFn: () => repo.fetchBudgets(month),
    enabled,
  })
}

export function useBudgetActuals(month?: string) {
  const enabled = useEnabled()
  return useQuery({
    queryKey: queryKeys.budgetActuals(month),
    queryFn: () => repo.fetchBudgetActuals(month),
    enabled,
  })
}

export function useRecurring() {
  const enabled = useEnabled()
  return useQuery({
    queryKey: queryKeys.recurring,
    queryFn: repo.fetchRecurringRules,
    enabled,
  })
}

export function useGoals() {
  const enabled = useEnabled()
  return useQuery({
    queryKey: queryKeys.goals,
    queryFn: repo.fetchGoals,
    enabled,
  })
}

export function useDebts() {
  const enabled = useEnabled()
  return useQuery({
    queryKey: queryKeys.debts,
    queryFn: repo.fetchDebts,
    enabled,
  })
}

export function useDebtBalances() {
  const enabled = useEnabled()
  return useQuery({
    queryKey: queryKeys.debtBalances,
    queryFn: repo.fetchDebtBalances,
    enabled,
  })
}

export function useCashFlow() {
  const enabled = useEnabled()
  return useQuery({
    queryKey: queryKeys.cashFlow,
    queryFn: repo.fetchMonthlyCashFlow,
    enabled,
  })
}

export function useCategorySpending(month?: string) {
  const enabled = useEnabled()
  const m = month ?? monthKey(todayIsoDate())
  return useQuery({
    queryKey: queryKeys.categorySpending(m),
    queryFn: () => repo.fetchCategorySpending(m),
    enabled,
  })
}

export function useNetWorthHistory() {
  const enabled = useEnabled()
  return useQuery({
    queryKey: queryKeys.netWorthHistory,
    queryFn: repo.fetchNetWorthHistory,
    enabled,
  })
}

/** Active rules with next due date as of Manila today, soonest first (max 5). */
export function upcomingRecurringRules(
  rules: readonly RecurringRule[],
  asOf: string = todayIsoDate(),
): Array<RecurringRule & { nextDueOn: string }> {
  return rules
    .filter((r) => r.status === 'active')
    .map((r) => {
      const nextDueOn = nextDueOccurrence({
        startDate: r.startDate,
        endDate: r.endDate,
        frequency: r.frequency,
        interval: r.intervalCount,
        asOf,
        lastMaterialized: r.lastMaterializedOn,
      })
      return nextDueOn ? { ...r, nextDueOn } : null
    })
    .filter((r): r is RecurringRule & { nextDueOn: string } => r != null)
    .sort((a, b) => a.nextDueOn.localeCompare(b.nextDueOn))
    .slice(0, 5)
}

export function useDashboardData() {
  const accounts = useAccounts()
  const balances = useAccountBalances()
  const cashFlow = useCashFlow()
  const categorySpending = useCategorySpending()
  const budgetActuals = useBudgetActuals(monthKey(todayIsoDate()))
  const goals = useGoals()
  const debts = useDebts()
  const debtBalances = useDebtBalances()
  const recurring = useRecurring()
  const netWorthHistory = useNetWorthHistory()

  const isLoading =
    accounts.isLoading ||
    balances.isLoading ||
    cashFlow.isLoading ||
    categorySpending.isLoading ||
    budgetActuals.isLoading ||
    goals.isLoading ||
    debts.isLoading ||
    debtBalances.isLoading ||
    recurring.isLoading ||
    netWorthHistory.isLoading

  const error =
    accounts.error ||
    balances.error ||
    cashFlow.error ||
    categorySpending.error ||
    budgetActuals.error ||
    goals.error ||
    debts.error ||
    debtBalances.error ||
    recurring.error ||
    netWorthHistory.error

  const balanceMap = new Map((balances.data ?? []).map((b) => [b.accountId, b.balanceMinor]))
  const accountsWithBal =
    accounts.data?.map((a: Account) => ({
      type: a.type,
      balanceMinor: balanceMap.get(a.id) ?? a.openingBalanceMinor,
    })) ?? []

  const netWorth = computeNetWorth(accountsWithBal)
  // Complete month aggregates from the view — not the 500-row transaction list.
  const currentMonth = monthKey(todayIsoDate())
  const monthFlow = (cashFlow.data ?? []).find((c) => c.month === currentMonth)
  const income = monthFlow?.incomeMinor ?? 0
  const expenses = monthFlow?.expenseMinor ?? 0
  const rate = savingsRate(income, expenses)
  const budgetTotal = (budgetActuals.data ?? []).reduce((s, b) => s + b.budgetMinor, 0)
  const budgetSpent = (budgetActuals.data ?? []).reduce((s, b) => s + b.spentMinor, 0)
  const debtTotal = (debtBalances.data ?? []).reduce((s, d) => s + d.balanceMinor, 0)
  const debtDue = (debtBalances.data ?? []).reduce((s, d) => s + d.minimumPaymentMinor, 0)
  const upcoming = upcomingRecurringRules(recurring.data ?? [])

  function refetchAll() {
    void accounts.refetch()
    void balances.refetch()
    void cashFlow.refetch()
    void categorySpending.refetch()
    void budgetActuals.refetch()
    void goals.refetch()
    void debts.refetch()
    void debtBalances.refetch()
    void recurring.refetch()
    void netWorthHistory.refetch()
  }

  return {
    isLoading,
    error,
    refetchAll,
    netWorth,
    income,
    expenses,
    savingsRate: rate,
    budgetTotal,
    budgetSpent,
    budgetActuals: budgetActuals.data ?? [],
    goals: goals.data ?? [],
    debtTotal,
    debtDue,
    debtBalances: debtBalances.data ?? [],
    recurring: recurring.data ?? [],
    upcoming,
    cashFlow: cashFlow.data ?? [],
    categorySpending: categorySpending.data ?? [],
    netWorthHistory: netWorthHistory.data ?? [],
    accounts: accounts.data ?? [],
    balances: balances.data ?? [],
  }
}

export function useInvalidateFinance() {
  const qc = useQueryClient()
  return async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.accounts }),
      qc.invalidateQueries({ queryKey: queryKeys.accountBalances }),
      qc.invalidateQueries({ queryKey: ['transactions'] }),
      qc.invalidateQueries({ queryKey: ['budgets'] }),
      qc.invalidateQueries({ queryKey: ['budget-actuals'] }),
      qc.invalidateQueries({ queryKey: queryKeys.recurring }),
      qc.invalidateQueries({ queryKey: queryKeys.goals }),
      qc.invalidateQueries({ queryKey: queryKeys.debts }),
      qc.invalidateQueries({ queryKey: queryKeys.debtBalances }),
      qc.invalidateQueries({ queryKey: queryKeys.cashFlow }),
      qc.invalidateQueries({ queryKey: ['category-spending'] }),
      qc.invalidateQueries({ queryKey: queryKeys.netWorthHistory }),
      qc.invalidateQueries({ queryKey: queryKeys.categories }),
    ])
  }
}

export function useCreateAccount() {
  const invalidate = useInvalidateFinance()
  return useMutation({
    mutationFn: repo.createAccount,
    onSuccess: () => invalidate(),
  })
}

export function useCreateTransaction() {
  const invalidate = useInvalidateFinance()
  return useMutation({
    mutationFn: repo.createTransaction,
    onSuccess: () => invalidate(),
  })
}

export function useDeleteTransaction() {
  const invalidate = useInvalidateFinance()
  return useMutation({
    mutationFn: repo.deleteTransaction,
    onSuccess: () => invalidate(),
  })
}

export function useCreateBudget() {
  const invalidate = useInvalidateFinance()
  return useMutation({
    mutationFn: repo.createBudget,
    onSuccess: () => invalidate(),
  })
}

export function useCreateRecurring() {
  const invalidate = useInvalidateFinance()
  return useMutation({
    mutationFn: repo.createRecurringRule,
    onSuccess: () => invalidate(),
  })
}

export function useUpdateRecurring() {
  const invalidate = useInvalidateFinance()
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string
      patch: Parameters<typeof repo.updateRecurringRule>[1]
    }) => repo.updateRecurringRule(id, patch),
    onSuccess: () => invalidate(),
  })
}

export function useMaterializeRecurring() {
  const invalidate = useInvalidateFinance()
  return useMutation({
    mutationFn: () => repo.materializeRecurring(),
    onSuccess: () => invalidate(),
  })
}

export function useCreateGoal() {
  const invalidate = useInvalidateFinance()
  return useMutation({
    mutationFn: repo.createGoal,
    onSuccess: () => invalidate(),
  })
}

export function useAddContribution() {
  const invalidate = useInvalidateFinance()
  return useMutation({
    mutationFn: repo.addContribution,
    onSuccess: () => invalidate(),
  })
}

export function useCreateDebt() {
  const invalidate = useInvalidateFinance()
  return useMutation({
    mutationFn: repo.createDebt,
    onSuccess: () => invalidate(),
  })
}

export function useCreateCategory() {
  const invalidate = useInvalidateFinance()
  return useMutation({
    mutationFn: repo.createCategory,
    onSuccess: () => invalidate(),
  })
}
