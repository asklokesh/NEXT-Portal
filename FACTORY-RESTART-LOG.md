# Factory docker restart log

## Iteration 1 — 2026-06-13T02:15Z

- Changed compose target: `runner` → `development` (avoid OOM on production build in Docker)
- Added `output: 'standalone'` to next.config.js
- Fixed Dockerfile PORT 4400 alignment
- `docker compose up -d db redis` — **healthy**
- Production docker build failed iteration 0: OOM on `npm run build` (runner target)

## Iteration 2 — 2026-06-13T02:20Z

- Development image built successfully
- Created DB `next_portal` (volume had legacy `idp_wrapper` only)
- `npx prisma db push` — schema synced
- Local `npm run dev` on 4400 (docker idp-platform blocked by port conflict)
- db: healthy, redis: healthy, app: local dev

## Iteration 3 — 2026-06-13T02:21Z

- Freed port 4400, `docker compose up -d` — **all 3 services healthy**
- idp-platform: Up (healthy) on 4400
- Health API: ok (backstage degraded warning in full health but DB/cache ok)
