import { z } from 'zod'
import { parseMoneyToMinor, MoneyParseError } from '@/lib/money'

/** Accept UUID-shaped ids (Postgres gen_random_uuid and common fixtures). */
export const uuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Must be a valid id')

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .refine((v) => {
    const [ys, ms, ds] = v.split('-')
    const y = Number(ys)
    const m = Number(ms)
    const d = Number(ds)
    if (!y || !m || !d) return false
    const dt = new Date(Date.UTC(y, m - 1, d))
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  }, 'Invalid calendar date')

export const monthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM')
  .refine((v) => {
    const [y, m] = v.split('-').map(Number)
    return m !== undefined && m >= 1 && m <= 12 && y !== undefined && y >= 2000
  }, 'Invalid month')

export const nameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(80, 'Name must be at most 80 characters')

export const notesSchema = z
  .string()
  .trim()
  .max(500, 'Notes must be at most 500 characters')
  .optional()
  .or(z.literal(''))
  .transform((v) => (v ? v : null))

export const payeeSchema = z
  .string()
  .trim()
  .max(120, 'Payee must be at most 120 characters')
  .optional()
  .or(z.literal(''))
  .transform((v) => (v ? v : null))

/** Decimal money string → positive integer minor units. */
export const positiveMoneyStringSchema = z
  .string()
  .trim()
  .min(1, 'Amount is required')
  .superRefine((val, ctx) => {
    try {
      const minor = parseMoneyToMinor(val)
      if (minor <= 0) {
        ctx.addIssue({ code: 'custom', message: 'Amount must be greater than zero' })
      }
      if (!Number.isInteger(minor)) {
        ctx.addIssue({ code: 'custom', message: 'Amount must resolve to whole centavos' })
      }
    } catch (e) {
      ctx.addIssue({
        code: 'custom',
        message: e instanceof MoneyParseError ? e.message : 'Invalid amount',
      })
    }
  })
  .transform((val) => parseMoneyToMinor(val))

export const nonNegativeMoneyStringSchema = z
  .string()
  .trim()
  .min(1, 'Amount is required')
  .superRefine((val, ctx) => {
    try {
      const minor = parseMoneyToMinor(val)
      if (minor < 0) {
        ctx.addIssue({ code: 'custom', message: 'Amount cannot be negative' })
      }
    } catch (e) {
      ctx.addIssue({
        code: 'custom',
        message: e instanceof MoneyParseError ? e.message : 'Invalid amount',
      })
    }
  })
  .transform((val) => parseMoneyToMinor(val))

export const positiveMinorSchema = z
  .number()
  .int('Amount must be an integer (minor units)')
  .positive('Amount must be greater than zero')

export const nonNegativeMinorSchema = z
  .number()
  .int('Amount must be an integer (minor units)')
  .nonnegative('Amount cannot be negative')

export const emailSchema = z.string().trim().email('Enter a valid email address').max(254)
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')

export const accountTypeSchema = z.enum([
  'cash',
  'checking',
  'savings',
  'e_wallet',
  'investment',
  'property',
  'credit_card',
  'loan',
  'asset',
  'liability',
])

export const categoryKindSchema = z.enum(['income', 'expense'])
export const transactionKindSchema = z.enum(['income', 'expense', 'transfer'])
export const transactionStatusSchema = z.enum(['pending', 'posted'])
export const frequencySchema = z.enum(['daily', 'weekly', 'monthly', 'yearly'])
export const recurrenceStatusSchema = z.enum(['active', 'paused'])
