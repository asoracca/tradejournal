# Owner-scoped portfolio query plan

Run `npx tsx scripts/explain.ts` after the local seed. It executes the same parameterized row selection used by Java `TradeService.portfolioRows`: owner, mode and nullable account filter. Java `BigDecimal` then calculates portfolio totals; the former SQL P&L aggregate has been removed so accounting has one authoritative implementation.

Flyway adds `(userId, mode, account, status)` alongside the existing ownership indexes. The query never loads another owner's rows for filtering in Java.

Observed September 23, 2026: seed v1, six trades, PostgreSQL 18.4, effective role `tradegoons_app`, owner `synthetic-demo`, mode `PAPER`, account null. PostgreSQL chose a sequential scan, returned two owned rows and removed four. One execution-buffer hit; planning 0.160 ms, execution 0.018 ms. At six rows a sequential scan is reasonable; this is one warm observation, not an index speedup claim. The benchmark separately uses 1,000 rows.

[Raw plan, parameters, row count and database version](benchmarks/validation/query-plan.json). The plan can change with data distribution and database version. No row-level-security policy is claimed; application ownership predicates and database foreign keys remain mandatory.
