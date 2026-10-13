/// <reference types="node" />
import { defineConfig, devices } from '@playwright/test'

const isCI = Boolean(process.env.CI)
// Set by `npm run test:e2e:emulators`: the build then talks to the local Auth and
// Firestore emulators, so never reuse a preview built without it.
const useEmulators = process.env.VITE_FIREBASE_EMULATORS === '1'
const port = 4173
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? 'github' : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    viewport: { width: 390, height: 844 },
    locale: 'en-PH',
    timezoneId: 'Asia/Manila',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    // Production preview matches Cafe public-demo pattern; IndexedDB works under preview.
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !isCI && !useEmulators,
    timeout: 180_000,
  },
})
