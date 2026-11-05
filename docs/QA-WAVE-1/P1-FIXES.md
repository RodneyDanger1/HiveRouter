# QA Wave 1 — P1 remediation ledger

**Checkpoint after remediation:** 2026-11-03T10:50-06:00 · HEAD-equivalent: no git; package-lock SHA256 unchanged `ADD08F…7AFF`; plan SHA256 `698C1B…27C7`.
**Final gates observed by Lead:** `npm.cmd run verify` PASS (209 tests / 26 files; typecheck; build; stub-sweep 77 clean; secret-scan 123 clean); `npm.cmd run e2e` **7/7 PASS**; `assert-stage --stage=p7` strict PASS (`fallback:false`); `preflight --port 0` PASS (disk 5.22 GB, RAM 2.05 GB); `test:live --yes` PASS ($0.00001605). Server restarted on the current tree; `/api/health` B2, key configured.

## P1 disposition

| Audit ID | Finding | Disposition | Evidence |
|---|---|---|---|
| AUD-1 | Finalize is per-file, not a whole-tree atomic swap | **ACCEPTED testing-stage risk** (documented; not claimed production-atomic) | `README.md` limitations; per-file `atomicWrite` in `finalize` |
| AUD-2 | Budget overcommit was rolled back with the throwing tx | **FIXED** | `runs/budget.ts` updates committed actual in tx, throws after; `logic-core.test.ts` “records the actual overrun before throwing” |
| AUD-3 | `needs_review` run had no controller, cancel faked success and blocked new runs | **FIXED** | `runs/manager.ts` `cancelRun` marks needs_review/queued/paused cancelled, releases leases; route returns `E_RUN_NOT_CANCELLABLE` if false; test “cancels a needs_review run” |
| AUD-4 | RVS plan persisted but verifier ignored it | **FIXED** | `verifyStaged(..., rvsPlan)` filters planned checks and records `verification.plan`; main pipeline passes `verifyPlan` at both verifier calls |
| AUD-5 | `schema-valid`/live badges minted without evidence | **FIXED** | `/api/agents` now returns full AgentView; badges are `registered` + evidence-backed live (six representative steps) + evidence-backed schema-valid; no unconditional schema-valid |
| AUD-6 | Trace cache/reasoning tokens hardcoded zero | **FIXED** | `usageTotals` sums cache hit/miss and reasoning; trace insert writes them; test expectations updated |
| AUD-7 | Ad-hoc `tests` agents took the single-file branch | **FIXED** | ad-hoc executor branches on `tests` first, uses `TestsSchema`, writes multiple test files; route no longer requires targetPath for tests |
| AUD-8 | repo-map unbounded/unfiltered | **FIXED** | 2,000-file / 10 MB cap, `.env*`/data/.git/binary deny-list |
| AUD-9 | integrity only hashed artifacts | **FIXED** | manifest parity + workspace containment; reports `manifestParity` |
| AUD-10 | `maxCostUsd` ignored | **FIXED** | `CreateRunInput.maxCostUsd` validated; stored as `run_limit:<id>`; `scopeCap`/`reserve`/`canAfford` honor it; both run routes pass it; test pins 0.01 cap |
| AUD-11 | FEATURES/stage flags not enforced | **PARTIAL** — API route gate added (`E_LEARNING_DISABLED` / `E_ROUTING_DISABLED`); pipeline A/B1 branch gating not exercised | app onRequest feature hook |
| AUD-12 | L4 guard had no caller | **PARTIAL** — guard evaluated in finalize, writes `learning_audit` and a warning check; not a full pause state machine | `pipeline/run.ts` finalize |
| AUD-13 | P7 HTTP approvals/promotions/rollback hardcoded | **ACCEPTED** — state-based refusals (`E_LEARNING_POOL_EXHAUSTED` / `E_LEARNING_NO_BASELINE`) replace unconditional stubs; no live promotion without pool/consent/eval | app learning routes; `learn` exit 6 |

## P2 closed

- OpenAPI now has `components.schemas` (`Error`, `Run`, `RunEvent`) and `/openapi.json` JSON.
- `npm.cmd run key:import -- --file|--stdin|--status|--clear` exists; key never echoed.
- `.gitignore` covers `.qa-api-results/`, `.playwright-artifacts/`.
- README updated: 209 tests, 7 E2E, ad-hoc/live-only, P7 refusal, stage manifests present, atomicity residual, LangGraph not the live orchestrator.
- Stage manifests A/P6A/P7 are strict (`fallback:false`).

## Remaining / unverified

1. AUD-1 whole-tree atomic finalize (accepted testing risk).
2. P7 live promotion/rollback (no 390-case sealed pool, no consent, no live paired eval).
3. A/B1 runtime start/flags (route gate only).
4. Multi-process one-active-run, periodic lease reaper, budget overcommit recovery at the LLM boundary.
5. Generated code is not executed by design; all verification is static.
6. Live revise/audit/ad-hoc UI effects are covered by seams/unit tests, not a fresh paid rerun after this remediation.
