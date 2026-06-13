# FACTORY WAVE 2 BRIEF

Branch: `factory/dev-backend`  
Orchestrator: wave-2 (max 4 sibling agents)  
Generated: 2026-06-13T02:22:00Z

## Priority batch

Wave 2 targets **docker / health / auth / tenant** — the foundation layer before broader API smoke
(IDs 1–401).

## Orchestrator P0 fixes (this wave)

| Fix                                                                                                                             | Evidence                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `docker-compose.yml`: removed obsolete `version`, healthcheck uses `node` (no `wget` in alpine dev image), `start_period: 120s` | diff vs main                                                                  |
| `Dockerfile` development stage: `RUN npx prisma generate` before `npm run dev`                                                  | fixes `@prisma/client did not initialize` on `/api/auth/login` in container   |
| DB name drift: compose uses `next_portal`; existing volumes may only have `idp_wrapper` — create DB or reset volume             | `curl /api/health` showed `Database next_portal does not exist` before create |

**No todo items marked verified** — QA gate must capture command output first.

## False verified audit

- Scanned `FACTORY-TODO-500.md`: **0** `[verified]` rows. Nothing reverted.
- Git diff vs `main`: all wave-1 work is uncommitted working tree; no stale verified claims in todo
  file.

## Sibling assignments (4 agents)

### sibling-ops — Docker & local CI

**Owner tag:** `sibling-ops`  
**Scope:** `Dockerfile`, `docker-compose.yml`, `Makefile`, `.env.example`, `config/env/`

| IDs | Item                                             |
| --- | ------------------------------------------------ |
| 133 | `/api/docker-compose` smoke                      |
| 474 | `tests/containers/docker-plugin-testing.test.ts` |

**Exit criteria**

- `docker compose down && docker compose up -d --build` succeeds (resolve port 4400 conflict if
  local `npm run dev` is running)
- `curl -sf http://localhost:4400/api/health` → HTTP 200, `"status":"ok"` or `"degraded"` (not 503)
- `make validate-scripts smoke-check` pass

---

### sibling-health — Health probes

**Owner tag:** `sibling-health`  
**Scope:** `src/app/api/health/**`, `src/app/api/catalog/health`,
`src/app/api/catalog-graph/health`, monitoring health routes

| IDs     | Route                                                    |
| ------- | -------------------------------------------------------- |
| 94      | `/api/catalog/health`                                    |
| 120     | `/api/catalog-graph/health`                              |
| 150–153 | `/api/health/database`, `/live`, `/ready`, `/api/health` |
| 203     | `/api/monitoring/comprehensive-health`                   |
| 207     | `/api/monitoring/health`                                 |
| 211     | `/api/monitoring/tenant-health`                          |
| 234     | `/api/platform/health`                                   |
| 252     | `/api/plugin-health`                                     |
| 298     | `/api/plugins/health`                                    |
| 364     | `/api/system/health`                                     |

**Exit criteria**

- Each route returns JSON (not HTML error page); live/ready return 200
- Record curl output in `FACTORY-QA-REPORT.md` before marking verified

---

### sibling-auth — Auth APIs & tests

**Owner tag:** `sibling-auth`  
**Scope:** `src/app/api/auth/**`, `src/lib/auth/**`, auth Jest suites

| IDs     | Item                                                   |
| ------- | ------------------------------------------------------ |
| 29–43   | All `/api/auth/*` smoke endpoints                      |
| 415     | `src/__tests__/security/authorization.test.ts`         |
| 416     | `src/__tests__/unit/auth/authentication.test.ts`       |
| 419     | `src/app/api/auth/__tests__/auth.test.ts`              |
| 432–437 | `src/lib/auth/**` tests                                |
| 453     | `src/services/backstage/__tests__/auth.client.test.ts` |

**Exit criteria**

- `npm run test:ci -- src/app/api/auth/__tests__/auth.test.ts` → 21/21 pass (orchestrator confirmed)
- POST `/api/auth/login` returns 401/400 for bad creds, **not** 500 Prisma init error
- Prisma client generated in container (`docker compose build` includes `prisma generate`)

---

### sibling-tenant — Tenant APIs & DB safety

**Owner tag:** `sibling-tenant`  
**Scope:** `src/app/api/tenant/**`, `src/lib/database/**`, tenant security tests

| IDs     | Item                                                   |
| ------- | ------------------------------------------------------ |
| 384–391 | `/api/tenant/*` and `/api/tenants*` smoke              |
| 445     | `src/lib/database/__tests__/parameterized-sql.test.ts` |
| 480     | `tests/database/plugin-database.test.ts`               |
| 494     | `tests/security/multi-tenant-security.test.ts`         |

**Exit criteria**

- Tenant routes use `Prisma.sql` for raw SQL (see `tenant/database`, `tenant/provision` diff)
- `npx jest --selectProjects database --testPathPattern=parameterized-sql` passes
- No string-concatenated SQL in tenant delete/provision paths

## Coordination

1. **Ops first** — sibling-ops rebuilds compose; others wait for healthy `:4400`
2. **Parallel** — health, auth, tenant can run tests locally without docker once DB exists
3. **QA gate** — only sibling with curl/jest output marks items `[verified]` in
   `FACTORY-TODO-500.md`
4. **Council** — review diff after QA; orchestrator opens wave 3 (catalog/plugins batch)

## Self-reflection (orchestrator)

- **Did not fabricate verified statuses** — health OK locally only after `next_portal` DB existed;
  auth login still 500 in container until image rebuild with `prisma generate`
- **Parameterized-sql Jest hung** >4 min — likely open-handle / project config issue; assigned to
  sibling-tenant to diagnose, not marked pass
- **Port 4400 conflict** — local `npm run dev` blocks docker `idp-platform`; ops must document
  stop-local-or-change-port policy
- **DB rename** (`idp_wrapper` → `next_portal`) breaks existing volumes; wave-2 ops should add init
  migration note or `docker compose down -v` for clean dev
