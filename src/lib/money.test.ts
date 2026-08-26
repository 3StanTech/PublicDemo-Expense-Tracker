import { describe, expect, it } from 'vitest'
import {
  formatMoney,
  minorToDecimalString,
  parseMoneyToMinor,
  percentageOf,
  savingsRate,
  sumMinor,
  MoneyParseError,
} from './money'

describe('parseMoneyToMinor', () => {
  it('parses whole and fractional amounts', () => {
    expect(parseMoneyToMinor('12')).toBe(1200)
    expect(parseMoneyToMinor('12.5')).toBe(1250)
    expect(parseMoneyToMinor('12.50')).toBe(1250)
    expect(parseMoneyToMinor('0.01')).toBe(1)
  })

  it('rejects invalid and over-precise values', () => {
    expect(() => parseMoneyToMinor('')).toThrow(MoneyParseError)
    expect(() => parseMoneyToMinor('12.345')).toThrow(MoneyParseError)
    expect(() => parseMoneyToMinor('abc')).toThrow(MoneyParseError)
  })

  it('strips common grouping commas when present in input after strip', () => {
    expect(parseMoneyToMinor('1,250.50'.replace(/,/g, ''))).toBe(125050)
  })
})

describe('minorToDecimalString & formatMoney', () => {
  it('round-trips minor units', () => {
    expect(minorToDecimalString(1250)).toBe('12.50')
    expect(minorToDecimalString(0)).toBe('0.00')
  })

  it('formats PHP with locale', () => {
    const s = formatMoney(150050)
    expect(s).toMatch(/1,500\.50|1500\.50/)
    expect(s).toMatch(/₱|PHP/)
  })

  it('supports signed formatting', () => {
    expect(formatMoney(100, { signed: true })).toMatch(/^\+/)
    expect(formatMoney(-100, { signed: true })).toMatch(/^−/)
  })
})

describe('aggregates', () => {
  it('sums minor units', () => {
    expect(sumMinor([100, 200, 3])).toBe(303)
  })

  it('computes savings rate', () => {
    expect(savingsRate(10000, 4000)).toBe(60)
    expect(savingsRate(0, 100)).toBe(0)
  })

  it('percentageOf', () => {
    expect(percentageOf(25, 100)).toBe(25)
    expect(percentageOf(1, 0)).toBe(0)
  })
})
