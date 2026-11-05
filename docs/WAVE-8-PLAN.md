# Wave 8 decision plan — finish one honest slice, then prove it live

Date: 2026-11-05
Lead: HiveRouter working copy at `C:\Users\Riley\Desktop\HiveRouter`
Baseline: `ca00a26` (424 tests / 65 files; 193 stage files / 50 tables / 61 routes / 24 scripts)

## Execution status

Implemented and verified on 2026-11-05: `/scripts` page, nav, client/types, known-SPA entry, `uiRoutes` census, 4 API tests, and a live Playwright trial. Full suite **428 tests / 66 files**, E2E **29/29**, stage **195 files / 50 tables / 62 routes / 24 scripts**, preflight PASS. Three live trials and the CUA false-negative analysis are recorded in `docs/TRACE/WAVE-8/`.

## 1. Outcome

After this wave, a reviewer can open a real **Scripts** surface in the operator console, see the exact safety class and dry-run support for every shipped script, request a **dry-run command without executing anything**, and receive a named refusal for the two paid scripts. The reviewer can repeat three black-box live trials against the rebuilt server: scripts, static analysis, and published-run search. Every trial has screenshots / network evidence and a verdict.

This wave does **not** claim the whole backlog is complete. It finishes P1-10 (scripts UI/schema), adds the missing live-test evidence, and fixes only defects the live trials prove.

## 2. Current behavior (evidence)

- `GET /api/scripts` returns 8 scripts with `id`, `name`, `safety`, `dryRun`, `description`: `src/server/app.ts:711-724`.
- `POST /api/scripts/:id/dry-run` allows only `preflight`, `stub-sweep`, `secret-scan`, `assert-stage`, `replay`, `integrity`; returns `{script,dryRun,message}`; unsupported ids return `E_SCRIPT_DRY_RUN_UNSUPPORTED`: `src/server/app.ts:726-732`.
- Both routes are already in the P7 release allowlist: `config/releases/p7.json:36-37`.
- **No scripts page exists.** `web/src/App.tsx` has no `/scripts` route; `web/src/components/AppShell.tsx` has no Scripts nav item; `web/src/pages/` has no `ScriptsPage.tsx`.
- Existing test coverage covers the script implementations (`test/scripts.test.ts`, `test/unit/scripts-agents.test.ts`) but not the API/UI contract.
- `/analysis` and run Search are wired (`web/src/pages/AnalysisPage.tsx`, `web/src/pages/RunDetailPage.tsx`), but have no recorded black-box live trial in this wave.

## 3. Decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Add a real `/scripts` SPA page and nav entry | Put the list in Settings | A script catalog is an operator capability, not a settings value; it needs its own readable surface and route |
| Keep dry-run as a **command hint only** | Execute scripts from the web process | The server must never spawn arbitrary repo scripts; current contract is already non-executing and must stay that way |
| Add `/scripts` to `uiRoutes` and the SPA route table | Omit it from the census | Stage/OpenAPI/UI census parity is part of the project contract |
| Add one new E2E test for the core path | Rely on manual screenshots only | The page must be re-runnable by anyone; a Playwright test is the lowest-cost proof |
| Treat `safety:'paid'` as disabled-by-name, not hidden | Hide paid scripts | The operator must see why a script cannot be dry-run; hiding it creates a mystery |
| 3 live trials: scripts, analysis, run search | Start a paid generation run | Zero provider spend; all three exercise real API/UI paths on the current build |
| Defer approval/needs_review, tool loop, P7, repo index | Implement one of them now | Each is a larger product change with its own state-machine and security review; this wave keeps the test seam coherent |

## 4. File-by-file change

### `web/src/pages/ScriptsPage.tsx` (new)

- Fetch `GET /api/scripts` with `useApiResource`.
- Render `PageHeader` + warning that dry-run is a **command hint**, never remote execution.
- Table/cards: name, id, safety, description, dry-run availability, action.
- `dryRun` action calls `POST /api/scripts/:id/dry-run`; shows returned command; renders `ApiError` by name.
- Paid/unsupported scripts render a disabled button with the exact reason.
- Loading, empty, error, and refusal states are explicit.
- No execution, no shell, no `eval`.

### `web/src/api.ts`

- Add `getScripts(signal?)` → `{ scripts: ScriptInfo[] }`.
- Add `dryRunScript(id, signal?)` → `{ script, dryRun, message }`.
- Export types from `web/src/api-types.ts`.

### `web/src/api-types.ts`

- `ScriptSafety = 'read' | 'paid' | 'write'`.
- `ScriptInfo { id; name; safety; dryRun; description }`.
- `ScriptDryRunResult { script; dryRun; message }`.

### `web/src/App.tsx`

- Import and route `/scripts`.

### `web/src/components/AppShell.tsx`

- Add `Scripts` nav item with a lucide icon (`Terminal` or `ScrollText`).

### `config/releases/p7.json`

- Add `/scripts` to `uiRoutes`.
- Route count becomes 62; stage file count becomes 195 (new page + new API test).

### Tests

- `test/unit/scripts-api.test.ts` (new): `GET /api/scripts` returns exactly 8 scripts; every `dryRun:true` id is accepted by POST; `bench` and `learn` return `E_SCRIPT_DRY_RUN_UNSUPPORTED`; unknown id is refused; response shape is stable.
- `e2e/scripts.spec.ts` (new): navigate `/scripts`; assert the header/table; dry-run `preflight` shows `npm.cmd run preflight`; assert paid `bench` has no enabled dry-run action; screenshot.
- Existing `test/unit/analysis-api.test.ts` and `run-search` tests remain the API pins for trials 2–3.

### Docs / census

- `README.md`: add Scripts to capabilities/API/quick links; update counts after gates.
- `docs/CAPABILITY-MATRIX.md`: P1-10 changes from absent to **Works (read-only catalog + command hint)**.
- `docs/PLAN-v3.md`: append Wave 8 decisions/evidence and the three trials.
- `docs/TRACE/WAVE-8/`: `01-capability-audit.md`, `02-trace.md`, `terminal-truth.md` (if a run is inspected), `runtime.json`, `TRACE-SUMMARY.md`.

## 5. Failure modes

| Failure | Behavior |
|---|---|
| Scripts API unreachable | Page shows retryable `ErrorPanel`; no invented list |
| Unknown script id in POST | 422/4xx `E_SCRIPT_DRY_RUN_UNSUPPORTED` with the id; UI renders the code, not a success |
| Paid script dry-run | Disabled control + explicit "not a dry-run endpoint" copy; direct POST still refused by server |
| Empty list | Explicit empty state, not a blank table |
| Duplicate POST | Dry-run is read-only and returns the same command; no idempotency requirement because no state changes |
| Route missing from stage census | `assert-stage` fails; add `/scripts` to `uiRoutes` |
| SPA returns 404 on refresh | Add `/scripts` to the known SPA route list in `app.ts` |
| Live server stale | Build + restart before trials; compare `/api/health` time and route |
| Trial run has no published files | Search trial uses a completed run with accepted artifacts; if none, the trial records `BLOCKED` rather than fabricating a pass |

## 6. Tests and commands

```powershell
npm.cmd run typecheck
npm.cmd test -- --run test/unit/scripts-api.test.ts
npm.cmd test
npm.cmd run build
npm.cmd run e2e
npm.cmd run assert-stage -- --stage=p7 --json
```

Acceptance:
- Scripts page loads with 8 rows.
- `preflight` dry-run returns a command containing `npm.cmd run preflight` and **does not** execute it.
- `bench` cannot be dry-run; server refuses with the named code.
- Analysis graph produces bounded nodes/edges/dominators.
- Run Search on a completed run returns indexed-file count and a real match; short query uses the LIKE fallback.
- Every trial has screenshot + network/API evidence and a verdict.

## 7. Rollback

- Remove `/scripts` from `App.tsx`, nav, `uiRoutes`, and delete `ScriptsPage.tsx` / client functions / tests.
- API routes `/api/scripts*` remain (pre-existing), so rollback restores the prior no-UI state without DB migration.
- No schema migration, no data mutation, no provider call.

## 8. Out of scope / blockers

- Approval/`needs_review` producer and decision API (P1-5).
- Tool-call loop and read-only repo tools (P1-2/P1-3).
- P7 evaluator / sealed pool / consent (P2-1).
- Full checkpoints and parallel generation (P1-6/P1-7).
- Patch/compaction/branch wiring (P1-8).
- Paid live generation: **not** run in this wave.
- CUA native driving is available (`cua-driver 0.28.2`); if the browser binding is unavailable, the trial records `UNVERIFIED` and uses Playwright as the fallback evidence, explicitly labelled.
