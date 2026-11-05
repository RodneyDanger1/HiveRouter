# BUGFIX WAVE 2 — plan (ForgeWright)

## 1. Outcome

After this wave, a user’s selected **thinking/effort** and the router’s selected **agent/model/thinking** actually reach the provider; per-run `maxCostUsd` bounds the router’s allocation before dispatch; failed JSON-repair attempts are visible in run usage and cost; and finalized artifacts are attributed to the agent that actually wrote them. The full backend/UI/integration inventory is recorded with evidence, and any defect that cannot be proven is explicitly left UNVERIFIED.

## 2. Current behavior — evidence

- `src/server/pipeline/agent-runner.ts:18-21` — `runtimeFor(agentId, snapshot)` does not read `snapshot.thinking` or `snapshot.effort`; it hardcodes planner/reviewer `enabled` and everything else `disabled`.
- `agent-runner.ts:39` — `const model = snapshot.model`; no route/model override.
- `agent-runner.ts:118-131` — `callAgentText` hardcodes `thinking:'enabled'`, `effort:'high'`.
- `src/server/pipeline/run.ts:453-536` — `routeByPath` stores only `{agentId}`; the `TaskRoute.model/thinking/effort` chosen by CCR are discarded.
- `run.ts:622-624` — generation calls `callAgentJson(engine, snapshot, user, ...)` with no route runtime.
- `run.ts:479-484` — router policy budget is `config.limits.maxRunCostUsd` (global 0.5), while `manager.ts:115-119` stores a lower per-run `run_limit:<id>` and `budget.ts:20-37` enforces it.
- `llm/client.ts:574-620` — `structured` invokes `onAttemptEnd` for every JSON-repair attempt; `agent-runner.ts:58-65` commits each attempt’s budget but only aggregates usage in `onResult` (`:77-90`), so failed/repair attempts’ usage is absent from run totals.
- `run.ts:880-905` — `finalize` recomputes `engineForPath(rel)` instead of using the actual `generated[].agentId`/routed agent, so artifact attribution can lie.
- `src/server/routing/ccr.ts:305-385` — DP is exact below `MAX_DP_CAPACITY = 1_000_000` micro-USD ($1); current max run cap 0.5 makes this unreachable by normal input, so not changed in this wave (recorded UNVERIFIED for future caps).
- `src/server/pipeline/run.ts:835-845` — `applyRevisions` silently ignores revisions for paths outside `allowed`; a rejected revision can look like success. Candidate for a separate wave because changing it may fail previously “lenient” runs.

## 3. Decisions

1. **Runtime precedence:** explicit call options (route) > snapshot (user choice) > agent default. No silent agent-level override of user `thinking`. `effort` applies only when thinking is enabled. Temperature 0.2 only when disabled.
2. **Route fields:** `routeByPath` stores the full `TaskRoute`; generation passes `model`, `thinking`, `effort` to `callAgentJson`. Fallback (routing disabled) uses snapshot values.
3. **Budget:** router policy uses `runBudgetUsd(runId)` (the lower of configured max and the per-run limit); the existing reservation checks remain the final authority.
4. **Usage:** one usage record per provider attempt. `onAttemptEnd` aggregates every non-null attempt usage and calls `onUsage`; successful `onResult` no longer duplicates the same usage. Failed attempts with usage are included; null usage is not fabricated.
5. **Artifact attribution:** `finalize` accepts an optional `agentByPath`; normal generation passes the actual generated agent ids. Review/adhoc paths without a map fall back to `engineForPath` and are explicitly documented.
6. **No test weakening:** additive regression tests only; existing tests remain unchanged unless a previously pinned wrong behavior is proven by a RED and replaced with an OLD→NEW comment.
7. **Rollback:** all edits are small and isolated; no schema migration; revert the changed files from the pre-wave hashes if any gate fails.

## 4. File-by-file change

- `src/server/pipeline/agent-runner.ts`
  - Add `AgentRuntime`/`AgentRuntimeOverride` types; export `runtimeFor`.
  - Extend `AgentCallOptions` with `model?`, `thinking?`, `effort?`.
  - Use `options.model ?? snapshot.model`; route/snapshot runtime.
  - `callAgentText` uses snapshot thinking/effort.
  - Aggregate usage in `onAttemptEnd`; remove duplicate success aggregation from `onResult`.
- `src/server/runs/budget.ts`
  - Export `runBudgetUsd(runId): number` from `scopeCap('user', runId) / 1_000_000`.
- `src/server/pipeline/run.ts`
  - Import route/runtime types; `routeByPath: Map<string, TaskRoute>`; fallback route object.
  - Use `runBudgetUsd(runId)` for `routeTasks` policy budget.
  - Pass route model/thinking/effort into generation calls.
  - Build `agentByPath` from `generated`; pass to `finalize`; optional parameter in `finalize`.
- `test/unit/agent-runtime.test.ts` (new)
  - Pure `runtimeFor` matrix: snapshot disabled/enabled, planner/reviewer, explicit route override, effort.
  - Usage aggregation: a structured call with one invalid then one valid attempt yields two `onUsage` calls and summed totals.
- `test/unit/route-budget.test.ts` (new)
  - `runBudgetUsd` returns the per-run limit, not the global cap; route policy receives it (static/unit where feasible).
- `test/pipeline-qa.test.ts`
  - Add finalize attribution test: actual generated agent id survives into artifact/recorded map even when path resolution differs.
- `docs/BUGFIX-WAVE-2/PLAN.md`, `SKILL-MATRIX.md`, `RECEIPT.md`.

## 5. Failure modes

- Invalid option model/thinking/effort → reject at the agent boundary (typed values; tests).
- Route candidate missing/unknown → fall back to snapshot, never crash.
- Per-run limit absent → global cap; zero/negative setting is ignored by `scopeCap` and uses global, as before.
- Failed JSON attempt with no usage → no fabricated usage; budget commit remains conservative.
- Failed JSON attempt with usage → usage recorded once.
- Finalize without an agent map → legacy path; no regression.
- Concurrent runs → existing one-active-run guard and reservation check remain authoritative.

## 6. Tests and gates

- `npm.cmd run typecheck`
- `npm.cmd test -- --run` (expect ≥220 + new tests)
- targeted new tests (RED first, then GREEN)
- `npm.cmd run build`
- `npm.cmd run e2e` (26 existing + any new)
- `npm.cmd run assert-stage -- --stage=p7 --json`
- `npm.cmd run preflight -- --port 0 --json`
- `npm.cmd run test:live -- --yes`
- live probes: create a low-cap run? Only if needed; otherwise read-only route/status; no paid run unless required and budgeted.

## 7. Rollback

Record pre-edit SHA-256 for each changed file in the receipt. On a failed gate, restore those files from the recorded content; no database migration. New test files can be removed. Do not touch `.env.local`, key material, package/lockfile, or unrelated docs.

## 8. Out of scope / blockers

- No UI redesign; no new agent IDs; no new dependency.
- No whole-tree atomic finalize, no P7 live promotion, no multi-process reaper.
- `MAX_DP_CAPACITY` > $1 behavior is recorded but not changed because the current cap makes it unreachable; do not invent a new algorithm without a reproducing input.
- `applyRevisions` silent-drop behavior is recorded as a candidate, not changed in this wave.
- Internal HTTP retry reservations remain a known bounded risk; do not claim fixed without a per-request reservation design and evidence.

## Implementation record — BUGFIX WAVE 2

The wave landed W2-01 through W2-06:
- `agent-runner.ts`: explicit `model/thinking/effort` options; snapshot/route precedence; per-attempt usage aggregation.
- `run.ts`: `RouteRuntime` map carries routed model/thinking/effort into generation; `runBudgetUsd` used by router; artifact agent map; revision fail-closed.
- `budget.ts`: `runBudgetUsd` from the per-run cap.
- `app.ts`: `/routing` reserve from the per-run cap and model/thinking/effort disclosure.
- Tests: `agent-runtime` (3), `logic-core` (+1), `pipeline-qa` (+2), `trace-fixes` route disclosure assertions.

RED evidence captured before the edits:
- runtime test expected `deepseek-v4-pro` got `deepseek-flash`; usage list was empty.
- live low-cap run showed `/routing reserveUsd=0.1` (global $0.5 × 0.2) before the disclosure fix; after fix `0.006` for a $0.03 run.
- artifact path test proves a routed `polyglot-engine` identity survives; live test artifacts show `gatekeeper` for the test file.
- revision test proves out-of-plan path throws `E_AGENT_OUTPUT_MISMATCH`.

Final gates: typecheck PASS; 226 tests / 30 files; 26/26 E2E; build PASS; strict stage 135 files / 45 tables / 47 routes / 23 scripts; preflight PASS; live smoke PASS; secret/stub scans clean. No key exposure.
