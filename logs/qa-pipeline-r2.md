# qa-pipeline-r2 — read-only independent re-verification

HEAD: QA-WAVE-1 remediation checkpoint `2026-11-03T10:50-06:00`
Scope: docs/QA-WAVE-1/02-pipeline-r2.md + logs/qa-pipeline-r2.md only. No product edits.
STATUS: PASS WITH RESIDUALS (6 items; 1 PARTIAL, 5 PASS)

## 10:51 — read
Read P1-FIXES.md. Read run.ts (ad-hoc branch, trace insert, finalize/guard, CCR budget), verifier.ts, recorder.ts usageTotals, app.ts maxCostUsd routes, manager.ts maxCostUsd, budget.ts scopeCap/reserve, guard.ts.

## 10:53 — probes
- Ad-hoc: inline tsx read `run.ts`/`app.ts` + `TestsSchema` with 2 files. Output: `{"testsBranchBeforeFiles":true,"usesTestsSchema":true,"writesMultiple":true,"routeRequiresTargetOnlyForFiles":true,"schemaAcceptsTwoFiles":true,"fileCount":2}`.
- RVS: inline tsx `verifyStaged` on invalid `bad.py` with plan excluding `syntax.python`: `WITH_PLAN=[{"id":"verification.plan","status":"warn"},{"id":"syntax.all","status":"pass"}]`; `CONTROL=[{"id":"syntax.py","status":"fail"}]`.
- Usage: temp DB + `insertUsage` cache 400/miss 600/reasoning 100 → `USAGE_TOTALS={"costUsd":0.02,"promptTokens":1000,"completionTokens":500,"cacheHitTokens":400,"cacheMissTokens":600,"reasoningTokens":100}`.
- Guard: temp DB + `evaluateLoopGuard` + `learning_audit` insert/read → `{"decision":"continue","auditRow":{"actor":"pipeline","action":"loop_guard"}}`.
- `npm.cmd test -- --run test/unit/logic-core.test.ts -t maxCostUsd` → 1 passed | 10 skipped.
- `npm.cmd test` → 26 files passed, 209 tests passed.
- `npm.cmd run typecheck` → exit 0.

## Findings
PASS: (1) ad-hoc tests branch uses TestsSchema/multiple files; (2) RVS filtering skips unplanned syntax and reports verification.plan; (3) usageTotals nonzero cache/reasoning; trace insert code read; (4) maxCostUsd app→manager→budget targeted test; (6) no regression.
PARTIAL: (5) guard writes learning_audit on normal path; insert is unguarded, so a DB failure would fail finalize/run. Local probe only normal path.
RESIDUALS: P1 per-run maxCostUsd not used by CCR (`run.ts:451`) or guard (`run.ts:871`); P2 audit insert fail-safety; P2 trace provenance `live` and null step/agent + `trace_complete` set without checking insert; P2 `verification.plan` warn-only vs `syntax.all pass` when all syntax skipped; P2 empty ad-hoc input returns E_PROMPT_TOO_LARGE (`run.ts:301`).

## Limits
No full pipeline run/live call; no failure injection for audit insert; trace row only code-read; no product edits; only two report/log files written.

## STATUS: DONE
