# Aggregate query plan

Run `npx tsx scripts/explain.ts` against seed v1 after `npm run db:seed`. It prints PostgreSQL version, effective application role, row count, parameter inputs and the actual `EXPLAIN (ANALYZE, BUFFERS)` output for `lib/ledger.ts`.

The query binds the user, mode, account filter and JSON price map as parameters. It sums rounded realized/unrealized position P&L and counts unpriced positions. Marks are joined by ticker only for stock valuation; options require a contract quote and are left unpriced. Ownership is a WHERE condition inside SQL, not a JavaScript filter after reading all users' data.

The index `(userId, status, createdAt)` begins with the ownership key. PostgreSQL may choose a sequential scan for the six-row seed; an index scan is not inherently faster at this size. This seed validates the plan and semantics, not production throughput. Capture output on the target PostgreSQL version and realistic tenant distribution before making capacity claims.

## Observed local run

On September 22, 2026, seed v1 (6 trades), PostgreSQL 18.4 on Darwin, and role `tradegoons_app`, the command above used `synthetic-demo`, `PAPER`, no account filter, and `{"SYNTH":"110"}`. It selected an index scan on `Trade_userId_importKey_key` (its leading column is `userId`), read 2 owned rows, joined 1 mark and aggregated 1 result. Reported planning time was 0.282 ms, execution time 0.081 ms, with 2 shared-buffer hits. This is one warm local observation, not a benchmark or capacity guarantee. The dedicated status/createdAt ownership index also exists; the planner did not select it for this run.
