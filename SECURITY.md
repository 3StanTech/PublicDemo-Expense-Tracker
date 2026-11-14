# Security

## Reporting a problem

Contact the maintainer privately through the email link on https://tristandolfo.netlify.app/, with "Fundsicles demo security" in the subject. Please do not open a public issue for a vulnerability.

## What this demo is

A client-rendered React app (Vite) served from Firebase Hosting, with fictional sample data. Each visitor's edits are stored under an anonymous Firebase ID; Firestore access is limited by `firestore.rules` and App Check. There is no server code.

## Dependency notes

`npm audit` was last reviewed on 2026-11-14. Every fix that does not downgrade a package has been applied. The advisories below remain, one row each, saying where the affected copy runs, how that was checked and why it stays. "Browser bundle" means the code ships to visitors; "development tooling" means it runs only on a developer machine or in GitHub Actions. A tooling row's proof is that `npm ls <package> --all --omit=dev` prints `(empty)`: the affected copy is not in the production dependency tree at all.

| Advisory | Severity | Affected copy and path | Where it runs | Proof (command → result) | Why it remains |
| --- | --- | --- | --- | --- | --- |
| [GHSA-m9gg-hp2v-232j](https://github.com/advisories/GHSA-m9gg-hp2v-232j) | high | `firebase` → `@firebase/firestore` → `@grpc/grpc-js` 1.9.16 (the `firebase-tools` copies are 1.14.6, not affected) | Not in the browser bundle: the browser build of Firestore uses WebChannel. Loaded in Node only by the Firestore rules tests (`tests/rules`, Vitest `node` environment) against the local emulator, on a developer machine and in CI. | `npm ls @grpc/grpc-js` → the path at left; `npm run build`, then `grep -rlE "grpc-js\|@grpc/\|ChannelCredentials" dist` → no files (`grep -rl WebChannel dist` → 1 file) | A gRPC server can report an unauthorized client certificate as authorized. Nothing here runs a gRPC server; the tests are a client of the local emulator. The latest Firebase SDK still pins `@grpc/grpc-js ~1.9.0`; npm's only fix is a downgrade to `firebase@9`. |
| [GHSA-f596-whhp-79r4](https://github.com/advisories/GHSA-f596-whhp-79r4) | low | same copy as the row above | Same as the row above. | Same as the row above. | A gRPC server can echo handler error messages to clients. Nothing here runs a gRPC server. Same pin and downgrade as above. |
| [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) | moderate | `firebase-tools` → `glob` 10.5.0 (also through `archiver-utils`, `exegesis` and `rimraf`) | Development tooling (the emulators for the rules and end-to-end tests). | `npm ls glob --all --omit=dev` → `(empty)` | Waiting for an upstream `firebase-tools` release; npm's fix is a downgrade. |
| [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) | moderate | `firebase-tools` → `glob` 10.5.0 → `minimatch` 9.0.9 (the other `minimatch` copies, 3.1.5, 5.1.9 and 6.2.3, are outside the affected range) | Development tooling. | `npm ls minimatch --all --omit=dev` → `(empty)` | Waiting for an upstream `firebase-tools` release. |
| [GHSA-8988-4f7v-96qf](https://github.com/advisories/GHSA-8988-4f7v-96qf) | moderate | `firebase-tools` → `@google-cloud/pubsub` → `@opentelemetry/core` 1.30.1 | Development tooling. | `npm ls @opentelemetry/core --all --omit=dev` → `(empty)` | Waiting for an upstream `firebase-tools` release. |
| [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | moderate | `firebase-tools` → `gaxios` → `uuid` 9.0.1 | Development tooling. | `npm ls uuid --all --omit=dev` → `(empty)` | Waiting for an upstream `firebase-tools` release. |

Fixed in this review, for the record: `hono` and `@hono/node-server` (through `firebase-tools`, 2026-11-14), `zod` 4.1.8 → 4.6.7 (memory exhaustion on oversized collections; two form fields now mark their optional value explicitly, which the newer `zod` requires), `vite` 7.1.6 → 7.3.8 and `vitest` 3.2.4 → 4.1.12 (dev-server and test-runner issues; neither runs in production), `@playwright/test` 1.55.0 → 1.62.0 (clears its advisory and supports the current GitHub runner image), and `re2js` → 2.10.0.
