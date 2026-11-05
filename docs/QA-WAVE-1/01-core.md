# QA Wave 1 — Seat 1 `qa-core`

**Scope:** `src/server/runs/**`, `src/server/db/**`, `src/server/security/**`, `src/server/logic/**`, `scripts/preflight.ts`, `scripts/assert-stage.mjs`, `scripts/stub-sweep.mjs`, `scripts/check-secrets.mjs`, `test/unit/logic-*`, `test/scripts.test.ts`.
**Verdict:** **PASS-WITH-NOTES for owned scope.** Nine defects reproduced and fixed; targeted tests green. Final `npm.cmd run typecheck` is **exit 0** (the earlier `test/pipeline-qa.test.ts` error was fixed by its owner). Full suite: **205 passed / 26 files**; targeted 27/27. No server restart, install, git, or key access.

## 1. Defects

### CORE-01 — P1 — Budget cap sums reserved amounts for committed rows
- **File:** `src/server/runs/budget.ts:40-44` (pre-fix).
- **Why:** after a call reserves 3,000,000 µUSD and commits 1,000,000 actual, the next reservation counted 3,000,000 + new amount. The ledger over-reports spend, refuses affordable calls, and violates "reconcile provider usage / actual cost."
- **RED probe:** old SQL on a committed row returned **3,000,000** active µUSD; actual committed is **1,000,000**; cap 4,500,000. New 2,000,000 reservation should fit (1M+2M) but old check rejects (3M+2M).
- **Patch:** sum `CASE WHEN state='committed' THEN COALESCE(committed_micro_usd, amount_micro_usd) ELSE amount_micro_usd END` for active rows (lines 40-43).
- **GREEN:** `test/unit/logic-core.test.ts` "uses committed actual cost…" passes; `reserve(r2)` succeeds.

### CORE-02 — P1 — `canAfford` ignored outstanding reservations
- **File:** `src/server/runs/budget.ts:100-103`.
- **Why:** `canAfford` used only committed spend. With 400,000 µUSD reserved against the 500,000 µUSD run cap, `canAfford(run, 200_000)` returned true; the caller then gets a late `E_BUDGET_EXCEEDED` from `reserve`.
- **RED probe:** new test expected `false`; old `spentMicro` = 0, so it returned `true`.
- **Patch:** query per-run active rows using the same committed-actual/reserved expression and compare estimate.
- **GREEN:** "counts outstanding reservations in canAfford…" passes.

### CORE-03 — P1 — Expired idempotency key collided on primary key
- **File:** `src/server/runs/manager.ts:84-88,115-119`.
- **Why:** lookup ignored expired rows, but the eventual insert reused `key_hash` as PK. After the 24 h TTL, a legitimate new request with the same key raised `UNIQUE constraint failed` instead of creating a run.
- **RED probe:** insert `idempotency_keys(key_hash='h')`, insert same key again → `UNIQUE constraint failed: k.key_hash`. The old `createRun` path did exactly that.
- **Patch:** delete only the **expired** row inside the idempotency transaction before insert (line 118). Unexpired different-body reuse still returns `E_IDEMPOTENCY_KEY_REUSED`.
- **GREEN:** "creates a new run instead of failing on the expired key primary key" passes; expired fixture replaced; no duplicate run.

### CORE-04 — P1 — Crash recovery left budget reservations held
- **Files:** `src/server/runs/manager.ts:152-157`; `src/server/runs/budget.ts:108-113`.
- **Why:** `markStartupInterrupted` marked runs interrupted but never released their `reserved` budget rows. Money stayed held until the 15-min reaper, and `index.ts` runs `markStartupInterrupted` before `reapExpired`, so a crash could block the next run's budget.
- **RED contradiction:** old function had no budget update; test "marks active runs interrupted and releases their reserved money" would fail with `state='reserved'`.
- **Patch:** `releaseReservationsForRun` releases only `state='reserved'` for the run; `markStartupInterrupted` collects active IDs and calls it for each. Committed actual spend is untouched.
- **GREEN:** test asserts run `interrupted` and reservation `released`; second call returns 0.

### CORE-05 — P1 — Unknown usage aggregated as zero
- **Files:** `src/server/runs/recorder.ts:355-364`; `src/server/runs/recorder.ts:332-353`.
- **Why:** `usageTotals` used `SUM(cost_usd)`. An unknown-usage row is inserted with 0, so the run report/`runs.cost_usd` showed **$0.00 known** instead of **unknown/null**, violating null-not-zero and causing false cost claims.
- **RED probe:** one `source='unknown', cost_usd=0` row → old `SUM` = **0**; contract requires **null**.
- **Patch:** aggregate returns NULL if any row has `source='unknown'`; otherwise sums cost/prompt/completion. Known-only rows still sum.
- **GREEN:** test "returns null totals when any usage row is unknown" plus known-run sum `{0.01,10,5}` passes.

### CORE-06 — P1 — Windows device names with multiple extensions passed path safety
- **File:** `src/server/security/paths.ts:31-34`.
- **Why:** old check stripped only the last extension, so `CON.tar.gz` became `CON.tar` (not reserved); Windows still treats it as the `CON` device. `COM1.a.b` similarly passed. This is a path-escape/device-write boundary defect.
- **RED probe:** old check on `CON.tar.gz` returned **false**; fixed check uses the first dot segment → **true**.
- **Patch:** reject when `part.split('.')[0]` is a reserved device name, keeping the existing last-extension check.
- **GREEN:** test rejects `CON.tar.gz`, `src/CON.tar.gz`, `src/COM1.a.b`, `src/nul.data.json`; `src/console.ts` remains valid.

### CORE-07 — P1 — `completed` allowed directly from `generating`
- **File:** `src/server/logic/run-state.ts:180-188`.
- **Why:** status and phase channels were validated independently. `running/generating → completed` passed the status table and kept phase `generating`; a "completed" run could bypass `finalizing`/`done`, violating the phase contract and snapshot/finalize ordering.
- **RED contradiction:** `STATUS_TRANSITIONS.running` includes `completed`; `PHASE_TRANSITIONS.generating` does not require `finalizing`; old `transitionRun` did not check the pair.
- **Patch:** successful terminal statuses (`completed`, `completed_with_warnings`) require the resulting phase to be `done`; otherwise throw `E_ILLEGAL_RUN_TRANSITION` with phase from/to.
- **GREEN:** test refuses `running/generating → completed` and allows `running/finalizing → completed/done`; existing run-state tests remain green.

### CORE-08 — P2 — `assert-stage` ignored UI routes
- **File:** `scripts/assert-stage.mjs:263-266`.
- **Why:** `readRouteStrings` collects both `src/server/routes` API paths and `web/src` `path="..."` values, but the allowlist checked only `merged.routes`. A strict manifest with `uiRoutes: ['/agents']` flagged `/agents` as `E_STAGE_LEAK`.
- **RED probe:** old `new Set(['/api/health']).has('/agents')` = **false**; fixed union = **true**.
- **Patch:** allow `[...merged.routes, ...merged.uiRoutes]`.
- **GREEN:** strict manifest fixture with `web/src/App.tsx path="/agents"` and `uiRoutes:['/agents']` exits 0; planted P7 path/table/script still exits 9.

### CORE-09 — P2 — Secret scan missed `sk-` keys containing `_` or `-`
- **File:** `scripts/check-secrets.mjs:9`.
- **Why:** deepseek pattern was `[A-Za-z0-9]{20,}`; a key with an underscore/hyphen after 20 chars did not match because `_` is a word char and `\b` failed before it. Real DeepSeek/other `sk-` shapes can include these characters.
- **RED probe:** `sk-` + 20 `a` + `_` + 10 `b` → old regex **false**, fixed regex **true**.
- **Patch:** `[A-Za-z0-9_-]{20,}`; OpenRouter still checked first.
- **GREEN:** source fixture with underscore key exits 4 and preview is redacted; synthetic `test/` fixtures remain classified.

## 2. Cross-section contradictions / residuals (not editable in this seat)

1. **Repair staging is not atomic (P1, qa-pipeline scope).** `src/server/pipeline/run.ts:792-864` copies accepted files one by one (`atomicWrite` per file); a failure after the first write leaves a partially updated accepted tree. The plan requires an atomic directory swap/rename. Owner: qa-pipeline.
2. **Initial SSE with >500 events (P1, qa-api scope).** `src/server/app.ts:484-505`: with no `Last-Event-ID`, `getEvents(...,0)` returns the **oldest** 500 events and then subscribes; events 501..N are silently missed. Should return `E_REPLAY_WINDOW_EXCEEDED` or the latest window/snapshot. Owner: qa-api.
3. **No periodic lease reaper (P2).** `reapExpired` is called only at startup (`index.ts:14`); a long-running process can hold expired reservations until restart. Startup release now handles interrupted runs, but not mid-process dead leases. Owner: API/server wiring.
4. **Typecheck (resolved).** The earlier `test/pipeline-qa.test.ts:14` missing-export error was fixed by its owner; final `npm.cmd run typecheck` exit 0.
5. **Preflight host state.** `npm.cmd run preflight -- --port 0 --json` is currently **RED** at RAM **0.4 GB** vs **1.5 GB** (many agents/Chrome running). Not a code defect; rerun when idle. The preflight test passes at relaxed floors and the refusal path exits 7.
6. **One-active-run is process-local.** `createRun` checks then inserts synchronously in one Node process; there is no DB partial unique index. Single-process is safe; a future multi-process deploy needs a DB invariant. Marked INFERRED residual, not fixed.

## 3. What I checked and found clean

- **Snapshot content:** full prompt text/policy/capabilities are stored in `run_snapshots` and `getSnapshot` returns parsed content; no update path exists that rewrites an existing snapshot. `prompt_versions` are content-addressed. **READ.**
- **Idempotency success replay:** unexpired same-key/same-body returns original `runId` with `replayed:true`; unexpired different-body is `E_IDEMPOTENCY_KEY_REUSED`; missing key is `E_IDEMPOTENCY_KEY_REQUIRED`. **READ/test.**
- **Budget overcommit:** `commit(actual > reserved)` records actual then raises `E_BUDGET_OVERCOMMIT`; reservation is not silently released. **READ.**
- **Reaper:** expired reserved rows release; committed actual stays; startup interrupted release now tested. **VERIFIED.**
- **Null-not-zero:** `runs.cost_usd` remains NULL until measured; usage aggregate fixed; `finished_at`/rating remain nullable. **VERIFIED for usage; READ for others.**
- **SSE sequence:** `events.seq` is AUTOINCREMENT, `getEvents` orders ascending and respects the 500 cap; heartbeat does not consume IDs. Replay-window initial case is the residual above. **READ.**
- **Refusal taxonomy:** script exits: preflight resource 7, stage leak 9, stub/secret findings 4, usage 2; scripts emit `hive.cli.v1` JSON. **VERIFIED.**
- **Sweeps:** final `stub-sweep` exit 0 (77 files, 0 hits); `secret-scan` exit 0 (122 files, 0 hits). **VERIFIED.**
- **Stage p7:** `assert-stage --stage=p7 --json` exit 0 with **strict manifests** (`fallback:false`); stage A fallback correctly reports P6/P7 path leaks in the merged B2 tree. **VERIFIED.**
- No secret/key access; no server restart; no install; no edits outside scope.

## 4. Claim strength

- **VERIFIED:** targeted 27/27 tests; full 205/205 tests; RED probes quoted above; stub/secret/stage p7 exits; startup release and budget/usage/path/state tests.
- **READ:** snapshot immutability path; overcommit/reaper; SSE code; refusal registry mapping.
- **INFERRED:** multi-process one-active-run risk; no periodic reaper.
- **UNVERIFIED:** live run/staging atomicity (owned by qa-pipeline); typecheck green on the whole tree (external test error); default preflight (host RAM currently below floor).

## 5. Skills applied

- **logic-debugger:** state terminal-pair bug (CORE-07), idempotency expiry (CORE-03), budget committed/reserved accounting (CORE-01/02).
- **forge:** root-cause fixes at the accounting/transaction/state boundary, minimal edits.
- **smartfix:** RED probe → patch → GREEN tests for every adopted fix.
- **capability-auditor:** claimed null-not-zero vs actual zero aggregate (CORE-05); claimed stage UI support vs route allowlist (CORE-08).
- **auditor:** independent probes, full test rerun, scope check; rejected self-claims that lacked a RED.
- **systems-validator:** CLI exit codes, stage/path/secret contracts, external typecheck blocker.

## 6. Files read / changed

- Read: `WAVE-SHEET`, `AGENTS.md`, `PLAN-v3` relevant sections, all owned source/tests, `pipeline/run.ts`, `app.ts`, `index.ts`.
- Changed: `src/server/runs/budget.ts`, `src/server/runs/manager.ts`, `src/server/runs/recorder.ts`, `src/server/security/paths.ts`, `src/server/logic/run-state.ts`, `scripts/assert-stage.mjs`, `scripts/check-secrets.mjs`, `test/unit/logic-core.test.ts` (new), `test/scripts.test.ts`.
- No web, pipeline, learning, agents, routing, context, quality, repair, config, or server files edited.
