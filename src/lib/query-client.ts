import { QueryClient } from '@tanstack/react-query'

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: true,
        staleTime: 30_000,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

export const queryKeys = {
  session: ['session'] as const,
  profile: ['profile'] as const,
  accounts: ['accounts'] as const,
  accountBalances: ['account-balances'] as const,
  categories: ['categories'] as const,
  transactions: (filters?: Record<string, string | undefined>) =>
    ['transactions', filters ?? {}] as const,
  budgets: (month?: string) => ['budgets', month ?? 'all'] as const,
  budgetActuals: (month?: string) => ['budget-actuals', month ?? 'all'] as const,
  recurring: ['recurring'] as const,
  goals: ['goals'] as const,
  contributions: (goalId?: string) => ['contributions', goalId ?? 'all'] as const,
  debts: ['debts'] as const,
  debtBalances: ['debt-balances'] as const,
  cashFlow: ['cash-flow'] as const,
  categorySpending: (month?: string) => ['category-spending', month ?? 'current'] as const,
  netWorthHistory: ['net-worth-history'] as const,
  dashboard: ['dashboard'] as const,
}
