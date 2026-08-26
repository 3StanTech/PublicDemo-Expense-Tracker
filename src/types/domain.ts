export type CurrencyCode = 'PHP'
export type LocaleCode = 'en-PH'
export type TimezoneId = 'Asia/Manila'

export type CategoryKind = 'income' | 'expense'

export type AccountType =
  | 'cash'
  | 'checking'
  | 'savings'
  | 'e_wallet'
  | 'investment'
  | 'property'
  | 'credit_card'
  | 'loan'
  | 'asset'
  | 'liability'

export type TransactionKind = 'income' | 'expense' | 'transfer'
export type TransactionStatus = 'pending' | 'posted'
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'
export type RecurrenceStatus = 'active' | 'paused'

export interface Profile {
  id: string
  displayName: string | null
  currency: CurrencyCode
  locale: LocaleCode
  timezone: TimezoneId
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: string
  userId: string
  name: string
  kind: CategoryKind
  color: string | null
  icon: string | null
  isArchived: boolean
  createdAt: string
  updatedAt: string
}

export interface Account {
  id: string
  userId: string
  name: string
  type: AccountType
  currency: CurrencyCode
  openingBalanceMinor: number
  isArchived: boolean
  /** Set by the database when archived; null while active. */
  archivedAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface Transaction {
  id: string
  userId: string
  kind: TransactionKind
  status: TransactionStatus
  amountMinor: number
  occurredOn: string
  accountId: string
  transferAccountId: string | null
  categoryId: string | null
  payee: string | null
  notes: string | null
  recurringRuleId: string | null
  createdAt: string
  updatedAt: string
}

export interface Budget {
  id: string
  userId: string
  categoryId: string
  month: string
  amountMinor: number
  createdAt: string
  updatedAt: string
}

export interface RecurringRule {
  id: string
  userId: string
  name: string
  kind: Exclude<TransactionKind, 'transfer'> | 'transfer'
  amountMinor: number
  accountId: string
  transferAccountId: string | null
  categoryId: string | null
  payee: string | null
  notes: string | null
  frequency: RecurrenceFrequency
  intervalCount: number
  startDate: string
  endDate: string | null
  status: RecurrenceStatus
  lastMaterializedOn: string | null
  createdAt: string
  updatedAt: string
}

export interface SavingsGoal {
  id: string
  userId: string
  name: string
  targetAmountMinor: number
  currentAmountMinor: number
  targetDate: string | null
  notes: string | null
  isArchived: boolean
  createdAt: string
  updatedAt: string
}

export interface GoalContribution {
  id: string
  userId: string
  goalId: string
  amountMinor: number
  contributedOn: string
  notes: string | null
  createdAt: string
}

export interface Debt {
  id: string
  userId: string
  name: string
  accountId: string
  /**
   * Historical original principal snapshot only.
   * Current balance always comes from the linked liability account (v_debt_balances).
   */
  originalPrincipalMinor: number
  interestBps: number
  minimumPaymentMinor: number
  dueDay: number
  notes: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface AccountBalance {
  accountId: string
  balanceMinor: number
}

export interface MonthlyCashFlowRow {
  month: string
  incomeMinor: number
  expenseMinor: number
}

export interface CategorySpendRow {
  categoryId: string
  categoryName: string
  amountMinor: number
}

export interface BudgetActualRow {
  budgetId: string
  categoryId: string
  categoryName: string
  month: string
  budgetMinor: number
  spentMinor: number
}

export interface DebtBalanceRow {
  debtId: string
  name: string
  balanceMinor: number
  minimumPaymentMinor: number
  dueDay: number
}

export interface NetWorthPoint {
  asOf: string
  netWorthMinor: number
}
