/**
 * Integer minor-unit money helpers.
 * PHP uses 2 decimal places (centavos). Never persist floating-point money.
 */

export const DEFAULT_CURRENCY = 'PHP' as const
export const DEFAULT_LOCALE = 'en-PH' as const
export const DEFAULT_TIMEZONE = 'Asia/Manila' as const
export const MINOR_UNIT_SCALE = 100

const DECIMAL_RE = /^-?\d+(\.\d{1,2})?$/
const TRAILING_ZEROS = /\.?0+$/

export class MoneyParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MoneyParseError'
  }
}

/** Parse a decimal string (e.g. "12.50") into integer minor units. */
export function parseMoneyToMinor(input: string): number {
  const trimmed = input.trim().replace(/,/g, '')
  if (!trimmed) {
    throw new MoneyParseError('Amount is required')
  }
  if (!DECIMAL_RE.test(trimmed)) {
    throw new MoneyParseError('Amount must be a number with at most 2 decimal places (e.g. 12.50)')
  }

  const negative = trimmed.startsWith('-')
  const abs = negative ? trimmed.slice(1) : trimmed
  const [wholePart = '0', fracPart = ''] = abs.split('.')
  const frac = (fracPart + '00').slice(0, 2)
  const minor = Number.parseInt(wholePart, 10) * MINOR_UNIT_SCALE + Number.parseInt(frac, 10)

  if (!Number.isSafeInteger(minor)) {
    throw new MoneyParseError('Amount is too large')
  }

  return negative ? -minor : minor
}

/** Convert minor units to a fixed 2-decimal string without currency symbol. */
export function minorToDecimalString(minor: number): string {
  if (!Number.isInteger(minor)) {
    throw new MoneyParseError('Minor units must be an integer')
  }
  const negative = minor < 0
  const abs = Math.abs(minor)
  const whole = Math.floor(abs / MINOR_UNIT_SCALE)
  const frac = String(abs % MINOR_UNIT_SCALE).padStart(2, '0')
  return `${negative ? '-' : ''}${whole}.${frac}`
}

export function formatMoney(
  minor: number,
  options?: {
    currency?: string
    locale?: string
    signed?: boolean
  },
): string {
  const currency = options?.currency ?? DEFAULT_CURRENCY
  const locale = options?.locale ?? DEFAULT_LOCALE
  const value = minor / MINOR_UNIT_SCALE
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value))

  if (options?.signed) {
    if (minor > 0) return `+${formatted}`
    if (minor < 0) return `−${formatted}`
    return formatted
  }

  if (minor < 0) return `−${formatted}`
  return formatted
}

export function assertPositiveMinor(minor: number, label = 'Amount'): void {
  if (!Number.isInteger(minor) || minor <= 0) {
    throw new MoneyParseError(`${label} must be a positive amount`)
  }
}

export function assertNonNegativeMinor(minor: number, label = 'Amount'): void {
  if (!Number.isInteger(minor) || minor < 0) {
    throw new MoneyParseError(`${label} must be zero or positive`)
  }
}

/** Sum integer minor units safely. */
export function sumMinor(values: readonly number[]): number {
  return values.reduce((acc, v) => {
    if (!Number.isInteger(v)) {
      throw new MoneyParseError('All amounts must be integer minor units')
    }
    return acc + v
  }, 0)
}

export function percentageOf(part: number, whole: number): number {
  if (whole === 0) return 0
  return Math.round((part / whole) * 1000) / 10
}

export function savingsRate(incomeMinor: number, expenseMinor: number): number {
  if (incomeMinor <= 0) return 0
  const saved = incomeMinor - expenseMinor
  return Math.round((saved / incomeMinor) * 1000) / 10
}

/** Normalize user input that may include currency symbols for display only. */
export function stripCurrencyDecorators(input: string): string {
  return input
    .replace(/[₱$€£,\s]/g, '')
    .replace(TRAILING_ZEROS, (m, _o, s) => (s.includes('.') ? m : ''))
}
