# W6-VER-01 — independent verification

- Repo: `C:\Users\Riley\Desktop\HiveRouter`
- Baseline: `docs/AUDIT-WAVE-6/baseline.sha256` — 150 files.
- Final: `docs/AUDIT-WAVE-6/final.sha256` — 162 files.
- Diff: **12 changed + 12 added + 0 missing**; the 12 changed are exactly the 11 production files plus `test/unit/logic-core.test.ts` (approved dataDir isolation only), and the 12 added are the approved regression test files.
- Server: restarted on the new tree; B2 healthy; no active run; 26 persisted runs.

## Commands and observed output

| Gate | Command | Observation |
|---|---|---|
| Typecheck | `npm.cmd run typecheck` | exit 0 (Lead, after writer) |
| Unit | `npm.cmd run test -- --run` | **50 files / 312 tests passed** |
| Build | `npm.cmd run build` | exit 0; only pre-existing Vite >500 kB advisory |
| Full gate | `npm.cmd run verify` | exit 0 (typecheck + 312 tests + build + sweeps) |
| E2E | `npm.cmd run e2e` | **26 passed** |
| Stage | `node scripts\assert-stage.mjs --stage=p7 --json` | `ok:true`, **files 162 / tables 45 / routes 48 / scripts 24**, `violations: []` |
| Preflight | `npm.cmd run preflight -- --port 0 --json` | exit 0 after stopping the dev server; node/npm/disk/ram/chrome/port pass |
| Stub sweep | `npm.cmd run stub-sweep` | clean, 86 files |
| Secret scan | `npm.cmd run secret-scan` | clean, 160 files |

## Live API checks

- `GET /api/runs/run_abf5fe78aab1e932ff/events?after=0` → **108 events, truncated:false, lastEventId:659**. The previous global-seq false positive is gone; `run.queued` and `repair.stalled` are returned.
- `GET /api/runs/run_95c11797b4923b4277/snapshot` → `run.costUsd: 0.25078177199999996`, `limits.maxCostUsd: 0.5`. The cap comes from the per-run source.
- `GET /api/runs/run_95c11797b4923b4277/routing` → decision reason is derived, e.g. `prior-based selection (n=0) · model deepseek-flash · thinking disabled`; the hardcoded literal is gone.
- `GET /api/runs/run_95c11797b4923b4277/context` → included items carry `included:true`; excluded rows are supported; Tokens/Chars columns are removed from the UI because the data never had them.
- `GET /api/runs/run_95c11797b4923b4277/checks` → every row carries a distinct `rowId`; the dead Time/code columns are removed.
- `GET /api/learning/overview` → `enabled:false`, `E_LEARNING_POOL_EXHAUSTED`, `sealedBlocks:0`, `completeSealedBlocks:0`, consent inactive, `promotions:0`. P7 remains honestly refused.

## Live browser checks (`lead-final-verify.ts` evidence)

- `run_abf5`: **Failed · Done · 20 steps · Terminal · Snapshot**; Events tab heading **Persisted events**; DOM contains `run.queued` and `repair.stalled`; no `Artifacts truncated` badge.
- `run_95`: **Completed**; estimated spend reads **`$0.2508 / $0.5000 cap`**; Context table has **no Tokens/Chars** column; Checks table has **no Time** column; Routing tab contains **no `static prior route`** literal.
- Console had one 404 for `/favicon.ico`; this is the pre-existing, deferred F10 cosmetic defect, not a regression.
- Screenshots: `verify-abf5-events.png`, `verify-run95.png`; earlier baseline/fix screenshots are under `docs/AUDIT-WAVE-6/`.

## Trace skill

- Updated `C:\Users\Riley\.dsh\skills\trace\SKILL.md` and mirrored to `C:\Users\Riley\.agents\skills\trace\SKILL.md`.
- Version **1.2.0**; SHA-256 for both copies: `996071B14C5AE5022CB5A70B433911CE737580B7BE5F45CC6F5565700C3A9A0C`.
- Research note: `docs/AUDIT-WAVE-6/verification/trace-skill-research.md`.
- Added event/payload/terminal-state trace, emitted/subscribed/delivered parity, live-vs-persisted payload shape, terminal usage truth, per-run truncation, error-code identity, derived-value provenance, timestamp reconciliation, peer-file/recipe verification and state-guard safety.

## Unverified (honest blockers)

- **Live→terminal Events-tab transition** was not executed (no non-terminal paid run; faking it is forbidden). The selector truth table and fresh-terminal path are proven; the transition remains unverified.
- **Provider-failure runtime** for the `run.ts` agent-step mapper and **plan-agent runtime** (AF-09) require paid provider calls, which the gate prohibited; pure helpers, manager integration, and static wiring are proven.
- **AF-01 gate-event payload at runtime** is code-inspection only; the catch/executor paths are runtime-tested.
- **>500-event replay boundary** tested with window 3, not the real 500 cap; no such run exists.
- **SSE 410 reconnect loop** client half remains unverified (no >500-event backlog).
- **No paid `test:live`** was run in this batch by design; the last baseline live smoke was `$0.0000321` on the prior tree. This is a deliberate no-spend verification, not a green live claim.
- **Historical rows**: the seven failed/budget runs still have NULL cost/tokens by policy; no backfill. The new terminal writer will populate future runs.
