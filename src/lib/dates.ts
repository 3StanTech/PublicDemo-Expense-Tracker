import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfMonth,
  format,
  getDaysInMonth,
  isAfter,
  isBefore,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
} from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { DEFAULT_TIMEZONE } from './money'

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

export function nowInManila(date: Date = new Date()): Date {
  return toZonedTime(date, DEFAULT_TIMEZONE)
}

export function todayIsoDate(date: Date = new Date()): string {
  return format(nowInManila(date), 'yyyy-MM-dd')
}

export function monthKey(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'yyyy-MM')
}

export function parseIsoDate(value: string): Date {
  const d = parseISO(value)
  if (!isValid(d)) {
    throw new Error(`Invalid date: ${value}`)
  }
  return startOfDay(d)
}

export function formatDisplayDate(value: string | Date, pattern = 'MMM d, yyyy'): string {
  const d = typeof value === 'string' ? parseISO(value) : value
  return format(d, pattern)
}

export function formatMonthLabel(month: string): string {
  const d = parseISO(`${month}-01`)
  return format(d, 'MMM yyyy')
}

/**
 * Clamp monthly recurrence to the last day of short months.
 * e.g. Jan 31 + 1 month → Feb 28/29, not Mar 3.
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const day = date.getDate()
  const target = addMonths(startOfMonth(date), months)
  const dim = getDaysInMonth(target)
  const clampedDay = Math.min(day, dim)
  return new Date(target.getFullYear(), target.getMonth(), clampedDay)
}

export function nextOccurrence(from: Date, frequency: RecurrenceFrequency, interval: number): Date {
  if (interval < 1) {
    throw new Error('Interval must be at least 1')
  }
  switch (frequency) {
    case 'daily':
      return addDays(from, interval)
    case 'weekly':
      return addWeeks(from, interval)
    case 'monthly':
      return addMonthsClamped(from, interval)
    case 'yearly':
      return addYears(from, interval)
    default: {
      const _exhaustive: never = frequency
      return _exhaustive
    }
  }
}

/** Generate due occurrence dates inclusive of start, up to and including asOf. */
export function generateOccurrences(params: {
  startDate: string
  endDate: string | null
  frequency: RecurrenceFrequency
  interval: number
  asOf: string
  lastMaterialized: string | null
}): string[] {
  const start = parseIsoDate(params.startDate)
  const asOf = parseIsoDate(params.asOf)
  const end = params.endDate ? parseIsoDate(params.endDate) : null
  const after = params.lastMaterialized ? parseIsoDate(params.lastMaterialized) : null

  const results: string[] = []
  let cursor = start

  // Advance past already-materialized dates
  while (after && !isAfter(cursor, after) && !isBefore(cursor, start)) {
    if (end && isAfter(cursor, end)) break
    cursor = nextOccurrence(cursor, params.frequency, params.interval)
    // safety
    if (results.length > 10_000) break
  }

  let guard = 0
  while (!isAfter(cursor, asOf) && guard < 10_000) {
    guard += 1
    if (end && isAfter(cursor, end)) break
    if (!after || isAfter(cursor, after)) {
      results.push(format(cursor, 'yyyy-MM-dd'))
    }
    cursor = nextOccurrence(cursor, params.frequency, params.interval)
  }

  return results
}

export function currentMonthRange(date: Date = new Date()): { start: string; end: string } {
  const zoned = nowInManila(date)
  const start = startOfMonth(zoned)
  const end = endOfMonth(zoned)
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
  }
}

/**
 * Inclusive start and exclusive end for a YYYY-MM month key using calendar arithmetic only.
 * Avoids Date/UTC conversion that can drop the last day under Asia/Manila.
 */
export function monthDateBounds(month: string): { start: string; endExclusive: string } {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error(`Invalid month key: ${month}`)
  }
  const [yearStr, monthStr] = month.split('-')
  const year = Number(yearStr)
  const monthNum = Number(monthStr)
  if (monthNum < 1 || monthNum > 12) {
    throw new Error(`Invalid month key: ${month}`)
  }
  const start = `${month}-01`
  const nextMonth = monthNum === 12 ? 1 : monthNum + 1
  const nextYear = monthNum === 12 ? year + 1 : year
  const endExclusive = `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}-01`
  return { start, endExclusive }
}

/** First occurrence on or after asOf for an active schedule; null if ended. */
export function nextDueOccurrence(params: {
  startDate: string
  endDate: string | null
  frequency: RecurrenceFrequency
  interval: number
  asOf: string
  lastMaterialized: string | null
}): string | null {
  let cursor = parseIsoDate(params.startDate)
  const asOf = parseIsoDate(params.asOf)
  const end = params.endDate ? parseIsoDate(params.endDate) : null
  const lastMaterialized = params.lastMaterialized ? parseIsoDate(params.lastMaterialized) : null
  let guard = 0

  while (
    (isBefore(cursor, asOf) || (lastMaterialized !== null && !isAfter(cursor, lastMaterialized))) &&
    guard < 10_000
  ) {
    guard += 1
    cursor = nextOccurrence(cursor, params.frequency, params.interval)
  }

  if (isBefore(cursor, asOf) || (lastMaterialized !== null && !isAfter(cursor, lastMaterialized))) {
    throw new Error('Recurring schedule exceeds the supported occurrence horizon')
  }

  if (end && isAfter(cursor, end)) return null
  return format(cursor, 'yyyy-MM-dd')
}

export function lastNMonths(n: number, date: Date = new Date()): string[] {
  const zoned = nowInManila(date)
  const keys: string[] = []
  for (let i = n - 1; i >= 0; i -= 1) {
    const m = addMonths(startOfMonth(zoned), -i)
    keys.push(format(m, 'yyyy-MM'))
  }
  return keys
}

export function dueDayForMonth(year: number, monthIndex: number, dueDay: number): Date {
  const dim = getDaysInMonth(new Date(year, monthIndex, 1))
  return new Date(year, monthIndex, Math.min(dueDay, dim))
}

export function toUtcIsoFromManilaDate(dateStr: string): string {
  return fromZonedTime(`${dateStr}T12:00:00`, DEFAULT_TIMEZONE).toISOString()
}
