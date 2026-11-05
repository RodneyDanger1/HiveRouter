# td-fix-core — TestDrive FIX1 journal

**Status:** PARTIAL — 2 owned blockers fixed; external typecheck red; live cards need Lead restart.
**Window:** 2026-11-03 15:04–15:11 America/Chicago.
**Skills:** logic-debugger (primary), forge, capability-auditor, research (not needed).

## 15:04 — preflight / frame
- Read testdrive SKILL, wave sheet, TEST-CARDS, AGENTS.
- Live health: B2, key configured `c30cfdbc`, db ok. `/api/runs/active` = null. No active run.
- Recent `run_23af...` ($0.05 cap) spent $0.0127 then failed `E_BUDGET_EXCEEDED` at `sentinel`; steps showed successful architect/generation/cleaner.
- Hypotheses: worst-case reservation blocks low caps; stale `needs_review` blocks restart.

## 15:05 — RED probes (before edits)
Budget probe (cap $0.03, prompt 4000, requested 32768):
```
RESERVE_RED E_BUDGET_EXCEEDED
```
Historical run evidence:
`run_23af9b7837448cb24a limit {"maxCostUsd":0.05}; usage cost 0.01270053; step 11 sentinel failed E_BUDGET_EXCEEDED`.
Startup probe:
```
BEFORE run_review
INTERRUPTED 0
AFTER {"status":"needs_review","active":"run_review"}
```

## 15:06 — fix 1 (budget fit)
- `src/server/runs/manager.ts:210-230`: `maxAffordableOutputTokens` walks the output ceiling down (floor 512) until `canAfford` is true; otherwise throws.
- `src/server/pipeline/agent-runner.ts:40-47,91-98`: compute requested ceiling, fit it, pass fitted ceiling to both `reserveLlmCall` and `chatJson`/`chat`.
- Safety: provider cannot exceed fitted ceiling; reservation covers the fitted worst case.

GREEN:
```
RESERVE_GREEN {"fit":24576,"id":true}
```

## 15:07 — fix 2 (startup recovery)
- `src/server/runs/manager.ts:184-192`: include `needs_review` in startup select/update and lease release. `getActiveRunId` already includes it.
GREEN:
```
STARTUP_GREEN {"before":"run_review","n":1,"status":"interrupted","after":null}
```

## 15:08 — verification
Command: `cmd /c "node_modules\.bin\vitest.cmd run test/unit/logic-core.test.ts test/pipeline-qa.test.ts test/unit/llm.client.test.ts"`
Observed: **3 files / 28 tests passed**.
Command: `cmd /c "node_modules\.bin\vitest.cmd run test/unit/logic-budget-policy.test.ts test/unit/logic-run-state.test.ts"`
Observed: **2 files / 18 tests passed**.
Command: `cmd /c "npm.cmd run typecheck"`
Observed: **exit 2** — errors only in `e2e/ui-audit.spec.ts:321-322` (`Property 'input'/'targetPath' does not exist on type 'never'`), owned by td-fix-experience. No owned diagnostics.

## Residual / out of scope
- Live TD-03/04/05/06 not run; no server restart and no paid provider run by this seat.
- JSON repair retries share one reservation; possible overcommit in repair-heavy calls (FIX2 candidate).
- Accepted AUD-1 per-file finalize remains.
- No app/routes/web/package/key/server/git/install touch.

**Status: PARTIAL.**
