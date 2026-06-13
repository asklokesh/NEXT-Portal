# FACTORY QA Report — `factory/dev-backend`

| Field          | Value                                                         |
| -------------- | ------------------------------------------------------------- |
| Branch         | `factory/dev-backend`                                         |
| Commit         | `9d899b6c` — fix: resolve 401 and 429 errors on dashboard API |
| Gate run (UTC) | 2026-06-13T02:23:14Z                                          |
| Workspace      | `/Users/lokesh/git/NEXT-Portal`                               |

## Verdict

**CONDITIONAL FAIL** — Docker smoke passes at gate close, but `npm run test:ci` did not finish
(killed after >7 min hang). Backend-focused subset passes. Six pre-marked `[verified]` docker todos
failed re-check at gate open and were downgraded pending evidence; five were re-confirmed after
compose came up.

---

## 1. Docker / API smoke

### Gate open (no compose)

```text
$ docker ps
NAMES     STATUS    PORTS
(empty)

$ curl -sS -o /dev/null -w '%{http_code}' http://localhost:4400/api/health
curl: (7) Failed to connect to localhost port 4400
000
```

### Gate close (compose up)

```text
$ docker compose ps
NAME                         SERVICE        STATUS
next-portal-db-1             db             Up (healthy)
next-portal-idp-platform-1   idp-platform   Up (healthy)
next-portal-redis-1          redis          Up (healthy)

$ curl -sf http://localhost:4400/api/health
{"status":"degraded","timestamp":"2026-06-13T02:23:03.038Z","version":"1.2.0",...,"services":{"database":{"status":"ok",...},"backstage":{"status":"ok",...},"cache":{"status":"degraded",...}}}
HTTP:200

$ curl -sf http://localhost:4400/api/health/ready
{"ready":true,"checks":{"database":true,"backstage":true},"timestamp":"2026-06-13T02:23:07.861Z"}
HTTP:200
```

| Check                                         | Result   | Notes                                                 |
| --------------------------------------------- | -------- | ----------------------------------------------------- |
| `docker compose ps` (db, redis, idp-platform) | **PASS** | All three `(healthy)` at gate close                   |
| `GET /api/health`                             | **PASS** | HTTP 200; overall `status: degraded` (cache fallback) |
| `GET /api/health/ready`                       | **PASS** | HTTP 200; `ready: true`                               |

---

## 2. `npm run test:ci`

Command: `jest --ci --coverage --maxWorkers=2 --forceExit --testTimeout=30000`

### Full suite — **INCOMPLETE (aborted)**

- Started at gate open; **killed after ~7+ minutes** with no Jest summary line.
- Observed before abort: **23 test suites PASS**, **0 FAIL** (partial log in terminal `295866`).
- Run appeared **stuck** in a Prisma connection-pool retry loop
  (`Invalid value undefined for datasource "db"`) after
  `src/lib/dnd/__tests__/DragDropContext.test.tsx` passed — remaining suites never reported.
- **No fabricated totals** — full pass/fail counts unknown.

Suites confirmed PASS in partial full run (23):

- `src/services/__tests__/plugin-management.test.ts`
- `src/app/api/auth/__tests__/auth.test.ts`
- `src/lib/db/repositories/__tests__/ServiceRepository.test.ts`
- `src/lib/db/repositories/__tests__/repository-interfaces.test.ts`
- `src/lib/db/repositories/__tests__/UserRepository.test.ts`
- `src/components/plugins/marketplace/__tests__/InstallationWizard.test.tsx`
- `src/components/plugins/marketplace/__tests__/SemanticSearchEngine.test.tsx`
- `src/components/plugins/marketplace/__tests__/CompatibilityChecker.test.tsx`
- `src/__tests__/websocket-functionality.test.ts`
- `src/services/catalog/__tests__/relationship-resolver.test.ts`
- `src/components/plugins/marketplace/__tests__/MarketplacePluginCard.test.tsx`
- `src/lib/websocket/__tests__/cleanup-utils.test.ts`
- `src/components/plugins/marketplace/__tests__/AdvancedPluginMarketplace.test.tsx`
- `src/components/ui/__tests__/Skeleton.test.tsx`
- `src/lib/auth/__tests__/rbac.test.ts`
- `src/hooks/__tests__/useRealtimePlugins.test.ts`
- `src/lib/cost/__tests__/cost-simple.test.ts`
- `src/lib/auth/__tests__/rbac-simple.test.ts`
- `src/lib/cost/providers/__tests__/cost-providers.test.ts`
- `src/lib/auth/providers/__tests__/azure-ad.test.ts`
- `src/lib/auth/providers/__tests__/okta.test.ts`
- `src/lib/auth/__tests__/jwt.test.ts`
- `src/lib/dnd/__tests__/DragDropContext.test.tsx`

### Backend subset — **PASS**

Ran after full-suite abort (coverage disabled for speed):

```bash
npm run test:ci -- --coverage=false --forceExit \
  src/app/api/auth/__tests__/auth.test.ts \
  src/lib/database/__tests__/parameterized-sql.test.ts \
  src/lib/db/repositories/__tests__/ServiceRepository.test.ts \
  src/lib/db/repositories/__tests__/UserRepository.test.ts \
  src/lib/db/repositories/__tests__/repository-interfaces.test.ts \
  src/lib/auth/__tests__/jwt.test.ts \
  src/lib/auth/__tests__/rbac.test.ts \
  src/lib/auth/__tests__/rbac-simple.test.ts \
  src/lib/auth/__tests__/security-vulnerabilities.test.ts
```

```text
Test Suites: 8 passed, 8 total
Tests:       163 passed, 163 total
Time:        3.065 s
EXIT:0
```

Note: `security-vulnerabilities.test.ts` is in `testPathIgnorePatterns` (jest.config.js) — **not
executed**; listed suite count is 8, not 9.

---

## 3. Makefile CI helpers

```text
$ make validate-scripts
All referenced CI scripts present.

$ make smoke-check
TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".sh" for scripts/ci/validate-referenced-scripts.sh
make: *** [smoke-check] Error 1
```

| Target             | Result                                              |
| ------------------ | --------------------------------------------------- |
| `validate-scripts` | **PASS**                                            |
| `smoke-check`      | **FAIL** — `node --check` on `.sh` files (Node v26) |

---

## 4. Verified-todo audit (`FACTORY-TODO-500.md`)

Six items were marked `[verified]` before this gate. QA re-check rules: evidence required.

| #   | Todo                     | Pre-gate status | QA gate open                       | QA gate close       | Downgrade action                 |
| --- | ------------------------ | --------------- | ---------------------------------- | ------------------- | -------------------------------- |
| 1   | idp-platform healthy     | `[verified]`    | **FAIL** — no containers           | **PASS** — healthy  | Downgraded at open → re-verified |
| 2   | db healthy               | `[verified]`    | **FAIL**                           | **PASS**            | Downgraded at open → re-verified |
| 3   | redis healthy            | `[verified]`    | **FAIL**                           | **PASS**            | Downgraded at open → re-verified |
| 4   | Full stack `compose up`  | `[verified]`    | **FAIL** — stack down              | **PASS** — stack up | Downgraded at open → re-verified |
| 5   | `curl /api/health`       | `[verified]`    | **FAIL** — connection refused      | **PASS** — HTTP 200 | Downgraded at open → re-verified |
| 6   | `curl /api/health/ready` | `[verified]`    | **FAIL** — not tested (stack down) | **PASS** — HTTP 200 | Downgraded at open → re-verified |

**Finding:** Items 1–6 were marked `[verified]` without reproducible evidence at gate open (compose
was not running). They should not have carried `[verified]` until this gate captured output. After
compose came up mid-gate, all six checks passed with logged evidence above.

Remaining **494** todos in `FACTORY-TODO-500.md` remain `[pending]` — not assessed in this gate.

---

## 5. Blockers / follow-ups

1. **Full `test:ci` hang** — Investigate Prisma pool / missing `DATABASE_URL` in Jest env; suite
   never completes in CI-like local run.
2. **`make smoke-check`** — Exclude `.sh` from `node --check` loop or use `bash -n`.
3. **Health degraded** — `/api/health` returns 200 but `cache: degraded`; confirm Redis wiring in
   compose.
4. **Re-run full `test:ci`** to completion before marking test todos verified.

---

## 6. Evidence files

| Artifact            | Path                                                   |
| ------------------- | ------------------------------------------------------ |
| Partial full CI log | `/tmp/factory-test-ci.log` (truncated; process killed) |
| Backend subset log  | `/tmp/factory-test-subset.log`                         |
| Terminal capture    | `terminals/295866.txt` (partial full run)              |

---

_Generated by FACTORY QA gate. Pass counts reflect only executed commands; no estimates for
incomplete runs._
