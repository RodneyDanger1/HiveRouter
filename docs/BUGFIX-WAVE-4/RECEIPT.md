# BUGFIX WAVE 4 — residual closure

## Outcome

The four previously documented residuals are closed at the code/test level: budget reservations are per actual HTTP request; the router supports allocatable budgets above $1 via conservative quantization; route candidates disclose every considered model/thinking/effort; and finalization publishes a complete workspace tree via directory swap with startup recovery. P7 live promotion remains blocked by its external sealed-pool/consent prerequisites, not by an unaddressed code path.

## 1. Per-HTTP-attempt reservations

- Added `onHttpAttemptStart`/`onHttpAttemptEnd` to `ChatRequest`/`ChatOptions` and `#requestWithRetry`.
- Each actual HTTP attempt opens and settles its own reservation; every retry/5xx/timeout is closed even if the request is retried.
- `callAgentJson`/`callAgentText` use the HTTP hooks instead of one structured-attempt reservation.
- **RED:** a 500-then-200 fetch; hooks were absent/one-sided. **GREEN:** `starts=[1,2]`, `ends=[{1,null},{2,cost}]`.
- Live run `run_a5202415c602bd8320`: **6 usage rows**, cost **$0.005652204**, completion successful.

## 2. Router DP above $1

- `selectExact` now quantizes capacity/cost **upward** when `capacityMicro > MAX_DP_CAPACITY`; the exact DP path is unchanged below the ceiling.
- Quantization is conservative: it can reject a marginal route, never publish a route above the cap; the post-DP actual-cost assertion remains authoritative.
- **RED:** `budgetUsd=2` previously returned `E_ROUTE_BUDGET_INFEASIBLE` at the capacity guard. **GREEN:** routing test returns 2 routes with `allocatableUsd=1.6`.

## 3. Per-candidate route disclosure

- `TaskRouteSchema` now carries `candidates: CandidateOption[]`.
- `routeTasks` returns every feasible candidate per selected task.
- `route_candidates` adds `model`, `thinking`, `effort`, and `chosen`; existing databases get additive columns at init.
- `run.ts` inserts every candidate, not only the chosen one; `/api/runs/:id/routing` exposes model/thinking/effort and `chosen`.
- **Live:** 2 tasks, **6 candidates**, 3 candidates each, `src/wave4.py`/`tests/test_wave4.py`, chosen candidate `deepseek-flash/disabled`.

## 4. Whole-tree atomic finalize

- `runs/publish.ts` writes a complete sibling publish tree, then renames old root aside and publish into place; restores the old root if the second rename fails.
- Startup recovery promotes a complete publish tree or restores a prior tree after a crash between renames.
- **Tests:** replacement removes old files; old-tree recovery; complete-publish promotion.
- **Live:** `run_a5202415c602bd8320` workspace contains `src`, `tests`, `manifest.json`, `RUN_REPORT.md`; **no** `.publish-*` or `.old-*` leftovers.

## 5. P7 live learning/promotion

The code path and honest refusal are present (`E_LEARNING_POOL_EXHAUSTED`; UI disabled; `learn`/API refusal), but **live promotion remains blocked**: this workspace has no user-authored 390-case sealed pool and no case-to-provider consent. No synthetic pool, no fake promotion, and no “live” claim were created. `P7_REFUSED` is the valid A/B1 outcome; promotion requires the external pool/consent and a real paired evaluation.

## Gates

- typecheck PASS
- **35 files / 236 tests PASS**
- build PASS
- **26/26 E2E PASS**
- `verify` PASS
- strict stage **142 files / 45 tables / 47 routes / 23 scripts**
- preflight PASS
- live smoke PASS `$0.0000321`
- stub-sweep clean (82 files); secret-scan clean (140 files)

## Residual

- P7 live promotion blocked by absent sealed pool/consent (external data), not claimed done.
- Historical route-candidate rows are backfilled from `route_decisions.features_json` or, when that predates the fields, from the run snapshot; **null count is now 0**.
- Finalize now restores the prior tree if a post-publish DB/vault/status write fails; DB artifact rows for the run are deleted on that rollback. The tree swap is not a database transaction, but the file tree and run status are kept consistent by the rollback path.
