import { describe, expect, it } from 'vitest'
import { transactionFormSchema, budgetFormSchema, debtFormSchema } from './forms'

describe('transactionFormSchema', () => {
  it('accepts valid expense', () => {
    const r = transactionFormSchema.safeParse({
      kind: 'expense',
      status: 'posted',
      amount: '12.50',
      occurredOn: '2024-06-01',
      accountId: '550e8400-e29b-41d4-a716-446655440000',
      categoryId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      payee: 'Cafe',
      notes: '',
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.amount).toBe(1250)
  })

  it('requires different accounts for transfer and no category', () => {
    const same = transactionFormSchema.safeParse({
      kind: 'transfer',
      status: 'posted',
      amount: '10.00',
      occurredOn: '2024-06-01',
      accountId: '11111111-1111-1111-1111-111111111111',
      transferAccountId: '11111111-1111-1111-1111-111111111111',
      categoryId: null,
      payee: '',
      notes: '',
    })
    expect(same.success).toBe(false)

    const withCat = transactionFormSchema.safeParse({
      kind: 'transfer',
      status: 'posted',
      amount: '10.00',
      occurredOn: '2024-06-01',
      accountId: '11111111-1111-1111-1111-111111111111',
      transferAccountId: '22222222-2222-2222-2222-222222222222',
      categoryId: '33333333-3333-3333-3333-333333333333',
      payee: '',
      notes: '',
    })
    expect(withCat.success).toBe(false)
  })

  it('rejects over-precise amounts', () => {
    const r = transactionFormSchema.safeParse({
      kind: 'expense',
      status: 'posted',
      amount: '1.234',
      occurredOn: '2024-06-01',
      accountId: '11111111-1111-1111-1111-111111111111',
      payee: '',
      notes: '',
    })
    expect(r.success).toBe(false)
  })
})

describe('budgetFormSchema', () => {
  it('requires positive amount and month', () => {
    const ok = budgetFormSchema.safeParse({
      categoryId: '11111111-1111-1111-1111-111111111111',
      month: '2024-06',
      amount: '5000.00',
    })
    expect(ok.success).toBe(true)

    const bad = budgetFormSchema.safeParse({
      categoryId: '11111111-1111-1111-1111-111111111111',
      month: '2024-13',
      amount: '0',
    })
    expect(bad.success).toBe(false)
  })
})

describe('debtFormSchema', () => {
  it('validates due day and interest bps without a principal field', () => {
    const ok = debtFormSchema.safeParse({
      name: 'Card',
      accountId: '11111111-1111-1111-1111-111111111111',
      interestBps: 1800,
      minimumPayment: '500',
      dueDay: 15,
      notes: '',
    })
    expect(ok.success).toBe(true)
    if (ok.success) {
      expect('principal' in ok.data).toBe(false)
    }

    const badDay = debtFormSchema.safeParse({
      name: 'Card',
      accountId: '11111111-1111-1111-1111-111111111111',
      interestBps: 0,
      minimumPayment: '500',
      dueDay: 32,
      notes: '',
    })
    expect(badDay.success).toBe(false)
  })
})

describe('transactionFormSchema kind field compatibility', () => {
  it('accepts expense after transfer fields are cleared', () => {
    const r = transactionFormSchema.safeParse({
      kind: 'expense',
      status: 'posted',
      amount: '10.00',
      occurredOn: '2024-06-01',
      accountId: '11111111-1111-1111-1111-111111111111',
      transferAccountId: null,
      categoryId: '22222222-2222-2222-2222-222222222222',
      payee: '',
      notes: '',
    })
    expect(r.success).toBe(true)
  })

  it('rejects expense when a leftover transferAccountId remains', () => {
    const r = transactionFormSchema.safeParse({
      kind: 'expense',
      status: 'posted',
      amount: '10.00',
      occurredOn: '2024-06-01',
      accountId: '11111111-1111-1111-1111-111111111111',
      transferAccountId: '22222222-2222-2222-2222-222222222222',
      categoryId: null,
      payee: '',
      notes: '',
    })
    expect(r.success).toBe(false)
  })

  it('accepts transfer after category is cleared', () => {
    const r = transactionFormSchema.safeParse({
      kind: 'transfer',
      status: 'posted',
      amount: '10.00',
      occurredOn: '2024-06-01',
      accountId: '11111111-1111-1111-1111-111111111111',
      transferAccountId: '22222222-2222-2222-2222-222222222222',
      categoryId: null,
      payee: '',
      notes: '',
    })
    expect(r.success).toBe(true)
  })

  it('rejects transfer when a leftover categoryId remains', () => {
    const r = transactionFormSchema.safeParse({
      kind: 'transfer',
      status: 'posted',
      amount: '10.00',
      occurredOn: '2024-06-01',
      accountId: '11111111-1111-1111-1111-111111111111',
      transferAccountId: '22222222-2222-2222-2222-222222222222',
      categoryId: '33333333-3333-3333-3333-333333333333',
      payee: '',
      notes: '',
    })
    expect(r.success).toBe(false)
  })
})
