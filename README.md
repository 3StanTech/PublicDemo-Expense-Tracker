# Fundsicles — Expense Tracker

Mobile-first personal finance demo. Track accounts, transactions, budgets, recurring rules, goals, debts, and reports on a phone-friendly layout.

**Live demo:** https://fundsicles-demo.web.app

Demo only. All data is fictional sample data for a made-up peso household.

## What this build is

The sample data is generated in the browser when a visitor opens the app. Edits are saved to Firebase under an anonymous visitor ID, so they survive reloads.

- **Seed data:** the sample dataset ships with the app and is built in the browser. Visitors always start from it.
- **Visitor edits:** each change is one document in `demos/{uid}/changes`, keyed `<collection>~<recordId>`, with `deleted: true` hiding a seeded row. Effective state is the seed with those change documents applied. A visit that changes nothing writes nothing.
- **Anonymous Auth:** each visitor signs in anonymously. The uid is kept by the browser's Auth persistence, so a returning visitor sees their own changes.
- **Offline and reloads:** Firestore's persistent local cache is the only durability layer. Unsent changes are kept in the SDK's queue and sent when the connection returns. If the browser blocks IndexedDB, Firestore falls back to memory and changes may not survive a reload; the app shows a warning when Firestore reports that fallback.
- **Reset:** Settings → Reset deletes that visitor's saved changes on the server and restores the sample data. It needs an internet connection. The visitor's write counters are kept, so a reset does not refill the write budget. Reset is unavailable once a visitor reaches the 1000-write budget, because the reset itself spends a write (accepted limit).
- **Security rules:** each visitor can read and write only `demos/{uid}`. Every batch spends one unit of a per-visitor write budget (1000 batches) and each new change document spends one unit of a document budget (500). Records are capped at 8 KB and collection names are checked against the nine known collections.
- **App Check:** requests carry a reCAPTCHA Enterprise token. Enforcement on Cloud Firestore is a setting on the Firebase project.
- **Nothing else is stored.** No real personal data and no analytics. Data goes only to Firebase and to reCAPTCHA for App Check.

- **PIN:** `123456`
- The PIN is a **UI demonstration, not a security boundary**. It ships in the client bundle in plain text. There is nothing real behind it.

Money is stored as **integer minor units** (centavos). Transfers and pending transactions are excluded from cash flow.

## Stack

- Vite + React + TypeScript (strict)
- React Router, TanStack Query
- Firebase (Spark plan): Auth (anonymous), Firestore with persistent local cache, Hosting, App Check
- React Hook Form + Zod, date-fns, Recharts, Tailwind CSS v4
- Vitest, Testing Library, Playwright
- Firebase emulator rules suite (`@firebase/rules-unit-testing`)

The Firebase web config in `src/data/firebase.ts` is public by design. It identifies the project and grants no access; access is enforced by the rules and App Check.

## Requirements

- Node.js 20+
- npm
- Java 21 for the Firebase emulators (`npm run test:rules`, `npm run test:e2e` and `npm run check`)

No environment variables are required. `VITE_FIREBASE_*` variables can override the Firebase config for a fork.

## Commands

```sh
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:rules
npm run build
npm run check
npm run test:e2e
npm run test:e2e:live
npm run check:bundle
npm run check:public-safe
npm run preview
```

`npm run test:e2e` builds the app in emulator mode and runs the Playwright smoke against local Auth and Firestore emulators (no App Check, no live sign-ups). It needs Playwright browsers installed once (`npx playwright install --with-deps chromium`) and Java 21.

`npm run test:e2e:live` runs the same smoke against the **live** `fundsicles-demo` project. It creates real anonymous visitors and spends their write budget, and it needs a registered App Check debug token (`VITE_APPCHECK_DEBUG`). Use it only to check the live project on purpose.

`npm run test:rules` starts the Firestore emulator and runs the rules suite. It needs Java 21 locally.

`npm run check` runs lint, typecheck, unit tests, production build, bundle budget, public-safety scan, and the emulator e2e smoke. It never touches the live project. It does not run the rules suite; CI runs that separately.

## Repository layout (short)

- `src/data/firebase.ts`: Firebase setup (App Check, anonymous sign-in, persistent cache)
- `src/data/firestore-store.ts`: the visitor's store (seed overlay, change documents, sync status)
- `src/data/store.ts`: picks the Firestore store in the app and the local store under Vitest
- `firestore.rules`: per-visitor isolation and the write budget
- `tests/rules/`: emulator rules suite
- `e2e/`: Playwright smoke across the feature pages

## Hosting

- **Firebase Hosting** (`firebase.json`): serves `dist`, rewrites all paths to `index.html`, and sets security headers including a Content Security Policy. Merges to `main` deploy to the live site, and each pull request gets a preview channel. Both run the full quality workflow first and deploy only if it passes, then build with `npm ci && npm run build`.
- **CI** (`.github/workflows/quality.yml`): lint, typecheck, unit tests, build, bundle budget, public-safety scan, the rules suite, and the emulator e2e smoke on every pull request and push to `main`.
- **Netlify** (`netlify.toml`, `netlify/`): redirect-only. The old Netlify URL forwards every path, with query string, to the same path on `fundsicles-demo.web.app` (301). Netlify runs no build.
- **Vercel:** not used for this demo.
