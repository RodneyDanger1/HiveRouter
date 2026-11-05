# W6-AUD-03 / task-3 — Forge root-cause report (HiveRouter Wave 6)

- Seat: independent read-only Forge root-cause engineer (task-3, W6-AUD-03)
- Repo: `C:\Users\Riley\Desktop\HiveRouter` (B2, no active run, 25 runs — verified below)
- Write scope: `docs/AUDIT-WAVE-6/forge/` only. No product/test/config/workspace/run/DB/log edit; no server restart; no paid provider call; no git (no `.git`).
- Method: live read-only API GETs, raw event payload inspection, read-only `node:sqlite` queries on `data/hive.db`, headless Chrome against the real built UI (`web/dist`), source call-graph tracing, one throwaway-DB peer probe re-executed for corroboration. Evidence: `docs/AUDIT-WAVE-6/forge/evidence/`.
- Evidence rule: "verified by tool" (command + output) is distinguished from "read from a file". Anything not reproduced is marked UNVERIFIED with the exact missing evidence.

## Baseline (verified)

| Fact | Value | Evidence |
|---|---|---|
| Phase / features | B2, routing=true, learning=true | `GET /api/health` → `probe-api-console.txt` |
| Active run | `null` | `GET /api/runs/active` → `probe-api.json` |
| Runs | 25 (18 completed, 4 budget_exceeded, 3 failed) | `GET /api/runs?limit=100` → `probe-api.json` |
| Server | up since 2026-11-04T03:42:05Z, port 8787 | `Get-CimInstance` + `GET /api/health` |
| Source vs baseline | key files match `docs/AUDIT-WAVE-6/baseline.sha256` (app.ts `4C4EE8F7…`, run.ts `6A820FC8…`, manager.ts `0641C20A…`, recorder.ts `C3E3A50B…`, useApi.ts `489BBF19…`, RunDetailPage.tsx `56C73CB7…`) | SHA-256 comparison |
| UI build | `web/dist` built 2026-11-04T04:01:15Z, after newest `web/src` change (useApi.ts 03:30:16Z) | directory mtimes |
| `team_task_update` | not mounted in this seat | tool inventory |

## Summary

| ID | Sev | Status | Defect | Peer overlap |
|---|---|---|---|---|
| RC-1 | **P1** | SUPPORTED | Non-success terminal runs persist `cost_usd`/`prompt_tokens`/`completion_tokens` = NULL although provider usage is known; run detail prints "Not measured / The provider has not reported a cost yet" | W6-L-02 (independently corroborated + trace/stats contradiction added) |
| RC-2 | **P1** | SUPPORTED (static; live→terminal transition not run) | After a live watch reaches terminal, the Events tab keeps the ≤100-row live buffer and never shows the persisted ledger, while the heading switches to "Persisted events (latest 500)" | W6-L-13 (independent; peer wrote it concurrently) |
| RC-3 | **P2** | SUPPORTED | 5 server-emitted named events have no client listener (EventSource drops them); 16 subscribed types are never emitted; live payload shape differs from persisted | W6-L-04, W6-L-13 |
| RC-4 | **P2** | SUPPORTED | `GET /runs/:id/events` computes `truncated` from global sequence numbers; 24/25 persisted runs report truncation while returning every row | W6-L-05 (independently re-probed on production rows) |
| RC-5 | **P3** | SUPPORTED (static) | Run detail reads fields no route provides: `snapshot.limits` (cap never shown; Settings also filters it) and `checks.code`/`checks.durationMs` (columns always "—") | unique to this seat; weaver F3/F12 independently |
| RC-6 | **P3** | SUPPORTED (key non-uniqueness); collapse/warning claim REFUTED | `ChecksTab` keys 16 rows by 5 repeated `check.id`s; production build shows no duplicate-key warning and renders all 16 rows, but the per-pass rows are indistinguishable | W6-L-14 (independent measurement nuances the "collapses" claim) |
| RC-7 | **P3** | SUPPORTED (static; never triggered) | The "Replay truncated" badge is driven by `snapshot.truncated` = artifact list >200, not event replay | W6-L-15 |
| R-1 | — | REFUTED | `run_abf5` "Running / 7 steps" was a mid-run capture, not a convergence defect | W6-L-00 (independent UI probe + exact window) |
| R-2 | — | REFUTED | `run.cancelled` is subscribed (line 76); the "cancelled" part of the brief is false | — |
| R-3 | — | REFUTED | The Wave-5 stub-scan false positive that failed `run_abf5` no longer reproduces (current scanner: 0 findings) | — |
| U-1 | P3 | UNVERIFIED | A 410 `E_REPLAY_WINDOW_EXCEEDED` on SSE reconnect puts the client in a permanent reconnect loop with no snapshot fallback | W6-L-10 (peer probe re-executed for route half only) |
| U-2 | P3 | UNVERIFIED | Any illegal `RunStatus` transition is accepted by `updateRun` (state machine is dead code) | W6-L-03 (peer probe re-executed) |

Severity used: **P0** data corruption/fake success/security; **P1** a user-visible terminal record or spend/error identity is wrong; **P2** a diagnostic/state path is silently lost or lies; **P3** contract/observability drift with no current user-visible break.

## RC-1 (P1) — failure terminals drop measured spend and tokens; the UI says "not measured"

**Falsifiable sentence.** For every terminal run that reached the provider, `runs.cost_usd`, `runs.prompt_tokens` and `runs.completion_tokens` must equal the sum of that run's committed `usage` rows (or be NULL only when usage is genuinely unknown); actual: all 7 non-success terminal runs have NULL cost/tokens while holding 4–20 provider usage rows, and the run-detail top card says "Estimated spend: Not measured / The provider has not reported a cost yet"; scope: every failed, budget_exceeded, cancelled or interrupted run whose pipeline recorded usage before terminating, plus the run detail and runs list cost fields.

**Hypotheses and cheapest decisive probes.**

| # | Hypothesis | Decisive probe | Result |
|---|---|---|---|
| H1 | No usage was recorded for failed runs | `SELECT COUNT(*), SUM(cost_usd) FROM usage WHERE run_id=…` for all 25 runs | Killed: 7/7 failed/budget runs have provider usage rows (4–20); 161 usage rows total |
| H2 | Usage exists but the failure terminal writer never copies it to the run row | Read the four failure branches vs the success branch; compare `runs` vs `usage` vs `traces` | **Confirmed**: only `finalize()` writes cost/tokens (`run.ts:1075-1084`); the failure branches call `markTerminal`/`updateRun` without usage (`run.ts:853-861`, `868-888`, `337-346`, `431-437`; `manager.ts:250-258`) |
| H3 | The value is stored but the UI renders NULL | Load a completed run (cost present) and abf5 (cost NULL) in the real UI; compare `run.costUsd` from `/snapshot` | Killed: completed `run_95…` shows `$0.2508`, abf5 shows "Not measured"; the API field itself is null |
| H4 | Stale capture of a pre-usage row | Load abf5 fresh, 54 min after `finished_at`; also read `traces` (written at terminal time) | Killed: fresh load still shows "Not measured"; `traces` row already holds $0.299980656 and 547 696/124 569 tokens |

**Root cause (file:line).**
- `src/server/pipeline/run.ts:853-861` (gate fail) and `:868-888` (catch: failed / budget_exceeded / cancelled) call `markTerminal`/`updateRun` with status/phase/error only.
- `src/server/pipeline/run.ts:337-346` (review/audit gate fail) and `:431-437` (adhoc gate fail) likewise.
- `src/server/runs/manager.ts:250-258` — `markTerminal` has no usage fields.
- The only writer of the run's cost/tokens is the success path `src/server/pipeline/run.ts:1075-1084` (`usageTotals` at `:1017`).
- `src/server/runs/recorder.ts:355-378` already implements the honest aggregation (`SUM`, NULL if any `source='unknown'`, NULL if no rows), used by `recordRunTrace` at `run.ts:114` and by the success finalize.

**RED (production rows; full evidence `evidence/cost-truth.json`, `evidence/probe-cost-console.txt`).**

```
$ node docs/AUDIT-WAVE-6/forge/probes/cost-probe.mjs
runs: 25
measuredWithNullRunCost: 7
unreportedMeasuredCostUsd: 0.606852192
abf5: status=failed errorCode=GATE_FAILED usageRows=20 providerRows=20 unknownRows=0
      measuredCostUsd=0.299980656 measuredPromptTokens=547696 measuredCompletionTokens=124569
      runCostUsd=null runPromptTokens=null runCompletionTokens=null
      traceRows=1 traceCostUsd=0.299980656 tracePromptTokens=547696 traceCompletionTokens=124569
```

The same database answers the spend question three different ways:

```
$ curl /api/stats                    GET /api/runs/run_abf5…/snapshot
totalCostUsd 0.924624168              run.costUsd null
sum(runs.cost_usd) = 0.317771976      run.promptTokens null
difference           = 0.606852192    UI: "Not measured"
```

`traces` for abf5 (written at 03:15:46 by the product, `outcome=failure, complete=1`) contains exactly `cost=0.299980656, prompt_tokens=547696, completion_tokens=124569`. The UI result is captured in `evidence/crop-abf5-spend-not-measured.png` (from `docs/AUDIT-WAVE-6/lead-ui-abf5.png`, sha256 `357027e5…`).

**Smallest fix (details in `patch-proposals.json` P-1).** Make the one terminal writer copy `usageTotals(runId)` into the run row: add `cost_usd`/`prompt_tokens`/`completion_tokens` to `manager.ts:markTerminal`, and route the catch branch (`run.ts:868-888`) through `markTerminal` instead of a bare `updateRun`. Callers unchanged; no schema change; no backfill of historical rows (they remain honestly NULL and are listed here). Edge cases: zero usage rows → NULL (not 0); any `source='unknown'` row → NULL for all three fields (existing `usageTotals` contract); executor-catch failures with no usage → NULL; double terminal calls are last-write-wins.

## RC-2 (P1) — the Events tab never switches from the live buffer to the persisted ledger

**Falsifiable sentence.** When a run detail page is opened while a run is non-terminal and the run later becomes terminal, the Events tab must show the persisted `/events` ledger (the 108 rows for `run_abf5`, including `run.queued` and `repair.stalled`); actual: `visibleEvents` keeps the in-memory live array (≤100 rows, missing the unsubscribed types) because it is non-empty, so the fetched persisted ledger is ignored while the heading says "Persisted events" and the description promises "latest 500"; scope: every run watched live through completion in `RunDetailPage`, any run id; a fresh load of an already-terminal run is correct (108/108 measured).

**Hypotheses and probes.**

| # | Hypothesis | Decisive probe | Result |
|---|---|---|---|
| H1 | `/events` returns no rows for terminal runs | GET /events for abf5/95/2bb2 | Killed: 108, 102, 55 rows; DOM shows all of them on fresh terminal load |
| H2 | The page never fetches persisted events | Playwright network capture on terminal pages | Killed: exactly 1 `/events` request, 1 `/snapshot`, 0 `/stream` |
| H3 | Live state is never cleared at terminal and wins the selector | Static data-flow extraction + truth table (`probes/static-probe.mjs`) | **Confirmed**: reset only on `runId` change (`:116-119`); stream disabled at terminal (`:135`) but `events` kept; `visibleEvents = events.length > 0 ? events : persistedEvents.data ?? []` (`:133`); cap `slice(-99)` (`:136`); heading terminal-only (`:1009-1013`) |
| H4 | Stale capture / the current page is broken | Fresh load of abf5/95/2bb2 in Chrome, compare DOM to API | Killed for the fresh path: status, steps, row count and type counts match exactly (3/3 runs). The defect is the transition path, not the current static render |

**RED (static contradiction; full evidence `evidence/probe-static.json`).**

```
RunDetailPage.tsx:116-119  useEffect(() => { setTab('overview'); setEvents([]); }, [runId]);
RunDetailPage.tsx:129-132  persistedEvents = useApiResource(runId && terminal ? getRunEvents(...) : Promise.resolve([]), [runId, terminal]);
RunDetailPage.tsx:133      const visibleEvents = events.length > 0 ? events : persistedEvents.data ?? [];
RunDetailPage.tsx:135-136  useRunStream(run && !terminal ? runId : null, (event) => { setEvents(prev => [...prev.slice(-99), event]); ... });
RunDetailPage.tsx:1009-1013 title={terminal ? 'Persisted events' : 'Live events'} … 'Terminal runs load the persisted event ledger (latest 500).'
```

Truth table of the shipped expression:

| State | live rows | persisted rows | visible | persisted used? |
|---|---|---|---|---|
| fresh terminal load | 0 | 108 | 108 | yes |
| watched live to terminal (cap) | 100 | 108 | **100** | **no** (8 rows hidden) |

The prior fix receipt claims a merge that does not exist: `docs/TRACE/20261103T2200Z/03-forgewright-fixes.md:82` says "loads it only when terminal, **merges local/live vs persisted**"; the code selects one array. The existing E2E only covers a fresh terminal load (`e2e/trace-fixes.spec.ts:4-23`), so it cannot catch the transition; the unit test only maps rows (`test/unit/trace-fixes.test.ts:156-167`). `RunStreamEvent` has no `seq` (`web/src/api-types.ts:102-106`), so a seq-merge is impossible today.

**Smallest fix (P-2).** Add a pure selector in `src/shared/run-events.ts` and use it at `RunDetailPage.tsx:133`: terminal → `persistedEvents.data ?? []`; non-terminal → live. No API change, no clearing, no merge. Loading already shows the spinner (`persistedEvents.loading`), error already shows `ErrorPanel`, and an empty persisted ledger shows the honest empty state with `lastEventId`.

**Runtime limitation.** No non-terminal run exists and paid runs are forbidden, so the live→terminal transition was not executed end-to-end. The static contradiction is complete (the selector, the reset effect and the cap are the only producers of `visibleEvents`), and the fresh-terminal path was measured. Exact missing evidence: a live run watched through completion (or a test-only route-intercepted transition), which the proposal's test adds. The peer W6-L-13 section independently reaches the same data-flow conclusion; this seat adds the fresh-load vs transition split (3/3 fresh loads exact), the failed e2e coverage analysis, and the selector truth table.

## RC-3 (P2) — emitted ≠ subscribed event vocabulary; live payload shape differs from persisted

**Falsifiable sentence.** Every type the server publishes with `emitEvent` must be registered by `useRunStream` so the browser dispatches it, and a live event's `data` must have the same shape as a persisted row's `data`; actual: 5 emitted types (`run.queued`, `phase.skipped`, `agent.failed`, `context.skipped`, `repair.stalled`) are absent from the 27-entry client list and are silently dropped by `EventSource`, the live handler stores the whole SSE envelope while the persisted mapper stores the bare payload, and 16 subscribed types are never emitted; scope: live/replayed Events tab rows and payload previews for every run.

**Hypotheses and probes.**

| # | Hypothesis | Decisive probe | Result |
|---|---|---|---|
| H1 | The server does not emit those types | Source scan of every `emitEvent(` call; production DB census | Killed: 16 distinct emitted types; 5 `agent.failed` rows, 25 `run.queued`, 1 `repair.stalled`; `phase.skipped`/`context.skipped` emitted only when routing is disabled (`run.ts:497,679,788`) |
| H2 | EventSource delivers unregistered named events to `onmessage` | Chrome probe: register the exact app list vs the 5 missing names, plus `onmessage` counter | Killed: app-list source received 106/108 (abf5), 53/55 (2bb2), 101/102 (95); missing-list source received exactly the 2/2/1 dropped rows; `onmessage` = 0 on all three |
| H3 | The client registers them elsewhere / via a wildcard | Grep `useRunStream`/`addEventListener` in `web/src` | Killed: only the `STREAM_EVENT_TYPES` loop exists (`useApi.ts:72-100,143`) |
| H4 | The loss has no UI field impact (only diagnostics) | Map every consumer of events in `web/src` | Partially true: no status/step/check field consumes event types; the affected field is the Events tab row list (and its payload preview). Terminal convergence is unaffected because `run.completed`/`run.failed`/`run.cancelled` are subscribed |

**RED (browser, real server; `evidence/probe-ui.json`).**

```
abf5: appTypes listener total=106  apiFrames=108  missed=2  onmessage=0
      missingTypes listener {run.queued:1, repair.stalled:1}
2bb2: appTypes listener total=53   apiFrames=55   missed=2  onmessage=0
      missingTypes listener {run.queued:1, agent.failed:1}
95:   appTypes listener total=101  apiFrames=102  missed=1  onmessage=0
raw replay: event: run.queued (seq 552), … event: repair.stalled (seq 658), event: agent.failed (seq 713)
server frame: data: {"schema":"hive.api.v1","type":"agent.failed","data":{…},"meta":{…}}
```

The persisted terminal Events tab does show the missing rows (DOM contains `run.queued`/`repair.stalled` for abf5 and `agent.failed` for 2bb2) because `/events` is not filtered; only the live/replay path loses them. `phase.skipped`/`context.skipped` are unexercised in B2 (0 rows) and are static-only.

**Root cause (file:line).**
- `web/src/hooks/useApi.ts:72-100` — the 27-name list lacks the 5 emitted names.
- `web/src/hooks/useApi.ts:124-150` — one handler registered per listed type; every server frame is a named event (`app.ts:853-857`), so unlisted names are dropped and `onmessage` never fires.
- `src/server/pipeline/run.ts:224-235, 497, 679, 788, 820, 851, 885` and `src/server/runs/manager.ts:135, 186` — emitters.
- `web/src/hooks/useApi.ts:126-139` stores the parsed envelope as `data`; `src/shared/run-events.ts:19-25` stores `row.payload` for persisted rows.

**Smallest fix (P-3).** Add the 5 names; unwrap `data` in the live handler (`isRecord(parsed) && 'data' in parsed ? parsed.data : parsed`); add a static contract test that every `emitEvent` literal in `src/` is in `STREAM_EVENT_TYPES`. Keep the 16 dead listeners (they are future/unsupported surface, not a lie) or delete them in a separate cleanup.

## RC-4 (P2) — `/events` truncation is computed in global sequence space

**Falsifiable sentence.** `truncated=true` must mean at least one of this run's events was omitted from the response; actual: for 24 of 25 persisted runs the route returns every row and still reports `truncated=true` (including `run_abf5`: 108/108, first row is the run's first event `run.queued` seq 552, last 659), because `start` is derived from the per-run last seq minus the 500 window while `seq` is a global AUTOINCREMENT; scope: `GET /api/runs/:id/events` for any run after the shared ledger passes ~500 rows.

**Hypotheses and probes.**

| # | Hypothesis | Decisive probe | Result |
|---|---|---|---|
| H1 | Rows were actually dropped | DB per-run count vs returned count for all 25 runs | Killed: 25/25 returned count == DB count; 0 dropped |
| H2 | Global vs per-run window | Source read + census of all 25 runs | **Confirmed**: `start=max(after,current-500)`; `truncated = after < start \|\| current - start > events.length` (`app.ts:824-832`); 24 false positives, 0 false negatives |
| H3 | The UI is misled today | `getRunEvents` (`web/src/api.ts:327-332`) drops `truncated`/`lastEventId` | Confirmed no current UI effect; the API contract is still wrong and the tab cannot disclose a real truncation |
| H4 | Stale capture / wrong run | Compare against DB directly | Killed: DB and route agree on counts |

**RED (production; `evidence/events-route-census.json`).**

```
runs: 25
falsePositiveTruncationCount: 24
falseNegativeTruncationCount: 0
abf5: dbCount=108 returned=108 dropped=0 apiTruncated=true firstSeq=552 lastSeq=659
95:   dbCount=102 returned=102 dropped=0 apiTruncated=true
2bb2: dbCount=55  returned=55  dropped=0 apiTruncated=true
only run_007238… (max seq 9) reports false correctly
```

Peer probe re-executed by this seat (`evidence/peer-logic-probe-rerun.txt`): a 20-event run whose first seq is 551 returns 20 rows and `truncated=true`.

**Root cause (file:line).** `src/server/app.ts:818-833` (specifically `:822-832`) with `src/server/runs/recorder.ts:58-69`. `seq` is one AUTOINCREMENT sequence for all runs (`src/server/db/migrations.ts:54-55`), so `current-500` is not a per-run row boundary.

**Smallest fix (P-4).** Ask for `window + 1` rows after the cursor (`getEvents(id, after, window + 1)`), set `truncated = rows.length > window`, and return the newest `window` rows; delete the global `start` math. Handles empty, exactly-window, >window, and after-cursor cases. No UI change needed (the flag is additive); optionally surface it in the Events tab later.

## RC-5 (P3) — run detail reads fields no route provides

**Falsifiable sentence.** Fields the UI claims to display from the API must exist in the route response; actual: `RunDetailPage.tsx:199-201` reads `snapshot.limits.maxCostUsd` but `/api/runs/:id/snapshot` returns only `{run,lastEventId,steps,checks,artifacts,truncated}` (no `limits`), so the cost cap is never shown; `:655-658` renders `check.code` and `check.durationMs`, but `insertCheck`/`getChecks` never persist or return them (`checks` table has no such columns; `durationMs` has no producer in `src/`), so both columns are permanently "—"; scope: run detail cost meter and Checks tab.

**Probes.** Route key dump and checks schema/sample: `evidence/api-field-audit.json`; source lines above. The same cap is also persisted in `run_limit:<runId>` and in `run_snapshots.snapshot_json.limits`, but `/api/settings` nests it under `limits` while `SettingsView` reads only top-level scalars (`SettingsPage.tsx:134-138` filters `typeof value !== 'object'` and its `knownKeys` include `maxRunCostUsd`, which is not top-level), so the cap has no UI path anywhere. No false statement is shown (the UI prints "—"), so this is an absent capability, not a lie. Rank P3. Weaver F3 independently reported the same cap gap.

**Smallest fix (P-5).** Add `limits: { maxCostUsd: runBudgetUsd(id) }` to the snapshot route (`runBudgetUsd` already imported at `app.ts:14`) so the existing cap display becomes truthful; remove the Check **Code** and **Time** columns (or, larger: add a `code` column migration and a `durationMs` producer). Removal is the honest minimal change.

## RC-6 (P3) — Checks table keys rows by a non-unique check id

**Falsifiable sentence.** Every rendered `<tr>` in the Checks tab must have a unique React key; actual: `RunDetailPage.tsx:650` uses `key={check.id}`, and `check.id` is the repeated `check_id` (abf5: 16 rows, 5 distinct ids: `stub.scan`×4, `plan.coverage`×3, `secret.scan`×3, `syntax.all`×3, `verification.plan`×3), because `getChecks` maps `id: row.check_id` (`recorder.ts:293-303`) and hides the unique DB row id; scope: every run with more than one verification pass (repairs), i.e. 2 runs in this DB.

**Probe and result.** `evidence/checks-tab-probe.json` (Chrome, run_abf5, Checks tab): 16 DOM rows, 5 distinct first-cell ids, all 16 rows rendered, **zero duplicate-key console messages** (the production React build suppresses the development warning). So the peer W6-L-14 claim that React "collapses" the rows is **not observed**; the proven defect is key non-uniqueness plus the inability to tell passes apart (no timestamp/pass column; the Time column is dead per RC-5). P3, display-only; the persisted rows are correct.

**Smallest fix (P-6).** Use a unique key (a composite `check.id` + row index, or return the DB row id / `created_at` from `getChecks` and key on it), and either show the pass timestamp or group passes in the route. Do not reuse `check_id` alone.

## RC-7 (P3) — "Replay truncated" badge is about the artifact list, not replay

**Falsifiable sentence.** A badge reading "Replay truncated" must indicate that event replay was truncated; actual: `RunDetailPage.tsx:330` renders `snapshot.data.truncated`, and the snapshot route sets that flag to `allArtifacts.length > artifacts.length` (artifact list capped at 200, `app.ts:806-814`); the real event-replay flag (`/events.truncated`, RC-4) is never displayed; scope: any run with >200 artifacts (0 in this DB; max is 20, so the badge never appears today).

**Probe.** Static: route flag and badge expression; `evidence/api-field-audit.json` shows `snapshot.truncated=false` for abf5/95. Never triggered, no current false claim. P3.

**Smallest fix (P-7).** Rename the badge to "Artifact list truncated" (truthful for the current flag), or add a separate `eventsTruncated` field fed by the corrected `/events` route (RC-4) and label both distinctly.

## R-1 (REFUTED) — `run_abf5` "Running / 7 steps" was a stale/mid-run capture

**Falsifiable sentence.** If the UI failed to converge, a fresh load would still show Running/7 steps; actual current UI/API agree exactly on three runs, and the "7 steps" value is only reachable for 19.5 s while the run was genuinely running.

Evidence:
- Fresh Chrome load of `run_abf5fe78aab1e932ff` (54 min after `finished_at`): `FAILED · DONE · 20 STEPS · TERMINAL · SNAPSHOT`; Events tab `Persisted events`, 108 rows; `/snapshot` `status=failed, steps=20, lastEventId=659`; `/events` 108 rows seq 552–659 (`evidence/probe-ui.json`, `evidence/ui-abf5-events.png`, `docs/AUDIT-WAVE-6/lead-ui-abf5.png`).
- Same convergence on `run_95…` (COMPLETED/19 steps/102 rows) and `run_2bb2…` (FAILED/9 steps/55 rows): status, steps, row count and type counts match 3/3.
- Terminal pages issue exactly 1 `/snapshot` + 1 `/events` request, 0 `/stream`, and 0 further requests over a 6 s window; the 5 s poll is gated on non-terminal (`RunDetailPage.tsx:141-145`) and the stream on `run && !terminal` (`:135`); terminal-no-SSE is also pinned by `e2e/ui-audit.spec.ts:127-147`.
- Step rows: step 7 inserted 03:09:33.029Z, step 8 inserted 03:09:52.479Z → 19.5 s where a snapshot shows Running with exactly 7 step rows; the run then progressed to 20 steps and failed at 03:15:46.742Z. A capture showing "7 steps" therefore must come from that window (or a frozen tab); it is not a persistent convergence defect. The existing UI screenshot in the repo (`docs/UI-WAVE-1/shots/run-detail-overview.png`) shows `19 STEPS` for run_95, confirming step counts are rendered from the snapshot.

The claim's exact provenance is not in the repo (UNVERIFIED as an artifact); the value itself is only consistent with a mid-run capture. Terminal convergence works; the only real convergence defect in this area is RC-2 (event ledger), not status/steps.

## R-2 (REFUTED) — `run.cancelled` is subscribed

`web/src/hooks/useApi.ts:76` contains `'run.cancelled'`; the server emits it at `src/server/pipeline/run.ts:885` (ternary) and `src/server/runs/manager.ts:186`. The brief's "cancelled" candidate is false. (No cancelled rows exist in this DB — never exercised — but both sides of the contract are present.)

## R-3 (REFUTED) — the Wave-5 stub-scan false positive no longer reproduces

`run_abf5` failed at `stub.scan` on `src/probes/tool_access.py:121` (event seq 659 payload) and produced 0 artifacts. The current scanner returns 0 findings on the stored staging tree:

```
$ node --import tsx -e "import fs from 'node:fs'; import {scanText} from './src/server/verify/stub-scan.ts'; …"
findings=0
src/probes/identity.py -> 0
src/probes/learning_loop.py -> 0
src/probes/memory.py -> 0
src/main.py -> 0
```

Line 121 is `"not implemented",` inside a tuple of marker strings; the current rule only flags `raise|throw|return … not implemented` (`src/server/verify/stub-scan.ts:44-48`). The historical failure is real evidence of the old scanner, not a current defect.

## U-1 (P3, UNVERIFIED) — SSE 410 reconnect loop has no client fallback

`app.ts:843-845` returns HTTP 410 JSON `E_REPLAY_WINDOW_EXCEEDED` when `current - lastId > 500`. `EventSource` cannot read a 410 body, fires `onerror`, and reconnects with the same `Last-Event-ID`; `useApi.ts:148-150` only sets `'reconnecting'`, so the loop is permanent until the run turns terminal (the 5 s snapshot poll keeps status/steps fresh). Peer probe re-executed by this seat confirms the route half: `HTTP 410, code=E_REPLAY_WINDOW_EXCEEDED` (`evidence/peer-logic-probe-rerun.txt`). No run in this DB has a >500-event reconnect gap, so the browser loop was not observed. Exact missing evidence: a live run (or a temp-server fixture with >500 events between disconnect and reconnect) plus a browser capture of repeated retries.

## U-2 (P3, UNVERIFIED) — run state machine is dead code

All status writes go through `recorder.updateRun`/`markTerminal`/`markRunning`; `transitionRun`/`assertStatusTransition` (`src/server/logic/run-state.ts`) have no production caller (grep). A peer probe on a throwaway DB re-executed by this seat shows `completed → running` persists with no guard (`evidence/peer-logic-probe-rerun.txt`). No production row currently contains an illegal transition; whether to wire the guard or delete the module is a product decision.

## Peer findings reconciliation (W6-AUD-02, `docs/AUDIT-WAVE-6/logic/`)

I read `findings.md`; for the UI/API-relevant items I re-ran the peer probe (`docs/AUDIT-WAVE-6/logic/probe-routes.ts`) on a throwaway DB and cross-checked production rows. Status is my independent assessment.

| Peer ID | My status | Note |
|---|---|---|
| W6-L-00 stale capture | **REFUTED as defect** (agrees) | independent UI probe + 19.5 s window |
| W6-L-01 provider code → E_INTERNAL | **SUPPORTED (static + peer probe re-run)** | no production provider-failure specimen; affects the UI error chip for such runs |
| W6-L-02 failed runs lose spend | **SUPPORTED** (agrees; RC-1) | added the `traces` vs `runs` vs `/api/stats` contradiction |
| W6-L-03 state machine dead | **SUPPORTED (peer probe re-run)** | no production illegal transition observed; U-2 |
| W6-L-04 SSE type drift | **SUPPORTED** (agrees; RC-3) | added independent delivery counts and persisted-DOM inclusion |
| W6-L-05 `/events` truncated | **SUPPORTED** (agrees; RC-4) | added the 24/25 production census |
| W6-L-06 interrupted silent | **SUPPORTED (peer probe re-run)** | no interrupted row in this DB; UI would show `Interrupted` with no explanation |
| W6-L-07 GATE_FAILED no log/registry | **SUPPORTED (static + errors.jsonl cross-check)** | `GATE_FAILED` absent from the 85 REFUSALS codes; 2 gate-failed runs, 0 `GATE_FAILED` rows in `errors.jsonl`; UI chip uses `run.errorMessage`, so visual impact is low |
| W6-L-08 trace_complete untied | **SUPPORTED as invariant break** | 7 completed runs have `trace_complete=1` and 0 `traces` rows; the historical cause is UNVERIFIED (peer's DB-history hypothesis not established) |
| W6-L-09 learning variant machine | **UNVERIFIED by me** | out of this seat's UI/API scope |
| W6-L-10 410 loop | **UNVERIFIED** (U-1) | route half re-probed; browser loop not observed |
| W6-L-11 cancel ack race | **UNVERIFIED by me** | source-only; not reproduced |
| W6-L-12 failure payload drift | **SUPPORTED (2 observed shapes)** | production `run.failed` is `{code,checks}` (2 runs) or `{code,message}` (5 runs); the peer's third `timedOut` shape is in `manager.ts:157` but has no production specimen. No current consumer; Events tab shows raw JSON |
| W6-L-13 live vs persisted event view | **SUPPORTED** (RC-2 selector + RC-3 shape) | independently measured fresh-terminal vs transition; adds e2e coverage gap |
| W6-L-14 checks non-unique key | **SUPPORTED (key non-uniqueness); REFUTED (collapse/warning)** | Chrome probe: 16 rows/5 ids, all rows rendered, 0 duplicate-key console errors in the production build; per-pass rows remain indistinguishable (RC-6) |
| W6-L-15 "Replay truncated" mislabel | **SUPPORTED (static, never triggered)** | RC-7 |

I did not duplicate W6-L-08/L-09/L-11 probes; L-07/L-08/L-12/L-14 were independently cross-checked against `data/hive.db`, `data/logs/errors.jsonl`, and the live Chrome DOM (`evidence/peer-crosscheck.json`, `evidence/checks-tab-probe.json`).

### Peer findings — falsifiable sentence and decisive probe

| Peer ID | Falsifiable sentence | Decisive probe run by this seat | Result |
|---|---|---|---|
| W6-L-01 | A provider `LlmError` code must reach `runs.error_code` and the terminal event; actual `E_INTERNAL` | Re-ran `probe-routes.ts` (temp DB, real `createRun`/executor) | RED: `run.errorCode=E_INTERNAL, event.code=E_INTERNAL` for `E_LLM_RATE_LIMIT` |
| W6-L-02 | A run with provider usage must not persist NULL spend | `cost-probe.mjs` on 25 production runs | 7/7 failed/budget runs NULL while usage known; traces hold the number |
| W6-L-03 | An illegal `completed → running` write must be refused | Re-ran `probe-routes.ts` | RED: status persists as `running`; pure guard throws |
| W6-L-04 | Every emitted type must be deliverable | `probe-ui.mjs` Chrome EventSource test | 3/3 runs lose exactly the unsubscribed types; `onmessage=0` |
| W6-L-05 | `truncated=true` must mean a row was omitted | `census-probe.mjs` on 25 production runs | 24/25 false positives, 0 rows dropped |
| W6-L-06 | `interrupted` must carry code/message/event/log | Re-ran `probe-routes.ts` | RED: code/message NULL, 0 events |
| W6-L-07 | A gate failure must log and use a registry code | `peer-crosscheck.mjs` | `GATE_FAILED` not in 85 registry codes; 0 log rows for 2 gate failures |
| W6-L-08 | `trace_complete=1` must imply a trace row | `peer-crosscheck.mjs` | 7 completed runs violate it; cause not established |
| W6-L-12 | One event type should have one payload contract | `peer-crosscheck.mjs` | 2 production shapes `{code,checks}` / `{code,message}` |
| W6-L-13 | Live and persisted event views must agree on source, shape and cap | `probe-static.mjs` + `probe-ui.mjs` + source | terminal transition keeps live data under the persisted title; fresh load correct; shapes differ |
| W6-L-14 | Every Checks row must have a unique key and be distinguishable | `checks-probe.mjs` (Chrome) | 16 rows/5 keys; all render; no warning; passes indistinguishable |
| W6-L-15 | "Replay truncated" must mean event replay was truncated | source route + badge expression | artifact-list flag, never triggered today |

### Weaver cross-reference (W6-AUD-01, `docs/AUDIT-WAVE-6/weaver/findings.md`)

The Weaver audit independently reported the same core UI truth defects from a different method (398-control DOM inventory + source traces):

- Weaver **F1** = RC-3 (5 emitted types undelivered); their raw SSE capture (`weaver/evidence/logs/sse_abf5.txt`) matches mine.
- Weaver **F2** = RC-1 (spend "Not measured"); their 7-run table matches my `cost-truth.json` exactly.
- Weaver **F3** = RC-5 cap half, including the Settings projection gap; I added the `snapshot.limits` one-line seam.
- Weaver **F6** = RC-4 + RC-7 (both "truncated" meanings); their capture confirms the snapshot flag is artifact truncation.
- Weaver **F12** = RC-5 checks half (dead Time/code columns).
- Weaver §7 independently flags the `visibleEvents` live-buffer residual = RC-2.
- Weaver's other findings (F4 Context columns, F5 hardcoded routing reason, F7–F11/F13 a11y/refusal copy) are outside this seat's root-cause set; I read them and did not duplicate them.
- Weaver's control/value audit and my route-level evidence agree on the happy-path truth (status/phase/steps/created/duration/error chip/files/checks counts/artifacts/trace flag), which is why R-1 is a stale capture rather than a convergence bug.

## Excluded false positives

- "Terminal Events tab shows no persisted events" — false on a fresh terminal load: 108/108, 102/102, 55/55 rows rendered (3/3). Only the live→terminal transition is broken (RC-2).
- "SSE missing `step.started`, `agent.delta`, `review.completed`, …" — these are never emitted, so their absence is not event loss; it is dead subscription surface (RC-3). No UI field depends on them.
- "The UI shows `—` for unknown cost" in completed runs with no usage (`run_3a4578…`, 0 usage rows) — honest unknown; not part of RC-1. (Whether a completed zero-call run should show $0 with a `costSource` is a product decision; peer W6-L-02 notes it.)
- "`run.updated`, `run.paused`, `run.needs_review` not delivered" — never emitted; not a dropped-event defect.
- "The run list is stale" — `RunsPage` loads once and has a manual Refresh; a screenshot of an old list tab is a stale capture, not a convergence defect. No automatic refresh is claimed by the page.

## Files that must not be touched by a future fix beyond the proposals

`src/server/pipeline/run.ts`, `src/server/runs/manager.ts`, `src/server/app.ts`, `src/server/runs/recorder.ts` (none needed for P-1 except manager/run; P-4 app only), `web/src/hooks/useApi.ts`, `web/src/pages/RunDetailPage.tsx`, `src/shared/run-events.ts`, `web/src/api.ts` (only if the UI later consumes `truncated`). Tests: `test/unit/*` and `e2e/*`. No schema change for P-1/P-2/P-3/P-4; P-5 check-code persistence (optional) needs a new migration group.

## Definition-of-done status for this audit

- Commands actually executed and outputs quoted: yes (`red-evidence.md`, `evidence/*`).
- Outputs compared to acceptance conditions: yes — every "actual" above is a quoted tool result, not an inference.
- Failure/edge paths exercised: `/events` empty/small/large via DB census; terminal vs live UI; unknown-usage contract read; no paid call, so provider-failure and live-transition paths remain UNVERIFIED with exact gaps stated.
- No stub/mock/fake data used as proof; the only test double is the peer's throwaway DB, re-executed and labelled as such.
