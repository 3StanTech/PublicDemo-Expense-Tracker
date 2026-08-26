import type { AccountType, TransactionKind, TransactionStatus } from '@/types/domain'
import { sumMinor } from './money'

export const ASSET_ACCOUNT_TYPES: readonly AccountType[] = [
  'cash',
  'checking',
  'savings',
  'e_wallet',
  'investment',
  'property',
  'asset',
] as const

export const LIABILITY_ACCOUNT_TYPES: readonly AccountType[] = [
  'credit_card',
  'loan',
  'liability',
] as const

export function isAssetType(type: AccountType): boolean {
  return (ASSET_ACCOUNT_TYPES as readonly string[]).includes(type)
}

export function isLiabilityType(type: AccountType): boolean {
  return (LIABILITY_ACCOUNT_TYPES as readonly string[]).includes(type)
}

export interface BalanceInput {
  accountType: AccountType
  openingBalanceMinor: number
  postedInflowsMinor: number
  postedOutflowsMinor: number
}

/** Account balance from opening + posted activity (pending excluded). */
export function computeAccountBalance(input: BalanceInput): number {
  const delta = input.postedInflowsMinor - input.postedOutflowsMinor
  if (isLiabilityType(input.accountType)) {
    // Liabilities: opening is what you owe; inflows reduce debt, outflows increase it
    // Convention: store liability balances as positive "amount owed"
    return input.openingBalanceMinor - delta
  }
  return input.openingBalanceMinor + delta
}

export function computeNetWorth(
  accounts: Array<{ type: AccountType; balanceMinor: number }>,
): number {
  let assets = 0
  let liabilities = 0
  for (const a of accounts) {
    if (isAssetType(a.type)) assets += a.balanceMinor
    else if (isLiabilityType(a.type)) liabilities += a.balanceMinor
  }
  return assets - liabilities
}

export interface CashFlowTx {
  kind: TransactionKind
  amountMinor: number
  status: TransactionStatus
}

/** Income/expense cash flow excludes transfers and pending. */
export function monthlyCashFlow(txs: readonly CashFlowTx[]): {
  incomeMinor: number
  expenseMinor: number
  netMinor: number
} {
  let incomeMinor = 0
  let expenseMinor = 0
  for (const t of txs) {
    if (t.status !== 'posted') continue
    if (t.kind === 'income') incomeMinor += t.amountMinor
    else if (t.kind === 'expense') expenseMinor += t.amountMinor
  }
  return {
    incomeMinor,
    expenseMinor,
    netMinor: incomeMinor - expenseMinor,
  }
}

export function categorySpending(
  txs: Array<{
    kind: TransactionKind
    categoryId: string | null
    amountMinor: number
    status: TransactionStatus
  }>,
): Map<string, number> {
  const map = new Map<string, number>()
  for (const t of txs) {
    if (t.status !== 'posted' || t.kind !== 'expense' || !t.categoryId) continue
    map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amountMinor)
  }
  return map
}

export function budgetUsedPercent(spentMinor: number, budgetMinor: number): number {
  if (budgetMinor <= 0) return 0
  return Math.min(999, Math.round((spentMinor / budgetMinor) * 1000) / 10)
}

export function isOverspent(spentMinor: number, budgetMinor: number): boolean {
  return spentMinor > budgetMinor
}

export function goalProgressPercent(currentMinor: number, targetMinor: number): number {
  if (targetMinor <= 0) return 0
  return Math.min(100, Math.round((currentMinor / targetMinor) * 1000) / 10)
}

export function debtMinimumDueTotal(
  debts: Array<{ minimumPaymentMinor: number; isActive: boolean }>,
): number {
  return sumMinor(debts.filter((d) => d.isActive).map((d) => d.minimumPaymentMinor))
}

export function chartSummaryLines(
  rows: Array<{ label: string; valueMinor: number }>,
  format: (n: number) => string,
): string {
  if (rows.length === 0) return 'No data for this period.'
  return rows.map((r) => `${r.label}: ${format(r.valueMinor)}`).join('; ')
}
