# W6-IMP-01 — ForgeWright writer receipt

- **Task:** W6-IMP-01 (Wave 6 implementation, task-6).
- **Seat:** sole product writer; skill `forgewright-lead` loaded before acting.
- **Repo:** `C:\Users\Riley\Desktop\HiveRouter` (B2 working tree, no `.git`).
- **Captured:** 2026-11-03 22:55 → 2026-11-03 23:12 America/Chicago (2026-11-04T04:55–05:12Z).
- **Authority:** `docs/AUDIT-WAVE-6/gate/approved-fixes.json` + `gate.md` bind; the directive was read for intent.
- **Write scope used:** `src/server/**`, `src/shared/**`, `web/src/**`, `test/unit/**` (12 new test files; 1 existing test file isolated), `web/dist/**` (only by running `npm run build`), and this receipt folder. No other path written. No e2e edit; no `scripts/`, `config/`, `package.json`, `playwright.config.ts`, `data/`, `workspace/`, `logs/`, `vault/`, `.env*`, `src/server/learning|security|vault|verify/**` edit.
- **Process:** strict order AF-01 → AF-11, one complete change + its tests at a time, targeted run after each AF (see `PROGRESS.md`). No subagents, no git, no paid calls, no server restart, no e2e (the Lead restarts and runs e2e after this receipt), no historical backfill, no fake data, no test weakening.

## 1. Completion summary

| AF | Title | Status | Targeted test result |
|---|---|---|---|
| AF-01 | Terminal runs record the usage they actually spent | DONE | `test/unit/terminal-usage.test.ts` 8/8 |
| AF-02 | One event vocabulary + inner-payload delivery | DONE | `test/unit/event-contract.test.ts` 8/8 |
| AF-03 | Terminal Events tab shows the persisted ledger | DONE | `test/unit/run-events-selection.test.ts` 5/5 |
| AF-04 | `/events` truncation from this run's rows + badge rename | DONE | `test/unit/events-window.test.ts` 8/8 |
| AF-05 | Snapshot serves the per-run cost cap | DONE | `test/unit/snapshot-limits.test.ts` 6/6 |
| AF-06 | Preserve the provider error code through terminal writers | DONE | `test/unit/error-code.test.ts` 9/9 + `test/unit/terminal-error-code.test.ts` 1/1 |
| AF-07 | `interrupted` is an explained terminal state | DONE | `test/unit/startup-interrupt.test.ts` 1/1; `test/unit/logic-core.test.ts` 11/11 |
| AF-08 | Context tab shows what the data contains | DONE | `test/unit/context-excluded.test.ts` 3/3 |
| AF-09 | Advertised plan contract is callable | DONE | `test/unit/agent-plan-contract.test.ts` 6/6 |
| AF-10 | Checks row identity, no dead columns | DONE | `test/unit/checks-identity.test.ts` 4/4 |
| AF-11 | Routing reason derives from the decision | DONE | `test/unit/routing-reason.test.ts` 4/4 |

**Exact test count:** `50` test files / `312` tests passed. Baseline was 38 files / 249 tests; the batch adds **63 tests in 12 new files** (249 + 63 = 312). No existing test assertion changed.

## 2. Per-AF record

### AF-01 — Terminal runs record the usage they actually spent

**Files / line ranges**

- `src/server/runs/recorder.ts:406-414` — new exported `usageFields(runId)`, a thin mapping of `usageTotals` to `{cost_usd, prompt_tokens, completion_tokens}`; no new SQL, `usageTotals` untouched.
- `src/server/runs/manager.ts:14-25` — new exported `terminalEventMessage(code, rawMessage, outcome)`; human sentence only.
- `src/server/runs/manager.ts:158-174` — executor-rejection catch adds `...usage`, `code` via `codeOfError` (AF-06), event `message` (human) and `costUsd`.
- `src/server/runs/manager.ts:193-206` — no-controller cancel adds `...usage`, event `message` and `costUsd`.
- `src/server/runs/manager.ts:285-294` — `markTerminal` adds `...usageFields(runId)`.
- `src/server/pipeline/run.ts:343-344` (review/audit gate), `:434-435` (adhoc gate), `:859-860` (full-build gate) — gate `run.failed` emits carry the `markTerminal` sentence and `costUsd`.
- `src/server/pipeline/run.ts:870-888` — catch adds `...usage`, a human `message` (registered refusal sentence, else status-aware) and `costUsd`; redaction/500-char slice preserved.
- `src/server/pipeline/run.ts:16,18` — imports `usageFields` and `terminalEventMessage`.
- `test/unit/terminal-usage.test.ts` (new).

**Behaviour change:** every terminal writer listed now writes the honest aggregate and every touched terminal event carries `costUsd` plus a message that is never identical to the code.

**Tests (8):** two provider rows → SUM (`toBeCloseTo`); one `source='unknown'` row → all NULL; zero rows → all NULL; duplicate `markTerminal` idempotent; snapshot route `run.costUsd` = SUM; real pipeline-catch `run.failed` (createRun + executeRun, preset `revise`, no parent → `E_INVALID_PARENT`) has `costUsd` and a human message; executor-rejection bare `Error('E_PROVIDER_EMPTY')` → `The run failed with E_PROVIDER_EMPTY.`; historical failed row with NULL cost is not backfilled.

**Command / output**

```
> npm.cmd run test -- --run test/unit/terminal-usage.test.ts
 ✓ test/unit/terminal-usage.test.ts (8 tests) 855ms
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

**Edge cases covered:** zero/unknown/two rows, duplicate terminal write, real catch path, bare code, no backfill. **Unverified (by mandate):** the three gate-emit payloads are code-inspection only — driving them requires a provider call; the receipt marks that unverified, as AF-01 condition 5 requires. Event `costUsd` is computed after the row write; at terminal time no in-flight usage writer exists on these paths.

**Gate conditions honoured:** helper lives in `recorder.ts`; all four terminal writers patched; every touched terminal emit has `costUsd` + human message; status mapping/`run.completed`/`budget_reservations`/`/api/stats` untouched; temp `config.dataDir`/`workspaceDir` restored in `finally`; float assertions approximate; no new source file/route/table/migration/script.

### AF-02 — One event vocabulary: subscribe to everything the server emits, deliver the payload

**Files / line ranges**

- `src/shared/run-events.ts:18-41` `RUN_EVENT_TYPES` (16 at AF-02; `run.interrupted` appended by AF-07), `:43-65` `RESERVED_EVENT_TYPES` (16 incl. `heartbeat`), `:67-68` `STREAM_EVENT_TYPES`, `:70-84` `normaliseStreamEvent`.
- `web/src/hooks/useApi.ts:3` shared import; `:91-109` handler uses `normaliseStreamEvent`, keeps JSON parse/raw fallback, heartbeat filter, `receivedAt`, `onmessage` fallback and `message → run.event` mapping; local list deleted.
- `test/unit/event-contract.test.ts` (new).

**Behaviour change:** all server-emitted types are subscribed (including the five previously dropped) and live `data` is the inner payload, matching the persisted ledger.

**Tests (8):** tokenises every `emitEvent(` call in `src/server/**/*.ts`, resolves both branches of the `run.ts` ternary, asserts every literal ∈ `RUN_EVENT_TYPES` and every declared type is emitted; union has no duplicates; reserved set length 16 incl. heartbeat; the five names present; client uses the shared import and no local list; envelope unwrap; no unwrap without `schema`; non-record/string no-throw; non-string envelope type keeps the frame name.

**Command / output**

```
> npm.cmd run test -- --run test/unit/event-contract.test.ts
 ✓ test/unit/event-contract.test.ts (8 tests) 39ms
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

**Edge cases covered:** ternary literals; raw fallback; heartbeat; data-without-schema; non-record. **Unverified:** live delivery of the five types is proven by listener/contract tests, not by a live run watched in this batch (no paid run).

**Gate conditions honoured:** reserved listeners kept (D-24); no event type added in AF-02; persisted mapping/SSE route/poll unchanged; no React/Node import in the shared module; static test extracts literals, not only the second-argument string.

### AF-03 — The terminal Events tab shows the persisted ledger

**Files / line ranges**

- `src/shared/run-events.ts:86-98` — `selectVisibleEvents({terminal, live, persisted})`; pure, no mutation.
- `web/src/pages/RunDetailPage.tsx:16` import; `:134` call site.
- `test/unit/run-events-selection.test.ts` (new).

**Behaviour change:** terminal → persisted `/events` ledger; non-terminal → live buffer. No `setEvents([])` at terminal (no flash); loading/error branches unchanged.

**Tests (5):** truth table `(true,100,108)→108`, `(true,100,0)→0`, `(false,100,108)→100`, `(false,0,0)→0`, plus no-mutation.

**Command / output**

```
> npm.cmd run test -- --run test/unit/run-events-selection.test.ts test/unit/event-contract.test.ts test/unit/trace-fixes.test.ts
 ✓ test/unit/run-events-selection.test.ts (5 tests) 20ms
 ✓ test/unit/event-contract.test.ts (8 tests) 49ms
 ✓ test/unit/trace-fixes.test.ts (7 tests) 426ms
 Test Files  3 passed (3)
      Tests  20 passed (20)
```

**Unverified (by mandate):** the live→terminal transition was not faked or exercised (no non-terminal/paid run; route interception and seed data are forbidden). Existing fresh-terminal e2e pin stays untouched and was not run here; its unit peer (`trace-fixes.test.ts`) stays green.

### AF-04 — `/events` truncation means this run's events were dropped

**Files / line ranges**

- `src/server/runs/recorder.ts:76-84` `countEventsAfter`; `:86-99` `getRecentEvents` (DESC then reverse, same mapping as `getEvents`).
- `src/server/app.ts:12` import; `:844-874` events route: after clamp, read transaction covering per-run count + fetch, newest window, `truncated = total > returned`, `lastEventId` last returned else `lastEventId(id)`.
- `web/src/pages/RunDetailPage.tsx:331` badge text exactly `Artifacts truncated`.
- `test/unit/events-window.test.ts` (new).

**Behaviour change:** no global-seq window math; a complete replay can never report truncation; a real truncation returns the newest window.

**Tests (8):** window patched to 3 (saved/restored); 0 events → 0/false/0; 2 → 2/false; exactly 3 → 3/false; 4 → newest 3 seqs/true; after cursor → newest 3 after cursor/true; after=last → []/false/current; negative and NaN after → 0; unknown run 404 `E_RUN_NOT_FOUND`; response keys exactly `{events,truncated,lastEventId}`.

**Command / output**

```
> npm.cmd run test -- --run test/unit/events-window.test.ts
 ✓ test/unit/events-window.test.ts (8 tests) 1069ms
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

**Edge cases covered:** the listed boundaries; newest-seq assertion for the 4-event case; cursor cases. **Unverified:** the >500-event boundary is not exercised (window 3 used); no run in the DB exceeds 500 events.

**Gate conditions honoured:** ASC forge P-4 not implemented; `GET /stream` and `web/src/api.ts` untouched; no global-seq dependence; count/fetch under one read transaction (`BEGIN`/`COMMIT`, `ROLLBACK` on error); badge text exact.

### AF-05 — Snapshot serves the per-run cost cap

**Files / line ranges**

- `src/server/app.ts:840` — snapshot adds exactly `limits: { maxCostUsd: runBudgetUsd(id) }`; every existing key preserved.
- `test/unit/snapshot-limits.test.ts` (new).

**Tests (6):** `run_limit` 0.03 → 0.03; absent → `config.limits.maxRunCostUsd`; above global → clamped; malformed row → global fallback; all seven keys present (six old + limits); unknown run 404.

**Command / output**

```
> npm.cmd run test -- --run test/unit/snapshot-limits.test.ts
 ✓ test/unit/snapshot-limits.test.ts (6 tests) 638ms
 Test Files  1 passed (1)
      Tests  6 passed (6)
```

**Gate conditions honoured:** `runBudgetUsd(id)` only; `run_snapshots.limits`/global cap never served as a per-run cap; additive only; no Settings/e2e edit.

### AF-06 — Preserve the provider error code through every terminal writer

**Files / line ranges**

- `src/shared/refusals.ts:106-119` — exported `codeOfError(error)`: `E_`-prefixed `.code` first (`/^E_[A-Z0-9_]+$/`), then message prefix, then `E_INTERNAL`.
- `src/server/pipeline/run.ts:18` import; `:232-237` `agentStep` maps `codeOfError` into `steps.error_code` and `agent.failed`; `:870-873` catch uses `codeOfError` after the `E_RUN_TIMEOUT` signal check.
- `src/server/runs/manager.ts:11` import; `:162` executor catch uses `codeOfError` after `timedOut`.
- `test/unit/error-code.test.ts` (new) and `test/unit/terminal-error-code.test.ts` (new).

**Tests (9 + 1):** LlmError code over prose; bare `E_PROVIDER_EMPTY`; prefixed message trimmed; lowercase/non-matching code; AbortError prose; non-Error/object/number/null/undefined; Node errno `ENOENT`/`ECONNREFUSED`/`ENOSPC` → `E_INTERNAL`; `.code` wins over a different message prefix; REFUSALS not expanded with the unregistered codes. Integration: throwaway DB + temp dirs, rejecting executor with `LlmError('E_LLM_RATE_LIMIT', prose)`, run/event code = `E_LLM_RATE_LIMIT`, human message unchanged.

**Command / output**

```
> npm.cmd run test -- --run test/unit/error-code.test.ts test/unit/terminal-error-code.test.ts test/unit/run-timeout.test.ts
 ✓ test/unit/error-code.test.ts (9 tests) 12ms
 ✓ test/unit/terminal-error-code.test.ts (1 test) 171ms
 ✓ test/unit/run-timeout.test.ts (1 test) 303ms
 Test Files  3 passed (3)
      Tests  11 passed (11)
```

**Unverified:** the `run.ts` `agentStep` mapper requires a real provider failure to execute (no paid call); it is code-inspected and covered by the pure helper table. The manager mapper is exercised by the integration test. Precedence (`E_RUN_TIMEOUT` first, `timedOut` first) preserved.

### AF-07 — `interrupted` is an explained terminal state

**Files / line ranges**

- `src/shared/refusals.ts:27` — `E_RUN_INTERRUPTED` (409, exit 4, retryable false, message `The run was interrupted by a server restart.`); the only REFUSALS addition.
- `src/shared/run-events.ts:40` — `run.interrupted` appended to `RUN_EVENT_TYPES` (17 emitted types now).
- `src/server/runs/manager.ts:211-239` — `markStartupInterrupted`: per-row usage snapshot, one guarded `UPDATE ... WHERE id = ? AND status IN (...)` writing status/phase/finished_at/error_code/error_message/usage fields; only when `changes === 1` → one `run.interrupted` event (`code`, `message`, `costUsd`) → `recordError({source:'run'})` → `releaseReservationsForRun`; returns the transitioned count.
- `test/unit/startup-interrupt.test.ts` (new).
- `test/unit/logic-core.test.ts:1-2,175-208` — isolation only: import `config`, point `config.dataDir` at the test's throwaway directory and restore in `finally`. Assertions byte-identical (verified against the baseline copy).

**Tests (1 + existing 11):** one queued + one running run (one usage row) → both `interrupted` with code/message/finished_at; exactly one `run.interrupted` per run with code/message/costUsd (null for no usage, 0.001 for the measured run); both `source:'run'` records in `temp/logs/errors.jsonl`; reservation released; second call returns 0 and writes no event/log/status change. `logic-core` interrupt test still returns 1, status interrupted, reservation released.

**Command / output**

```
> npm.cmd run test -- --run test/unit/startup-interrupt.test.ts test/unit/logic-core.test.ts test/unit/event-contract.test.ts
 ✓ test/unit/event-contract.test.ts (8 tests) 38ms
 ✓ test/unit/startup-interrupt.test.ts (1 test) 47ms
 ✓ test/unit/logic-core.test.ts (11 tests) 435ms
 Test Files  3 passed (3)
      Tests  20 passed (20)
```

**Gate conditions honoured:** only `E_RUN_INTERRUPTED` + `run.interrupted` added; conditional guard preserved; per-row order write → event → log → release; constant message used for row/event/log; no `run.failed` for interrupted; startup call site/return semantics unchanged; no learning/P7 change.

**Form note (not a behavioural deviation):** the gate text names `updateRun` for the per-row write, but `updateRun` has no `WHERE` guard. To satisfy binding condition 2 (never downgrade a run that finished between SELECT and UPDATE) the row write is a single guarded SQL `UPDATE` that sets exactly the same columns. Using `updateRun` after a check would reintroduce the race the condition forbids.

**Unverified:** the SELECT→UPDATE race itself was not timed; the guard is static. No production `interrupted` specimen exists (0 rows) — forward-only.

### AF-08 — Context tab shows what the data actually contains

**Files / line ranges**

- `src/server/app.ts:452-495` — parse `excluded_json` in try/catch; included rows get `included: true`; excluded rows exactly `{id, path:null, kind:'excluded', tokens:null, mandatory:false, reason:String(item.reason ?? 'excluded'), included:false}`; `packs`/`items`/`usedTokens`/`prefixHash` preserved.
- `web/src/pages/RunDetailPage.tsx:767` exact description; `:822-841` ContextItems drops Tokens and Chars, keeps Path/Kind/Mandatory/Reason/Included.
- `test/unit/context-excluded.test.ts` (new).

**Tests (3):** included rows `included:true`; excluded rows with reason and `included:false`; missing reason → `'excluded'`; `usedTokens`/`prefixHash` unchanged; top-level `items` = `packs.flatMap`; malformed `excluded_json` → no fabricated rows, HTTP 200; unknown run 404.

**Command / output**

```
> npm.cmd run test -- --run test/unit/context-excluded.test.ts
 ✓ test/unit/context-excluded.test.ts (3 tests) 766ms
 Test Files  1 passed (1)
      Tests  3 passed (3)
```

**Observation (out of scope, reported not fixed):** the pre-existing aggregate `looseItems` card still renders the same items a second time; excluded rows therefore appear in both the pack table and the aggregate table. AF-08 condition 3 forbids fixing it in this batch.

### AF-09 — The advertised plan contract is callable

**Files / line ranges**

- `src/server/agents/registry.ts:791-804` — `PLAN_AGENT_IDS` and `planOutputSchemaFor(agentId)` returning `AgentPlanSchema`; `ProjectPlanSchema` unchanged.
- `src/server/pipeline/run.ts:22` import `planOutputSchemaFor`; `:405-408` adhoc plan branch validates with `planOutputSchemaFor(agent.id)`; `:470-471` full-build architect still uses `ProjectPlanSchema`.
- `web/src/pages/AgentsPage.tsx:477` hint exactly `Structured JSON outputs are schema-validated before they are stored; text output is stored as text.`
- `test/unit/agent-plan-contract.test.ts` (new).

**Tests (6):** both plan `architect` payloads and kind payloads for router/epic/cartographer parse through the selector; router payload missing `summary` fails; ProjectPlan accepted via the router selector; `ProjectPlanSchema` still rejects a router payload; static source assertion that the adhoc branch uses the selector and the full-build architect uses `ProjectPlanSchema`; exact AgentsPage hint. Existing `agents.schemas.test.ts` (6) and `agents.registry.test.ts` (9) remain green.

**Command / output**

```
> npm.cmd run test -- --run test/unit/agent-plan-contract.test.ts test/unit/agents.schemas.test.ts test/unit/agents.registry.test.ts
 ✓ test/unit/agent-plan-contract.test.ts (6 tests) 28ms
 ✓ test/unit/agents.schemas.test.ts (6 tests) 32ms
 ✓ test/unit/agents.registry.test.ts (9 tests) 95ms
 Test Files  3 passed (3)
      Tests  21 passed (21)
```

**Unverified:** plan-agent runtime execution was not run (paid call forbidden); the contract is proven statically and at the schema level. `schemaId`, `outputKind`, prompts, hashes and `PROMPT_SOURCE_MAP` unchanged.

### AF-10 — Checks: unique row identity and no dead columns

**Files / line ranges**

- `src/shared/types.ts:211` — optional `rowId?: string` on `CheckResult` (additive).
- `src/server/runs/recorder.ts:318-330` — `getChecks` adds `rowId: String(row.id)`; `insertCheck` untouched.
- `web/src/pages/RunDetailPage.tsx:626-660` — row key `check.rowId ?? check.id`; Time `th`/cell removed; File cell drops `check.code`; Check/Status/Mandatory/Detail/File and the badge kept.
- `test/unit/checks-identity.test.ts` (new).

**Tests (4):** two checks with the same `check_id` return 2 distinct `rowId`s and preserved fields; `GET /checks` and `/snapshot` both carry `rowId`; an old payload without `rowId` remains valid; explicit distinct `created_at` values are written before asserting order (no millisecond-tie reliance).

**Command / output**

```
> npm.cmd run test -- --run test/unit/checks-identity.test.ts
 ✓ test/unit/checks-identity.test.ts (4 tests) 726ms
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

**Unverified:** actual duplicate-key behaviour in the production React build is not re-measured here (the key is provably unique now). No migration; `e2e/ui-audit.spec.ts` untouched.

### AF-11 — Routing reason derives from the decision, not a literal

**Files / line ranges**

- `src/server/app.ts:409-430` — `reasonText` composed from that decision's `features`: non-empty string `reason` wins; else non-empty string `qualitySource` → `"<source>-based selection (n=<finite sampleSize or 0>)"` + ` · model <model>` / ` · thinking <thinking>` only for non-empty strings; the `reason` key is conditionally spread and omitted when unknown.
- `test/unit/routing-reason.test.ts` (new).

**Tests (4):** `{qualitySource:'prior',sampleSize:0,model:'deepseek-flash',thinking:'disabled'}` → exact composed sentence; `{}` → `'reason' in decision === false`; `{reason:'learned v2'}` wins; non-string qualitySource → no reason; missing/non-finite sampleSize → `n=0`; non-string model/thinking omitted; serialized response contains no `NaN`, `[object Object]`, `"undefined"`, or the old literal; other decision keys and `allocatedCostUsd`/`reserveUsd` preserved.

**Command / output**

```
> npm.cmd run test -- --run test/unit/routing-reason.test.ts test/unit/trace-fixes.test.ts
 ✓ test/unit/routing-reason.test.ts (4 tests)
 ✓ test/unit/trace-fixes.test.ts (7 tests) 584ms
 Test Files  2 passed (2)
      Tests  11 passed (11)
```

**Approved exception stated:** omitting the `reason` key when nothing is known is the single approved exception to "additive API only" (AF-11 condition 2). No other key was removed or renamed. No UI change (the UI already renders only truthy reasons); no DB writer change; no backfill.

## 3. Final gates (quoted)

### 3.1 Typecheck

```
> npm.cmd run typecheck
> tsc --noEmit
TYPECHECK_EXIT=0
```

### 3.2 Full unit suite

```
> npm.cmd run test -- --run
 Test Files  50 passed (50)
      Tests  312 passed (312)
   Duration  23.45s
```

50 = baseline 38 + 12 new files. 312 = baseline 249 + 63 new tests.

### 3.3 Build

```
> npm.cmd run build
web/dist/assets/index-DAWc-vRE.js  664.33 kB │ gzip: 199.34 kB
✓ built in 1.43s
EXIT=0
```

The only stderr text is Vite's pre-existing chunk-size advisory (>500 kB); the process exit code is 0 (an earlier PowerShell `2>&1` capture mis-reported the advisory as a native-command error; the direct run above is authoritative). `web/dist` was regenerated by this build (allowed exception).

### 3.4 Stage census

```
> node scripts\assert-stage.mjs --stage=p7 --json
{
  "ok": true,
  "data": {
    "stage": "p7",
    "label": "B2",
    "counts": { "files": 162, "tables": 45, "routes": 48, "scripts": 24 },
    "violations": []
  }
}
EXIT=0
```

`files` 162 = baseline 150 + 12 new test files (honest report, as the gate permits). `routes` 48, `tables` 45, `scripts` 24, `violations` [] — unchanged.

### 3.5 Sweeps

```
> npm.cmd run stub-sweep
stub-sweep: clean (86 files)
> npm.cmd run secret-scan
secret-scan: clean (160 files)
```

A manual `Select-String` over all 24 changed/new files for `TODO|FIXME|XXX|HACK|placeholder|NotImplemented|not implemented|mock|stub|dummy|lorem|simplified for|for illustration` returned only pre-existing domain strings (verifier check id `stub.scan`, product `mock` refusal/UI mode, HTML `placeholder` attributes, prompt text that forbids TODO/FIXME, descriptive text). No unfinished code, stub body, or placeholder implementation was introduced.

### 3.6 Preflight (documented environment refusal)

```
> npm.cmd run preflight -- --port 0 --json
"ok": false,
"code": "E_RESOURCE_INSUFFICIENT"
"ram": { "ok": false, "actual": 1.08, "required": 1.5 }
```

Node/npm/disk/chrome/port checks pass; free RAM is 1.08 GB against the 1.5 GB floor. This is the documented environment refusal the gate allows; it is not caused by this batch.

### 3.7 Baseline manifest integrity (nothing else changed)

Recomputed all 150 `docs/AUDIT-WAVE-6/baseline.sha256` entries:

```
baseline entries OK: 138
mismatched: 12   (exactly the 11 production files + test/unit/logic-core.test.ts)
missing: 0
```

So `e2e/**`, `scripts/**`, `config/**`, `package.json`, `playwright.config.ts`, all other tests, and every untouched source file are byte-identical to baseline. The `logic-core.test.ts` diff vs the baseline copy is only the `config` import + `try/finally` isolation wrapper; all assertions are identical.

## 4. No backfill / no P7 data

- **Historical run rows remain NULL.** Read-only `data/hive.db` check after the batch: the seven historical failure/budget runs (`run_1e5a…`, `run_23af…`, `run_26e2…`, `run_2bb2…`, `run_65da…`, `run_9c46…`, `run_abf5…`) still have `cost_usd = NULL`, `prompt_tokens = NULL`, `completion_tokens = NULL`. The run with no usage rows (`run_3a45…`) stays honestly NULL. No UPDATE/DELETE was issued against the production DB by this writer.
- **No P7 data created.** Every test opens `initDb(':memory:')` or a `mkdtemp` database; the production `data/hive.db` was opened only with `new DatabaseSync(..., { readOnly: true })`. P7 tables remain `variants 0`, `eval_suites 0`, `eval_runs 0`, `promotions 0`; newest `traces`/`learning_audit`/`events` timestamps are `2026-11-04T04:48:30Z`, i.e. before this writer's first edit (~05:00Z). `/api/learning/overview` refusal code and `src/server/learning/**` are untouched.
- **Production run count note (external, not this writer):** the DB now holds 26 runs; the 26th (`run_fca89a75c3b1b917a5`, completed, cost 0.09898257) was created at `2026-11-04T04:41:01.515Z`, before this writer's first edit, by the already-running server. Its spend explains the probe delta (`sumRunCost` 0.317771976 → 0.416754546, `sumUsageCost` 0.924624168 → 1.023606738, both +0.09898257). `measuredWithNullRunCost` is still 7 and `unreportedMeasuredCostUsd` still 0.606852192.

## 5. SHA-256 of changed files

| File | SHA-256 |
|---|---|
| `src/server/runs/recorder.ts` | `83223417C125B50E51F49AD91A7CB574D56E0E96A9D3248F10EA458A0ECA9068` |
| `src/server/runs/manager.ts` | `9791D860B01650E82015CAACE45323CB956CA9946804EE32CBC71C5F36CE5545` |
| `src/server/pipeline/run.ts` | `0E201141F091E7D6CDEA0313F90E94EDAB6D2EA604AAB4CEEFFDD348C655CF8B` |
| `src/server/app.ts` | `3EB72C7281E9F78C65709A7BEFE23B7A00A359F9D65D63F64051116EE81588D9` |
| `src/server/agents/registry.ts` | `BC0898A186C015A3CA29A6BF0BFDDAA2B86FB85D357023D4CD7DB020214FDDBB` |
| `src/shared/run-events.ts` | `5E5CEB3D72B4D81C6ECAAEDEBEACC11E466183609104A196BD33E510DF0492E6` |
| `src/shared/refusals.ts` | `2475B39FEE5C4D97C6851464ADC2E4ACE70EB3287296B1BF8329744F301BBA85` |
| `src/shared/types.ts` | `C77B9B2413DCB7C72C29C1422EDADAB5C3178D02290EFF5544C43B845153AE0A` |
| `web/src/hooks/useApi.ts` | `40E26D054CD3E8E84673D79CBE0E05BF44821E3FC8E8DD15248138455322DE49` |
| `web/src/pages/RunDetailPage.tsx` | `FB16035203135002106DB20A08A4F0C0E19EDBB59891FE449B558C3CF6F346F9` |
| `web/src/pages/AgentsPage.tsx` | `4BFC97B73DA72BBADA395D12C5C361C810773D7E7C8DEBF7E97D975B00403E42` |
| `test/unit/logic-core.test.ts` (isolation only) | `A6487ECEB648DA1A6EEF68D32D250EB6C601B958F4CF7992585B27C62F242888` |
| `test/unit/terminal-usage.test.ts` (new) | `2559D2A17F8894F638D89714FCACCE11FCDC94E3644C1103B0F804E132D769DA` |
| `test/unit/event-contract.test.ts` (new) | `6F27DB45DE843E1BD204A305A3228069B9A0CF31B34BC95598FFF3208078BDB6` |
| `test/unit/run-events-selection.test.ts` (new) | `72F9E52858F6B21D9CB7F48DABF80B8FE381573181E8855A27D38FCE2D65FB9A` |
| `test/unit/events-window.test.ts` (new) | `22C895D2473A4FCCAC76E469EF4F1EEFAE56A25F539B644D97A446D57834FA81` |
| `test/unit/snapshot-limits.test.ts` (new) | `A8037EBEA5FDD903A50F3787355FB201A9A6B2D13BC0A9BB0455937A1FE6A3DB` |
| `test/unit/error-code.test.ts` (new) | `4D853F45D2FDE7F9F08F83980FF1F610FD9063EFFED4324D4A818154169022B4` |
| `test/unit/terminal-error-code.test.ts` (new) | `2E354D5179EF9A2B2E9798766565E19E1B14D95C6F6D18BF5F5EAE309F76F28C` |
| `test/unit/startup-interrupt.test.ts` (new) | `7124118E9742D5AFB4156D11A61E715B76043251CC3FFF621E32D3B73EB54678` |
| `test/unit/context-excluded.test.ts` (new) | `6BF159D78B3C27C1F6DB1A13279D55A8B48B8EFFD50E3E0FE46646865611B040` |
| `test/unit/agent-plan-contract.test.ts` (new) | `0EA19BF848A660662AEC09D95F0DC2C4DA6385B6BA3C0247ECA8A37CB6D818A6` |
| `test/unit/checks-identity.test.ts` (new) | `1E62FC2E9E9DFCB036364BC33F01B0C714F4D2BC0974B67CAC9231E4654AE45D` |
| `test/unit/routing-reason.test.ts` (new) | `2CA6CF57F5B5B7DD167BAAC00CEE92CBA24CB3B747530B50EC2338A18B6D2271` |

## 6. Unverified / not run (explicit)

1. **E2E was not run** and the server was not restarted (per the task). The Lead must restart and run `npm.cmd run e2e`; pinned `e2e/api-contract.spec.ts:62-64` and `e2e/ui-audit.spec.ts:127-147` are untouched and must stay green.
2. **AF-01 gate-event payloads at runtime** — code-inspection only (a provider call is required to fail a gate); catch/executor paths are runtime-tested.
3. **AF-03 live→terminal transition** — not exercised; no non-terminal run and route interception/seed data are forbidden. Fresh terminal load keeps its existing e2e pin and unit peer.
4. **AF-06 `run.ts:232-237` mapper at runtime** — needs a real provider failure (paid); the pure helper table and the manager integration test cover the logic.
5. **AF-09 plan-agent runtime** — no paid plan-agent run; schema + static wiring are proven.
6. **AF-04 >500-event boundary** — the boundary was tested with window 3; no run in the DB exceeds 500 events.
7. **AF-10 duplicate-key render in the production bundle** — the key is now provably unique; the rendered-warning measurement from the forge probe was not repeated.
8. **AF-07 SELECT→UPDATE race** — the guarded UPDATE closes it structurally; the race was not timed.
9. **Preflight** — environment refusal (`E_RESOURCE_INSUFFICIENT`, free RAM 1.08 GB < 1.5 GB); node/npm/disk/chrome/port pass.
10. **Build advisory** — Vite's >500 kB chunk-size advisory is pre-existing; build exit 0.

## 7. Gate compliance checklist

- No new route, table, migration, package script, dependency, or production source file: **confirmed** (stage 48/45/24, violations [], files only +12 tests).
- No historical backfill and 7 NULL-cost runs stay NULL: **confirmed** read-only.
- No P7 data, no learning/security/vault/verify edits: **confirmed**.
- Pinned e2e tests, `web/src/api.ts`, `getRunEvents`, `GET /stream`, `run.completed`, `budget_reservations`, `/api/stats`, prompts/hashes/schemaIds, `PHASE_TRANSITIONS`: **untouched**.
- Additive API only except AF-11's approved conditional omission of a fabricated `reason`: **stated in §2 AF-11**.
- No test weakening: `logic-core.test.ts` isolation only (assertions verified identical); all other pre-existing tests byte-identical.
- Single writer, strict AF order, later fixes preserved earlier edits (overlapping files re-read and patched surgically): **confirmed**; `PROGRESS.md` carries the per-AF ledger and commands.
- No secret logged or written; secret-scan clean; no paid call.
