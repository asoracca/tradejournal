# TradeGoons

A private, multi-user paper-trading journal built with Next.js 14, React 18, TypeScript and PostgreSQL. It records trades, closes positions, calculates P&L, previews CSV imports and offers optional Gemini coaching. It does not place brokerage orders.

## Run the offline demo

Use Node.js 22 or 24 and npm. The lockfile pins the tested versions. Installation downloads dependencies and the local PostgreSQL binary; after installation the synthetic demo needs no API keys or external services.

```sh
npm ci
npm run db:local
```

Keep that terminal running. This creates **only** a loopback PostgreSQL database, `tradegoons_test`, and writes local `.env` settings. Use a second terminal:

```sh
npm run db:migrate
npm run db:grant-demo
npm run db:seed
npm run dev -- --hostname 127.0.0.1
```

Open [the local app](http://127.0.0.1:3000). Sign in with a synthetic account from `.local/demo-accounts.json`: `a@example.test` and `b@example.test` can write; `demo@example.test` is read-only. Passwords are generated locally, never committed. `npm run db:seed` resets only those accounts in the local test database. Stop the database with Ctrl-C. It persists under `.local/` between runs.

Seed v1 contains 10 synthetic shares bought at $100, marked at a fixed $110, plus 5 shares sold short at $120 and closed at $110. The SQL ledger returns **$50.00 realized and $100.00 marked unrealized P&L** per account. These are arithmetic fixtures, not performance claims. Log another 10-share paper trade at $100 and close it at $110: realized P&L becomes $150.00.

## Validation

```sh
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run test:migrations
npx playwright install chromium
npm run build
npm run start -- --hostname 127.0.0.1
# Separate terminal, with the seeded server running:
npm run test:e2e
npx tsx scripts/explain.ts
```

CI uses disposable PostgreSQL and tests the production build. Unit tests cover decimal accounting, invalid input, CSV escaping, disabled AI and provider outages. Integration tests exercise actual SQL constraints, concurrent close/import requests and ownership. Browser tests use separate authenticated users and probe trade/comment/asset reads, writes, deletes and exports. Screenshots are written to `test-results/`.

## Architecture and limits

React forms → authenticated Next.js route handlers → reusable Zod contracts → owner-scoped Prisma services → PostgreSQL constraints and parameterized SQL aggregates. Server sessions, not request-supplied user IDs, determine ownership. See [architecture](docs/architecture.md), [database migration procedure](docs/migrations.md), and [query plan method](docs/query-plan.md).

- Stock trades and standard 100-share options are supported. No partial closes, fees, taxes, FX, dividends or adjusted option multipliers. New futures trades are rejected until contract multipliers are modeled. Each entry is a separate lot; closed rows cannot be edited.
- Decimal prices and quantities use six places. Each position's P&L rounds to cents, half away from zero, before summing. Dashboard totals come from SQL; individual cards retain approximate JavaScript display calculations.
- Synthetic quotes and history are fixed, prominently labeled demo inputs. `MARKET_DATA_MODE=live` opts into unofficial Yahoo endpoints; quotes carry source, timestamp and stale status. Missing marks are reported as incomplete; underlying stock quotes never value options. News/options/disclosure lists are empty offline. External endpoints are not guaranteed.
- Gemini is optional. Set `GEMINI_API_KEY` to enable educational commentary, analysis, chat and file extraction. Those features send submitted trade/file context to Google. Without a key they perform no Gemini request and the journal works normally. They do not provide buy/sell recommendations or price predictions.
- Local credentials use NextAuth v4, scrypt and short-lived encrypted sessions. Accounts are provisioned locally; there is no public registration, password recovery or MFA. A database-backed per-account attempt limit is included; internet-facing deployment also requires edge rate limiting and operational monitoring.
- The retained Next.js 14 baseline and some dependencies have published security advisories. This branch is a local demonstration, **not cleared for public deployment**. Upgrade and revalidate the framework before hosting it.

CSV import accepts `ticker,type,side,quantity,entryPrice` plus optional trade fields. Preview reports every row error; commit rejects the entire batch if any row is invalid. An account-scoped hash of normalized row contents skips identical rows across retries/files; edit a field if a second otherwise-identical lot is intentional. Deleting a row permits reimport. Exports contain your trades/comments only and prefix potentially active spreadsheet text with an apostrophe. Export includes closed-state fields, so it is an audit export, not a round-trip import format.

Existing source comments retain attribution to public market/disclosure sources and the volatility method. Dependency licenses remain with their packages; embedded PostgreSQL documents its PostgreSQL/zonky and wrapper licenses. No original repository license file was present; no license or authorship claim is added here.
