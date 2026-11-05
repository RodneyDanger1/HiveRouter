# Wave 17 — Seat B: Ledger/State Truth (wave 1)

Date: 2026-11-05
Base: `db4e6d5` (455 tests / 71 files; 38/38 E2E; stage 204; server running on `127.0.0.1:8787`, not restarted)
Owner: Seat B (`src/server/**`, `test/unit/**`, this report)
Skills: `truthseeker` + `logic-debugger` + `auditor`, under the `forgewright-lead` / `forgewright-plan` / `forgewright-recon` / `forge` / `logic-gatekeeper` contract.
Scope: P0-5 historical NULL/zero audit; P0-1 production writer matrix. Confirmed defects only.

## 0. Phase 1 gate (written before any mutation)

```json
{
  "phase1": {
    "architecture": "Run truth lives in src/server/runs/recorder.ts (generic updateRun guard, CAS, usage aggregation), with production writers in runs/manager.ts, pipeline/run.ts, and one guarded raw UPDATE (markStartupInterrupted); logic/run-state.ts holds STATUS_TRANSITIONS/PHASE_TRANSITIONS and TERMINAL_PHASES=['done']. Read projections are getRun/listRuns, the snapshot route, /api/stats, the chat store, and the learning trace store.",
    "dataFlow": "writer -> updateRun/guarded SQL -> SQLite runs row -> getRun/listRuns/snapshot/stats -> API -> web. usage rows -> usageTotals (NULL when any source='unknown' or when there are no rows) -> usageFields -> terminal run columns. /api/stats aggregates usage rows and chat_jobs independently.",
    "edgeCases": [
      "terminal status written without phase done (the guard only enforced completed/completed_with_warnings)",
      "/api/stats returned partial=false and a numeric total while a terminal run had NULL spend and no usage rows (live run_3a4578fa7b6ffebae1)",
      "markStartupInterrupted raw SQL bypasses STATUS_TRANSITIONS; only its WHERE status IN (...) guard limits the edge",
      "terminal close skips the phase matrix by design; phase done alone is still only legal from finalizing"
    ],
    "rootCause": "The persistence guard enforced the terminal-phase pairing only for completed/completed_with_warnings, so failed/cancelled/budget_exceeded/interrupted could persist beside a live phase; and /api/stats defined unknown spend only as usage rows with source='unknown', so spend that exists in no usage row (a historical NULL-cost terminal run) was silently aggregated as zero."
  }
}
```

## 1. P0-5 — invariant and audit

**Invariant (falsifiable):** when spend is unknown, every persisted or projected spend field is NULL; no writer, migration, snapshot, or API aggregate may rewrite an unknown spend to `0` or present it as part of a mathematically complete total.

### 1.1 Live-store census (READ-ONLY; `data/hive.db`, no writes, no migrations)

Command: a temporary `node:sqlite` probe opened `data/hive.db` with `{ readOnly: true }` and queried counts; the probe file was deleted afterwards.

```json
{
  "runCounts": [{ "status": "budget_exceeded", "n": 4 }, { "status": "completed", "n": 23 }, { "status": "failed", "n": 3 }],
  "terminalNullSpend": [{ "status": "budget_exceeded", "n": 4 }, { "status": "completed", "n": 1 }, { "status": "failed", "n": 3 }],
  "terminalNullWithNoUsage": [{ "status": "completed", "n": 1 }],
  "usageSources": [{ "source": "provider", "n": 239, "null_cost": 0 }],
  "historicalNullCostWithKnownUsage": [{ "n": 7 }],
  "chatJobs": [{ "status": "cancelled", "n": 1, "null_cost": 1 }, { "status": "succeeded", "n": 9, "null_cost": 0 }]
}
```

Findings:

- 8 terminal rows carry NULL spend. 7 are historical rows whose measured spend lives in `usage` rows (`source='provider'`, 239 rows, no NULL cost); their run-level NULL must stay NULL (no backfill) and the usage ledger is the truth for aggregate spend.
- 1 terminal row (`run_3a4578fa7b6ffebae1`, completed, `full-build`, 6 succeeded steps, 2 artifacts) has **no usage rows at all** and NULL spend. Its provider calls really happened (6 `agent.completed` events), so its spend is unknown — it is the unaccounted amount.
- 1 chat job is cancelled with `attempts = 0` and NULL cost: no provider attempt happened, so it is not unknown spend.

### 1.2 Live API before the fix (server on 8787, old process — not restarted)

```text
GET /api/stats ->
{ "runCount": 30, "totalPromptTokens": 2102789, "totalCompletionTokens": 807551,
  "totalCostUsd": 1.189493862, "measuredCostUsd": 1.188757662, "chatCostUsd": 0.0007362,
  "unknownUsageRows": 0, "partial": false }
```

`partial:false` and a numeric total were reported while one terminal run's spend is unaccounted — the unknown spend was implicitly added as zero. This is the confirmed P0-5 defect (**D-B2**).

### 1.3 Path matrix (code -> API -> UI)

| Layer | path:line | Unknown-spend behavior | Evidence |
|---|---|---|---|
| usage ingestion (`callAgentJson` attempt hooks) | `src/server/pipeline/agent-runner.ts:101-125` | no provider usage -> `emptyUsage()` with `source:'unknown'`, never a measured zero | `test/unit/agent-runtime.test.ts`, `test/unit/terminal-usage.test.ts` |
| usage ingestion (`callAgentText`) | `src/server/pipeline/agent-runner.ts:173-214` | failed attempt -> unknown row; success -> measured row | code read |
| LLM boundary | `src/server/llm/client.ts:578-583`, `:764-792` | exactly one `onHttpAttemptEnd` per attempt: usage or null | `test/unit/http-attempt-hooks.test.ts` |
| per-run aggregate | `src/server/runs/recorder.ts:463-496` | any `source='unknown'` row or zero rows -> all fields NULL; known rows sum | `test/unit/terminal-usage.test.ts` |
| terminal writers | `src/server/runs/manager.ts:164-173`, `:196-206`, `:222-232`, `:291-299`; `src/server/pipeline/run.ts:1048-1052`, `:1243-1249` | write `usageFields`/`usageTotals`; NULL is written as NULL | new `test/unit/historical-usage.test.ts` |
| run row projection | `src/server/runs/recorder.ts:226-254` | `row.cost_usd == null ? null : Number(...)` | new test (list/detail) |
| list / detail / snapshot routes | `src/server/app.ts:985-997`, `:1063-1091` | return `getRun` rows unchanged (NULL preserved) | new test |
| stats aggregate | `src/server/app.ts:1266-1337` | **fixed**: unaccounted terminal-run spend and attempted chat spend force `partial`; totals NULL | new test |
| chat job writers | `src/server/chat/store.ts:505-519`, `:532-537`, `:553-587`, `:592-617` | unknown usage keeps `cost_usd` NULL; only measured usage is summed | `test/unit/chat-store.test.ts`, `test/unit/chat-worker.test.ts` |
| learning trace | `src/server/runs/terminal-trace.ts:30-35`; `src/server/learning/trace-store.ts:171-217` | unknown fields are omitted -> SQL NULL | `test/unit/learning-consent-trace.test.ts` |
| UI | `web/src/components/ui.tsx:36-44` (null -> `—`); `web/src/pages/OverviewPage.tsx:193-207` | total null -> `—`; partial notice explains missing total | read only; Seat A-owned path |

### 1.4 Confirmed defect D-B2 (fixed)

`src/server/app.ts` `/api/stats` computed `partial` from `usage.source='unknown'` only. A terminal run whose spend exists in no usage row was therefore omitted from the total without any partial signal (live evidence in 1.1/1.2). A chat job with attempts but NULL cost was summed as zero the same way.

Fix (`src/server/app.ts:1278-1332`):

- `unknownRunSpendRows` = terminal runs with `cost_usd IS NULL` **and no usage row**. Runs with a stale NULL aggregate but measured usage rows are deliberately not counted: their spend is measured in the per-call ledger.
- `unknownChatSpendJobs` = chat jobs with `attempts > 0`, `cost_usd IS NULL`, status `queued|failed|cancelled` (running jobs are not yet settled; `attempts = 0` jobs provably made no call).
- `partial = unknownUsageRows > 0 || unknownRunSpendRows > 0 || unknownChatSpendJobs > 0`; `totalCostUsd` / `totalPromptTokens` / `totalCompletionTokens` stay NULL when partial. `measured*` remain the known-only sums.

Projection on the real data (read-only SQL, no route restart):

```json
{ "unknownRunSpendRows": 1, "unknownChatSpendJobs": 0, "unknownUsageRows": 0,
  "measured": { "c": 1.188757662, "p": 2102789, "k": 807551 }, "chatCost": { "c": 0.0007362 },
  "projectedPartial": true }
```

## 2. P0-1 — production writer matrix

**Invariant:** every status/phase write the server can persist is a declared edge in `STATUS_TRANSITIONS` / `PHASE_TRANSITIONS` (`src/server/logic/run-state.ts:27-71`), and a status write that makes a run terminal also writes the terminal phase `done` (`TERMINAL_PHASES`, `run-state.ts:25`). Terminal closes are the only documented phase-matrix exception because a run may fail in any phase.

Method: new `test/unit/writer-matrix.test.ts` installs a SQLite trigger `AFTER UPDATE OF status, phase ON runs` in the test database, drives every production entry point, and validates every captured `(old -> new)` pair. The trigger also captures the one raw `UPDATE runs` writer, so a writer cannot bypass the audit with hand-rolled SQL. `pipeline/agent-runner` is replaced with a scripted queue (provider boundary test double; no network, no paid call); every layer below it is real production code.

### 2.1 Writer inventory (`src/server/**`)

| Writer | path:line | Persisted edge(s) | Guard |
|---|---|---|---|
| `createRunRow` insert | `runs/recorder.ts:103-132` | fresh `queued/intake` | insert, no transition |
| `markRunning` | `runs/manager.ts:286-288` | `queued->running` (phase intake retained) | `updateRun` |
| `updateRun` (generic) | `runs/recorder.ts:134-209` | any declared status/phase edge | status matrix + CAS + terminal-close check (hardened in D-B1) |
| `markTerminal` | `runs/manager.ts:290-303` | non-terminal -> `failed|cancelled|budget_exceeded|interrupted`, phase `done` | `updateRun` |
| executor catch | `runs/manager.ts:157-181` | running-ish -> `failed`, `done` | `updateRun` |
| `cancelRun` (no controller) | `runs/manager.ts:185-212` | `queued|paused|needs_review -> cancelled`, `done` | `updateRun` |
| `markStartupInterrupted` | `runs/manager.ts:214-244` | `queued|running|paused|needs_review -> interrupted`, `done` | raw SQL with `WHERE status IN (...)` |
| pipeline phase writers | `pipeline/run.ts:395-396, 447, 459, 472, 488, 524, 584, 627, 664, 771, 888, 900, 915, 933, 991, 1000, 1145` | phase-only edges | `updateRun` phase guard |
| pipeline terminal catch | `pipeline/run.ts:1037-1056` | running-ish -> `failed|cancelled|budget_exceeded`, `done` | `updateRun` |
| `finalize` success | `pipeline/run.ts:1243-1254` | running -> `completed|completed_with_warnings`, `done` | `updateRun` |
| DB-open reconcile | `db/database.ts:101-111` | `trace_complete` only | no status/phase write |
| snapshot stamp | `runs/snapshot.ts:85` | `snapshot_hash`/`policy_version_id` only | no status/phase write |

The static inventory test fails if a new file contains `updateRun(`, `UPDATE runs`, or `INSERT INTO runs` and is not in this audited list.

### 2.2 Observed edges (trigger capture, GREEN)

| Entry point | Captured phase sequence | Terminal |
|---|---|---|
| full-build | planning, routing, generating, cleaning, hardening, testing, verifying, finalizing, done | completed |
| blueprint | planning, finalizing, done | completed |
| docs | planning, routing, generating, verifying, finalizing, done | completed |
| ui-build | planning, routing, generating, cleaning, hardening, testing, verifying, finalizing, done | completed |
| revise | cleaning, hardening, verifying, finalizing, done | completed |
| audit | cleaning, hardening, testing, verifying, finalizing, done | completed |
| adhoc (text agent) | generating, verifying, finalizing, done | completed |
| resume (no provider call) | generating, verifying, finalizing, done | completed |
| pipeline catch (revise without parent) | terminal close | failed (`E_INVALID_PARENT`) |
| manager executor catch | terminal close | failed (`E_PROVIDER_EMPTY`) |
| no-controller cancel | terminal close | cancelled |
| budget terminal | terminal close | budget_exceeded |
| startup interrupt (4 source statuses) | terminal close | interrupted |

Every captured status edge is declared in `STATUS_TRANSITIONS`; every non-terminal phase edge is declared in `PHASE_TRANSITIONS`; every terminal write observed lands on phase `done`.

### 2.3 Confirmed defect D-B1 (fixed): dead terminal-phase guard

`updateRun` enforced "terminal status must use phase done" only for `completed`/`completed_with_warnings`. `failed`, `cancelled`, `budget_exceeded` and `interrupted` could be persisted beside any live phase (e.g. `failed + generating`), contradicting `TERMINAL_PHASES = ['done']`. No current production writer triggers it (all pass `done`), but the generic writer every status writer shares accepted the illegal state, so the guard was dead for four of five terminal statuses.

Fix (`src/server/runs/recorder.ts:166-184`): any write that changes status or phase and whose result is terminal must have `nextPhase === 'done'` (`E_ILLEGAL_RUN_TRANSITION`, named, thrown before any SQL). Idempotent same-value writes on already-terminal rows remain no-ops; terminal rows still cannot change phase; non-terminal writes still follow the full phase matrix.

## 3. Tests added

| File | Tests | Discriminates |
|---|---|---|
| `test/unit/writer-matrix.test.ts` | 7 | every production writer x matrix; exact preset phase sequences; all 100 status pairs and 121 phase pairs through `updateRun`; terminal-close guard (D-B1); writer inventory |
| `test/unit/historical-usage.test.ts` | 8 | historical NULL rows unchanged through every terminal writer (UPDATE trigger on spend columns); reopen/migration no-backfill; list/detail/snapshot NULL projections; stats partial for unaccounted run spend (D-B2); known-usage historical rows do not mark partial; chat unknown spend; a never-started cancelled run stays unknown |

## 4. RED -> GREEN evidence

Baseline targeted cluster (before edits):

```text
npm.cmd test -- --run test/unit/terminal-usage.test.ts test/unit/logic-run-state.test.ts test/unit/run-transition-guard.test.ts test/unit/stats-truth.test.ts
Test Files  4 passed (4)
     Tests  24 passed (24)
```

RED before the fixes (new tests against base code; the historical file then had 7 tests and its 8th test was added afterwards, covered by the final planted-defect run in §5):

```text
test/unit/writer-matrix.test.ts   Tests  1 failed | 6 passed (7)
  × refuses a terminal status that is not closed at the terminal phase
  AssertionError: expected [Function] to throw an error

test/unit/historical-usage.test.ts   Tests  3 failed | 4 passed (7)
  × does not report a complete total when a terminal run has spend nowhere in the ledger
  × keeps the total complete when the stale NULL run row is backed by measured usage rows
  × marks unknown chat spend as partial instead of adding it as zero
  AssertionError: expected false to be true   # partial
  AssertionError: expected undefined to be +0 / 1  # new counters
```

Final planted-defect RED with the final 8-test historical file (§5):

```text
test/unit/historical-usage.test.ts   Tests  4 failed | 4 passed (8)
  × does not report a complete total when a terminal run has spend nowhere in the ledger
  × keeps the total complete when the stale NULL run row is backed by measured usage rows
  × marks unknown chat spend as partial instead of adding it as zero
  × keeps a terminal run with no usage rows as unknown spend, even when it never started
```

GREEN after the fixes:

```text
npm.cmd test -- --run test/unit/writer-matrix.test.ts test/unit/historical-usage.test.ts
Test Files  2 passed (2)
     Tests  15 passed (15)
```

Targeted regression cluster (9 files):

```text
terminal-usage, terminal-writers, startup-interrupt, run-transition-guard, p0-truth,
stats-truth, resume-run, runs-list-api, run-timeout
Test Files  9 passed (9)
     Tests  35 passed (35)
```

Full suite:

```text
npm.cmd test
Test Files  73 passed (73)
     Tests  470 passed (470)      # base 455 + 15 new
```

Other gates on the changed server files:

```text
npm.cmd run typecheck   -> exit 0 (no diagnostics)
npm.cmd run stub-sweep  -> stub-sweep: clean (104 files)
npm.cmd run secret-scan -> secret-scan: clean (208 files)
```

Stub sweep on the four changed files returned only pre-existing legitimate strings (`mock-run` badge, `mock` ad-hoc mode refusal, `stub-sweep`/`Placeholder scan` script catalog text) and `vi.mock` in the new test file (permitted provider-boundary test double). No TODO/FIXME/stub/placeholder was added to `src/`.

## 5. Independent re-verification (auditor protocol)

Both adopted fixes were re-verified by planting the defect on the current tree, running the named test, restoring the exact bytes from a temp backup, and re-running green. Backups were deleted afterwards.

| Fix | Planted state | RED observed | Restore sha256 | GREEN |
|---|---|---|---|---|
| D-B1 terminal-phase guard | pre-fix recorder guard restored | `Tests 1 failed | 6 passed (7)`; `× refuses a terminal status that is not closed at the terminal phase`; `AssertionError: expected [Function] to throw an error` | `3a3f398d85013bfc1058b9e94d6017a203c06fff571684b9de1e43c28312c73e` (identical) | `Tests 7 passed (7)` |
| D-B2 stats unknown spend | pre-fix stats block restored | `Tests 4 failed | 4 passed (8)`; the four stat tests above; `partial` false / counters undefined | `20ed025836f52f1ddc604af49d9d7352e5d9663852bc1b5d9d9aaddd75339e54` (identical) | `Tests 15 passed (15)` for both new files |

Final file hashes (sha256), produced by `Get-FileHash`:

```text
20ed025836f52f1ddc604af49d9d7352e5d9663852bc1b5d9d9aaddd75339e54  src/server/app.ts
3a3f398d85013bfc1058b9e94d6017a203c06fff571684b9de1e43c28312c73e  src/server/runs/recorder.ts
9f91428535d49335d7f331f1ddd9ce52c8ca1610e6b6ce188fbed98f11766d2d  test/unit/writer-matrix.test.ts
e2088c94f8b888d30bb582ea436c41659aa3394e5971df6df38cbd51ad5dcb64  test/unit/historical-usage.test.ts
```

No git write was performed. Other working-tree changes (`AGENTS.md`, `docs/AGENT-OPERATING-PLAN.md`, `web/**`, `e2e/**`, `docs/WAVE-17-PLAN.md`, `docs/TRACE/WAVE-17/`) are not Seat B's and were not touched.

## 6. Claim register

| Claim | Evidence | Status |
|---|---|---|
| No terminal writer, DB reopen, snapshot, list, detail, or snapshot route rewrites a historical NULL spend to 0 | `test/unit/historical-usage.test.ts` (8 tests, spend-column UPDATE trigger, reopen, 3 routes) | VERIFIED |
| Live DB has 8 terminal NULL-spend rows: 7 backed by 239 known usage rows, 1 with no usage rows | read-only probe of `data/hive.db` (1.1) | VERIFIED |
| `/api/stats` reported `partial:false` plus a numeric total while unknown spend existed | live `GET /api/stats` before fix (1.2) | VERIFIED |
| Fixed stats flags unaccounted run spend and attempted chat spend as partial, keeps measured sums visible | `test/unit/historical-usage.test.ts`; read-only projection on live data (1.4) | VERIFIED |
| Every production status/phase writer persists only matrix edges; observed sequences per preset | `test/unit/writer-matrix.test.ts` (trigger capture, 7 tests) | VERIFIED |
| The terminal-close guard now covers every terminal status and refuses the illegal state by name | `test/unit/writer-matrix.test.ts`; planted-defect RED/GREEN (§5) | VERIFIED |
| `unknownRunSpendRows`/`unknownChatSpendJobs` appear in the web `RunStats` type and the Overview notice copy | concurrent Lead/Seat A edit (`src/shared/types.ts` RunStats fields; `web/src/pages/OverviewPage.tsx:204` three-count notice) + `npm.cmd run typecheck` exit 0 | VERIFIED for type contract; browser render is Seat A/Lead E2E evidence, not Seat B |
| A run cancelled before any provider call is now counted as unknown (partial) | `test/unit/historical-usage.test.ts` "keeps a terminal run with no usage rows as unknown spend, even when it never started"; follows the documented null-not-zero rule (`test/unit/terminal-usage.test.ts` test 3) | VERIFIED behavior; POLICY noted in residual |
| Post-status finalize failure cannot downgrade a completed run | code path not deterministically exercised; see residual | UNVERIFIED |

## 7. Residual, not done, and Lead-owned requests

Not done (out of Seat B scope / not a confirmed defect):

- `updateRun` on a non-existent run id silently applies 0 rows (no `E_RUN_NOT_FOUND`). No production caller hits it; recorded as residual, not changed.
- PLAN-v3 §4 says `docs` = plan→generate→finalize and `ui-build` has no testing phase; running code adds `verifying` (docs) and `testing` (ui-build). Local running code wins; docs drift is Lead-owned.
- Chat job success writes `cost_usd = ?` (`chat/store.ts:532-537`), so an impossible success-without-usage would overwrite a measured cost with NULL (conservative direction). No production path observed; residual.

Lead-owned REQUEST (cross-scope):

1. ~~`src/shared/types.ts` `RunStats`: add `unknownRunSpendRows` / `unknownChatSpendJobs`~~ — satisfied concurrently by the Lead: `git diff -- src/shared/types.ts` shows both fields plus the updated null-total comment; `typecheck` exit 0.
2. ~~`web/src/pages/OverviewPage.tsx:201-207`: truthful partial notice~~ — satisfied concurrently by Seat A/Lead: the notice now reports usage rows, terminal runs and chat jobs. Browser render still needs the Lead/Seat A E2E evidence; Seat B did not edit `web/**`.
3. Restart the running server before checking `/api/stats` on live data — Seat B must not restart it. The fixed route is proven by unit tests and the read-only projection; the live old process still returns the old shape.
4. `RunStats.chatCostUsd` remains `number | null` in the shared type while the server returns a number; harmless, shared-type owner may tighten it.

Unverified / policy note:

- The aggregate marks a terminal run with no usage rows as unknown spend even when it provably never started a provider call (queued cancel/startup interrupt). This is consistent with the existing "zero usage rows -> NULL, never 0" policy (`test/unit/terminal-usage.test.ts` test 3), but it makes `partial` more frequent. A future explicit "known-zero spend" provenance would be a policy decision for the Lead, not a silent change here.
