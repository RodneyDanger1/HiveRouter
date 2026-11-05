# W6-AUD-02 — Logic-Debugger findings (HiveRouter Wave 6)

- Seat: independent read-only Logic-Debugger audit (task-2 / W6-AUD-02)
- Repo: `C:\Users\Riley\Desktop\HiveRouter` (B2, no active run, 25 runs)
- Scope written: `docs/AUDIT-WAVE-6/logic/` only. No product file, test, config, workspace, run, DB row or log was modified.
- Evidence rule: every finding below is either (a) reproduced by a probe in this folder against a throwaway DB or the live read-only API, or (b) read from source **and** corroborated by existing persisted rows. Anything not reproduced is labelled **unverified**.

Severity: **P1** = a terminal record or error identity is wrong and user-visible; **P2** = a diagnostic/state path is silently lost or lies; **P3** = contract/observability drift with no current user-visible break.

## Summary

| ID | Sev | Defect | Proof |
|---|---|---|---|
| W6-L-00 | — | `run_abf5` "Running / 7 steps / Live" was a mid-run capture, not a convergence defect | fresh browser load + existing screenshot + event ledger |
| W6-L-01 | P1 | Every provider `LlmError.code` is discarded; run/step/event persist `E_INTERNAL` | probe RED + source |
| W6-L-02 | P1 | Failed and budget-exceeded runs persist `cost_usd = NULL` although provider spend is known | production DB rows |
| W6-L-03 | P2 | Run state machine is dead code; unguarded `updateRun` accepts illegal transitions | probe RED + grep |
| W6-L-04 | P2 | SSE type drift: 5 emitted types are never delivered, 16 subscribed types never emitted | Chrome probe + source |
| W6-L-05 | P2 | `/events` reports `truncated=true` on complete replays | live GET + probe RED |
| W6-L-06 | P2 | `interrupted` terminal state has no code, message, event, or log | probe RED + source |
| W6-L-07 | P2 | Gate failures: no error-log entry, non-registry `GATE_FAILED`, event payload without message | errors.jsonl + event rows |
| W6-L-08 | P3 | `trace_complete=1` is written without proving a trace row exists | DB rows + source |
| W6-L-09 | P3 | Learning variant state machine unguarded; `evaluating`/`rejected` are dead states | source |
| W6-L-10 | P3 | SSE reconnect after a >500-event gap is a permanent 410 loop; client has no snapshot fallback | route probe + client source |
| W6-L-11 | P3 | `cancel` acknowledges on controller presence, not run state | source |
| W6-L-12 | P3 | Failure payload/type drift: `run.failed` for `budget_exceeded`, 3 payload shapes, code duplicated as message | DB rows |
| W6-L-13 | P3 | Live vs persisted event view: shape/time/cap differ, and the terminal tab keeps live data under a "Persisted events" title | client + mapping source |
| W6-L-14 | P3 | `ChecksTab` uses non-unique `check.id` as the React key, collapsing multi-pass checks | DB rows + UI source |
| W6-L-15 | P3 | "Replay truncated" badge is driven by artifact-list truncation, not event replay | route + UI source |

---

## W6-L-00 — run_abf5 "Running / 7 steps / Live": stale capture, not a convergence defect

**Question.** The audit brief claimed the UI showed `Running / 7 steps / Live` while the API said `failed / 20 steps / 108 events / terminal seq 659`. Is terminal state convergence broken?

**Verdict: stale/mid-run capture.** No convergence defect is evidenced; the current UI renders the terminal truth and opens no stream for a terminal run.

Evidence:

1. `docs/AUDIT-WAVE-6/lead-ui-abf5.png` (mtime `2026-11-03 22:09:45` local, i.e. ~54 min after the run's `finished_at = 2026-11-04T03:15:46.742Z`) shows `FAILED · DONE · 20 STEPS · TERMINAL · SNAPSHOT`, timeline item `#1 PLANNING architect SUCCEEDED`, and the error strip `GATE_FAILED Mandatory verification failed`. It does **not** show Running/Live.
2. Fresh browser load (`probe-sse-ui.ts`, Chrome headless, `/runs/run_abf5fe78aab1e932ff`):
   `terminalBadge: "TERMINAL · SNAPSHOT"`, `timelineItems: 20`, `hasStreamBadge: false`,
   `streamRequestsAfterLoad: []`, `errorLine: "GATE_FAILED Mandatory verification failed"`.
3. The run's ledger has one terminal event, `run.failed` seq 659, type subscribed by the client (see W6-L-04). `run.failed` is written **after** `updateRun(status=failed)` (`src/server/pipeline/run.ts:884-885`), so any reload triggered by it already sees the terminal state.
4. The run detail page polls `/api/runs/:id/snapshot` every 5 s while non-terminal and reloads on every delivered event (`web/src/pages/RunDetailPage.tsx:135-145`).
5. The claimed "7 steps" is exactly the run's true state at 03:09:52Z: step `#7` (`python-engine`, generating) finished `2026-11-04T03:09:52.440Z`; the run finished at `03:15:46.742Z` (`probe-db.mjs` steps output). A capture taken mid-run would therefore show Running / 7 steps / Live **truthfully**.

Residual (not the claimed defect): the poll interval and the debounce mean a terminal transition is visible within ~0.25-5 s of the event, not instantly; and a dead stream leaves the badge at "Reconnecting" (W6-L-10) even though the status keeps converging.

---

## W6-L-01 — Provider error code is lost on every terminal path (`E_INTERNAL`)

**Invariant.** The failure identity chosen at the provider boundary survives to `runs.error_code`, `steps.error_code`, the persisted `run.failed`/`agent.failed` event, `errors.jsonl`, and the UI error chip.

**Expected.** `LlmError('E_LLM_RATE_LIMIT', …)` → run/step/event code `E_LLM_RATE_LIMIT`.
**Actual.** run/step/event code `E_INTERNAL`; only the prose message survives.

**Evidence (RED probe).**

```
RED   | error propagation: LlmError E_LLM_RATE_LIMIT must persist its own code
         expected: run.errorCode=E_LLM_RATE_LIMIT, event.code=E_LLM_RATE_LIMIT
         actual  : run.errorCode=E_INTERNAL, event.code=E_INTERNAL, message=DeepSeek rate limit reached after 3 attempts.
```

**Broken hop.** `LlmError` stores the code in `.code` and the human sentence in `.message` (`src/server/llm/client.ts:63-80`). Every terminal mapper derives the code from the *message prefix* instead:

- `src/server/pipeline/run.ts:871-875` — `message.startsWith('E_') ? message.split(':')[0] : 'E_INTERNAL'`
- `src/server/pipeline/run.ts:233-234` (`agentStep`) — same expression for `steps.error_code` and `agent.failed`
- `src/server/runs/manager.ts:146-148` — same expression for the executor catch

LlmError messages are prose (`"DeepSeek rate limit…"`, `"No DeepSeek API key was configured."`), so every `E_LLM_*`, `E_KEY_INVALID`, `E_BALANCE_LOW` failure becomes `E_INTERNAL`.

**Second-order:** 30 distinct `E_*` codes used in `src/` are absent from `src/shared/refusals.ts` (103 distinct codes in src, 73 registered; missing include `E_CANCELLED`, `E_RUN_TIMEOUT`, `E_PROVIDER_EMPTY`, `E_PROVIDER_TRUNCATED`, `E_FINALIZE_PUBLISH_MISSING` and all 22 `E_LLM_*`). Routes that re-raise such an error therefore answer HTTP 500 `E_INTERNAL` (`src/server/app.ts:992-1004`; the prompt-analysis route at `app.ts:249-258` rethrows non-registry codes). Probe RED `error registry: every code persisted on a run exists in REFUSALS → missing=GATE_FAILED,E_CANCELLED,E_RUN_TIMEOUT,E_LLM_RATE_LIMIT,E_PROVIDER_EMPTY`.

**Fix seam.** One shared `codeOf(error)` helper: prefer `(error as {code?:unknown}).code` when it is a string matching `^[A-Z][A-Z0-9_]*$`; fall back to the message prefix; then `E_INTERNAL`. Use it in all three mappers. Add the run-domain codes to a registry (either `REFUSALS` or a `RUN_ERROR_CODES` set) and assert in a test that every code literal in `src/` is registered.

**Unverified.** No production run has yet failed on a provider error (the 7 non-completed runs are budget/gate; `probe-db.mjs` step-error and event histograms), so this is a proven code path with no production specimen. The probe drives the real `createRun` + real executor catch with a real `LlmError` on a throwaway DB.

---

## W6-L-02 — Failed / budget-exceeded runs lose measured spend (`cost_usd = NULL`)

**Invariant.** A run record's spend is either the measured provider cost or explicitly unknown; it must never be `NULL` when the usage ledger holds provider-reported cost.

**Expected.** `runs.cost_usd` = sum of provider usage for the run (the same number already written to `traces.cost_usd` and to committed reservations).
**Actual.** Every non-completed run has `cost_usd = NULL`, while its usage rows are all `source='provider'`.

**Evidence (production DB, read-only).**

```
### run_cost_vs_usage
{"id":"run_abf5fe78aab1e932ff","status":"failed",         "cost_usd":null,"usage_cost":0.299980656,"committed_usd":0.299991}
{"id":"run_2bb2f8edf3043fe89e","status":"failed",         "cost_usd":null,"usage_cost":0.051138816,"committed_usd":0.051144}
{"id":"run_65da49c3948f9d8f5c","status":"budget_exceeded","cost_usd":null,"usage_cost":0.045521616,"committed_usd":0.045527}
{"id":"run_26e2456caef4b8be0c","status":"budget_exceeded","cost_usd":null,"usage_cost":0.185232012,"committed_usd":0.185239}
{"id":"run_1e5add0b6ba2e3c736","status":"budget_exceeded","cost_usd":null,"usage_cost":0.002719722,"committed_usd":0.002721}
{"id":"run_9c4659ee2d4fbb40bf","status":"failed",         "cost_usd":null,"usage_cost":0.00955884, "committed_usd":0.009561}
```

`traces` proves the number was measurable at terminal time: `run_abf5fe78aab1e932ff` trace has `outcome=failure, complete=1, cost=0.299980656` — written by `recordRunTrace`, which calls `usageTotals` (`src/server/pipeline/run.ts:108-140`). The UI therefore prints "Estimated spend: Not measured / The provider has not reported a cost yet" (`lead-ui-abf5.png`) while the provider did report it.

**Broken hop.** `finalize()` is the only writer of `cost_usd`, `prompt_tokens`, `completion_tokens` (`src/server/pipeline/run.ts:1075-1084`). The failure branch calls `updateRun({status, phase, finished_at, error_code, error_message})` only (`src/server/pipeline/run.ts:884`), and `markTerminal` (`src/server/runs/manager.ts:250-258`) has no usage fields. `budget_exceeded` follows the same branch (`run.ts:876-882`).

**Probe (RED, throwaway DB).**

```
RED   | failure branch: a failed run keeps commit totals out of runs.cost_usd
         expected: runs.cost_usd tracks committed spend (0.0009)
         actual  : committed=0.0009, runs.cost_usd=null
```

**Fix seam.** In the `executeRun` catch, write `usageTotals(runId)` into the same `updateRun` patch as `error_code`; make the terminal writer a single function that always includes usage (and emit `costUsd` in `run.failed`). Also fix the completion path for the zero-call case (`run_3a4578…` has `cost_usd=NULL`, no usage rows — that one is honestly unknown but the UI cannot distinguish "no calls" from "not measured"; consider `cost_usd=0` plus a `costSource` field).

**Unverified.** Whether a failed run's spend should count against the budget cap retroactively is a product decision; the budget ledger already contains the committed reservations, so the cap itself is unaffected.

---

## W6-L-03 — The run/phase state machine is dead code; production writes status unguarded

**Invariant.** Only legal `RunStatus` edges are persisted; terminal states never move; an illegal edge is refused by name (`E_ILLEGAL_RUN_TRANSITION`).

**Expected.** Every status write goes through `transitionRun`/`assertStatusTransition` (`src/server/logic/run-state.ts:27-54, 135-198`), which rejects terminal→non-terminal and unknown edges.
**Actual.** Production writes go straight to `updateRun` (`src/server/runs/recorder.ts:107-126`); the state machine has **zero production call sites** — only `test/unit/logic-run-state.test.ts` and `test/unit/logic-core.test.ts` import it. `E_ILLEGAL_RUN_TRANSITION` is in `REFUSALS` (`refusals.ts:90`) but is unreachable from the product.

**Evidence.**

- Grep for `transitionRun|assertStatusTransition|assertPhaseTransition` outside `test/` → none.
- All 33 status/phase writes are `updateRun`/`markTerminal`/`markRunning` (`src/server/pipeline/run.ts`, `src/server/runs/manager.ts`).
- Probe RED:

```
RED   | state guard: persistence layer rejects completed -> running
         expected: throw E_ILLEGAL_RUN_TRANSITION / status stays completed
         actual  : status persisted as running (no guard)
green | state guard: pure transitionRun rejects completed -> running
         expected: E_ILLEGAL_RUN_TRANSITION
         actual  : E_ILLEGAL_RUN_TRANSITION
```

- No DB `CHECK` constraint on `runs.status` (`src/server/db/migrations.ts:7-34`), so any string persists.

**Reachable consequences.** No current production caller is proven to write an *illegal* edge (reviewed: `markRunning` from queued, pipeline phase writes, terminal writes, `markStartupInterrupted`, `cancelRun`). The defect is that the guard meant to reject such writes is not wired, so the invariant is enforced only by caller discipline. Two adjacent edges are already suspicious:

- `cancelRun` (`src/server/runs/manager.ts:167-190`) returns `true` when a controller exists even if the run is already terminal, and only the *pipeline catch* persists `cancelled`.
- `paused` and `needs_review` are declared statuses with no writer in production (see `state-machines.md`), so their matrix rows and the `cancelRun` no-controller branch for them are dead.

**Fix seam.** Route `updateRun` status patches through `transitionRun(current, patch)` (read current row in the same transaction) and surface `E_ILLEGAL_RUN_TRANSITION`; or add a DB trigger/CHECK enumerating legal status values and drop the unused module + refusal (dead-path removal is equally valid, but the module is referenced by the plan as LG2).

**Unverified.** No production data currently contains an illegal transition.

---

## W6-L-04 — SSE event-type drift: emitted ≠ subscribed

**Invariant.** Every event the server publishes is deliverable to the client, and every type the client listens for is actually emitted.

**Expected.** One shared event-type registry used by `emitEvent` and by `useRunStream`.
**Actual.** Server emits 16 types; client subscribes 27; 5 emitted types have no listener and 16 listeners can never fire. `source.onmessage` is dead because every frame carries a named `event:` field.

**Evidence (Chrome, live server, terminal replay of 108 frames).**

```
browserStream.server: {run.queued:1, run.started:1, run.failed:1, phase.started:11, phase.completed:11,
                       agent.started:20, agent.completed:20, file.written:14, route.decided:14,
                       context.packed:14, repair.stalled:1, agent.failed:0, phase.skipped:0, context.skipped:0}
browserStream.client: {run.queued:0, run.started:1, run.failed:1, phase.started:11, phase.completed:11,
                       agent.started:20, agent.completed:20, file.written:14, route.decided:14,
                       context.packed:14, repair.stalled:0, ...all 16 subscribed-only types:0}
browserStream.onmessage: 0
```

- Emitted but not subscribed (`web/src/hooks/useApi.ts:72-100`): `run.queued`, `phase.skipped`, `agent.failed`, `context.skipped`, `repair.stalled`.
- Subscribed but never emitted anywhere in `src/` (grep for the literal in `emitEvent` calls): `run.updated`, `run.paused`, `run.needs_review`, `step.started`, `step.completed`, `agent.delta`, `file.revised`, `check.completed`, `review.completed`, `failure.clustered`, `repair.completed`, `confidence.recorded`, `learning.trace`, `learning.eval`, `learning.promotion`, `heartbeat`.
- The drop is real, not hypothetical: the events table holds **5** `agent.failed` rows (budget failures in run_1e5a, run_23af, run_2bb2, run_65da, run_26e) and 1 `repair.stalled` (run_abf5 seq 658). None can reach a live page.
- `phase.skipped` / `context.skipped` are emitted only when routing is disabled (`run.ts:497,679,788`); this B2 DB has zero of either, so in B2 they are dead emissions (still missing from the client list for Release A).
- `heartbeat` is not emitted as a named event at all; the server sends an SSE comment `: ping` (`app.ts:860`), which never dispatches. The client's `heartbeat` listener is dead by construction.

**Impact.** Terminal convergence is *not* affected (`run.completed`/`run.failed`/`run.cancelled` are subscribed). What is lost: live visibility of agent failures, repair stalls, the queued state, and the entire step/delta/review/learning surface the client pretends to consume. Today those listeners are dead code; the UI still refreshes through its 5 s poll and the event-triggered snapshot reload.

**Fix seam.** Export one `RUN_EVENT_TYPES` constant from `src/shared/run-events.ts`, use it in `emitEvent` (compile-time check) and in `useRunStream` (subscribe list generated from it). Either emit `step.*`/`agent.delta` (the UI already has the shapes) or delete those listeners. Add a test that parses `emitEvent(` call sites and compares them with the shared list (the repo already has a static-verification culture).

**Unverified.** Delivery of `agent.failed` is proven at the source/route level, not by a live run that produced one while a browser was open (no live run was executed, per scope).

---

## W6-L-05 — `/events` truncation is computed from global sequence numbers → false positives

**Invariant.** `truncated=true` means the API dropped at least one of *this run's* events.

**Expected.** `GET /api/runs/run_abf5…/events?after=0` → all 108 events, `truncated=false`.
**Actual.** all 108 events, `truncated=true`.

**Evidence (live API).**

```
run_abf5: count=108 truncated=True lastEventId=659 firstSeq=552 lastSeq=659
run_95  : count=102 truncated=True lastEventId=972 firstSeq=871 lastSeq=972
```

**Broken hop.** `app.ts:824-832`:

```ts
const current = lastEventId(id);              // per-run max seq (e.g. 659)
const start = Math.max(after, Math.max(0, current - window));  // 159
const all = getEvents(id, start, window);     // returns all 108 rows (seq > 159)
truncated: after < start || current - start > events.length   // 0 < 159 → true
```

`current` is per-run but `start = current - 500` is compared against global autoincrement seqs. A run whose first event seq is greater than `current-500` (i.e. it has fewer than 500 events but the global counter is far ahead of its start) always reports truncated. Since `seq` is `INTEGER PRIMARY KEY AUTOINCREMENT` on the shared `events` table (`migrations.ts:54-55`), this is the normal case for every short run after the ledger passes ~500 rows.

**Probe (RED, throwaway DB, real route via `app.inject`).**

```
RED   | events window: complete 20-event run must not claim truncation
         expected: truncated=false, events=20, lastEventId=570
         actual  : truncated=true, events=20, lastEventId=570
green | events window: run with 550 events returns window and flags truncation
         expected: truncated=true, events=500
         actual  : truncated=true, events=500
```

**Impact today.** `web/src/api.ts:327-332` ignores `truncated` (`getRunEvents` returns only the mapped rows), so the UI is not misled — but the API contract lies and any future consumer that reacts to `truncated` (e.g. "fetch the snapshot because replay is incomplete") will over-fetch. The Events tab also silently displays only the latest 500 rows with no truncation notice.

**Fix seam.** Compute truncation from this run's rows: e.g. `dropped = after > 0 ? (count events for run with seq > after) > window : (count for run) > window`, or return `{ returned, totalRunEvents, truncated: totalRunEvents > returned }`. Keep the window clamp but report `snapshotRequired` honestly.

---

## W6-L-06 — `interrupted` is a silent terminal state

**Invariant.** Every terminal status carries a named code, a message, a persisted event, and a log record.

**Expected.** `status=interrupted`, `error_code=E_RUN_INTERRUPTED` (or similar), `error_message`, one `run.*` event, one `errors.jsonl` record.
**Actual.** `status=interrupted`, `phase=done`, `finished_at` set; `error_code=NULL`, `error_message=NULL`, no event, no log.

**Evidence.** `src/server/runs/manager.ts:192-204`:

```ts
db.prepare("UPDATE runs SET status='interrupted', phase='done', finished_at=? WHERE status IN (...)")
for (const row of active) releaseReservationsForRun(row.id);
```

No `emitEvent`, no `recordError`, no error fields. Probe RED:

```
RED   | startup interrupt: interrupted is a terminal status with a code, message and event
         expected: error_code set, error_message set, at least one run event
         actual  : status=interrupted, error_code=null, error_message=null, events=0
```

**Impact.** A page opened after a restart shows a terminal `Interrupted` badge with no explanation and no event; the error log has no entry. The run is excluded from `getActiveRunId` and cannot be resumed (the workspace may be half-staged).

**Fix seam.** Add `E_RUN_INTERRUPTED` to the registry, write `error_code/error_message`, emit a `run.failed`/`run.interrupted` event per run, and `recordError({source:'run',…})`.

---

## W6-L-07 — Gate failures bypass the error log and use a non-registry code

**Invariant.** A failed run produces a named `E_*` code, a persisted event with message, a log record, and UI-visible state.

**Expected.** `E_GATE_FAILED` (registry) + `recordError` + event `{code, message, checks}`.
**Actual.** `GATE_FAILED` (not in `REFUSALS`), **no** `errors.jsonl` entry, event `{code:'GATE_FAILED', checks:[…]}` with **no message**.

**Evidence.**

- `errors.jsonl` has 18 records, histogram: `15 E_RUN_TIMEOUT, 1 E_BUDGET_UNKNOWN_RESERVATION, 2 E_BUDGET_EXCEEDED`. There is **no** `GATE_FAILED` record although two runs (run_9c4659…, run_abf5…) failed at the gate.
- Terminal event payloads: `run.failed` for the gate path has `code=GATE_FAILED, message=null, checks=[…]`; the catch path has `code/message`; the budget path has `code=E_BUDGET_EXCEEDED, message=E_BUDGET_EXCEEDED`. Three shapes for one event type (also W6-L-12).
- Gate writers: `src/server/pipeline/run.ts:341-345, 432-436, 857-861` call `markTerminal(..., 'GATE_FAILED')` + `emitEvent('run.failed', {code:'GATE_FAILED'})`; `run.failed` is emitted but `recordError` is never called on these paths.

**Impact.** The most common real failure class leaves no diagnostic trail; the UI's error chip shows `GATE_FAILED` which no refusal registry or documentation lists; an API client keying on `E_*` cannot classify it.

**Fix seam.** Rename to `E_GATE_FAILED`, register it, call `recordError({source:'run', code, message:'Mandatory verification failed', runId})`, include `message` in the event, and centralise terminal-event construction.

---

## W6-L-08 — `trace_complete=1` is not tied to a trace row

**Invariant.** `runs.trace_complete=1` implies a complete row in `traces` for that run.

**Actual.** The flag is written unconditionally on success (`run.ts:1083,1085`), while the trace insert is wrapped in a bare catch (`run.ts:110-139`) that cannot fail the run or report. DB reality: 7 completed runs have `trace_complete=1` and **no** `traces` row (`run_007238…`, `run_01581f…`, `run_f08c67…`, `run_e5853e…`, `run_582bf8…`, `run_094ae1…`, `run_3bf07c…`).

**Caveat (unverified cause).** The missing rows are exactly the first 10 runs; the traces table has 16 rows from run_23af onward, so a DB replacement/reset of the `traces` table (or a run under earlier code) is a plausible alternative cause. What *is* proven from current source is that nothing enforces the invariant, and `recordRunTrace`'s failure is silent.

**Fix seam.** `recordRunTrace` returns `boolean`/throws; set `trace_complete` from the insert result (`changes`/`RETURNING`); log a named `E_TRACE_WRITE_FAILED` on failure. The learning overview already requires `traces>=3` and will be wrong if flags are believed instead of rows.

---

## W6-L-09 — Learning variant state machine: unguarded, mostly dead

**Expected.** A variant has an explicit lifecycle (draft → evaluating → promoted/rejected) with validated edges and an audit row.
**Actual.** `variants.status` is written by one SQL `UPDATE` with an arbitrary string (`src/server/learning/candidates.ts:291-297`); the only production writer sets `'promoted'` (`src/server/learning/promotion.ts:583`). `'evaluating'` is only read by the family-cap query (`candidates.ts:232-241`), never written; `'rejected'` appears nowhere in production writes, so a slot in the 3-candidate family cap can never be freed by rejection.

Other learning machines are sound and were re-verified rather than restated:

- consent: versioned grant/revoke, latest-by-version wins, revoke of `case_to_provider_eval` tombstones cases of unclaimed suites and preserves claimed suites (`consent.ts:54-100`); overview requires 6 complete 65-case blocks + active `case_to_provider_eval` + ≥3 traces (`overview.ts:40-97`, `contracts.ts:139-140`).
- sealed block: `ready → used` is atomic (`UPDATE … WHERE used_by_suite_id IS NULL`, `sealed-pool.ts:419-426`) with `E_LEARNING_SUITE_ALREADY_USED` on a lost race.
- suite claim: unique `suite_uses.suite_id`, duplicate path refuses (`sealed-pool.ts:479-514`).
- approval token: HMAC + row binding, single-use via `UPDATE … WHERE consumed_at IS NULL` with a concurrency refusal (`approval.ts:158-220`).
- promotion: baseline drift check **inside** the transaction before `setActiveVersion` (`promotion.ts:574-586`), audit row + monitor row created atomically with the promotion.

**Fix seam.** Add a `VARIANT_TRANSITIONS` table (mirroring `run-state.ts`) or narrow the function signature to the legal set (`'promoted'|'rejected'|'evaluating'`) and write a `learning_audit` row per change.

---

## W6-L-10 — SSE reconnect after a >500-event gap can never recover

**Invariant.** A client that reconnects with a stale cursor either resumes or is told to reload the snapshot and does so.

**Actual.** `GET /stream` with `last-event-id` older than 500 events returns HTTP 410 JSON `E_REPLAY_WINDOW_EXCEEDED` (`app.ts:843-845`). A browser `EventSource` cannot read a 410 body; it fires `onerror` and reconnects **with the same Last-Event-ID**, forever. The client's only reaction is `setStatus('reconnecting')` (`useApi.ts:148-150`) and it never fetches the `snapshotUrl` offered in the refusal body.

**Evidence.** Route probe (throwaway DB): `HTTP 410, code=E_REPLAY_WINDOW_EXCEEDED`. Client source has no data path for a refusal (`useApi.ts:124-150`). Status convergence still works through the 5 s poll, so this is a stream-recovery defect, not a terminal-state defect.

**Fix seam.** Either drop the 410 (resume from the last 500 and mark replay gaps in-band) or make the client detect the failure and re-open with a reset cursor after fetching `/snapshot` (the refusal already returns `snapshotUrl`). Add an `onopen`/error-count fallback so "Reconnecting" cannot persist indefinitely.

---

## W6-L-11 — `cancel` acknowledges on controller presence, not on state

**Invariant.** `POST /api/runs/:id/cancel` returns success only when cancellation will be persisted.

**Actual.** `cancelRun` returns `true` as soon as an `AbortController` exists (`manager.ts:167-177`), before the pipeline observes the abort; the controller is deleted only in `.finally` after `executeRun` settles (`manager.ts:159-162`). In the window between `updateRun(status=completed)` (inside `finalize`) and that `.finally`, a cancel reports `{cancelled:true}` for a run that stays completed. If the pipeline is between abort checks (`checkAbort` points only at phase boundaries and the finalize entry, `run.ts:976`), the abort can also be ignored until the next check.

**Evidence.** Source only; the window is sub-millisecond and was not reproduced deterministically. **Unverified as observed behaviour.** Note also that the no-controller branch (`manager.ts:177-188`) does persist `cancelled` correctly (probe green: `cancelled=true, status=cancelled` for a queued run).

**Fix seam.** Read the run first: terminal → `E_RUN_NOT_CANCELLABLE`; else abort and return `{cancelled:true, pending:true}` or wait for the pipeline to persist the terminal status. Add `checkAbort` inside `finalize` after the publish.

---

## W6-L-12 — Failure payload/type drift

- `budget_exceeded` runs persist a `run.failed` event (there is no `run.budget_exceeded` type), and the payload is `{code:'E_BUDGET_EXCEEDED', message:'E_BUDGET_EXCEEDED'}` — the message duplicates the code (`run.ts:885`), so the UI renders `E_BUDGET_EXCEEDED E_BUDGET_EXCEEDED`.
- `run.failed` payload shapes: `{code,checks}` (gate, no message), `{code,message}` (pipeline catch), `{code,message,timedOut}` (executor catch, `manager.ts:157`). `timedOut` is only ever `false`/absent in the stored ledger (no production timeout specimen reached the executor catch with a run row).
- `run.completed` includes `{runId,status,files,costUsd}` while `run.failed` omits `costUsd` even when known (W6-L-02).
- `phase.completed` shapes vary by phase (`files/chars`, `findings/revised`, `tests/command`, `status/checks/failed/confidence/verifyPlanChecks`, `attempt`) — acceptable but undocumented; no consumer validates.

**Fix seam.** A single `terminalEvent(run)` builder with a stable schema (`{code, message, status, costUsd, usage?, checks?}`), plus `run.budget_exceeded` or a `status` field on `run.failed`.

---

## W6-L-13 — Live vs persisted event view: shape, timestamp, cap, and a misleading "Persisted events" title

- Server SSE frame: `data: {schema, type, data:<payload>, meta:{seq,runId,replay}}` (`app.ts:854`).
- Live client stores the **whole parsed envelope** in `RunStreamEvent.data` (`useApi.ts:126-139`) and stamps `receivedAt` with the browser clock.
- Persisted client maps `row.payload` → `RunStreamEvent.data` and `row.createdAt` → `receivedAt` (`src/shared/run-events.ts:19-25`, `web/src/api.ts:327-331`).
- **The terminal tab does not switch to the persisted ledger.** `visibleEvents = events.length > 0 ? events : persistedEvents.data` (`RunDetailPage.tsx:133`); `persistedEvents` is fetched on terminal (`:129-132`) but its result is discarded whenever any live event was received. So a page that watched the run keeps showing the live array under the title "Persisted events" and the description "latest 500".
- The live array is capped at 100 (`setEvents(previous => [...previous.slice(-99), event])`, `useApi.ts:136`). For run_abf5 (108 events) a live session therefore permanently loses the first 8 events — including `run.queued` and `run.started` — and the terminal title still claims a persisted ledger.
- `getRunEvents` also discards `truncated`/`lastEventId` (`api.ts:327-332`), so neither mode can disclose truncation.

Net effect: the same tab shows (a) envelope-shaped `data` vs payload-shaped `data`, (b) browser receipt time vs server `created_at`, (c) ≤100 live rows vs up to 500 persisted rows, and (d) a title that says "persisted" while showing live data. Only a fresh page load on a terminal run shows the persisted ledger.

**Fix seam.** Prefer `persistedEvents.data` when `terminal` (`visibleEvents = terminal && persistedEvents.data ? persistedEvents.data : events`), normalise live frames to `parsed.data` with `meta` kept separately, keep one timestamp field name per meaning, and surface `truncated` from `/events`.

---

## W6-L-14 — `ChecksTab` collapses multi-pass checks on a non-unique key

**Actual.** `checks` persists every verification pass (initial + each repair re-verify) and `getChecks` returns all rows (`src/server/runs/recorder.ts:293-303`). `ChecksTab` renders `<tr key={check.id}>` (`web/src/pages/RunDetailPage.tsx:649`) although `check_id` repeats: run_abf5 has 16 rows over 5 ids (`stub.scan`×4, `plan.coverage`×3, `secret.scan`×3, `syntax.all`×3, `verification.plan`×3). React therefore receives duplicate keys and cannot reliably render each pass; the user cannot see that, e.g., `stub.scan` failed in pass 1/2 and differently in pass 3.

**Evidence.** `probe-db.mjs run_abf5fe78aab1e932ff` + direct count query: `checks abf5: 16`, grouped as above.

**Fix seam.** Key on the row identity (`checks.id` is not selected by `getChecks`; it returns `checkId` as `id`) — either return the DB row id/createdAt and key on `(check.id, createdAt)`, or group passes in the API. P3 (display only; the persisted record is correct).

---

## W6-L-15 — "Replay truncated" badge is about artifacts, not replay

`/api/runs/:id/snapshot` returns `truncated = allArtifacts.length > artifacts.length` (artifact list capped at 200, `src/server/app.ts:802-816`), and the run page renders that flag as `Replay truncated` (`web/src/pages/RunDetailPage.tsx:330`). A user with >200 artifacts would see an event-replay warning for an artifact-list cap; the actual event-replay truncation (`/events` `truncated`, W6-L-05) is never displayed. Never triggered today (max 20 artifacts/run).

**Fix seam.** Rename the snapshot flag to `artifactsTruncated` and add a separate `eventsTruncated`/`lastEventId` to the events response consumed by the tab.

---

## Cross-cutting verified-safe (not defects)

- **Budget settlement** (Wave 5 fix holds): 161 reservations for 161 usage rows, all `committed`, zero `reserved`/`released`, no stale leases; probe proves a second end-hook yields `E_BUDGET_UNKNOWN_RESERVATION`, an overcommit throws **after** recording the true cost, and `release()` after commit is a silent (non-refunding) no-op. `reapExpired` is wired at startup (`index.ts:44`).
- **Idempotency**: identical replay returns the same run id (`replayed=true`); same key + different body → `E_IDEMPOTENCY_KEY_REUSED`; expired keys are deleted before insert (`manager.ts:127-134`).
- **Single-active-run guard**: `getActiveRunId` check and row insert are synchronous (no `await` between them), so one process cannot interleave two creates. Multi-process (two servers on one DB) is **unverified** and has no DB-level enforcement.
- **Atomic publish / rollback**: rename-based publish, backup retained until commit, rollback on post-publish failure, startup recovery for `.publish-*`/`.old-*` leftovers (`publish.ts:16-85`, `run.ts:1057-1101`).
- **Routing/context disabling**: skipped emissions exist for A-phase only; in B2 they are unreachable (0 rows), not a lie.

## Not audited / unverified

- A live paid run was not executed (scope forbids paid provider calls), so no *new* provider-failure specimen exists; W6-L-01 is proven by probe, not by a live run.
- Multi-process concurrency (two servers, one DB) was not exercised.
- The historical cause of the missing `traces` rows (W6-L-08) is not established; only the missing invariant is.
- The `paused`/`needs_review` run statuses and the `E_RUN_NOT_CANCELLABLE` branch for them are unreachable in this build; whether they should be wired or removed is a product decision.
