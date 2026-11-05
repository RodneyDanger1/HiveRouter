# FORGEWRIGHT DIRECTIVE — W6-AUD-04 capability batch

**Audience:** one product writer (forgewright seat). **Source of truth:** this file plus `capability-audit.md` in the same folder. Everything here is derived from `file:line` evidence re-verified against the live repo and a read-only DB/API; nothing is inferred from prose. Follow it literally; if a line has moved, locate the same expression and say so in your receipt.

---

## 0. Situation report (what the previous seats found)

**First three seats**

- **Weaver (W6-AUD-01)** audited the built UI front-to-back (398 control instances, 34 traces, 16 vs 27 event types) and reported 13 defects. Its five material ones are confirmed: dropped live events (F1), missing spend on failed runs (F2), cap never surfaced (F3), dead Context columns (F4), hardcoded routing reason (F5). It correctly classified the `run_abf5` "Running / 7 steps / Live" screen as a **stale mid-run capture**, not a convergence bug. It missed (out of scope) the agent-contract drift and mis-attributed the cap's provenance.
- **Logic (W6-AUD-02)** produced reproducible throwaway-DB RED probes. I re-ran them unchanged: **6/15 RED, identical**. Its core wiring defects (provider code loss, missing terminal spend, dead state machine, SSE drift, `/events` truncation, silent `interrupted`) are confirmed. Its probe suite is the best artifact in this wave; reuse its patterns.
- **Forge (W6-AUD-03)** independently corroborated the cost, event and truncation defects (three-way spend contradiction; 24/25 truncation census; 3/3 run delivery counts) and correctly refuted R-1/R-2/R-3. **It is missing the files it references:** `docs/AUDIT-WAVE-6/forge/patch-proposals.json` (P-1…P-5) and any handoff file do not exist; only `root-causes.md`, `red-evidence.md`, `evidence/`, `probes/` are present. Its P-4 prose ("ask for window+1 … return the newest window rows") is internally inconsistent for a run with more than `window` events — AF-04 below replaces it.

**Capability auditor (this seat)**

- Baseline integrity: **150/150** files in `baseline.sha256` still match — no product file changed since baseline.
- DB/API census (read-only): 25 runs (18 completed / 4 budget_exceeded / 3 failed), 972 events, 161 usage rows (all `provider`), 7 runs with NULL cost but **$0.606852192** measured spend, 24/25 false truncation positives, 84 context packs / 343 items / 0 tokens / 0 non-empty excluded, 15 `run_limit` rows, 45 tables, 24 scripts, 48 route strings (42 server paths + 6 UI), 45 OpenAPI operations, 37 registered agents (28 routable, 12 ever stepped, 7 ever routed, 9 with evidence).
- New finding **CA-01 (P2):** `router`, `epic`, `cartographer` advertise the `agent-plan` contract, but the only plan-consuming caller validates `ProjectPlanSchema`; `AgentPlanSchema` — the schema the registry advertises — has **zero production callers**. `metacognitive`'s `candidate-draft` contract is never validated, while the Agents page claims "Output is schema-validated before it is stored".
- Baseline unit suite is **green**: 38 files / 249 tests passed (matches `docs/PLAN-v3.md:475`). Your failures are attributable to your change.

**Non-negotiable framing:** this batch fixes *wiring and truth*. It does **not** add capabilities, execute generated code, run a shell, touch secrets, spend money, seed data, or rewrite historical terminal records. If a fix seems to need one of those, stop and report instead.

---

## 1. Operating constraints for this batch

**Approved write scope (product):** `src/server/**`, `src/shared/**`, `web/src/**`. Tests: `test/unit/**`, `e2e/**` (new test files allowed). Do **not** touch: `src/server/learning/**`, `src/server/security/**`, `src/server/vault/**`, `scripts/**`, `config/**`, `package.json`, `playwright.config.ts`, `docs/**` (except your own receipt if your seat requires one), `data/**`, `workspace/**`, `logs/**`, `.env*`, `vault/**`, `web/dist/**` except by running the build.

**Hard constraints**

1. **No new route, table, migration, or package script.** `assert-stage --stage=p7` must keep `routes:48`, `tables:45`, `scripts:24`. Target files are already allowed by the stage path globs (`src/`, `web/`, `test/`, `e2e/`).
2. **No new production source file is required.** Put shared helpers in existing files: `src/shared/run-events.ts`, `src/shared/refusals.ts`, `src/server/runs/recorder.ts`. New *test* files are expected and fine.
3. **Additive API only.** Adding keys (`limits`, `rowId`, `included`, `reason`, `costUsd`, `run.interrupted` event) is allowed. Do not remove or rename existing response keys.
4. **Do not weaken or delete tests.** `e2e/api-contract.spec.ts:62-64` pins `E_RUN_NOT_FOUND` for unknown API routes — leave it. `e2e/ui-audit.spec.ts:127-147` pins terminal-no-SSE — leave it.
5. **No paid calls.** Do not run `npm run test:live`, `npm run bench`, or any live provider path. `npm run verify` (typecheck/test/build/stub-sweep/secret-scan), `npm run e2e`, `assert-stage`, `preflight` are the gates.
6. **No fake data / mocks as proof.** Test doubles for DB/HTTP/log sinks are allowed per the repo contract; a fabricated run/event/agent evidence row is not.
7. **No historical backfill.** `runs.cost_usd` stays NULL for the 7 historical runs; `trace_complete` stays as-is on the 7 historical rows; `agent_evidence` is not seeded. State this in your receipt.
8. **Restart discipline.** Server-side changes need a process restart before e2e/live inspection (`web/dist` is served from disk; static-only changes need only `npm run build`). Restart only the local dev server; do not touch the production DB.
9. **One writer per file**; if you split work, serialize by file.

**Evidence you must capture (paste command + observed output in your receipt):**

```
npm.cmd run typecheck
npm.cmd run test                # expect 38+ files / 249+ tests, all pass
npm.cmd run build               # rebuilds web/dist for e2e
node scripts\assert-stage.mjs --stage=p7 --json   # expect violations:[] routes:48 tables:45 scripts:24
npm.cmd run preflight -- --port 0 --json
npm.cmd run e2e                 # against a restarted local server on 127.0.0.1:8787
node docs\AUDIT-WAVE-6\capability\probe-db-readonly.mjs   # before/after cost null-count (read-only)
```

For UI-visible fixes, capture a before/after screenshot or a DOM assertion in e2e — not a verbal claim. For server fixes, capture the route response JSON.

---

## 2. Approved fix queue (11 items, strict order)

### AF-01 (P1) — Terminal runs must record the usage they actually spent

**Root cause.** Only `finalize()` writes `cost_usd`/`prompt_tokens`/`completion_tokens` (`src/server/pipeline/run.ts:1075-1084`). Every other terminal writer omits them: gate fail `run.ts:853-861` (via `markTerminal`), catch `run.ts:868-888` (bare `updateRun`), executor rejection `src/server/runs/manager.ts:150-156`, no-controller cancel `manager.ts:179-185`. `markTerminal` (`manager.ts:250-258`) has no usage fields. `usageTotals` already implements the honest contract (`src/server/runs/recorder.ts:355-378`): NULL when there are no rows; NULL for all three when any row has `source='unknown'`; otherwise the SUM.

**Change.**
1. `src/server/runs/recorder.ts`: export a helper `usageFields(runId)` returning `{ cost_usd: number|null; prompt_tokens: number|null; completion_tokens: number|null }` from `usageTotals` (no new query logic).
2. `src/server/runs/manager.ts`:
   - `markTerminal(...)` adds `...usageFields(runId)` to its `updateRun` patch.
   - the executor `.catch` adds `...usageFields(id)` to its `updateRun` patch.
   - the no-controller cancel branch adds `...usageFields(runId)`.
3. `src/server/pipeline/run.ts:884`: add `...usageFields(runId)` to the catch `updateRun` patch. Both gate paths already funnel through `markTerminal` and inherit the fix; keep them as-is.
4. Terminal **event** payloads: every `run.failed`/`run.cancelled` emitted from these paths must carry `costUsd` (the same value written to the row; `null` when unknown) and a human `message` that is **not identical to `code`**:
   - gate emits (`run.ts:342,433,858`): add `message: 'Mandatory verification failed'` (or the run-specific gate sentence already used at `run.ts:341,432,857`).
   - catch emit (`run.ts:885`): before emitting, if `message === code`, replace `message` with `REFUSALS[code]?.message` when the code is registered (`src/shared/refusals.ts`), else keep the prose message. Keep the 500-char redaction slice.
   - `run.completed` (`run.ts:1088`) is unchanged.

**Semantics / expected behaviour.** Every terminal run row's `costUsd`/`promptTokens`/`completionTokens` equals `usageTotals(runId)` at terminal time, for `completed`, `completed_with_warnings`, `failed`, `budget_exceeded`, `cancelled`, `interrupted` (interrupted via AF-07). `GET /api/runs/:id/snapshot` therefore returns a non-null `run.costUsd` for the 7 currently-NULL failure runs **only for runs created after this change**; historical rows stay NULL.

**Edge cases (must be tested).**
- zero usage rows → all three `null` (never `0`);
- any `source='unknown'` row → all three `null` (existing `usageTotals` contract);
- duplicate terminal write (gate then catch) → same values, no double count (usage rows are per call, not per terminal write);
- executor rejection after the pipeline already wrote a terminal row → last-write-wins with the same sum;
- budget-exceeded → the spend that tripped the cap is recorded;
- cancelled → partial spend recorded;
- `run.failed` message for `E_BUDGET_EXCEEDED` must render as prose, not `E_BUDGET_EXCEEDED E_BUDGET_EXCEEDED`.

**Tests (new `test/unit/terminal-usage.test.ts`, `initDb(':memory:', 'B2')`).**
1. create run row + 2 `usage` rows via `insertUsage` → `markTerminal(...,'failed')` → row cost/tokens equal the SUM.
2. one `source:'unknown'` row → all three NULL.
3. no usage rows → all three NULL.
4. call `markTerminal` twice → values unchanged, single terminal state.
5. `app.inject` (host header `127.0.0.1:${config.port}`) `GET /api/runs/<id>/snapshot` → `run.costUsd` equals the SUM.
6. the emitted `run.failed` row payload has `costUsd` and `message !== code`.
7. redirect `config.dataDir` to `fs.mkdtempSync` for any path that calls `recordError`; restore in `finally`.

**Preserve.** `run.completed` payload; `usageTotals` semantics; all 161 historical usage rows; `budget_reservations` untouched; `/api/stats` aggregate unchanged.

---

### AF-02 (P1) — One event vocabulary: subscribe to everything the server emits, and deliver the payload

**Root cause.** `STREAM_EVENT_TYPES` (`web/src/hooks/useApi.ts:72-100`) omits `run.queued`, `agent.failed`, `phase.skipped`, `context.skipped`, `repair.stalled`. `EventSource` dispatches named frames only to registered listeners (`:143`); every frame is named (`src/server/app.ts:854`), so `onmessage` (`useApi.ts:144`) never fires. The live handler stores the **whole SSE envelope** as `data` (`useApi.ts:126-139`), while persisted rows map `payload` (`src/shared/run-events.ts:19-25`).

**Change.**
1. `src/shared/run-events.ts`: add
   - `export const RUN_EVENT_TYPES = [ ...the 16 emitted types... ] as const;` (16 names: `run.queued, run.started, run.failed, run.cancelled, run.completed, phase.started, phase.completed, phase.skipped, agent.started, agent.completed, agent.failed, file.written, route.decided, context.packed, context.skipped, repair.stalled`);
   - `export const RESERVED_EVENT_TYPES = [ ...the 16 currently-subscribed-but-never-emitted names... ] as const;` (keep them; do not delete — D-24);
   - `export const STREAM_EVENT_TYPES: readonly string[] = [...RUN_EVENT_TYPES, ...RESERVED_EVENT_TYPES];`
   - `export function normaliseStreamEvent(rawType: string, rawData: unknown): { type: string; data: unknown }` — if `rawData` is a record with `schema === 'hive.api.v1'` and a `data` property, return `{ type: typeof rawData.type === 'string' ? rawData.type : rawType, data: rawData.data }`; otherwise `{ type: rawType, data: rawData }`.
2. `web/src/hooks/useApi.ts`: import the constant and helper; delete the local array; in the handler parse JSON, call `normaliseStreamEvent(event.type, parsed)`, keep the `heartbeat` filter, keep `receivedAt: new Date().toISOString()`, and keep `source.onmessage = handler` as a harmless fallback.
3. `src/shared/run-events.ts` must not import React or client-only modules.

**Semantics.** A live/replayed event's `data` has the same shape as the persisted row's `data` (the inner payload). All 16 emitted types produce a row on a live page. The 16 reserved listeners remain registered (future surface, not a claim).

**Edge cases.** non-JSON frame (keep raw text path); frame without `event:` name (onmessage → `run.event`); `heartbeat` comment (never becomes a named event); payload that itself contains a `data` key without the `schema` marker (must NOT be unwrapped).

**Tests (new `test/unit/event-contract.test.ts`).**
1. read every `src/server/**/*.ts`, extract `emitEvent(<expr>, '<type>'` literals → every literal ∈ `RUN_EVENT_TYPES`.
2. every `RUN_EVENT_TYPES` member ∈ `STREAM_EVENT_TYPES`; no duplicates across the union.
3. explicit assertion that the 5 previously-missing names are in `STREAM_EVENT_TYPES` (regression pin).
4. `normaliseStreamEvent('agent.failed', {schema:'hive.api.v1',type:'agent.failed',data:{code:'E_LLM_RATE_LIMIT'},meta:{}})` → `{type:'agent.failed', data:{code:'E_LLM_RATE_LIMIT'}}`.
5. plain payload `{code:'x'}` (no schema) → unchanged; non-record → unchanged; malformed JSON path is exercised in the client (assert no throw by calling the helper with a string).

**Preserve.** Persisted mapping (`mapPersistedRunEvents`) unchanged; 5 s poll unchanged; terminal no-SSE behaviour unchanged.

---

### AF-03 (P1) — The terminal Events tab must show the persisted ledger

**Root cause.** `web/src/pages/RunDetailPage.tsx:133`: `visibleEvents = events.length > 0 ? events : persistedEvents.data ?? []`. A page that watched a run live keeps its in-memory array (capped at 100 by `:136`), so the fetched 108-row ledger is discarded while the heading (`:1009-1013`) says "Persisted events (latest 500)". Reset only happens on `runId` change (`:116-119`); the stream is correctly disabled at terminal (`:135`).

**Change.**
1. `src/shared/run-events.ts`: add `export function selectVisibleEvents(input: { terminal: boolean; live: MappedRunEvent[]; persisted: MappedRunEvent[] }): MappedRunEvent[]` → `input.terminal ? input.persisted : input.live`.
2. `web/src/pages/RunDetailPage.tsx:133`: `const visibleEvents = selectVisibleEvents({ terminal, live: events, persisted: persistedEvents.data ?? [] });`
3. Do not clear `setEvents([])` at terminal (unnecessary and would flash); the selector wins.

**Semantics.** Terminal → exactly the `/events` ledger (up to the server window), including types the live feed used to drop. Non-terminal → the live buffer (bounded to 100). Loading/error/empty states keep their current branches (`RunDetailPage.tsx:1017-1029`); when the persisted fetch is in flight the tab shows the loading panel, not an empty table.

**Edge cases.** persisted empty and live non-empty → empty state with `lastEventId` (honest: the ledger is the truth); persisted error → `ErrorPanel`; run changes → reset still applies; a run that was already terminal on first load is unchanged (existing e2e must still pass).

**Tests.**
1. new `test/unit/run-events-selection.test.ts`: truth table — `(terminal=true, live=100, persisted=108) → 108`; `(true, 100, 0) → 0`; `(false, 100, 108) → 100`; `(false, 0, 0) → 0`.
2. keep `e2e/trace-fixes.spec.ts:4-23` green (fresh terminal load).
3. **Do not** fake a live run to prove the transition. The transition remains unverified; say so in the receipt. If you can exercise it with a real run, do not — paid runs are out of scope.

**Preserve.** Heading semantics, the 100-row live cap, the snapshot as source of truth.

---

### AF-04 (P2) — `/events` truncation must mean "this run's events were dropped"

**Root cause.** `src/server/app.ts:825-830`: `start = max(after, current - window)` where `current` is the **per-run** max seq but `seq` is a global `AUTOINCREMENT` on the shared `events` table; `truncated = after < start || current - start > events.length` is therefore true for any short run after the ledger passes ~500 rows. Reproduced on 24/25 runs; live abf5 = 108/108 rows with `truncated:true`. The UI ignores it (`web/src/api.ts:327-332`) and instead labels the **artifact** truncation flag "Replay truncated" (`RunDetailPage.tsx:330`).

**Change.**
1. `src/server/runs/recorder.ts`: add
   - `countEventsAfter(runId: string, after: number): number` — `SELECT COUNT(*) WHERE run_id=? AND seq>?`;
   - `getRecentEvents(runId: string, after: number, limit: number): RunEvent[]` — `ORDER BY seq DESC LIMIT ?` then reverse (same mapping as `getEvents`).
2. `src/server/app.ts:818-833`: keep the `after` clamp; `const total = countEventsAfter(id, after); const truncated = total > window; const events = truncated ? getRecentEvents(id, after, window) : getEvents(id, after, window);` `lastEventId` = last returned `seq`, else `lastEventId(id)`.
3. `web/src/pages/RunDetailPage.tsx:330`: rename the badge to **"Artifacts truncated"** (it is driven by `snapshot.truncated`, i.e. the 200-artifact cap at `app.ts:806-814`). Do not add an events badge in this batch.

**Why not forge P-4.** An ASC `LIMIT window+1` returns the *oldest* window after the cursor, so "return the newest window rows" is not implementable from it. The `count + DESC` form above is the correct minimal recipe and does not assume per-run seq contiguity.

**Semantics.** `truncated=true` ⇔ at least one of this run's events with `seq > after` was not returned. Rows are always the newest window (or all of them).

**Edge cases.** `after=0`; `after` at the last seq → `{events:[], truncated:false, lastEventId:current}`; exactly `window` events → false; `window+1` → true with the newest `window`; a run whose first seq is far above 500 → false (the historical false positive); negative/NaN `after` → 0 (keep the existing clamp); unknown run → 404 `E_RUN_NOT_FOUND` (unchanged).

**Tests (new `test/unit/events-window.test.ts`).** Patch `config.limits.eventReplayWindow` to `3` (save/restore, same pattern as `test/unit/run-timeout.test.ts:15-16`), create a run, `emitEvent` 0/2/3/4 events, and use `app.inject` for each case; assert `events.length`, `truncated`, `lastEventId`, and that with 4 events the returned seqs are the **newest** 3. Add an `after`-cursor case.

**Preserve.** Response keys `{events,truncated,lastEventId}`; `GET /stream` untouched (U-1 deferred); no client change to `getRunEvents`.

---

### AF-05 (P2) — Serve the **per-run** cost cap on the snapshot

**Root cause.** `GET /api/runs/:id/snapshot` returns only `{run,lastEventId,steps,checks,artifacts,truncated}` (`src/server/app.ts:802-816`); the UI reads `snapshot.limits.maxCostUsd` (`RunDetailPage.tsx:199-201`) and `CostMeter` only appends a cap when it is a number (`ui.tsx:607`). **Provenance correction (CA-04):** `run_snapshots.snapshot_json.limits.maxRunCostUsd` is the **global** config cap (0.5 for both `run_23af…` and `run_abf5…`, even though 23af's per-run limit is 0.05). The truthful per-run source is `runBudgetUsd(id)` (`src/server/runs/budget.ts:44-46`, already imported at `app.ts:14`), which reads `settings.run_limit:<id>` and clamps to the global cap.

**Change.** In the snapshot response add `limits: { maxCostUsd: runBudgetUsd(id) }`. One line (plus the import already present).

**Semantics.** The run detail shows `$spent / $cap cap` for every run; for a run with `run_limit` 0.05 the cap is 0.05, not 0.5. Additive field.

**Edge cases.** no `run_limit` row → global cap; `run_limit` above global → clamped (`scopeCap` takes the min); never `null`/`undefined`; unknown run → 404 unchanged.

**Tests (new `test/unit/snapshot-limits.test.ts`).** (1) insert `run_limit:<id>` 0.03 → snapshot `limits.maxCostUsd === 0.03`; (2) no row → `config.limits.maxRunCostUsd`; (3) the pre-existing keys are all still present (guard against projection regression); (4) `RunDetailPage` already reads it — no UI change required, but verify in e2e that the cap text appears on a run with a limit (add an assertion to an existing run-detail e2e if convenient).

**Preserve.** The Settings page (D-20); `run_snapshots` content; no route change.

---

### AF-06 (P2) — Preserve the provider error code through every terminal writer

**Root cause.** `LlmError` stores its identity in `.code` (`src/server/llm/client.ts:63-80`) with a prose `.message` ("DeepSeek rate limit reached after 3 attempts."). Three mappers derive the code from the message prefix instead: `run.ts:233-234` (step + `agent.failed`), `run.ts:871-875` (terminal catch), `manager.ts:146-148` (executor catch). Every provider failure becomes `E_INTERNAL`. Registry census: 104 `E_*` literals in `src/`, 85 `REFUSALS` keys, 31 unregistered.

**Change.**
1. `src/shared/refusals.ts`: add and export
   ```ts
   export function codeOfError(error: unknown): string {
     const candidate = (error as { code?: unknown } | null)?.code;
     if (typeof candidate === 'string' && /^[A-Z][A-Z0-9_]*$/.test(candidate)) return candidate;
     const message = error instanceof Error ? error.message : String(error);
     const prefixed = /^(E_[A-Z0-9_]+)/.exec(message);
     return prefixed ? prefixed[1] : 'E_INTERNAL';
   }
   ```
2. Use it in all three mappers. **Keep the existing precedence:** in `run.ts:871-875` the `signal.reason E_RUN_TIMEOUT` check stays first (timeout reason is an `Error('E_RUN_TIMEOUT: …')`); in `manager.ts:146-148` `timedOut` stays first. Do not change the status mapping (`E_RUN_TIMEOUT`→failed, aborted/`E_CANCELLED`→cancelled, `E_BUDGET_EXCEEDED`→budget_exceeded).
3. Do **not** expand `REFUSALS` in this batch (D-12); `E_LLM_*` remain non-HTTP codes. The row/event/step identity is what this fix restores.

**Semantics.** A run that dies on a provider rate limit persists `E_LLM_RATE_LIMIT` in `runs.error_code`, `steps.error_code`, and the `run.failed`/`agent.failed` payloads; the human message is unchanged and redacted.

**Edge cases.** LlmError (code + prose); bare `Error('E_PROVIDER_EMPTY')` → `E_PROVIDER_EMPTY`; `Error('E_AGENT_OUTPUT_MISMATCH: x')` → `E_AGENT_OUTPUT_MISMATCH`; lowercase/non-matching `code` → prefix → `E_INTERNAL`; AbortError with prose message → `E_INTERNAL` (the abort path still maps to `cancelled` via `signal.aborted`); non-Error throw (`String(error)`) → prefix or `E_INTERNAL`.

**Tests.**
1. new `test/unit/error-code.test.ts`: the six cases above as a pure table.
2. new `test/unit/terminal-error-code.test.ts` (throwaway DB, same shape as the logic probe): `initDb(':memory:')`; `setExecutor(() => Promise.reject(new LlmError('E_LLM_RATE_LIMIT', 'DeepSeek rate limit reached after 3 attempts.')))`; `await createRun({...})`; await a tick; assert `getRun(id).errorCode === 'E_LLM_RATE_LIMIT'` and the `run.failed` payload code matches; restore the executor and `config.dataDir` (redirect to a temp dir) in `finally`.

**Preserve.** HTTP error mapping (`app.ts:992-1004`), `recordError` behaviour, the status mapping, and all existing error messages.

---

### AF-07 (P2) — `interrupted` must be an explained terminal state

**Root cause.** `markStartupInterrupted` (`src/server/runs/manager.ts:192-204`) runs a bare `UPDATE runs SET status='interrupted', phase='done', finished_at=?` and releases reservations. No `error_code`, no `error_message`, no event, no error-log record. Reproduced RED on a throwaway DB. No production specimen (0 interrupted rows), so this is a forward-only fix.

**Change.**
1. `src/shared/refusals.ts`: add `E_RUN_INTERRUPTED: { http: 409, exit: 4, retryable: false, message: 'The run was interrupted by a server restart.' }`. (Adding one registry entry is allowed; it keeps `recordError`/client classification honest. It does not add a route.)
2. `src/shared/run-events.ts`: add `'run.interrupted'` to `RUN_EVENT_TYPES` (so AF-02 subscribes to it).
3. `src/server/runs/manager.ts:192-204`: select the active ids (already done), then for each id call `updateRun(id, { status:'interrupted', phase:'done', finished_at: nowIso(), error_code:'E_RUN_INTERRUPTED', error_message:'The run was interrupted by a server restart.', ...usageFields(id) })`; `emitEvent(id, 'run.interrupted', { code:'E_RUN_INTERRUPTED', message:'The run was interrupted by a server restart.', costUsd: usageFields(id).cost_usd })`; `recordError({ source:'run', code:'E_RUN_INTERRUPTED', message:'The run was interrupted by a server restart.', runId:id })`; then `releaseReservationsForRun(id)`. Return the number of runs updated (keep `index.ts:43` behaviour).

**Semantics.** Every run interrupted by a restart is terminal, explained, has exactly one `run.interrupted` event, and appears in `errors.jsonl`. Spend measured before the crash is recorded (AF-01 helper).

**Edge cases.** zero active runs → returns 0, no events, no log; second call → 0 (the `WHERE status IN (…)` excludes them); multiple active runs → one event each; unknown usage → `costUsd:null`.

**Tests (new `test/unit/startup-interrupt.test.ts`, throwaway DB).** Create one `queued` + one `running` run (with 1 usage row); set `config.dataDir` to a temp dir (save/restore) so `recordError` writes to `temp/logs/errors.jsonl`; call `markStartupInterrupted()`; assert (1) both rows `status='interrupted'`, `error_code`, `error_message`; (2) exactly one `run.interrupted` event per run with `code` and `costUsd`; (3) the temp error log has two records with `source:'run'`; (4) second call returns 0 and writes nothing.

**Preserve.** `releaseReservationsForRun` ordering (release after the terminal write), the startup call site (`src/server/index.ts:43`), the returned count.

---

### AF-08 (P2) — Context tab: show what the data actually contains

**Root cause.** `GET /api/runs/:id/context` reads only `included_json` and maps `{id,path,kind,tokens,mandatory}` (`src/server/app.ts:449-469`). The `context_packs.excluded_json` column exists (DB pragma) and the packer writes `{id, reason}` for excluded items (`src/server/context/packer.ts:163-243`), but the route never reads it. Included items persist `tokens: null` (`run.ts:661`), so the Tokens/Chars columns are always empty. The UI advertises 7 columns and claims "with reasons and estimated size" (`RunDetailPage.tsx:768,827`). Census: 84 packs / 343 items / 0 tokens / 0 non-empty excluded in this DB — the route is still wrong by construction.

**Change.**
1. `src/server/app.ts`: parse `excluded_json` (same try/catch pattern as `included_json`); map included items with `included: true`; append excluded items as `{ id, path: null, kind: 'excluded', tokens: null, mandatory: false, reason: String(item.reason ?? 'excluded'), included: false }`. Keep `packs` and `items` shapes; all additions are optional fields already present in `ContextItemView` (`web/src/api-types.ts:154-164`).
2. `web/src/pages/RunDetailPage.tsx`: `ContextItems` drops the **Tokens** and **Chars** columns (they are never produced), keeps Path / Kind / Mandatory / Reason / Included; `ContextTab` description becomes "Included and excluded items are listed; exclusions carry a reason. No raw context is dumped here." (drop "estimated size").
3. Do not change the packer, the DB, or `est_tokens` on the pack header (that one is real).

**Semantics.** Excluded items appear as rows with `included:false` and a reason; included rows show `included:true`; no column claims a value that is never produced.

**Edge cases.** `excluded_json` missing/malformed → `[]` (no crash); reason missing → `'excluded'`; included item `tokens:null` → the column is gone, so no misleading `—`; zero packs → existing empty state.

**Tests (new `test/unit/context-excluded.test.ts`).** Insert a `context_packs` row with `included_json` and `excluded_json` populated; `app.inject GET /api/runs/<id>/context`; assert the excluded row is present with `included:false` and its reason, included rows have `included:true`, and `packs[0].usedTokens` is unchanged. Add a malformed-`excluded_json` case (no 500).

**Preserve.** `packs[].items`, `packs[].usedTokens/prefixHash`, no raw context text in the response.

---

### AF-09 (P2) — Make the advertised plan contract callable

**Root cause (CA-01).** `router`, `epic`, `cartographer` have `outputKind:'plan'`, `schemaId:'agent-plan'` (`registry.ts:112-145`), and the runtime contract instructs them to return a `kind`-discriminated shape (`src/server/agents/prompts.ts:48`). But `AgentPlanSchema` — the union that accepts those shapes (`registry.ts:753-788`) — has **zero production callers**; the only plan consumer validates `ProjectPlanSchema` (`run.ts:406`, adhoc; `run.ts:471`, architect). A `kind:'router'` payload therefore fails validation after the repair retries. Separately, `metacognitive`'s `candidate-draft` contract is never validated because the text path uses `callAgentText` (`run.ts:392-401`), while the Agents page claims "Output is schema-validated before it is stored" (`web/src/pages/AgentsPage.tsx:477`).

**Change.**
1. `src/server/agents/registry.ts`: add a small exported selector
   ```ts
   export const PLAN_AGENT_IDS = ['architect','router','epic','cartographer'] as const;
   export function planOutputSchemaFor(agentId: AgentId): z.ZodType { return AgentPlanSchema; }
   ```
   (A function rather than a bare export so the call site is testable and the intent is explicit. Keep `ProjectPlanSchema` for the full-build architect path — it needs `projectName/files`.)
2. `src/server/pipeline/run.ts:404-407`: the adhoc `plan` branch validates with `planOutputSchemaFor(agent.id)` instead of `ProjectPlanSchema`. Everything else (write `AGENT_OUTPUT.json`, `planned.push`) is unchanged. The full-build architect call at `:471` stays on `ProjectPlanSchema`.
3. `web/src/pages/AgentsPage.tsx:477`: change the hint text to exactly "Structured JSON outputs are schema-validated before they are stored; text output is stored as text." (no overclaim).

**Semantics.** An adhoc run of `router`/`epic`/`cartographer` accepts its documented kind payload; `architect` is still accepted through the union's `ProjectPlan` variant; the full-build plan path is unchanged. The Agents page's validation claim is literally true for every output kind.

**Edge cases.** kind payload missing a required field → validation fails with `E_LLM_SCHEMA_INVALID` (preserved by AF-06); architect-shaped payload for a router agent → still accepted (union) — that is intentional leniency, not a lie; text agent → no schema claim.

**Tests (new `test/unit/agent-plan-contract.test.ts`).**
1. for each of the four plan agents, `planOutputSchemaFor(id).safeParse(<documented payload>)` succeeds (router/epic/cartographer kind shapes, architect `ProjectPlan` shape);
2. a router payload missing `summary` fails;
3. `planOutputSchemaFor('router')` accepts a `ProjectPlan` payload (union fallback);
4. assert the six formerly-AUTHORED ids in `PROMPT_SOURCE_MAP` still pass `test/unit/agents.registry.test.ts` (no change to source metadata).

**Preserve.** `schemaId`, `outputKind`, prompt text, hashes, `PROMPT_SOURCE_MAP`, the full-build planning path, and the model output format.

---

### AF-10 (P3) — Checks: unique row identity, and stop rendering dead columns

**Root cause.** `getChecks` maps `id = check_id` and drops the DB row id (`src/server/runs/recorder.ts:293-303`), so a run with multiple verification passes yields duplicate React keys (`RunDetailPage.tsx:650`) — abf5 has `stub.scan`×4, `plan.coverage`×3, etc. (`evidence-db-probe.txt`). `insertCheck` never persists `code` or `durationMs` and the `checks` table has no such columns, so the "Time" column and the `check.code` fallback can never populate (`RunDetailPage.tsx:656,658`).

**Change.**
1. `src/shared/types.ts`: add optional `rowId?: string` to `CheckResult` (additive).
2. `src/server/runs/recorder.ts`: `getChecks` adds `rowId: String(row.id)`.
3. `web/src/pages/RunDetailPage.tsx`: key rows on `check.rowId ?? check.id`; delete the `<th>Time</th>` and its cell; the File cell becomes `check.file ? \`${check.file}${check.line ? ':'+check.line : ''}\` : '—'` (drop `check.code`). Keep Check/Status/Mandatory/Detail/File and the CheckBadge.

**Semantics.** Each persisted check pass renders as its own row; no duplicate keys; no column claims a value that is never produced. `snapshot.checks` and `GET /checks` carry `rowId` for every row.

**Edge cases.** duplicate `check_id` → distinct `rowId`; old payloads without `rowId` → fallback key; zero checks → existing empty state.

**Tests (new `test/unit/checks-identity.test.ts`).** Insert two checks with the same `id` and different `detail`; assert `getChecks` returns 2 rows with distinct `rowId`, and `GET /api/runs/:id/checks` returns both in `created_at` order. No migration.

**Preserve.** All persisted check fields and ordering; e2e that visits the Checks tab (no test asserts the removed columns — verified).

---

### AF-11 (P3) — Routing reason must come from the decision, not a literal

**Root cause.** `reason: 'static prior route'` is a literal in the route map (`src/server/app.ts:423`) and is rendered for every decision (`RunDetailPage.tsx:731`). Today `ccr` always persists `qualitySource:'prior', sampleSize:0` (`ccr.ts:263-264,566-567`), so the constant happens to be true — but it is a guaranteed lie the day routing uses learning data.

**Change.** In `app.ts` replace the literal with a value derived from the row's own `features`, and **omit the field entirely when nothing is known** (the client type is `reason?: string`, so `null` would be type-dishonest):
```
const reasonText = typeof features.reason === 'string' ? features.reason
  : features.qualitySource != null
    ? `${String(features.qualitySource)}-based selection (n=${Number(features.sampleSize ?? 0)})` +
      (features.model ? ` · model ${String(features.model)}` : '') +
      (features.thinking ? ` · thinking ${String(features.thinking)}` : '')
    : undefined;
// then in the decision object: ...(reasonText ? { reason: reasonText } : {})
```
The UI already renders `decision.reason` only when truthy (`RunDetailPage.tsx:731`).

**Semantics.** The displayed reason is composed of the same fields the API returns for that decision; if a future writer persists a real `reason`, it wins; if nothing is known, the field is absent and nothing is shown.

**Edge cases.** `features={}` → field absent; `sampleSize` absent → `n=0`; non-string `reason` → ignored; model/thinking absent → omitted.

**Tests (new `test/unit/routing-reason.test.ts`).** Insert a `route_decision` with `features_json = {qualitySource:'prior', sampleSize:0, model:'deepseek-flash', thinking:'disabled'}` and a candidate → `GET /routing` reason contains `prior` and `n=0` and the model; a second row with `{}` → `reason` is absent (`'reason' in decision === false`); a third with `{reason:'learned v2'}` → `learned v2`.

**Preserve.** Decision/candidate payload keys, ordering, `allocatedCostUsd`, `reserveUsd`.

---

## 3. Cross-cutting event / payload / terminal-state contract (apply everywhere you touch)

1. **One terminal event per run**, emitted *after* the run row is terminal (`run.failed`/`run.cancelled`/`run.interrupted`/`run.completed`). No event may claim a state the row does not have.
2. **Terminal payload minimum:** `code` (when a failure), `message` (human sentence, never a copy of `code`), `costUsd` (number or `null`), plus the existing `checks`/`timedOut` fields where they already exist. Do not remove existing keys.
3. **Usage fields follow `usageTotals`:** zero rows → `null`; any `unknown` → all three `null`; else the SUM. Never write `0` to mean "unknown".
4. **Live frames and persisted rows share one `data` shape** (inner payload), one `type`, and differ only in `receivedAt` meaning (client receipt vs server `created_at`) — document, don't "fix" the timestamp in this batch.
5. **Terminal statuses are terminal:** do not add a writer that moves a terminal run to another status in this batch (D-15). If you touch a writer, assert you are not doing so.
6. **Redaction applies:** every event payload still passes `redactValue` (`recorder.ts:36-51`); messages are `redactString(...).slice(...)`.
7. **No new event type except `run.interrupted`** (AF-07).

## 4. What NOT to change (explicit)

- **P7 / learning:** `src/server/learning/**`, promotion/rollback/consent/sealed-pool code and any UI that reports the refusal. Do not enable, seed, or simulate a promotion. `/api/learning/overview` must keep returning `E_LEARNING_POOL_EXHAUSTED` / `enabled:false` in this build.
- **Generated-code execution:** no shell tool, no `child_process` for generated artifacts, no auto-apply/auto-promotion, no change to `src/server/verify/**` semantics (except nothing in this batch).
- **Secrets:** no key material in code, logs, fixtures, or events; do not touch `.env*`, `data/secrets*`, key ingress, or the `FORBIDDEN_PROVIDER_KEY_ACCESS` routes. Do not log request bodies.
- **Security paths:** `src/server/security/**` (`safePath`, redaction), vault bridge, origin/host checks.
- **State machine phase matrix:** do not wire `PHASE_TRANSITIONS`/`transitionRun` (D-21) and do not "fix" `markStartupInterrupted` into a generic terminal writer beyond AF-07.
- **`/events` SSE stream windowing** (`app.ts:835-865`): leave the 410 and replay semantics alone (U-1/D-16).
- **`GATE_FAILED` naming:** do not rename it to `E_GATE_FAILED` or register/rewrite it (D-12); only add the missing `message` (AF-01).
- **Historical data:** no backfill of `runs.cost_usd`, `traces`, `agent_evidence`, `checks`, or events.
- **`e2e/api-contract.spec.ts:62-64`** (`E_RUN_NOT_FOUND` for unknown API routes), **`e2e/ui-audit.spec.ts:127-147`** (terminal no-SSE), the 37-agent registry assertions, and the P7 refusal tests.
- **Unrelated refactors:** no renames, formatting sweeps, dependency changes, new packages, new routes, new tables, new scripts, or `package.json` edits.

## 5. Refuted / deferred / unverified — do not work on these

| Item | Status | Why not |
|---|---|---|
| `run_abf5` "Running / 7 steps / Live" convergence (R-1) | **REFUTED** | mid-run capture; live API is `failed/20 steps`; step window 19.5 s (`evidence-steps.txt`). |
| "cancelled is not subscribed" (R-2) | **REFUTED** | `useApi.ts:76` + `run.ts:885`. |
| Wave-5 stub-scan false positive (R-3) | **REFUTED as current defect** | current scanner returns 0 findings on the stored abf5 tree; line 121 is a quoted string (`evidence-stubscan.txt`). Do not re-tighten the scanner to re-flag it. |
| SSE 410 reconnect loop (U-1 / L-10) | **UNVERIFIED** | route half proven; loop unobserved; no run >500 events. D-16. |
| State guard / illegal transitions (U-2 / L-03) | **SUPPORTED but DEFERRED (unsafe)** | phase matrix contradicts four real edges; executor catch throw → unhandled rejection; no production illegal row. D-15. |
| Nested-modal Escape (F7) | deferred | needs dialog-stack design. |
| Skip-link focus (F8) | deferred | a11y; needs focus + e2e. |
| Tab `aria-controls` (F9) | deferred | a11y; multi-component. |
| favicon 404 (F10) | deferred | cosmetic. |
| Unknown-route code (F11) | deferred | pinned by `e2e/api-contract.spec.ts:62-64`. Do not change that test. |
| Refusal-code split (F13) | deferred | new codes/copy; UI pre-validates. |
| Learning inspect UI (O1) | deferred | P7 refusal honesty. |
| `vault/qa-api-temp` root (O2) | deferred | data hygiene; would delete user data. |
| Runs filter >100 / `interrupted` option (O3) | deferred | no live impact; server-side filter is a separate change. |
| "Accepted tree" label (O4) | deferred | cosmetic copy. |
| Dead review path (O5) | deferred | dead code, no claim. |
| Gate error logging + `GATE_FAILED` registration (L-07) | deferred | observability/registry design; historical compatibility. |
| `trace_complete` invariant (L-08) | deferred | needs finalize reorder + the 7 historical rows cannot be repaired without backfill. |
| Learning variant machine (L-09) | unverified/deferred | P7, unreachable. |
| Cancel ack race (L-11) | unverified | sub-ms, unreproduced. |
| Full failure-payload vocabulary / `run.budget_exceeded` (L-12) | partially fixed | AF-01 covers `costUsd`/message on the paths it touches; a new event type needs a consumer decision. |
| `receivedAt` semantics / live-cap disclosure (L-13) | partially fixed | AF-03 fixes array selection; timestamps need `meta.createdAt`. |
| Settings nested `limits` display (F3b) | deferred | AF-05 makes the run cap truthful; settings display is separate. |
| Delete the 16 reserved listeners | deferred | harmless; future surface. |
| Backfill historical cost/traces, seed runs/events | **REJECTED** | fake data / rewriting terminal audit records. |

## 6. Definition of done for this batch

1. All 11 AF items implemented, in order, one commit-sized change each (or one receipt line each).
2. `npm.cmd run typecheck` clean.
3. `npm.cmd run test` → at least 249 tests + your new tests, all pass; quote the summary lines.
4. `npm.cmd run build` succeeds.
5. `node scripts\assert-stage.mjs --stage=p7 --json` → `violations: []`, `routes: 48`, `tables: 45`, `scripts: 24`; report the new `files` count honestly (new test files are expected).
6. `npm.cmd run e2e` → all specs pass against a restarted server; quote the count.
7. `npm.cmd run preflight -- --port 0 --json` → PASS (or the documented environment refusal).
8. `node docs\AUDIT-WAVE-6\capability\probe-db-readonly.mjs` before/after: `sumRunCost` unchanged for historical runs (proves no backfill), and a new failed run (created in a throwaway DB test, not production) shows non-null cost.
9. Receipt lists, for each AF: files changed with line ranges, the test names added, the command output that proves it, and any edge case you could not exercise (state it as unverified).
10. No secret in any diff or log; no `TODO/FIXME/placeholder` in changed files (`npm run stub-sweep`); no paid action; no restart of anything except the local dev server.
