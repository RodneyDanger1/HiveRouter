# qa-core — seat 1 journal

**STATUS:** PASS-WITH-NOTES (owned scope green; external typecheck blocker)
**Wave:** QA-WAVE-1 · checkpoint 2026-11-03T10:22:05-06:00
**Scope:** runs/db/security/logic + four gate scripts + logic/script tests only.
**Budget:** 10:22–10:34 America/Chicago.

## 10:22 — read / frame
- Read WAVE-SHEET, AGENTS.md, PLAN-v3 relevant sections, owned source, `pipeline/run.ts`, `app.ts`, `index.ts`.
- Lenses: logic-debugger (state/idempotency), forge (root cause), smartfix (RED/GREEN), capability-auditor (claims), auditor (independent probe), systems-validator (CLI/path).
- Hypotheses:
  - H1 budget cap counts reservation amounts after partial commit;
  - H2 expired idempotency keys collide;
  - H3 unknown usage becomes zero;
  - H4 path safety misses multi-extension device names;
  - H5 completion bypasses finalizing;
  - H6 assert-stage ignores UI routes.

## 10:24 — RED probes (before fixes, captured in shell)
```
BUDGET {"oldActiveMicro":3000000,"fixedActiveMicro":1000000,"actualCommitted":1000000,"cap":4500000}
USAGE {"oldCost":0,"fixedCost":null,"expected":null}
IDEMPOTENCY {"oldInsert":"throws","error":"UNIQUE constraint failed: k.key_hash"}
PATH {"oldReserved":false,"fixedReserved":true}
SECRET {"oldKeyMatch":false,"fixedKeyMatch":true}
STAGE {"oldUiRouteAllowed":false,"fixedUiRouteAllowed":true}
```
- H5 contradiction: `STATUS_TRANSITIONS.running` includes `completed`; `PHASE_TRANSITIONS.generating` does not require `finalizing`; old `transitionRun` checked status only.
- H4 startup: old `markStartupInterrupted` (`manager.ts:152-157`) updated runs only, no budget release.

## 10:25 — fixes
- `budget.ts:40-43` committed-actual SUM; `budget.ts:100-106` canAfford includes holds; `budget.ts:108` releaseReservationsForRun.
- `manager.ts:118` delete expired key before insert; `manager.ts:155-166` release interrupted leases.
- `recorder.ts:355-366` return NULL if any usage row source=unknown.
- `paths.ts:34` reserved name check uses first dot segment.
- `run-state.ts:182-188` success terminal requires phase done.
- `assert-stage.mjs:265` allow API + UI routes.
- `check-secrets.mjs:9` include `_`/`-` in sk- pattern.

## 10:27 — GREEN
Command: `node_modules\.bin\vitest.cmd run test/unit/logic-core.test.ts test/unit/logic-run-state.test.ts test/scripts.test.ts`
Observed:
```
✓ test/unit/logic-core.test.ts (7 tests)
✓ test/unit/logic-run-state.test.ts (10 tests)
✓ test/scripts.test.ts (10 tests)
Test Files 3 passed; Tests 27 passed
```
Command: `npm.cmd test`
Observed: **26 files / 205 tests passed**, exit 0.
Command: `npm.cmd run stub-sweep -- --json` → `"ok": true`, 77 files, 0 hits.
Command: `npm.cmd run secret-scan -- --json` → `"ok": true`, 122 files, 0 hits.
Command: `npm.cmd run assert-stage -- --stage=p7 --json` → `"ok": true`, `"fallback": false`, exit 0.
Command: `npm.cmd run preflight -- --port 0 --json` → **RED** `E_RESOURCE_INSUFFICIENT`, RAM 0.4 GB vs 1.5; host pressure, not code.
Command: `npm.cmd run typecheck` → exit 2: `test/pipeline-qa.test.ts(14,44): error TS2305 ... 'plannedTestFiles'`. Owned files: no diagnostics.
**10:31 recheck:** `npm.cmd run typecheck` → **exit 0** after qa-pipeline fixed its test; full suite 205/205 remained green.

## 10:31 — residuals / cross-scope (not edited)
1. `pipeline/run.ts:792-864` finalize writes accepted tree file-by-file; not atomic dir swap. qa-pipeline.
2. `app.ts:484-505` no-Last-Event-ID >500 events replays oldest 500 and misses rest. qa-api.
3. `index.ts:14` reaper only at startup; no periodic reaper. API/server wiring.
4. Typecheck external error — **resolved** at 10:31 by owner; final exit 0.
5. preflight RAM 0.4/1.5 under current load; rerun idle.
6. one-active-run process-local; no partial unique index. INFERRED future multi-process risk.

## Files changed
- `src/server/runs/budget.ts`
- `src/server/runs/manager.ts`
- `src/server/runs/recorder.ts`
- `src/server/security/paths.ts`
- `src/server/logic/run-state.ts`
- `scripts/assert-stage.mjs`
- `scripts/check-secrets.mjs`
- `test/unit/logic-core.test.ts` (new)
- `test/scripts.test.ts`

No out-of-scope edits. No installs, restart, git, key access, or paid calls.
**STATUS: PASS-WITH-NOTES.**
