# FACTORY-COUNCIL-REVIEW

**Branch:** `factory/dev-backend` (local only; not on `origin`)  
**Base:** `origin/main` (`9d899b6c`)  
**Diff scope:** 46 files, +15,007 / −805 lines (all **uncommitted** working tree)  
**Method:** gstack `/review` (scope drift, SQL/trust-boundary pass, enum completeness, pre-emit
verification)  
**Date:** 2026-06-12  
**Reviewer:** Factory Council (code-reviewer subagent)

---

## Verdict

**DO NOT MERGE** until blocking items are resolved and changes are committed in reviewable slices.

**PR Quality Score:** 5.5 / 10  
**Status:** `issues_found`

---

## Scope Check

| Field                 | Value                                                                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Intent (inferred)** | Local dev-backend ergonomics: Docker/env alignment, Redis URL support, safer parameterized SQL, Stripe/dev billing fallbacks, database test harness                    |
| **Delivered**         | Above **plus** ~12k lines of minified-file reformatting (observability, feedback UI, email/onboarding services), new Makefile/CI scripts, large plugin DB test rewrite |
| **Status**            | **DRIFT DETECTED**                                                                                                                                                     |

**Out-of-scope / inflate diff (reformat-only, not new behavior):**

- `src/services/observability/*.ts` (alerting, capacity, incident, logging, tracing, etc.)
- `src/components/feedback/FeedbackPortal.tsx`, `FeedbackWidget.tsx`
- `src/components/plugins/PluginManagementDashboard.tsx`
- `src/lib/email/EmailService.ts`, `src/services/onboarding/*`

**Missing / weakened vs stated backend-dev goals:**

- No committed history on branch (cannot review incrementally)
- Integration DB tests now silently skip when `TEST_DATABASE_URL` / `DATABASE_URL` unset
  (`tests/database/plugin-database.test.ts:8`)

---

## Blocking

| ID  | Confidence | Location                                        | Finding                                                                                                                                                                                                                    | Required action                                                                               |
| --- | ---------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| B1  | 9/10       | `src/lib/env-validation.ts:51`                  | `NODE_ENV` schema default changed from `'production'` to `'development'`. Any deploy that omits `NODE_ENV` now parses as development, skipping production required-var enforcement at `src/lib/env-validation.ts:168-191`. | Restore `default('production')` or fail closed when `NODE_ENV` is unset in non-test runtimes. |
| B2  | 9/10       | `docker-compose.yml:9`, `docker-compose.yml:16` | `idp-platform` build `target` switched `runner` → `development`; default `NODE_ENV` is `development`. Compose file is no longer production-safe.                                                                           | Split dev/prod compose profiles or revert service target for any prod-like path.              |
| B3  | 10/10      | _(branch state)_                                | `factory/dev-backend` == `origin/main` at HEAD; entire diff is **uncommitted** (55 dirty paths). Nothing landable via PR as-is.                                                                                            | Commit in focused chunks (env/docker, DB safety, tests/CI) before merge.                      |

---

## Major

| ID  | Confidence | Location                                                  | Finding                                                                                                                                                                                                                                          | Recommended fix                                                                                 |
| --- | ---------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| M1  | 9/10       | `src/lib/database/client.ts:259-264`                      | `batchTransaction` passes `operations.map(op => op())` into `$transaction`, **eagerly executing** each op before the transaction boundary. Atomicity guarantee is false.                                                                         | Pass thunks: `operations.map(op => op)` or `await client.$transaction(async (tx) => { ... })`.  |
| M2  | 8/10       | `src/lib/billing/stripe-client.ts:4-8`                    | `DEV_STRIPE_PLACEHOLDER` (`sk_test_placeholder_not_configured`) used when `STRIPE_SECRET_KEY` unset. Billing code can run with a fake key and fail opaquely at Stripe API instead of failing fast at startup (except explicit production check). | Gate `getStripeClient()` on validated config; throw in non-dev or when key missing/placeholder. |
| M3  | 8/10       | `src/lib/database/TenantAwareDatabase.ts:402-408`         | Tenant isolation for raw SQL is **warn-only** (`console.warn`); `executeRaw` still runs `$queryRaw` even when `tenant_id` absent from SELECT-shaped SQL.                                                                                         | Enforce block (or require `allowCrossTenant` + audit) for tenant-scoped contexts.               |
| M4  | 8/10       | `tests/database/plugin-database.test.ts:5-8`              | Suite wrapped in `describeIfDb`; skips entirely without `TEST_DATABASE_URL`/`DATABASE_URL`. CI can pass with **zero** plugin DB coverage.                                                                                                        | Require dedicated test DB in CI or explicit `describe.skip` reason + separate mandatory job.    |
| M5  | 7/10       | `src/lib/database/client.ts:220-237`                      | `executeRawQuery` / `executeRawCommand` no longer accept raw `string` (removed `$queryRawUnsafe` / `$executeRawUnsafe` paths). Good security direction, but **breaking** for any string callers outside repo grep scope.                         | Confirm all call sites use `Prisma.sql`; add compile-time types or migration note.              |
| M6  | 7/10       | `src/lib/env-validation.ts:9-47`                          | `normalizeProcessEnv()` mutates global `process.env` (deletes empty strings, aliases keys) at validation time. Side effects can surprise modules that read env before/after validation order.                                                    | Document call order; prefer read-only normalization object.                                     |
| M7  | 7/10       | `src/lib/database/connection.ts:390`                      | `getDatabaseManager()` uses `process.env.DATABASE_URL!` non-null assertion; throws opaque pool errors if unset.                                                                                                                                  | Validate via `validateEnvironment()` before singleton init.                                     |
| M8  | 6/10       | `src/services/observability/alerting-engine.ts:1018-1033` | Notification channels log to `console.log` only ("Production-ready" header at file top). Operational alerts are no-ops.                                                                                                                          | Wire real adapters or mark module dev-only; do not expose in prod health paths.                 |
| M9  | 6/10       | `config/env/.env.development:28-31`                       | Committed static dev secrets (`NEXTAUTH_SECRET`, `JWT_SECRET`, `SESSION_SECRET`, `ENCRYPTION_KEY`). Acceptable for local-only if never promoted; risky if copied to shared envs.                                                                 | Ensure `.env.development` is dev-only; document rotation; never reuse in staging/prod.          |

---

## Minor

| ID  | Confidence | Location                                      | Finding                                                                                                                                          |
| --- | ---------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| m1  | 9/10       | `Makefile:3`                                  | Typo `.NPHONY` → should be `.PHONY`; `help` target won't mark phony correctly.                                                                   |
| m2  | 8/10       | `src/lib/database/simple-monitoring.ts:30-31` | Monitoring `start()` remains explicit placeholder after reformat.                                                                                |
| m3  | 7/10       | `src/lib/database/connection.ts:410-417`      | `process.on('SIGTERM'/'SIGINT')` registered at module load; duplicate listeners under Next.js HMR/test workers.                                  |
| m4  | 7/10       | `Dockerfile:74-80`                            | Port/healthcheck moved to 4400 (good for compose) but diverges from default Next 3000 docs elsewhere—verify all entrypoints.                     |
| m5  | 6/10       | `src/app/api/auth/login/route.ts:21-26`       | `__resetLoginAttemptsForTests` exported from route module; acceptable but keep test-only guard (`NODE_ENV === 'test'` already present at `:22`). |
| m6  | 6/10       | _(diff noise)_                                | Large line-count inflation from minified → formatted files obscures review; split formatting PR from behavioral PR.                              |

---

## Positive (ship-worthy elements)

| Location                                                     | Note                                                                                      |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `src/lib/database/__tests__/parameterized-sql.test.ts`       | Adds enforcement tests for `Prisma.sql` → `$queryRaw` / `$executeRaw` routing.            |
| `src/lib/cache/redis.ts:22-35`, `src/lib/db/client.ts:69-88` | `REDIS_URL` support with DB index overrides—matches Docker dev setup.                     |
| `src/lib/database/TenantAwareDatabase.ts:396-408`            | Moves off `$executeRawUnsafe(string, ...params)` to `Prisma.sql` + `$queryRaw`.           |
| `src/app/api/auth/login/route.ts:318`                        | Tenant context fallback `organization?.id \|\| user.tenantId` improves legacy auth paths. |
| `jest.config.js:288-309`                                     | Dedicated `database` Jest project for DB unit/integration tests.                          |
| `.env.example`, `config/env/.env.development`                | Aligns DB name/credentials with `docker-compose` `next_portal` service.                   |
| `src/app/api/auth/__tests__/auth.test.ts:88-99`              | Resets login attempt map between tests; adds `findFirst` mock.                            |

---

## Pre-landing checklist (gstack)

- [ ] Split reformat-only files from behavioral changes
- [ ] Commit with conventional messages per slice
- [ ] Run `make ci` or `npm run test:ci` with `TEST_DATABASE_URL` set
- [ ] Run `npm run test -- --selectProjects database`
- [ ] Confirm production deploy sets `NODE_ENV=production` explicitly
- [ ] Re-run review after commits (branch currently uncommitted)

---

## Council decision

| Gate                     | Result                                                                        |
| ------------------------ | ----------------------------------------------------------------------------- |
| Scope alignment          | **FAIL** (drift + uncommitted)                                                |
| SQL safety delta         | **PASS with caveats** (parameterized path improved; tenant warn-only remains) |
| Trust boundary / secrets | **FAIL** (NODE_ENV default, Stripe placeholder, committed dev secrets)        |
| Test signal              | **FAIL** (silent DB test skip)                                                |
| Operability              | **FAIL** (compose dev target, mock observability notifications)               |

**Recommendation:** Fix B1–B3, then land env/docker + DB safety as PR1; tests/CI as PR2; defer
observability/UI reformat to PR3 or drop from `factory/dev-backend`.
