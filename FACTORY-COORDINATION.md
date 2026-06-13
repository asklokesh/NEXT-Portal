# Factory coordination protocol

## Agent cap: 5 concurrent subagents max

## Shared artifacts

| File                        | Purpose                                                       |
| --------------------------- | ------------------------------------------------------------- |
| `FACTORY-TODO-500.md`       | 500 functionality items — status `pending` or `verified` only |
| `FACTORY-QA-REPORT.md`      | QA gate output; may downgrade false verified                  |
| `FACTORY-COUNCIL-REVIEW.md` | Cross-team code review                                        |
| `FACTORY-RESTART-LOG.md`    | Docker compose restart log per iteration                      |
| `FACTORY-WAVE-*-BRIEF.md`   | Orchestrator batch assignments                                |

## Rules (non-negotiable)

1. **Never mark verified without command output** saved in QA report or todo evidence line.
2. **Docker restart after each fix wave**: `docker compose down && docker compose up -d --build`
3. **Scope boundaries**: Ops = compose/Dockerfile/env; Dev = src/\*\*; QA = tests/smoke only.
4. **QA gate** re-runs evidence before any verified status sticks.

## Regenerate todos

`node scripts/generate-factory-todos.mjs` — preserves existing verified IDs.

## Docker (dev)

- Target: `development` (avoids OOM production build in Docker)
- App: http://localhost:4400
- Health: `curl -sf http://localhost:4400/api/health`

## Wave cadence

1. Orchestrator assigns ID ranges
2. Dev teams fix + run targeted tests
3. Ops restarts compose
4. QA verifies + updates report
5. Council reviews diff
6. Orchestrator closes wave, starts next batch
