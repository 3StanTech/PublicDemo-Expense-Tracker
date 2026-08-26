# Fundsicles — Expense Tracker

Mobile-first personal finance demo. Track accounts, transactions, budgets, recurring rules, goals, debts, and reports on a phone-friendly layout.

## What this build is

This is a **local-only public demo with no backend** and **no hosted database**. Sample data is generated in the browser and stored only in the visitor’s IndexedDB. Nothing is sent to a server or external API.

- **PIN:** `123456`
- The PIN is a **UI demonstration, not a security boundary**. It ships in the client bundle in plain text. There is nothing real behind it.
- **Reset demo data** in Settings restores the sample data and discards local edits.

## Stack

- Vite + React + TypeScript (strict)
- React Router, TanStack Query
- IndexedDB via `idb` (local-only storage)
- React Hook Form + Zod, date-fns, Recharts, Tailwind CSS v4
- Vitest, Testing Library, Playwright

Money is stored as **integer minor units** (centavos).

## Requirements

- Node.js 20+
- npm

No environment variables are required.

## Commands

```sh
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run check
npm run test:e2e
npm run check:bundle
npm run check:public-safe
npm run preview
```

`npm run test:e2e` needs Playwright browsers installed once (`npx playwright install --with-deps chromium`).

`npm run check` runs lint, unit tests, production build, bundle budget, public-safety scan, and e2e smoke.

## Hosting

- **Vercel**: `vercel.json` — SPA rewrites + security headers
- **Netlify**: `netlify.toml` + `public/_redirects` SPA fallback
