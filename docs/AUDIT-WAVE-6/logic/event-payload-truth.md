# W6-AUD-02 — Event and payload truth

Derived from source (`emitEvent` call sites, `app.ts` SSE/route serialization), the persisted ledger (`data/hive.db`, read-only), and a real Chrome `EventSource` against the live stream. No UI behaviour is inferred from labels; every claim is a source line or a captured row/response.

---

## 1. Emitted set (derived from source, 16 types)

Every event the product can write goes through `emitEvent(runId, type, payload)` (`src/server/runs/recorder.ts:36-51`), which inserts `events(run_id, type, payload_json, created_at)` and fans out to SSE subscribers. Complete call-site inventory:

| # | Type | Emitter (file:line) | Payload keys |
|---|---|---|---|
| 1 | `run.queued` | `runs/manager.ts:135` | `runId, preset` |
| 2 | `run.started` | `pipeline/run.ts:451` | `runId, preset` |
| 3 | `run.failed` | `pipeline/run.ts:342,433,858,885`; `runs/manager.ts:157` | gate: `code, checks[]`; catch: `code, message`; executor: `code, message, timedOut` |
| 4 | `run.cancelled` | `pipeline/run.ts:885`; `runs/manager.ts:186` | `code` (+`message` from catch); `code, source` |
| 5 | `run.completed` | `pipeline/run.ts:1088` | `runId, status, files, costUsd` |
| 6 | `phase.started` | `run.ts:293,304,316,332,367,426,464,501,608,724,735,749,767,825,833,978` | `phase` (+`attempt`, `signature`, `agentId`, `adhoc`) |
| 7 | `phase.completed` | `run.ts:300,310,327,336,423,430,481,603,719,731,742,762,811,831,848,1087` | `phase` + phase-specific: `files/chars`, `findings/revised`, `tests/command`, `status/checks/failed/confidence/verifyPlanChecks`, `attempt`, `routes/allocatedCostUsd/reserveUsd` |
| 8 | `phase.skipped` | `run.ts:497,788` | `phase, reason, fallback` |
| 9 | `agent.started` | `run.ts:224` | `stepId, agentId, phase` |
| 10 | `agent.completed` | `run.ts:229` | `stepId, agentId, phase, usage{costUsd,promptTokens,…}` |
| 11 | `agent.failed` | `run.ts:234` | `stepId, agentId, phase, code, message` |
| 12 | `file.written` | `run.ts:717` | `path, agentId, bytes` |
| 13 | `route.decided` | `run.ts:601` | `taskId, agentId, model, thinking, score` |
| 14 | `context.packed` | `run.ts:669` | `taskId, tokens, prefixHash, degraded` |
| 15 | `context.skipped` | `run.ts:679` | `taskId, reason, fallback` |
| 16 | `repair.stalled` | `run.ts:820,851` | `signature` **or** `reason, attempts` |

There is **no** emitter for `run.updated`, `run.paused`, `run.needs_review`, `step.*`, `agent.delta`, `file.revised`, `check.completed`, `review.completed`, `failure.clustered`, `repair.completed`, `confidence.recorded`, `learning.trace`, `learning.eval`, `learning.promotion`, `heartbeat` (grep over `src/` for the literal in an `emitEvent` call returns nothing).

Global ledger histogram (`probe-db.mjs` → `event_type_histogram`): `agent.started 171`, `agent.completed 166`, `phase.started 140`, `phase.completed 135`, `route.decided 99`, `file.written 96`, `context.packed 84`, `run.started 25`, `run.queued 25`, `run.completed 18`, `run.failed 7`, `agent.failed 5`, `repair.stalled 1`. Zero `phase.skipped`/`context.skipped` (routing enabled in B2), zero `run.cancelled`.

## 2. Subscribed set (derived from `web/src/hooks/useApi.ts:72-100`, 27 types)

```
run.started run.updated run.paused run.cancelled run.completed run.failed run.needs_review
phase.started phase.completed
step.started step.completed
agent.started agent.delta agent.completed
file.written file.revised
check.completed review.completed
route.decided context.packed failure.clustered repair.completed confidence.recorded
learning.trace learning.eval learning.promotion
heartbeat
```

Registration (`useApi.ts:142-150`): `addEventListener(type, handler)` for each listed type **plus** `source.onmessage = handler`. Server frames always include `event: <type>` (`app.ts:853-857`), so the browser only dispatches to the named listener; `onmessage` fires only for frames without an `event:` field, which never occur.

## 3. Delivered truth (Chrome, run_abf5 ledger replay, 108 frames)

From `probe-sse-ui.ts`:

| Type | Server listeners | Client listeners | Delivered to product UI? |
|---|---|---|---|
| run.queued | 1 | **0** | no |
| run.started | 1 | 1 | yes |
| run.failed | 1 | 1 | yes |
| phase.started | 11 | 11 | yes |
| phase.completed | 11 | 11 | yes |
| agent.started | 20 | 20 | yes |
| agent.completed | 20 | 20 | yes |
| file.written | 14 | 14 | yes |
| route.decided | 14 | 14 | yes |
| context.packed | 14 | 14 | yes |
| repair.stalled | 1 | **0** | no |
| agent.failed | 0 in this run (5 in DB) | **0 (never subscribed)** | no |
| phase.skipped / context.skipped | 0 in B2 | **0** | no (and not subscribed) |
| `onmessage` | — | **0** | the fallback is dead |

Emitted-but-undelivered: **`run.queued`, `phase.skipped`, `agent.failed`, `context.skipped`, `repair.stalled`**.
Subscribed-but-never-emitted: **16 types** (list in §2 minus the 11 delivered).

## 4. What the UI actually consumes

Grep over `web/src` for event payload access finds **no field reads**. The only consumer of `event.data` is the raw JSON preview:

- `RunDetailPage.tsx:135-139` — the stream handler appends the event and schedules a snapshot reload; it reads no payload field.
- `RunDetailPage.tsx:1035-1046` — Events tab renders `event.type`, `event.receivedAt`, and `<JsonPreview value={event.data}>`.

Everything the page displays as truth comes from REST snapshots, not events:

| UI surface | Source | Fields |
|---|---|---|
| status/phase/cost/error chip/steps count | `GET /api/runs/:id/snapshot` | `run.status`, `run.phase`, `run.costUsd`, `run.errorCode`, `run.errorMessage`, `steps.length` |
| timeline | snapshot `steps[]` | `seq, phase, agentId, status, startedAt, finishedAt, outputSummary, errorCode, errorMessage, promptTokens, completionTokens, costUsd` |
| events tab | live stream **or** `GET /events` | `type, receivedAt, data` (raw) |
| files/checks/routing/context/repairs/confidence | dedicated GETs | see `api-types.ts` |

Consequences:

1. Event-payload drift cannot break the current page — which is exactly why run_abf5's terminal state converges even though `agent.failed`/`repair.stalled` are dropped.
2. The Events tab is the only payload consumer and it receives **two different shapes** (see §7.1), keeps the live array even after the run is terminal (title "Persisted events" over live data, `RunDetailPage.tsx:129-133`), and caps live rows at 100 (`useApi.ts:136`) while claiming the persisted ledger's 500.
3. Any future payload-driven UI (e.g. showing `agent.failed` inline) inherits W6-L-04.

## 5. Real payloads — run_abf5 (failed, 108 events, seq 552-659)

Rows quoted from the ledger (`probe-db.mjs <runId>`), abbreviated where marked:

```json
{"seq":552,"type":"run.queued","payload":{"runId":"run_abf5fe78aab1e932ff","preset":"full-build"}}
{"seq":553,"type":"run.started","payload":{"runId":"run_abf5fe78aab1e932ff","preset":"full-build"}}
{"seq":554,"type":"phase.started","payload":{"phase":"planning"}}
{"seq":556,"type":"agent.started","payload":{"stepId":"stp_4346…","agentId":"architect","phase":"planning"}}
{"seq":557,"type":"phase.completed","payload":{"phase":"planning","files":15}}
{"seq":558,"type":"agent.completed","payload":{"stepId":"stp_4346…","agentId":"architect","phase":"planning",
  "usage":{"promptTokens":604,"completionTokens":2002,"cacheHitTokens":0,"cacheMissTokens":604,
           "reasoningTokens":0,"costUsd":0.0025836,"source":"provider","model":"deepseek-flash"}}}
{"seq":635,"type":"phase.completed","payload":{"phase":"cleaning","findings":10,"revised":6}}
{"seq":645,"type":"phase.completed","payload":{"phase":"verifying","status":"fail","checks":6,"failed":2,
  "confidence":"needs_review","verifyPlanChecks":8}}
{"seq":658,"type":"repair.stalled","payload":{"reason":"attempt budget exhausted","attempts":2}}
{"seq":659,"type":"run.failed","payload":{"code":"GATE_FAILED","checks":[
  {"id":"stub.scan","status":"fail","detail":"1 placeholder marker(s), first at line 121",
   "file":"src/probes/tool_access.py","line":121,"mandatory":true}]}}
```

Run row: `status=failed, phase=done, error_code=GATE_FAILED, error_message="Mandatory verification failed", cost_usd=NULL, trace_complete=0, finished_at=03:15:46.742Z`. Steps: 20 (all `succeeded`). Artifacts: 0 (failure before finalize). `traces` row: `outcome=failure, complete=1, cost=0.299980656` — the spend exists in the trace but not on the run (W6-L-02).

Observations:

- `run.failed` (gate shape) has **no `message`** field; a client that only reads the event cannot display why.
- `code` is `GATE_FAILED`, outside the `E_*` registry.
- `repair.stalled` exists only in the ledger, not in any subscribed channel.
- `agent.failed` does not appear because no step failed; failure was a verification gate.
- `costUsd` is absent from the terminal event even though the trace knows it.

## 6. Real payloads — run_95 (completed, 102 events, seq 871-972)

```json
{"seq":871,"type":"run.queued","payload":{"runId":"run_95c11797b4923b4277","preset":"full-build"}}
{"seq":972,"type":"run.completed","payload":{"runId":"run_95c11797b4923b4277","status":"completed",
  "files":20,"costUsd":0.25078177199999996}}
```

Run row: `status=completed, cost_usd=0.250781772, prompt_tokens=380277, completion_tokens=117961, trace_complete=1`. Steps: 19 (all succeeded). Artifacts: 20. Event histogram: 19 `agent.started`/`agent.completed`, 15 `route.decided`/`context.packed`/`file.written`, 8 `phase.started`/`phase.completed`, 1 each of `run.queued`/`run.started`/`run.completed`.

**Direction of truth:** both runs write `run.queued` first and exactly one terminal event last (`probe-db.mjs` → `event_window_per_run` shows `terminal_events=1` and `last_type` terminal for all 25 runs). There is no evidence of a missing, duplicated, or out-of-order terminal event.

## 7. Payload/shape mismatches (all confirmed by rows or source)

| # | Mismatch | Evidence |
|---|---|---|
| 1 | **Live `data` = SSE envelope; persisted `data` = inner payload.** Live: `{schema,type,data,meta}` (`app.ts:854`, parsed whole at `useApi.ts:126-139`). Persisted: `row.payload` (`shared/run-events.ts:19-25`, `api.ts:327-331`). Same `RunStreamEvent.data` type holds both. Additionally `visibleEvents = events.length > 0 ? events : persistedEvents.data` (`RunDetailPage.tsx:133`) means a terminal page that watched the run keeps the live data (and the live 100-row cap) under the "Persisted events / latest 500" title; run_abf5 has 108 events, so its first 8 (incl. `run.queued`, `run.started`) are lost from that tab. | source; abf5 dbCount 108 vs live cap 100 |
| 2 | **Three `run.failed` shapes** (`{code,checks}`, `{code,message}`, `{code,message,timedOut}`) and `run.failed` used for `budget_exceeded` (no `run.budget_exceeded` type). | `run_failed_payload_shapes` in `probe-db.mjs`: gate `message=null`; budget `message="E_BUDGET_EXCEEDED"` |
| 3 | **Code duplicated as message** for catch-shaped failures: `{"code":"E_BUDGET_EXCEEDED","message":"E_BUDGET_EXCEEDED"}`; UI renders both, giving `E_BUDGET_EXCEEDED E_BUDGET_EXCEEDED`. | rows seq 60/285/714/773/870 |
| 4 | **`run.failed` omits `costUsd`** even when the trace knows it; `run.completed` includes it. | run_abf5 vs run_95 |
| 5 | **Event `receivedAt` means two things:** client receipt time for live events (`useApi.ts:138`), server `created_at` for persisted events (`run-events.ts:23`). Events tab column "Received" changes meaning after reload. | source |
| 6 | **UI "Replay truncated" badge is driven by artifact truncation, not event replay.** `app.ts:807-815` returns `truncated = artifacts.length > 200`; `RunDetailPage.tsx:330` labels it `Replay truncated`. | source; never shown today (max 20 artifacts/run) |
| 7 | **`/events` `truncated` is a false positive** for every run whose first seq is inside the global window (`app.ts:828-832`); confirmed live on run_abf5 (108/108, `true`) and run_95 (102/102, `true`). | `red-probes.md` probe 4 |
| 8 | **Client drops `/events` metadata**: `getRunEvents` returns only mapped rows (`api.ts:327-331`), discarding `truncated` and `lastEventId`, so the tab cannot disclose truncation despite its "latest 500" copy. | source |
| 9 | **`agent.failed` payload carries a code that is often wrong** (`E_INTERNAL` for provider failures) and is never delivered. | `run.ts:234` + 5 rows (budget ones happen to be correct because their messages start with `E_`) |
| 10 | **Learning events are declared in the client but do not exist**: promotion/rollback write DB rows and `learning_audit`, never `emitEvent`. | `promotion.ts:517-620,718-728`; no emitters |

## 8. Route response truth (representative runs)

| Response | run_abf5 | run_95 | Note |
|---|---|---|---|
| `GET /api/runs/:id` | `failed/done`, 20 steps, `lastEventId=659`, 0 artifacts | `completed/done`, 19 steps, `lastEventId=972`, 20 artifacts | `lastEventId` is the global `events.seq` max for the run |
| `GET /api/runs/:id/snapshot` | `truncated=false` (artifacts 0 ≤ 200) | `truncated=false` | `truncated` here means **artifact list** truncation, cap 200 |
| `GET /api/runs/:id/events?after=0` | 108 events, `truncated=true` (false positive), `lastEventId=659` | 102 events, `truncated=true` (false positive), `lastEventId=972` | identical body shape to the stream's inner payloads |
| `GET /api/runs/:id/checks` | 16 rows: `stub.scan`×4, `plan.coverage`×3, `secret.scan`×3, `syntax.all`×3, `verification.plan`×3 | 5 rows | duplicates by `id` across the three verification passes; `ChecksTab` keys rows by `check.id` (`RunDetailPage.tsx:649`) → **React duplicate-key warning + collapsed rows for repeated check ids** |
| `GET /api/runs/:id/files` | `{artifacts:[]}` | 20 artifacts | failed run has no published tree |
| `GET /api/runs/:id/stream` | replays 108 frames, 0 onmessage-capable | replays 102 | 410 if `Last-Event-ID` older than 500 |

New finding from this table: **`ChecksTab` uses `key={check.id}` and `check.id` is not unique** — `checks` stores every verification pass (initial, repair 1, repair 2) and `getChecks` returns all of them (`recorder.ts:293-303`). run_abf5 has 16 check rows across 5 distinct ids (the same `stub.scan` id appears 4 times with different details). The table therefore renders duplicate React keys, so per-pass verification results cannot be displayed. That is a payload/UI truth defect (display only; the persisted record is correct). The response payload itself is honest (all rows returned); the consumer collapses them.

## 9. Verdict on the payload question

- The server's event **ledger** is truthful: one `run.queued` first, one terminal event last, correct counts, no duplicates (`event_window_per_run`).
- The server's **delivery** is incomplete by design drift: 5 emitted types are unreachable by the client (§3).
- The **run record** lies about spend on every non-completed run (W6-L-02) and about trace completeness in 7 historical rows (W6-L-08).
- The **UI consumes no payload fields**, so these drifts are invisible in normal page behaviour except through the run snapshot (spend/error chip), which is why run_abf5 rendered correctly.
- The **Events tab** shows different data shapes and timestamps before vs after a *fresh* terminal load (a page that watched the run keeps its live 100-frame envelope view under the "Persisted events" title), and cannot disclose replay truncation (§7.1, §7.5, §7.8).
