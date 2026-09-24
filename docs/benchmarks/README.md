# Local validation and API measurements

Measured September 23, 2026 (America/Chicago; raw UTC timestamps September 24). These are short local observations, not production capacity or evidence of an improvement over the prior implementation.

## Reproduce

Follow the root README setup, migrations and seed. Start Java with `npm run java:run`, then:

```sh
npm run java:test
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run test:migrations
npm run build
# Start the production frontend in another terminal before the browser test:
npm run test:e2e
node scripts/benchmark.mjs docs/benchmarks/local-run
npx tsx scripts/explain.ts
```

The benchmark refuses non-loopback APIs/databases and requires the disposable `tradegoons_test` database. It creates and removes only its reserved synthetic account. Do not repurpose it for hosted data.

## Workload and environment

Apple M5, 10 logical CPUs, 16 GiB RAM; Darwin 25.5.0; ARM64 Temurin Java 21.0.12.1, Node 24.19.0, Spring Boot 4.1.1. PostgreSQL 18.4 is the embedded **x86_64 build running on Apple Silicon**. Client, API and database share the machine. Hikari pool size 8; default JVM settings; no JaCoCo/profiler on the benchmark server.

Seed `fixed-synth-1000-v1`: 1,000 owned stock trades, 500 open and 500 closed, quantity 1, entry 100, mark/exit 110. Each worker executes create → edit → read → close → read → portfolio → delete sequentially. Edit sets quantity 12.5; close at 110.005 against entry 100 must return realized P&L **125.06**. The closed read is checked too. Active worker trades temporarily add to the 1,000 baseline rows.

Concurrency 1 then 8; three repetitions each. Each repetition has 20 warm-up lifecycles and 200 measured lifecycles: 140 warm-up and 1,400 measured requests. Total: **8,400 measured requests, zero observed errors**, plus 840 excluded warm-up requests. Error means an unexpected HTTP status or failed calculation/state assertion, not merely a network failure.

Timing uses the client monotonic clock through response JSON parsing. Requests are directly signed Java REST calls; Next.js, browser rendering, Gemini, live market providers, TLS and WAN latency are excluded. Raw samples include warm-up flags; summaries exclude them. Percentiles use sorted nearest-rank samples.

| Run | Duration (s) | p50 (ms) | p95 (ms) | p99 (ms) | Requests/s | Errors / requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| c1-r1 | 2.947 | 1.502 | 5.118 | 6.564 | 475.1 | 0 / 1400 |
| c1-r2 | 2.790 | 1.342 | 4.726 | 7.965 | 501.9 | 0 / 1400 |
| c1-r3 | 2.336 | 1.190 | 4.371 | 5.121 | 599.3 | 0 / 1400 |
| c8-r1 | 0.640 | 2.646 | 9.023 | 11.061 | 2188.2 | 0 / 1400 |
| c8-r2 | 0.611 | 2.501 | 8.454 | 11.085 | 2291.4 | 0 / 1400 |
| c8-r3 | 0.571 | 2.432 | 8.100 | 9.648 | 2452.2 | 0 / 1400 |

All six runs are shown. Runs are short bursts; warm-up does not establish JVM steady state, run order is not randomized, the client synchronously writes samples, and shared-machine scheduling affects results. The bounded single-JVM nonce cache is another sustained-load limitation. No confidence interval, production sizing, real users or speedup is claimed. Do not extrapolate burst requests/s to sustainable traffic.

Raw evidence: [samples](2026-09-23/requests.jsonl), [per-operation summaries](2026-09-23/summary.json), [hardware/workload metadata](2026-09-23/metadata.json), [measured source hashes](2026-09-23/source-manifest.json). The source manifest identifies the uncommitted slice measured on baseline `900dba7`; later documentation-only edits are not performance changes.

## Correctness and coverage

Local checks passed: **41 JUnit tests** (9 accounting cases, 21 contract cases, 11 HTTP/database scenarios), **17 TypeScript tests**, **4 Playwright scenarios**, type checking, lint and production build. Legacy float/comment preservation and rollback passed in a separate temporary database; repeated Flyway execution required no further migration. CI is configured for the same checks with disposable PostgreSQL, but this Java branch has not yet run on hosted CI.

JaCoCo measures Java only: **431/460 executable lines (93.7%)** and **188/230 branches (81.7%)**. Accounting has 10/10 lines and 6/6 branches covered. These are coverage observations, not proof of all possible behavior; no TypeScript coverage percentage is claimed. [Raw JaCoCo CSV](validation/jacoco.csv); full HTML is generated locally at `backend/target/site/jacoco/index.html`.

Important behavior covered: long/short and option multipliers, fractional quantities, half-cent rounding, zero basis, malformed dates/numbers, row constraints, owned nested resources, disabled/read-only users, signature tampering/replay, concurrent identical closes, conflicting closes, atomic imports and duplicate races, legacy CSV fingerprints, missing/current/prior marks, account filters, Gemini disabled/provider failure, and React loading/empty/failure/recovery. Browser tests use real PostgreSQL for the lifecycle and separate mocked responses for UI failure states.

Not established: successful live Gemini calls, external quote availability, hosted deployment correctness, failover, long-duration load, multi-instance replay protection or comprehensive outage recovery. [SQL plan](../query-plan.md) is a separate six-row seed observation.
