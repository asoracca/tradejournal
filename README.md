# TradeGoons

A multi-user **paper-trading journal**, not a brokerage. The existing Next.js 15 / React 18 / TypeScript interface uses a Java 21 / Spring Boot 4.1 API for the complete trade lifecycle and decimal portfolio calculations. PostgreSQL stores owned trades; Gemini remains optional.

## Run locally without external keys

Prerequisites: **Java 21**, **Node.js 22 or 24**, and npm on macOS/Linux. The checked-in Maven wrapper pins Maven 3.9.11 and verifies its distribution checksum. Initial dependency installation needs internet access; the installed synthetic demo does not.

```sh
npm ci
npm run db:local
```

Leave PostgreSQL running. This creates only the loopback `tradegoons_test` database and writes ignored `.env` configuration. In a second terminal:

```sh
npm run db:migrate
npm run db:grant-demo
npm run db:seed
npm run java:build
npm run java:migrate
npm run java:run
```

Leave Java running. In a third terminal:

```sh
npm run dev -- --hostname 127.0.0.1
```

Open [localhost](http://127.0.0.1:3000). Use the generated credentials in `.local/demo-accounts.json`: `a@example.test` and `b@example.test` are synthetic writable accounts; `demo@example.test` is read-only. Never commit that file. Re-running `db:seed` resets only the local synthetic accounts. Stop the servers with Ctrl-C.

**Example:** seed v1 has $50.00 realized and $100.00 marked unrealized P&L. Create 10 shares of DEMO at $100, edit quantity to 12.5, and close at $110.005. That trade realizes **$125.06**, and the portfolio's realized total becomes **$175.06**. While signed in as A, `/api/trades/synthetic-b-open` returns 404. These are deterministic arithmetic examples, not investment results.

## Validate and measure

With PostgreSQL and Java running:

```sh
npm run java:test              # JUnit + HTTP + real PostgreSQL; JaCoCo report
npm run typecheck
npm run lint
npm test
npm run test:integration       # Next.js adapter → Java → PostgreSQL
npm run test:migrations        # isolated legacy preservation/rollback rehearsal
npx playwright install chromium
npm run build
npm run start -- --hostname 127.0.0.1  # stop dev first; keep this running
# Another terminal:
npm run test:e2e               # UI create/edit/read/close + ownership + UI states
node scripts/benchmark.mjs docs/benchmarks/local-run
```

CI provisions disposable PostgreSQL, Java and Node, and runs those checks against production builds. The benchmark is **not** a CI timing gate. See the [three-minute demo walkthrough and screenshots](docs/demo/README.md), [measured results and raw samples](docs/benchmarks/README.md), [REST contracts](docs/api.md), [architecture and JavaScript fundamentals](docs/architecture.md), and [migration/rollback](docs/java-migration.md).

## Ownership and limits

- Java is the sole trade read/write/validation/P&L implementation, including CSV commits and comments. Next.js authenticates sessions, signs internal requests, translates CSV, supplies market marks and calls Gemini. There is no fallback trading implementation if Java is unavailable.
- Decimal values use `numeric(20,6)` / `BigDecimal`; financial JSON uses strings. Each position rounds to cents using `HALF_UP` before summation. The UI preserves exact strings for edits and formats Java-calculated totals. Sizing, stop/target suggestions, charts and visual risk indicators are estimates, not accounting records.
- Stock lots and standard 100-share options are supported. Options without contract-specific marks are reported as unpriced; stock prices never value an option. No partial closes, futures, adjusted multipliers, fees, tax lots, dividends, FX or live execution. Market value is **gross marked exposure**, and equity is the user-entered starting balance plus P&L, not brokerage buying power.
- Synthetic quotes are labeled. `MARKET_DATA_MODE=live` opts into the existing unofficial market adapter with timeouts/cache/stale states; availability is not guaranteed. Gemini commentary, analysis, chat and extraction require `GEMINI_API_KEY` and send submitted context to Google. Without a key, no Gemini request is made.
- Existing unowned rows remain in the restricted legacy archive. No automatic owner assignment, startup migration, production migration or hosted deployment is part of the Java cutover. The local user authentication has no public registration, password recovery or MFA. Java binds to loopback; production needs private networking/TLS, secret management and operational abuse controls.
- Portfolio calculation scans one owner's selected rows; the measured workload is 1,000 synthetic rows. There is no production-scale claim. See the benchmark limitations before interpreting its numbers.

CSV previews use Java's canonical validator, commits reject batches containing errors, and owner-scoped fingerprints prevent duplicate imports (including pre-Java fingerprints). Exports escape spreadsheet-formula text; they are audit exports, not complete round-trip backups.

Existing attribution for market/disclosure sources and volatility methods is retained. Dependencies keep their own licenses; generated Maven wrapper scripts retain Apache notices. No original repository license was present, and no authorship or license claim is added.
