# W6-AUD-02 — Deterministic RED probes

Every probe here is read-only with respect to the product: no `src/`, no test, no config, no production DB row, no run, no workspace, no server restart, no paid provider call. Two probe kinds are used:

1. **Throwaway-DB integration probes** (`probe-routes.ts`, `probe-db.mjs`) — the real modules are imported, but `HIVE_DATA_DIR`/`HIVE_WORKSPACE_DIR`/`HIVE_VAULT_DIR` are redirected to a fresh `%TEMP%\hive-w6-logic-*` directory before the first server import, and `initDb(<temp>/hive.db, 'B2')` is explicit. `probe-routes.ts` also builds the real Fastify app in-process and uses `app.inject()` — no port is opened.
2. **Live read-only probes** (`probe-sse-ui.ts`, `Invoke-RestMethod`) — GET only, against the already-running server on `127.0.0.1:8787`.

The production DB is opened only with `new DatabaseSync('data/hive.db', { readOnly: true })` (`probe-db.mjs`).

Run order:

```powershell
# 1. production DB facts (read-only, no temp dir needed)
node docs\AUDIT-WAVE-6\logic\probe-db.mjs

# 2. deterministic defects on a throwaway DB (real routes/manager/budget/state modules)
node_modules\.bin\tsx.cmd docs\AUDIT-WAVE-6\logic\probe-routes.ts

# 3. browser SSE delivery truth + fresh-load terminal truth (live server must be up)
node_modules\.bin\tsx.cmd docs\AUDIT-WAVE-6\logic\probe-sse-ui.ts
```

A **RED** probe means "the invariant is violated" — it is the expected output for a defect probe, and the script still exits 0.

---

## Probe 1 — provider error code lost (`E_LLM_RATE_LIMIT` → `E_INTERNAL`)

| | |
|---|---|
| Invariant | A provider failure keeps its named code in `runs.error_code`, the `run.failed` payload, and `steps.error_code`. |
| Cheapest probe | `probe-routes.ts` probe 4: real `createRun`, real executor catch, `setExecutor` throws a real `LlmError('E_LLM_RATE_LIMIT', …)`; read the row and the event after one tick. |
| Expected | `run.errorCode=E_LLM_RATE_LIMIT`, `event.code=E_LLM_RATE_LIMIT` |
| Actual | `run.errorCode=E_INTERNAL`, `event.code=E_INTERNAL`, `message=DeepSeek rate limit reached after 3 attempts.` |
| Broken hop | `src/server/pipeline/run.ts:871-875`, `src/server/pipeline/run.ts:233-234`, `src/server/runs/manager.ts:146-148` — code derived from `message.startsWith('E_')`; `LlmError` stores it in `.code` (`src/server/llm/client.ts:63-80`). |

```
RED   | error propagation: LlmError E_LLM_RATE_LIMIT must persist its own code
         expected: run.errorCode=E_LLM_RATE_LIMIT, event.code=E_LLM_RATE_LIMIT
         actual  : run.errorCode=E_INTERNAL, event.code=E_INTERNAL, message=DeepSeek rate limit reached after 3 attempts.
```

## Probe 2 — failed run keeps measured spend out of `runs.cost_usd`

| | |
|---|---|
| Invariant | A terminal run's recorded spend equals provider-reported spend when usage rows exist. |
| Cheapest probe (production) | `probe-db.mjs` → `run_cost_vs_usage`: six non-completed runs with `usage_cost > 0`, `committed_usd > 0`, `cost_usd = NULL`. |
| Cheapest probe (deterministic) | `probe-routes.ts` probe 5: create a running run, reserve+commit 900 µUSD, take the failure branch; compare committed total with `runs.cost_usd`. |
| Expected | `runs.cost_usd = 0.0009` |
| Actual | `committed=0.0009`, `runs.cost_usd=null` |
| Broken hop | Only `finalize()` writes usage fields (`run.ts:1075-1084`); the failure branch (`run.ts:884`) and `markTerminal` (`manager.ts:250-258`) do not. |

```
RED   | failure branch: a failed run keeps commit totals out of runs.cost_usd
         expected: runs.cost_usd tracks committed spend (0.0009)
         actual  : committed=0.0009, runs.cost_usd=null
```

```
### run_cost_vs_usage
{"id":"run_9c4659ee2d4fbb40bf","status":"failed","cost_usd":null,"usage_cost":0.00955884,"committed_usd":0.009561}
{"id":"run_1e5add0b6ba2e3c736","status":"budget_exceeded","cost_usd":null,"usage_cost":0.002719722,"committed_usd":0.002721}
{"id":"run_23af9b7837448cb24a","status":"budget_exceeded","cost_usd":null,"usage_cost":0.01270053,"committed_usd":0.012707}
{"id":"run_abf5fe78aab1e932ff","status":"failed","cost_usd":null,"usage_cost":0.299980656,"committed_usd":0.299991}
{"id":"run_2bb2f8edf3043fe89e","status":"failed","cost_usd":null,"usage_cost":0.051138816,"committed_usd":0.051144}
{"id":"run_65da49c3948f9d8f5c","status":"budget_exceeded","cost_usd":null,"usage_cost":0.045521616,"committed_usd":0.045527}
{"id":"run_26e2456caef4b8be0c","status":"budget_exceeded","cost_usd":null,"usage_cost":0.185232012,"committed_usd":0.185239}
```

## Probe 3 — run state machine refuses an illegal edge but production bypasses it

| | |
|---|---|
| Invariant | `completed → running` can never be persisted. |
| Cheapest probe | `probe-routes.ts` probe 3: call production `updateRun` on a completed run, then call the pure `transitionRun` with the same edge. |
| Expected | `updateRun` throws `E_ILLEGAL_RUN_TRANSITION` (or leaves the row completed) |
| Actual | row persists `running`; the pure function throws `E_ILLEGAL_RUN_TRANSITION` |
| Broken hop | `updateRun` (`src/server/runs/recorder.ts:107-126`) has no guard and is the only writer; `transitionRun` has no production caller (grep). No DB CHECK on `runs.status` (`migrations.ts:7-34`). |

```
RED   | state guard: persistence layer rejects completed -> running
         expected: throw E_ILLEGAL_RUN_TRANSITION / status stays completed
         actual  : status persisted as running (no guard)
green | state guard: pure transitionRun rejects completed -> running
         expected: E_ILLEGAL_RUN_TRANSITION
         actual  : E_ILLEGAL_RUN_TRANSITION
```

## Probe 4 — `/events` claims truncation on a complete replay

| | |
|---|---|
| Invariant | `truncated=true` ⇒ at least one of this run's events was not returned. |
| Cheapest probe (live) | `GET /api/runs/run_abf5fe78aab1e932ff/events?after=0` and the same for run_95 — compare `events.Count` with the DB row count. |
| Cheapest probe (deterministic) | `probe-routes.ts` probe 1: one run with 20 events at global seq 551-570, real route via `app.inject`. |
| Expected | all rows returned, `truncated=false` |
| Actual | all rows returned, `truncated=true` |
| Broken hop | `src/server/app.ts:824-832` — `start = current(per-run) - 500`, then `after < start` compares a client cursor with a window start in global-seq space; event `seq` is `AUTOINCREMENT` on the shared `events` table. |

Live evidence:

```
$r = Invoke-RestMethod 'http://127.0.0.1:8787/api/runs/run_abf5fe78aab1e932ff/events?after=0'
count=108 truncated=True lastEventId=659 firstSeq=552 lastSeq=659
$r2 = Invoke-RestMethod 'http://127.0.0.1:8787/api/runs/run_95c11797b4923b4277/events?after=0'
count=102 truncated=True lastEventId=972 firstSeq=871 lastSeq=972
```

Deterministic evidence:

```
RED   | events window: complete 20-event run must not claim truncation
         expected: truncated=false, events=20, lastEventId=570
         actual  : truncated=true, events=20, lastEventId=570
green | events window: run with 550 events returns window and flags truncation
         expected: truncated=true, events=500
         actual  : truncated=true, events=500
```

## Probe 5 — startup interrupt is silent

| | |
|---|---|
| Invariant | `interrupted` (terminal) carries a code, message, event, and log. |
| Cheapest probe | `probe-routes.ts` probe 9: mark a running run, call production `markStartupInterrupted()`, read the row and event count. |
| Expected | `error_code` set, `error_message` set, ≥1 event |
| Actual | `status=interrupted, error_code=null, error_message=null, events=0` |
| Broken hop | `src/server/runs/manager.ts:192-204` |

```
RED   | startup interrupt: interrupted is a terminal status with a code, message and event
         expected: error_code set, error_message set, at least one run event
         actual  : status=interrupted, error_code=null, error_message=null, events=0
```

## Probe 6 — codes persisted on runs are missing from the refusal registry

| | |
|---|---|
| Invariant | Every code stored in `runs.error_code`/event payloads is a registered refusal code (so HTTP/CLI/UI classify it). |
| Cheapest probe | `probe-routes.ts` probe 7 (imports the real `REFUSALS`) + static scan of `src/**.ts` string literals. |
| Expected | all present |
| Actual | `missing=GATE_FAILED,E_CANCELLED,E_RUN_TIMEOUT,E_LLM_RATE_LIMIT,E_PROVIDER_EMPTY` (static scan: 103 distinct `E_*` literals in `src/`, 30 unregistered, incl. all 22 `E_LLM_*`, `E_PROVIDER_TRUNCATED`, `E_FINALIZE_PUBLISH_MISSING`, `E_SHUTDOWN`). |
| Broken hop | `src/shared/refusals.ts:9-95`; consumers `app.ts:780-784` (`code in REFUSALS` else 500), `app.ts:249-258`, `manager.ts:354`. |

## Probe 7 — live SSE delivery vs the client's subscription list

| | |
|---|---|
| Invariant | Every emitted event type reaches the client; every subscribed type is emitted. |
| Cheapest probe | `probe-sse-ui.ts` Part B: real Chrome `EventSource` against the live stream, two listener sets — the server-emitted set and the exact `STREAM_EVENT_TYPES` set from `useApi.ts:72-100` — plus `onmessage`. |
| Expected | identical positive counts for both sets; `onmessage` counts unnamed frames |
| Actual | `run.queued` and `repair.stalled`: server-set 1/1, client-set 0/0; `onmessage=0`; 16 client-list types always 0 |
| Broken hop | server emit list vs `web/src/hooks/useApi.ts:72-100,142-150`; every frame has `event: <type>` (`app.ts:854`), so `onmessage` never fires. |

```
browserStream.server: {"run.queued":1,"run.started":1,"run.failed":1,"phase.started":11,"phase.completed":11,
                       "agent.started":20,"agent.completed":20,"file.written":14,"route.decided":14,
                       "context.packed":14,"repair.stalled":1,...}
browserStream.client: {"run.queued":0,"run.failed":1,"run.started":1,"phase.started":11,"phase.completed":11,
                       "agent.started":20,"agent.completed":20,"file.written":14,"route.decided":14,
                       "context.packed":14,"repair.stalled":0,...all subscribed-only types 0...}
browserStream.onmessage: 0
```

Production rows proving the dropped types are real: 5 × `agent.failed` (run_1e5a seq 59, run_23af seq 284, run_2bb2 seq 713, run_65da seq 772, run_26e seq 869), 1 × `repair.stalled` (run_abf5 seq 658).

## Probe 8 — stale SSE cursor is a permanent 410 with no client recovery

| | |
|---|---|
| Invariant | A reconnecting client either resumes or is told to reload the snapshot and does so. |
| Cheapest probe | `probe-routes.ts` probe 2: `app.inject GET /api/runs/<550-event run>/stream` with `last-event-id: 1`. |
| Expected | HTTP 410 `E_REPLAY_WINDOW_EXCEEDED` (server contract) **and** a client path that consumes the refusal |
| Actual | HTTP 410 `E_REPLAY_WINDOW_EXCEEDED`; `useApi.ts:148-150` only sets `status='reconnecting'`, so `EventSource` retries the same cursor forever |
| Broken hop | `src/server/app.ts:843-845` + `web/src/hooks/useApi.ts:142-150` |

```
green | stream: stale Last-Event-ID is refused with a JSON refusal the EventSource client cannot read
         expected: HTTP 410 with error.code=E_REPLAY_WINDOW_EXCEEDED (client only sees onerror)
         actual  : HTTP 410, code=E_REPLAY_WINDOW_EXCEEDED
```

"green" is the server half; the client half is the defect (proven by reading the only error handler, which has no body access — `EventSource.onerror` exposes no response).

## Probe 9 — fresh load of a terminal run (convergence check for run_abf5)

| | |
|---|---|
| Invariant | With no live run, the run page shows the persisted terminal truth and does not open a stream. |
| Cheapest probe | `probe-sse-ui.ts` Part A: navigate, wait for the timeline, read badges/step count, count `/stream` requests made during load. |
| Expected | `FAILED`, `DONE`, `20 STEPS`, `TERMINAL · SNAPSHOT`, no `/stream` request |
| Actual | exactly that (`streamRequestsAfterLoad: []`) |

```
"ui": {"terminalBadge":"TERMINAL · SNAPSHOT","timelineItems":20,"hasStreamBadge":false,
       "errorLine":"GATE_FAILED Mandatory verification failed", ...},
"streamRequestsAfterLoad": []
```

This is the run_abf5 "Running / 7 steps / Live" check: the persisted capture in `docs/AUDIT-WAVE-6/lead-ui-abf5.png` (taken 54 min after the run ended) already shows terminal/20 steps, and the run's `step #7` finished at `03:09:52Z` while the run ended at `03:15:46Z` — the claim matches a truthful mid-run capture.

## Probe 10 — budget settlement idempotency (regression proof, expected green)

| | |
|---|---|
| Invariant | One HTTP attempt settles exactly once; overcommit records the true cost before refusing; a committed row cannot be refunded silently. |
| Probe | `probe-routes.ts` probe 6: reserve→commit→commit; reserve→commit(over); reserve→commit→release. |
| Result | `E_BUDGET_UNKNOWN_RESERVATION`; `E_BUDGET_OVERCOMMIT` with row `committed=5000`; `release()` is a no-op (`state=committed`). |
| Production corroboration | 161 reservations / 161 usage rows, all `committed`, 0 `reserved`, 0 `released`, no stale leases (`probe-db.mjs`). |

## Probe 11 — idempotency replay (expected green)

| | |
|---|---|
| Probe | `probe-routes.ts` probe 8: same key/body → same `runId` + `replayed=true`; same key/different body → `E_IDEMPOTENCY_KEY_REUSED`. |
| Result | green |

---

## Full `probe-routes.ts` result (last run)

```
green | events window: run with 550 events returns window and flags truncation
RED   | events window: complete 20-event run must not claim truncation
green | stream: stale Last-Event-ID is refused with a JSON refusal the EventSource client cannot read
RED   | state guard: persistence layer rejects completed -> running
green | state guard: pure transitionRun rejects completed -> running
RED   | error propagation: LlmError E_LLM_RATE_LIMIT must persist its own code
RED   | failure branch: a failed run keeps commit totals out of runs.cost_usd
green | budget: double end-hook cannot settle twice
green | budget: overcommit throws after recording the true cost (not rolled back)
green | budget: release() after commit is a silent no-op (state stays committed)
RED   | error registry: every code persisted on a run exists in REFUSALS
green | idempotency: identical replay returns the same run id
green | idempotency: same key + different body is refused
green | cancel: aborting an executor that ignores the signal still reports cancelled=true
RED   | startup interrupt: interrupted is a terminal status with a code, message and event

6/15 probes are RED (a RED probe confirms a defect, it does not fail the harness).
```

## Notes and bounds

- `probe-routes.ts` writes only under `%TEMP%\hive-w6-logic-*`; it prints the temp path. The real `data/` was checked before/after (mtime/size of `data/hive.db` unchanged apart from normal live-server WAL activity, which the probe never touches because it never opens `data/hive.db`).
- The live server was already running on `127.0.0.1:8787`; no restart, no port, no run creation, no paid call.
- Probes 1/3/5 use `setExecutor` to inject a failure at the executor boundary — the unit under test is the production `createRun`/`updateRun`/`markStartupInterrupted`, not a reimplementation. Probe 2 uses the real `budget` module.
- Not exercised: real provider failure in a live run, multi-process DB races, browser sleep/resume reconnect loop (W6-L-10 is proven from code + the 410 response, not by suspending a browser for 500 events).
