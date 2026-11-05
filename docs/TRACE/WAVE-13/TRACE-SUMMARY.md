# Wave 13 — terminal writer truth evidence

Date: 2026-11-05
Baseline: `ef8a838` (443 tests / 69 files; 34/34 E2E; 200 stage files / 51 tables)
Final: **447 tests / 70 files**, **34/34 E2E**, stage **202 files / 51 tables / 62 routes / 24 scripts**, `verify` exit 0, preflight PASS (free RAM 1.91 GB, disk 9.06 GB).

## Defect

Terminal truth was split across writers:

- `updateRun` wrote a terminal run but did not settle an open `steps` row.
- `markStartupInterrupted` used raw guarded SQL and left open steps and no trace.
- `cancelRun` for a no-controller paused/queued/needs_review run left open steps and no trace.
- The manager executor catch left open steps and no trace.
- The terminal trace producer lived in `pipeline/run.ts`, so manager paths could not use it without a cycle.

## Change

- `src/server/runs/recorder.ts`: terminal `updateRun` now calls `settleOpenSteps()`; the helper closes only `steps.status = 'started'`, with `failed` for failed/budget/interrupted and `cancelled` for cancelled.
- `src/server/runs/terminal-trace.ts` (new): shared `recordRunTerminalTrace`; P7-gated, upsert-safe, same usage/checks/error behavior as the old pipeline function.
- `src/server/pipeline/run.ts`: `recordRunTrace` is now a thin wrapper over the shared producer.
- `src/server/runs/manager.ts`: executor catch, no-controller cancel, startup interrupt, and `markTerminal` record the terminal trace and set `trace_complete` from its result; startup interrupt explicitly settles steps because it deliberately uses guarded raw SQL.
- New `test/unit/terminal-writers.test.ts`: four terminal paths across run, step, event, snapshot, usage, and trace.

## RED evidence

Restored the pre-Wave-13 `recorder.ts`, `manager.ts`, and `pipeline/run.ts` while keeping the new test:

```
Test Files  1 failed (1)
Tests  4 failed (4)
AssertionError: expected true to be false   # open step still started
AssertionError: expected false to be true   # trace_complete missing
```

All four terminal tests failed. Restored the fix:

```
Test Files  1 passed (1)
Tests  4 passed (4)
```

## Claim/evidence

| Claim | Evidence | Status |
|---|---|---|
| Failed executor path closes step | test 1, `getSteps` | VERIFIED |
| No-controller cancel closes step as cancelled | test 2 | VERIFIED |
| Budget terminal closes step and traces | test 3 | VERIFIED |
| Interrupted closes step, event, trace | test 4 | VERIFIED |
| Snapshot reflects terminal run/step | all four via `/api/runs/:id/snapshot` | VERIFIED |
| Usage remains measured | run cost/usage assertions | VERIFIED |
| Full suite | `npm.cmd test` → 447 / 70 | VERIFIED |
| E2E | `npm.cmd run e2e` → 34/34 | VERIFIED |
| Stage | 202 files / 51 tables / 62 routes / 24 scripts, violations [] | VERIFIED |
| Preflight | PASS, RAM 1.91 GB, disk 9.06 GB | VERIFIED |
| Budget terminal event | `markTerminal` itself does not emit; the pipeline budget path emits `run.failed` | PARTIAL / UNVERIFIED in this fixture |
| Paid live run | no paid provider call | UNVERIFIED |

## Residual

- The budget test exercises `markTerminal` (run/step/snapshot/usage/trace); event emission for a real budget catch remains covered by the pipeline catch design, not this fixture.
- Startup interrupt traces are written only when P7/learning is enabled; A/B phases return false and write no trace row.
- No API shape or UI change.
