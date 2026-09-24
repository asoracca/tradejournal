# Java cutover and rollback

The Java stage starts from the multi-user branch at `900dba7`. Inspection found functioning NextAuth ownership, numeric columns, optional Gemini, deterministic fixtures, CSV and browser tests. There were no open GitHub pull requests at inspection. The older public main branch may still require the original [ownership/archive migration procedure](migrations.md) before this stage. Do not assume main and this branch have the same schema.

## Data ownership and schema

Existing `Trade`, `AiComment`, `User`, `Asset` and `CongressTrade` rows, IDs, foreign keys, decimal values and timestamps are reused **in place**. No data is copied, reassigned or rounded by this Java migration. The existing Prisma migration history remains authoritative for the baseline schema. Java's Flyway history lives in the separate `trade_api_migrations` schema; `V1__portfolio_owner_index.sql` only adds an index on `(userId, mode, account, status)`. There is no automatic baseline-on-migrate and no runtime migration.

Trade/comment mutations move to Java. Prisma remains for authentication, assets, existing migrations and fixture tooling. Next.js trade routes become adapters with no fallback implementation. Cutover is all-or-nothing at the route layer, so a Java outage yields 503 instead of silently using older logic. The CSV canonical fingerprint format is preserved and has a regression test against a pre-cutover hash.

## Rehearsed local sequence

1. The local launcher creates `tradegoons_test` with separate admin and limited application roles. Run the retained Prisma migrations and grants, then seed synthetic accounts.
2. Build Java. Explicit `npm run java:migrate` runs Flyway using `DIRECT_URL`, exits without starting HTTP, and adds the index/history. A repeat invocation reports schema version 1 and no migration necessary.
3. `npm run java:run` uses only the limited `DATABASE_URL`; the launcher removes `DIRECT_URL` from the HTTP process environment. The role is tested to lack superuser, role-creation, database-creation and archive access.
4. Run JUnit against actual PostgreSQL, then the Next.js adapter and Playwright lifecycle tests. The separate legacy migration rehearsal preserves original float/comment data and demonstrates an archive rollback on a disposable database.

## Operator procedure for existing hosted data

Production execution is outside this task. Take and **test restoring** a database snapshot before any cutover. Check baseline migration history, column types, ownership, role memberships and row counts. Rehearse on an isolated copy. Verify Gemini and market configuration independently. Stop writes while changing the application version; do not run the local reset/benchmark scripts against production.

Apply the additive index with the migration role and remove that credential from the running application environment. Normal index creation can block writes on a large table; schedule a maintenance window or separately review a concurrent-index migration. Provision a private Java endpoint, distinct HMAC secret, clock synchronization and transport encryption. Start Java, deploy the matching Next.js adapters and run authorized synthetic smoke tests. Do not expose the Java port publicly based on this local demo.

## Rollback

Stop both writers and deploy the prior matching Next.js-only version from `900dba7`. Its trade schema and six-place decimals are unchanged, and new Java-created UUID IDs are valid text IDs for that version. ClosedAt and CSV fingerprint semantics remain compatible. Existing and newly created rows stay in place. The extra index/Flyway history may remain harmlessly; dropping the added index is optional and should be a separate reviewed migration, not an automatic destructive down script.

Do **not** roll back to the original unowned main application and publicly expose its records. That is a different, higher-risk migration described in the archive document. No hosted database was read or modified during the Java implementation, and no Java cutover was deployed.
