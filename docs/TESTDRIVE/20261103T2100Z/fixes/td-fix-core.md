# td-fix-core — FIX1 summary

**Status: PARTIAL** — both owned test-start blockers fixed with RED→GREEN; targeted tests green. `npm.cmd run typecheck` is currently red only in another seat's `e2e/ui-audit.spec.ts`, and live cards still require the Lead's server restart to load this source.
**Scope:** `src/server/runs/**`, `db/**`, `security/**`, `logic/**`, `pipeline/**`, `llm/**` only. No server restart/install/key/git.

## Findings

### TD1-CORE-01 — P0 — low per-run caps fail before work despite low actual spend
- **RED:** `RESERVE_RED E_BUDGET_EXCEEDED` for run cap `$0.03`, prompt 4000 chars, requested output 32,768. Historical `run_23af9b7837448cb24a` ($0.05 cap) spent only `$0.01270053` before `sentinel` failed with `E_BUDGET_EXCEEDED`.
- **Cause:** every call reserved the worst-case 32,768 output tokens (~`$0.0401`), so the next reservation failed even though actual spend was a fraction of the cap. Test cards TD-03/04/05/06 use `$0.03–$0.10` caps.
- **Fix:** `runs/manager.ts:210-230` `maxAffordableOutputTokens()` lowers the requested output ceiling until the worst-case reservation fits the run's remaining cap (floor 512); `pipeline/agent-runner.ts:40-47,91-98` passes that fitted ceiling to both `reserveLlmCall` and the provider. Safety is preserved: the provider cannot exceed the reserved worst case.
- **GREEN:** `RESERVE_GREEN {"fit":24576,"id":true}`; probe for `$0.03` now reserves 24,576 tokens instead of throwing. Targeted `logic-core` + `llm.client` + `pipeline-qa` all pass.
- **Residual:** JSON-repair retries inside one `chatJson` call still share one reservation; a repair storm can exceed the reservation and surface `E_BUDGET_OVERCOMMIT`. Not exercised by test cards; candidate for FIX2.

### TD1-CORE-02 — P1 — `needs_review` survives restart and blocks the one-active-run guard
- **RED:** `BEFORE run_review`; `INTERRUPTED 0`; `AFTER {"status":"needs_review","active":"run_review"}`. `getActiveRunId()` includes `needs_review` (`runs/manager.ts:28`), but `markStartupInterrupted()` updated only `queued|running|paused` (`:182-193`). After a restart, an abandoned review run permanently blocks every new run.
- **Fix:** include `needs_review` in the startup selection/update and in the lease-release loop (`manager.ts:184-192`). `cancelRun` already handled it at `:167`.
- **GREEN:** `STARTUP_GREEN {"before":"run_review","n":1,"status":"interrupted","after":null}`. Lease release remains in the same path.

## Verification
- `npm.cmd run typecheck` → **red only in `e2e/ui-audit.spec.ts`** (`Property 'input'/'targetPath' does not exist on type 'never'`), owned by td-fix-experience; no diagnostics in owned files.
- `vitest run test/unit/logic-core.test.ts test/pipeline-qa.test.ts test/unit/llm.client.test.ts` → **28/28 passed**.
- `vitest run test/unit/logic-budget-policy.test.ts test/unit/logic-run-state.test.ts` → **18/18 passed**.
- Live `/api/health` B2, key fingerprint only, `/api/runs/active` → `{"activeRunId":null}`; no active run at sweep time.
- No server restart, paid call, install, git write, key access, or out-of-scope edit.

## Residuals
- Live TD-03/04/05/06 remain **UNVERIFIED** until the Lead restarts the server on this source tree; no paid card was run by this seat.
- Accepted risk AUD-1: `pipeline/run.ts` finalize is per-file, not whole-tree atomic.
- Typecheck gate is blocked by the other seat's e2e file until that owner fixes it.
