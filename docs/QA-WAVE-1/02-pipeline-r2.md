# 02-pipeline — Round 2 Independent Re-Verification (read-only)

**Checkpoint:** `docs/QA-WAVE-1/P1-FIXES.md` (2026-11-03T10:50-06:00). No product edits. Only this report and `logs/qa-pipeline-r2.md` written.
**Verdict:** **PASS WITH RESIDUALS** — 6/6 requested items pass on their stated path; 3 residual risks recorded (one P1, two P2). No paid call, no key access, no server restart, no git write.

## Results

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Ad-hoc `tests` output uses `TestsSchema` and multiple files | **PASS** | Code read + local probe. `run.ts:308` tests branch is before files (`:319`), calls `TestsSchema` (`:310`), loops `tests.files` and pushes every path (`:313-318`); `app.ts:248` requires `targetPath` only for `outputKind === 'files'`. Probe output: `{"testsBranchBeforeFiles":true,"usesTestsSchema":true,"writesMultiple":true,"routeRequiresTargetOnlyForFiles":true,"schemaAcceptsTwoFiles":true,"fileCount":2}`. |
| 2 | `verifyStaged` plan filtering skips unplanned syntax and reports `verification.plan` | **PASS** | Local probe with invalid `bad.py`, plan containing only `path.safety`/`secret.scan`/`stub.scan`. `WITH_PLAN=[{"id":"verification.plan","status":"warn"},{"id":"syntax.all","status":"pass"}]`; `CONTROL=[{"id":"syntax.py","status":"fail"}]`. Code: `verifier.ts:24,82,106`. |
| 3 | `usageTotals` cache/reasoning + trace insertion | **PASS (usage VERIFIED; trace READ)** | Local DB probe: `USAGE_TOTALS={"costUsd":0.02,"promptTokens":1000,"completionTokens":500,"cacheHitTokens":400,"cacheMissTokens":600,"reasoningTokens":100}` (1 usage row). `recorder.ts:355-376` sums cache hit/miss/reasoning; `run.ts:54-70` insert has `cache_hit_tokens/cache_miss_tokens/reasoning_tokens` placeholders and passes `usage.cacheHitTokens/cacheMissTokens/reasoningTokens`. No runtime trace row was created (would require a full pipeline run; not done). |
| 4 | `maxCostUsd` propagation app→manager→budget | **PASS (targeted test)** | `app.ts:261,524` pass `maxCostUsd`; `manager.ts:83-85` validates, `:115-118` stores `run_limit:<id>`; `budget.ts:20-31,58` reads it in `scopeCap`/`reserve`. `npm.cmd test -- --run test/unit/logic-core.test.ts -t maxCostUsd` → **1 passed, 10 skipped**. Residual: CCR (`run.ts:451`) and L4 (`run.ts:871`) still use the global cap. |
| 5 | L4 guard call writes `learning_audit` without failing the run | **PARTIAL** | Normal path: `run.ts:867-883` evaluates `evaluateLoopGuard`, adds a non-mandatory `loop.guard` warning when action ≠ continue, then inserts `learning_audit`; local DB probe inserted and read back `{"decision":"continue","auditRow":{"actor":"pipeline","action":"loop_guard"}}` and full tests pass. **Fail-safe residual:** the insert (`run.ts:880-882`) is unguarded; a DB error would throw from `finalize` and fail the run. No runtime failure was induced. |
| 6 | No regression in `npm.cmd test` / `typecheck` | **PASS** | `npm.cmd test` → **26 files passed, 209 tests passed** (36.10s). `npm.cmd run typecheck` → exit 0, no output. |

## Residuals / requests for Lead

1. **P1 — per-run cap not used by CCR or the L4 guard.** `run.ts:451` passes `config.limits.maxRunCostUsd` as `policy.budgetUsd`; `run.ts:871` passes it as guard `capUsd`. `budget.scopeCap` honors `run_limit:<id>` (verified), so a $0.01 run is reserved correctly but may be planned/guarded against $0.50 and stop mid-run. Fix: read the run limit (or expose a `runCapUsd` helper) before CCR/guard, or thread the cap through `CreateRunInput`/snapshot.
2. **P2 — `learning_audit` insert can fail the run.** Wrap the `INSERT` in a bounded try/catch (or make telemetry best-effort) so an audit write cannot turn a completed run into `failed`. Add a failure-injection test.
3. **P2 — trace integrity/provenance.** `recordRunTrace` still writes `provenance='live'` and null `step_id`/`agent_id` for every run, and `finalize` sets `trace_complete=1` before/without checking the insert succeeded. A mock/synthetic run can be labelled live; a failed trace write can be reported complete. Fix: pass provenance, write per-step or at least real agent/step, and set `trace_complete` only after a verified insert.
4. **P2 — `verification.plan` is warn-only; `syntax.all` is `pass` even when every syntax check was skipped.** The plan detail records skipped count, but no explicit `syntax.skipped` check; a consumer may read `syntax.all: pass` as "all syntax checked." Add a `syntax.skipped` warning/unverified check or make the plan detail mandatory-visible.
5. **P2 — ad-hoc empty input still returns `E_PROMPT_TOO_LARGE` (`run.ts:301`).** Unchanged from the prior round; wrong named error. Use an input-required/empty-input refusal.
6. **Accepted by P1-FIXES:** whole-tree atomic finalize is not claimed; generated code is not executed; P7 live promotion remains refused by pool/consent. Not re-litigated here.

## What I actually ran (quote)

- Ad-hoc probe: `node --import tsx --input-type=module` stdin script importing `TestsSchema` and reading `run.ts`/`app.ts`; output above.
- RVS probe: same inline tsx, `verifyStaged` with invalid `bad.py`; output above.
- Usage probe: inline tsx, temp `HIVE_DATA_DIR`, `openDatabase(...,'B2')`, `createRunRow` + `insertUsage` with cache 400/miss 600/reasoning 100; output above.
- Guard probe: inline tsx, temp DB, `evaluateLoopGuard` + `learning_audit` insert/read; output above.
- `npm.cmd test -- --run test/unit/logic-core.test.ts -t maxCostUsd` → `1 passed | 10 skipped`.
- `npm.cmd test` → `26 passed (26)`, `209 passed (209)`.
- `npm.cmd run typecheck` → exit 0, no output.

## Claim strength / limits

- **VERIFIED:** targeted tests, full test count, typecheck exit 0, the four inline probes.
- **READ:** trace insert SQL/params, app/manager/budget line path, guard insert fail-safety, residual maxCost CCR/guard use.
- **INFERRED:** failure impact of unguarded audit insert; no failure injection was run.
- **UNVERIFIED:** a real trace row from a full pipeline run; live/mock provenance; no paid call or server restart. Read-only constraint respected; only the two named docs/log files were written.
