/// <reference types="node" />
import { expect, test, type Page } from '@playwright/test'

const DEMO_PIN = '123456'
const SEEDED_ACCOUNT = 'Maya Wallet'
const SEEDED_PAYEE = 'Sample Mart'

const FEATURE_PAGES: { path: string; heading: string }[] = [
  { path: '/app', heading: 'Home' },
  { path: '/app/transactions', heading: 'Transactions' },
  { path: '/app/accounts', heading: 'Accounts' },
  { path: '/app/budgets', heading: 'Budgets' },
  { path: '/app/recurring', heading: 'Recurring' },
  { path: '/app/goals', heading: 'Goals' },
  { path: '/app/debts', heading: 'Debts' },
  { path: '/app/reports', heading: 'Reports' },
  { path: '/app/settings', heading: 'Settings' },
]

/** Collect uncaught page errors and console errors; assert empty at end of each test. */
function trackPageHealth(page: Page) {
  const pageErrors: string[] = []
  const consoleErrors: string[] = []

  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })

  return {
    assertClean() {
      expect(pageErrors, `Unexpected page errors:\n${pageErrors.join('\n')}`).toEqual([])
      expect(consoleErrors, `Unexpected console errors:\n${consoleErrors.join('\n')}`).toEqual([])
    },
  }
}

async function unlockDemo(page: Page) {
  await page.goto('/login')
  const pin = page.getByLabel(/PIN/i)
  await expect(pin).toBeVisible()
  await pin.fill(DEMO_PIN)
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page).toHaveURL(/\/app/)
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible()
}

async function clickHeaderAction(page: Page, name: string | RegExp) {
  const action = page.locator('#main-content > div > header').getByRole('button', {
    name,
  })
  await expect(action).toHaveCount(1)
  await action.click()
}

// Vitest include already scopes to src/, but keep Cafe-style guard if collector widens.
if (process.env.VITEST) {
  const vitest = globalThis as unknown as {
    describe: { skip: (title: string, fn: () => void) => void }
    it: (title: string, fn: () => void) => void
  }
  vitest.describe.skip('playwright public-demo smoke (run via npm run test:e2e)', () => {
    vitest.it('placeholder — not executed under Vitest', () => {})
  })
} else {
  test.describe('public demo smoke', () => {
    test('PIN gate unlocks to dashboard with demo banner', async ({ page }) => {
      const health = trackPageHealth(page)

      await page.goto('/login')
      await expect(page.getByText('Fundsicles').first()).toBeVisible()
      await page.getByLabel(/PIN/i).fill(DEMO_PIN)
      await page.getByRole('button', { name: 'Continue' }).click()

      await expect(page).toHaveURL(/\/app\/?$/)
      await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible()
      await expect(
        page.getByRole('status').filter({ hasText: /Public demo/i }),
      ).toBeVisible()
      await expect(
        page.getByRole('status').filter({
          hasText: /fictional|sample data|stored on this device/i,
        }),
      ).toBeVisible()

      health.assertClean()
    })

    test('protected route redirects to login when locked', async ({ page }) => {
      const health = trackPageHealth(page)

      await page.goto('/app/accounts')
      await expect(page).toHaveURL(/\/login/)
      await expect(page.getByLabel(/PIN/i)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible()

      health.assertClean()
    })

    test('core feature pages load without error alerts', async ({ page }) => {
      const health = trackPageHealth(page)
      await unlockDemo(page)

      for (const { path, heading } of FEATURE_PAGES) {
        await page.goto(path)
        await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
        await expect(page.getByRole('alert')).toHaveCount(0)
      }

      health.assertClean()
    })

    test('creates an account from the accounts page', async ({ page }) => {
      const health = trackPageHealth(page)
      await unlockDemo(page)

      await page.goto('/app/accounts')
      await expect(page.getByRole('heading', { name: 'Accounts', exact: true })).toBeVisible()
      await expect(page.getByText(SEEDED_ACCOUNT)).toBeVisible()

      const stamp = Date.now()
      const accountName = `Smoke Cash ${stamp}`
      await clickHeaderAction(page, 'Add account')
      await page.getByLabel('Name').fill(accountName)
      await page.getByLabel('Type').selectOption('cash')
      await page.getByLabel(/Opening balance/i).fill('100.00')
      await page.getByRole('button', { name: /^save$/i }).click()
      await expect(page.getByText(accountName)).toBeVisible({ timeout: 15_000 })

      health.assertClean()
    })

    test('reset demo data restores deterministic seed after a destructive edit', async ({
      page,
    }) => {
      const health = trackPageHealth(page)
      await unlockDemo(page)

      await page.goto('/app/accounts')
      await expect(page.getByText(SEEDED_ACCOUNT)).toBeVisible()

      const stamp = Date.now()
      const tempName = `Temp Reset Probe ${stamp}`
      await clickHeaderAction(page, 'Add account')
      await page.getByLabel('Name').fill(tempName)
      await page.getByLabel('Type').selectOption('cash')
      await page.getByLabel(/Opening balance/i).fill('1.00')
      await page.getByRole('button', { name: /^save$/i }).click()
      await expect(page.getByText(tempName)).toBeVisible({ timeout: 15_000 })

      await page.goto('/app/settings')
      await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
      await page.getByRole('button', { name: /Reset demo data/i }).click()

      // resetDemoData closes storage, deletes IndexedDB, then reloads the current route
      await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible({
        timeout: 15_000,
      })
      await page.goto('/app/accounts')
      await expect(page.getByText(SEEDED_ACCOUNT)).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(tempName)).toHaveCount(0)
      await page.goto('/app/transactions')
      await expect(page.getByText(SEEDED_PAYEE).first()).toBeVisible({ timeout: 15_000 })

      health.assertClean()
    })
  })
}
