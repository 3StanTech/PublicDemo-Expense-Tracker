import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const UID = 'visitor-one'
const PROFILE = `demos/${UID}`
const TX_ID = 'a1000001-0001-4000-8000-000000000001'
const TX = `transactions~${TX_ID}`
const ACCOUNT = 'accounts~c2000002-0002-4000-8000-000000000003'
const old = () => Timestamp.fromMillis(Date.now() - 10_000)

const COLLECTIONS = [
  'profiles',
  'categories',
  'accounts',
  'transactions',
  'budgets',
  'recurringRules',
  'savingsGoals',
  'goalContributions',
  'debts',
]

/** A fictional transaction row in the domain shape the app stores. */
const transaction = (overrides: DocumentData = {}): DocumentData => ({
  id: TX_ID,
  userId: UID,
  kind: 'expense',
  status: 'posted',
  amountMinor: 12_500,
  occurredOn: '2026-09-01',
  accountId: 'c2000002-0002-4000-8000-000000000003',
  transferAccountId: null,
  categoryId: 'b1000001-0001-4000-8000-000000000004',
  payee: 'Sample Mart',
  notes: null,
  recurringRuleId: null,
  createdAt: '2026-09-01T04:00:00.000Z',
  updatedAt: '2026-09-01T04:00:00.000Z',
  ...overrides,
})

const TS = '2026-06-01T04:00:00.000Z'
const USER = '00000000-0000-4000-8000-000000000001'

/**
 * One full record per collection, shaped like the src/demo/seed.ts rows
 * (fictional values), so the suite exercises realistic record sizes.
 */
const RECORDS: Record<string, DocumentData> = {
  profiles: {
    id: USER,
    displayName: 'Demo Explorer',
    currency: 'PHP',
    locale: 'en-PH',
    timezone: 'Asia/Manila',
    createdAt: TS,
    updatedAt: TS,
  },
  categories: {
    id: 'b1000001-0001-4000-8000-000000000004',
    userId: USER,
    name: 'Groceries',
    kind: 'expense',
    color: '#ea580c',
    icon: null,
    isArchived: false,
    createdAt: TS,
    updatedAt: TS,
  },
  accounts: {
    id: 'c2000002-0002-4000-8000-000000000001',
    userId: USER,
    name: 'Wallet Cash',
    type: 'cash',
    currency: 'PHP',
    openingBalanceMinor: 500_000,
    isArchived: false,
    archivedAt: null,
    notes: 'Everyday pocket money',
    createdAt: TS,
    updatedAt: TS,
  },
  transactions: transaction(),
  budgets: {
    id: 'g7000007-0007-4000-8000-000000000001',
    userId: USER,
    categoryId: 'b1000001-0001-4000-8000-000000000004',
    month: '2026-08',
    amountMinor: 800_000,
    createdAt: TS,
    updatedAt: TS,
  },
  recurringRules: {
    id: 'f5000005-0005-4000-8000-000000000001',
    userId: USER,
    name: 'Rent — Sample Unit',
    kind: 'expense',
    amountMinor: 1_800_000,
    accountId: 'c2000002-0002-4000-8000-000000000002',
    transferAccountId: null,
    categoryId: 'b1000001-0001-4000-8000-000000000003',
    payee: 'Rent — Sample Unit',
    notes: null,
    frequency: 'monthly',
    intervalCount: 1,
    startDate: '2026-06-01',
    endDate: null,
    status: 'active',
    lastMaterializedOn: '2026-08-01',
    createdAt: TS,
    updatedAt: TS,
  },
  savingsGoals: {
    id: 'd3000003-0003-4000-8000-000000000001',
    userId: USER,
    name: 'Emergency fund',
    targetAmountMinor: 15_000_000,
    currentAmountMinor: 4_500_000,
    targetDate: '2027-03-31',
    notes: '3-month buffer target',
    isArchived: false,
    createdAt: TS,
    updatedAt: TS,
  },
  goalContributions: {
    id: 'h8000008-0008-4000-8000-000000000001',
    userId: USER,
    goalId: 'd3000003-0003-4000-8000-000000000001',
    amountMinor: 2_000_000,
    contributedOn: '2026-06-20',
    notes: 'Opening contribution',
    createdAt: TS,
  },
  debts: {
    id: 'e4000004-0004-4000-8000-000000000001',
    userId: USER,
    name: 'Sample Credit Card',
    accountId: 'c2000002-0002-4000-8000-000000000005',
    originalPrincipalMinor: 1_850_000,
    interestBps: 2400,
    minimumPaymentMinor: 250_000,
    dueDay: 18,
    notes: 'Linked to Sample Credit Card liability account',
    isActive: true,
    createdAt: TS,
    updatedAt: TS,
  },
}

/** Every collection with free text, set to its byte caps (multibyte where it fits exactly). */
const AT_CAPS: Record<string, DocumentData> = {
  profiles: { displayName: '€'.repeat(166) + 'xx' },
  categories: { name: 'n'.repeat(500) },
  accounts: { name: 'n'.repeat(500), notes: '€'.repeat(666) + 'xx' },
  transactions: { payee: 'p'.repeat(500), notes: 'x'.repeat(2000) },
  budgets: {},
  recurringRules: { name: 'n'.repeat(500), payee: 'p'.repeat(500), notes: 'x'.repeat(2000) },
  savingsGoals: { name: 'n'.repeat(500), notes: 'x'.repeat(2000) },
  goalContributions: { notes: 'x'.repeat(2000) },
  debts: { name: 'n'.repeat(500), notes: 'x'.repeat(2000) },
}

const recordId = (name: string) => `${name}~${RECORDS[name]!.id as string}`

const live = (record: DocumentData = transaction(), name = 'transactions'): DocumentData => ({
  collection: name,
  deleted: false,
  record,
  updatedAt: serverTimestamp(),
})

const tombstone = (name: string): DocumentData => ({
  collection: name,
  deleted: true,
  updatedAt: serverTimestamp(),
})

let environment: RulesTestEnvironment

type Firestore = ReturnType<ReturnType<RulesTestEnvironment['authenticatedContext']>['firestore']>

beforeAll(async () => {
  // Never contact a live database if this suite is invoked without the CLI.
  const address = process.env.FIRESTORE_EMULATOR_HOST
  if (!address) throw new Error('Run this suite with npm run test:rules (Firestore emulator required).')
  const separator = address.lastIndexOf(':')
  const host = address.slice(0, separator)
  const port = Number(address.slice(separator + 1))
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(host) || !Number.isInteger(port) || port <= 0) {
    throw new Error('Rules tests require a local Firestore emulator.')
  }
  environment = await initializeTestEnvironment({
    projectId: 'demo-fundsicles-rules',
    firestore: { host, port, rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  })
})
beforeEach(async () => {
  await environment.clearFirestore()
})
afterAll(async () => {
  await environment?.cleanup()
})

function visitor(uid: string | null = UID): Firestore {
  return uid === null
    ? environment.unauthenticatedContext().firestore()
    : environment.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore()
}

const changePath = (id: string, uid = UID) => `demos/${uid}/changes/${id}`

async function seed(path: string, data: DocumentData) {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), data)
  })
}

async function seedProfile(writes = 1, docs = 1, last = ACCOUNT) {
  await seed(PROFILE, { createdAt: old(), updatedAt: old(), writes, docs, last })
}

async function seedChange(id: string, data: DocumentData = { ...live(), updatedAt: old() }) {
  await seed(changePath(id), data)
}

async function exists(path: string): Promise<boolean> {
  let found = false
  await environment.withSecurityRulesDisabled(async (context) => {
    found = (await getDoc(doc(context.firestore(), path))).exists()
  })
  return found
}

/** The visitor's first batch: create the profile and one change doc. */
function firstWrite(db: Firestore, id: string, data: DocumentData, profile: DocumentData = {}) {
  const batch = writeBatch(db)
  batch.set(doc(db, changePath(id)), data)
  batch.set(doc(db, PROFILE), {
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    writes: 1,
    docs: 1,
    last: id,
    ...profile,
  })
  return batch.commit()
}

/** A later batch the way the app writes it: one change doc + the profile step. */
function write(db: Firestore, id: string, data: DocumentData, create: boolean, profile: DocumentData = {}) {
  const batch = writeBatch(db)
  batch.set(doc(db, changePath(id)), data)
  batch.update(doc(db, PROFILE), {
    writes: increment(1),
    ...(create ? { docs: increment(1) } : {}),
    last: id,
    updatedAt: serverTimestamp(),
    ...profile,
  })
  return batch.commit()
}

describe('own visitor', () => {
  it('creates the profile with the first change doc and reads both back', async () => {
    const db = visitor()
    await assertSucceeds(firstWrite(db, TX, live()))
    await assertSucceeds(getDoc(doc(db, PROFILE)))
    await assertSucceeds(getDoc(doc(db, changePath(TX))))
    await assertSucceeds(getDocs(collection(db, 'demos', UID, 'changes')))
    const profile = (await getDoc(doc(db, PROFILE))).data()
    expect(profile).toMatchObject({ writes: 1, docs: 1, last: TX })
  })

  it('creates a change doc in every allowed collection, including tombstones', async () => {
    await seedProfile()
    const db = visitor()
    for (const name of COLLECTIONS) {
      await assertSucceeds(write(db, `${name}~x-${name.length}`, tombstone(name), true))
    }
    await assertSucceeds(write(db, TX, live(), true))
  })

  it('updates an existing change doc with one write step and no docs step', async () => {
    await seedProfile(5, 2, ACCOUNT)
    await seedChange(TX)
    const db = visitor()
    await assertSucceeds(write(db, TX, live(transaction({ amountMinor: 9_900 })), false))
    await assertSucceeds(write(db, TX, tombstone('transactions'), false))
  })

  it('lets a reset batch of 100 deletes (the client batch size) spend one write step', async () => {
    const ids = Array.from({ length: 100 }, (_, index) => `transactions~reset-${index}`)
    await seedProfile(110, ids.length)
    for (const id of ids) await seedChange(id)
    const db = visitor()
    const batch = writeBatch(db)
    for (const id of ids) batch.delete(doc(db, changePath(id)))
    batch.update(doc(db, PROFILE), { writes: increment(1), updatedAt: serverTimestamp() })
    await assertSucceeds(batch.commit())
    for (const id of ids) expect(await exists(changePath(id))).toBe(false)
    const profile = (await getDoc(doc(db, PROFILE))).data()
    expect(profile).toMatchObject({ writes: 111, docs: ids.length })
  })
})

describe.each(COLLECTIONS)('full %s record', (name) => {
  const id = recordId(name)

  it('is accepted on the first write, a later create and an update', async () => {
    const db = visitor()
    await assertSucceeds(firstWrite(db, id, live(RECORDS[name], name)))
    await assertSucceeds(write(db, ACCOUNT, tombstone('accounts'), true))
    await assertSucceeds(write(db, id, live({ ...RECORDS[name], ...AT_CAPS[name] }, name), false))
  })

  it('is accepted at its free-text caps on create', async () => {
    await seedProfile()
    await assertSucceeds(write(visitor(), id, live({ ...RECORDS[name], ...AT_CAPS[name] }, name), true))
  })

  it('is denied one byte over a free-text cap, with a foreign key, or under another collection', async () => {
    await seedProfile()
    const db = visitor()
    for (const [key, value] of Object.entries(AT_CAPS[name]!)) {
      await assertFails(write(db, id, live({ ...RECORDS[name], [key]: `${value as string}x` }, name), true))
    }
    await assertFails(write(db, id, live({ ...RECORDS[name], frequency: 'monthly', goalId: 'g-1' }, name), true))
    const other = name === 'debts' ? 'budgets' : 'debts'
    await assertFails(write(db, `${other}~${RECORDS[name]!.id as string}`, live(RECORDS[name], other), true))
  })
})

describe('other visitors', () => {
  it.each(['visitor-two', null])('denies reads and writes on another visitor (%s)', async (uid) => {
    await seedProfile()
    await seedChange(TX)
    const db = visitor(uid)
    await assertFails(getDoc(doc(db, PROFILE)))
    await assertFails(getDoc(doc(db, changePath(TX))))
    await assertFails(getDocs(collection(db, 'demos', UID, 'changes')))
    await assertFails(write(db, ACCOUNT, tombstone('accounts'), true))
    await assertFails(write(db, TX, live(), false))
    await assertFails(updateDoc(doc(db, PROFILE), { writes: increment(1), updatedAt: serverTimestamp() }))
    await assertFails(deleteDoc(doc(db, changePath(TX))))
    await assertFails(deleteDoc(doc(db, PROFILE)))
  })

  it('denies writing under another uid even in a self-consistent batch', async () => {
    const db = visitor('visitor-two')
    const batch = writeBatch(db)
    batch.set(doc(db, changePath(TX)), live())
    batch.set(doc(db, PROFILE), {
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      writes: 1,
      docs: 1,
      last: TX,
    })
    await assertFails(batch.commit())
  })

  it('denies anything outside demos/{uid}', async () => {
    await seedProfile()
    const db = visitor()
    await assertFails(setDoc(doc(db, 'other/thing'), { a: 1 }))
    await assertFails(getDoc(doc(db, 'other/thing')))
    await assertFails(getDocs(collection(db, 'demos')))
    await assertFails(setDoc(doc(db, `${PROFILE}/unknown/x`), { a: 1 }))
    await assertFails(getDoc(doc(db, `${PROFILE}/unknown/x`)))
    await assertFails(setDoc(doc(db, `${changePath(TX)}/nested/y`), { a: 1 }))
  })
})

describe('write budget', () => {
  it('denies a change doc without the profile step', async () => {
    await seedProfile()
    await seedChange(TX)
    const db = visitor()
    await assertFails(setDoc(doc(db, changePath(ACCOUNT)), tombstone('accounts')))
    await assertFails(setDoc(doc(db, changePath(TX)), live()))
    await assertFails(deleteDoc(doc(db, changePath(TX))))
  })

  it('denies a batch that does not raise writes by exactly one', async () => {
    await seedProfile(5, 1)
    await seedChange(TX)
    const db = visitor()
    await assertFails(write(db, ACCOUNT, tombstone('accounts'), true, { writes: 5 }))
    await assertFails(write(db, ACCOUNT, tombstone('accounts'), true, { writes: 7 }))
    await assertFails(write(db, TX, live(), false, { writes: 5 }))
    const batch = writeBatch(db)
    batch.delete(doc(db, changePath(TX)))
    batch.update(doc(db, PROFILE), { writes: 7, updatedAt: serverTimestamp() })
    await assertFails(batch.commit())
  })

  it('denies a create that does not raise docs by exactly one', async () => {
    await seedProfile(5, 1)
    const db = visitor()
    await assertFails(write(db, ACCOUNT, tombstone('accounts'), false))
    await assertFails(write(db, ACCOUNT, tombstone('accounts'), true, { docs: 3 }))
  })

  it('denies a first write whose profile does not start at one', async () => {
    const db = visitor()
    await assertFails(firstWrite(db, TX, live(), { writes: 0 }))
    await assertFails(firstWrite(db, TX, live(), { writes: 2 }))
    await assertFails(firstWrite(db, TX, live(), { docs: 0 }))
    await assertFails(firstWrite(db, TX, live(), { createdAt: old() }))
    await assertFails(firstWrite(db, TX, live(), { unexpected: true }))
  })

  it('denies writes past the 1000-batch cap and allows the last one', async () => {
    await seedProfile(999, 10)
    const db = visitor()
    await assertSucceeds(write(db, ACCOUNT, tombstone('accounts'), true))
    await assertFails(write(db, TX, live(), true))
    await seedChange(TX)
    await assertFails(write(db, TX, live(), false))
    const batch = writeBatch(db)
    batch.delete(doc(db, changePath(TX)))
    batch.update(doc(db, PROFILE), { writes: increment(1), updatedAt: serverTimestamp() })
    await assertFails(batch.commit())
  })

  it('denies change-doc creates past the 500-doc cap and allows the last one', async () => {
    await seedProfile(600, 499)
    const db = visitor()
    await assertSucceeds(write(db, ACCOUNT, tombstone('accounts'), true))
    await assertFails(write(db, TX, live(), true))
  })

  it('denies resetting the budget by deleting or recreating the profile', async () => {
    await seedProfile(1000, 500)
    const db = visitor()
    await assertFails(deleteDoc(doc(db, PROFILE)))
    await assertFails(firstWrite(db, TX, live()))
    await assertFails(updateDoc(doc(db, PROFILE), { writes: 1, updatedAt: serverTimestamp() }))
  })

  it('denies changing createdAt or forging updatedAt on the profile', async () => {
    await seedProfile()
    const db = visitor()
    await assertFails(write(db, ACCOUNT, tombstone('accounts'), true, { createdAt: serverTimestamp() }))
    await assertFails(write(db, ACCOUNT, tombstone('accounts'), true, { updatedAt: old() }))
  })
})

describe('one change doc per batch', () => {
  it('denies two change-doc updates in one batch with one write step', async () => {
    await seedProfile(5, 2)
    await seedChange(TX)
    await seedChange(ACCOUNT, { ...tombstone('accounts'), updatedAt: old() })
    const db = visitor()
    const batch = writeBatch(db)
    batch.set(doc(db, changePath(TX)), live(transaction({ amountMinor: 1 })))
    batch.set(doc(db, changePath(ACCOUNT)), tombstone('accounts'))
    batch.update(doc(db, PROFILE), { writes: increment(1), last: ACCOUNT, updatedAt: serverTimestamp() })
    await assertFails(batch.commit())
    const saved = (await getDoc(doc(db, changePath(TX)))).data()
    expect(saved?.record?.amountMinor).toBe(12_500)
  })

  it('denies two change-doc creates in one batch that share one docs step', async () => {
    await seedProfile()
    const db = visitor()
    const batch = writeBatch(db)
    batch.set(doc(db, changePath(TX)), live())
    batch.set(doc(db, changePath(ACCOUNT)), tombstone('accounts'))
    batch.update(doc(db, PROFILE), {
      writes: increment(1),
      docs: increment(1),
      last: ACCOUNT,
      updatedAt: serverTimestamp(),
    })
    await assertFails(batch.commit())
    expect(await exists(changePath(TX))).toBe(false)
    expect(await exists(changePath(ACCOUNT))).toBe(false)
  })

  it('denies a create or update whose last names another document', async () => {
    await seedProfile()
    await seedChange(TX)
    const db = visitor()
    await assertFails(write(db, ACCOUNT, tombstone('accounts'), true, { last: TX }))
    await assertFails(write(db, TX, live(), false, { last: ACCOUNT }))
    await assertFails(write(db, TX, live(), false, { last: '' }))
  })
})

describe('change doc shape', () => {
  beforeEach(async () => {
    await seedProfile()
  })

  it('denies a collection outside the nine names', async () => {
    const db = visitor()
    await assertFails(write(db, 'widgets~w-1', tombstone('widgets'), true))
    await assertFails(write(db, 'widgets~w-1', live(transaction(), 'widgets'), true))
  })

  it('denies a collection field that does not match the doc ID', async () => {
    await assertFails(write(visitor(), TX, live(transaction(), 'accounts'), true))
  })

  it('denies malformed doc IDs', async () => {
    const db = visitor()
    for (const id of [TX_ID, `transactions~${'a'.repeat(65)}`, 'transactions~has space', 'transactions~a~b', 'transactions~']) {
      await assertFails(write(db, id, tombstone('transactions'), true))
    }
  })

  it('denies a record whose id differs from the doc ID', async () => {
    await assertFails(write(visitor(), TX, live(transaction({ id: 'a1000001-0001-4000-8000-000000000999' })), true))
  })

  it('denies extra fields, a missing record and a tombstone with a record', async () => {
    const db = visitor()
    await assertFails(write(db, TX, { ...live(), unexpected: true }, true))
    const missing = live()
    delete missing.record
    await assertFails(write(db, TX, missing, true))
    await assertFails(write(db, TX, { ...live(), deleted: true }, true))
    await assertFails(write(db, TX, { ...live(), deleted: 'no' }, true))
  })

  it('denies an omitted or forged updatedAt', async () => {
    const db = visitor()
    const omitted = live()
    delete omitted.updatedAt
    await assertFails(write(db, TX, omitted, true))
    await assertFails(write(db, TX, { ...live(), updatedAt: old() }, true))
    await assertFails(write(db, TX, { ...live(), updatedAt: Timestamp.fromMillis(Date.now() + 60_000) }, true))
  })

  it('accepts free text at its byte limits', async () => {
    await assertSucceeds(
      write(visitor(), TX, live(transaction({ notes: 'x'.repeat(2000), payee: 'p'.repeat(500) })), true),
    )
  })

  it('denies an oversize record', async () => {
    const db = visitor()
    const oversize: DocumentData[] = [
      { notes: 'x'.repeat(2001) },
      { notes: '€'.repeat(667) },
      { payee: 'p'.repeat(501) },
      { occurredOn: '2'.repeat(65) },
      { goalId: 'd3000003-0003-4000-8000-000000000001' },
      { unexpectedKey: 'x' },
      { notes: { nested: 'map' } },
      { notes: ['list'] },
    ]
    for (const override of oversize) {
      await assertFails(write(db, TX, live(transaction(override)), true))
    }
    await assertFails(write(db, TX, live('not a map' as unknown as DocumentData), true))
  })
})
