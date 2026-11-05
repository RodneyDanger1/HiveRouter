# W6-AUD-03 — RED evidence (commands, raw output, file:line)

All commands run from `C:\Users\Riley\Desktop\HiveRouter` on Windows PowerShell 5.1 / Node v26.7.0. Probes are GET-only against the live server (`http://127.0.0.1:8787`) or `node:sqlite` opened with `{ readOnly: true }`; screenshots/JSON go only to `docs/AUDIT-WAVE-6/forge/`. No product file, test, config, workspace, run, DB row or log was modified by this seat. Row counts before/after all probes: `runs=25 events=972 usage=161 steps=171 checks=88 artifacts=61` (unchanged); no active run (`/api/runs/active` → `{"activeRunId":null}`).

Evidence files are listed with their first 16 SHA-256 hex chars in §12.

## 1. Baseline and immutability

```text
$ curl -s http://127.0.0.1:8787/api/health
{"status":"ok","version":"0.1.0","phase":"B2","features":{"routing":true,"learning":true},"db":"ok",...}

$ curl -s http://127.0.0.1:8787/api/runs/active
{"activeRunId":null}

$ curl -s "http://127.0.0.1:8787/api/runs?limit=100"
25 runs: completed=18, budget_exceeded=4, failed=3

$ Get-FileHash web/src/hooks/useApi.ts -Algorithm SHA256
489bbf1959f73f9cf2bdbbf10002ebbd70d92b0fd73a2bc6a1e427885ef32148
baseline.sha256: 489BBF1959F73F9CF2BDBBF10002EBBD70D92B0FD73A2BC6A1E427885EF32148  web/src/hooks/useApi.ts
```

Key source files match `docs/AUDIT-WAVE-6/baseline.sha256`: `app.ts 4C4EE8F7…`, `run.ts 6A820FC8…`, `manager.ts 0641C20A…`, `recorder.ts C3E3A50B…`, `run-events.ts 23C0542F…`, `RunDetailPage.tsx 56C73CB7…`, `useApi.ts 489BBF19…`.

The live server (`PID 23876`, `node --require tsx/preflight.cjs --import …/loader.mjs src/server/index.ts`) was started `2026-11-04T03:42:05Z`; `web/dist` was built `2026-11-04T04:01:15Z`, after the newest `web/src` edit (`useApi.ts 03:30:16Z`), so the browser evidence runs the audited source.

## 2. RC-1 — failure terminals drop measured spend/tokens

### 2.1 Reproduce

```powershell
node docs/AUDIT-WAVE-6/forge/probes/cost-probe.mjs
```

Raw output (`evidence/probe-cost-console.txt`, full rows `evidence/cost-truth.json`):

```json
{
  "runs": 25,
  "measuredWithNullRunCost": 7,
  "unreportedMeasuredCostUsd": 0.606852192,
  "affected": [
    {"runId":"run_9c4659ee2d4fbb40bf","status":"failed","errorCode":"GATE_FAILED","usageRows":7,"measuredCostUsd":0.00955884,"runCostUsd":null},
    {"runId":"run_1e5add0b6ba2e3c736","status":"budget_exceeded","errorCode":"E_BUDGET_EXCEEDED","usageRows":4,"measuredCostUsd":0.002719722,"runCostUsd":null},
    {"runId":"run_23af9b7837448cb24a","status":"budget_exceeded","errorCode":"E_BUDGET_EXCEEDED","usageRows":10,"measuredCostUsd":0.01270053,"runCostUsd":null},
    {"runId":"run_abf5fe78aab1e932ff","status":"failed","errorCode":"GATE_FAILED","usageRows":20,"measuredCostUsd":0.299980656,"runCostUsd":null},
    {"runId":"run_2bb2f8edf3043fe89e","status":"failed","errorCode":"E_BUDGET_UNKNOWN_RESERVATION","usageRows":9,"measuredCostUsd":0.051138816,"runCostUsd":null},
    {"runId":"run_65da49c3948f9d8f5c","status":"budget_exceeded","errorCode":"E_BUDGET_EXCEEDED","usageRows":9,"measuredCostUsd":0.045521616,"runCostUsd":null},
    {"runId":"run_26e2456caef4b8be0c","status":"budget_exceeded","errorCode":"E_BUDGET_EXCEEDED","usageRows":18,"measuredCostUsd":0.185232012,"runCostUsd":null}
  ],
  "abf5": {
    "runId":"run_abf5fe78aab1e932ff","status":"failed","errorCode":"GATE_FAILED",
    "usageRows":20,"providerRows":20,"unknownRows":0,
    "measuredCostUsd":0.299980656,"measuredPromptTokens":547696,"measuredCompletionTokens":124569,
    "runCostUsd":null,"runPromptTokens":null,"runCompletionTokens":null,
    "measuredButRunRowNull":true,
    "traceRows":1,"traceCostUsd":0.299980656,"tracePromptTokens":547696,"traceCompletionTokens":124569,
    "tokensDropped":true,"costAgrees":false
  }
}
```

### 2.2 Same database, three answers (`evidence/api-field-audit.json`)

```
GET /api/stats                  → totalCostUsd = 0.924624168
SELECT SUM(cost_usd) FROM runs  → 0.317771976
difference                      → 0.606852192  (exactly the 7 affected runs' usage)
run_abf5 snapshot.run.costUsd   → null
run_abf5 usage sum              → 0.299980656
run_abf5 traces[0]              → cost_usd 0.299980656, prompt 547696, completion 124569, outcome failure, complete 1
```

`traces` is written by the product at terminal time via `recordRunTrace` → `usageTotals` (`src/server/pipeline/run.ts:108-140`), which proves the number was measurable when the run terminated. The run row and the UI were not updated.

### 2.3 The UI states a false explanation

`web/src/components/ui.tsx:591-614`:

```tsx
const known = typeof costUsd === 'number';
…
{known ? formatUsd(costUsd) : 'Not measured'}
…
{!known ? <p className="mt-1 text-xs text-slate-400">The provider has not reported a cost yet.</p> : null}
```

`RunDetailPage.tsx:335-342` feeds `run.promptTokens`, `run.completionTokens`, `run.costUsd` into those fields. For abf5 all three are null, so the provider *did* report the cost and the UI says it did not. Screenshot crop: `evidence/crop-abf5-spend-not-measured.png` (from `docs/AUDIT-WAVE-6/lead-ui-abf5.png`, sha256 `357027e5…`), showing `PROMPT TOKENS — / COMPLETION TOKENS — / Estimated spend Not measured / The provider has not reported a cost yet.`

### 2.4 Broken hop (file:line)

- `src/server/pipeline/run.ts:853-861` — gate fail: `markTerminal(...)` + `emitEvent('run.failed')`; no usage fields.
- `src/server/pipeline/run.ts:868-888` — catch (failed / budget_exceeded / cancelled / timeout): `updateRun({status, phase, finished_at, error_code, error_message})`; no usage fields.
- `src/server/pipeline/run.ts:337-346` and `:431-437` — review/audit and adhoc gate-fail paths; same omission.
- `src/server/runs/manager.ts:250-258` — `markTerminal` has no `cost_usd`/token fields.
- `src/server/pipeline/run.ts:1075-1084` — success path is the only writer of `cost_usd`, `prompt_tokens`, `completion_tokens`.
- `src/server/runs/recorder.ts:355-378` — honest `usageTotals` already exists (NULL if any `source='unknown'`, NULL if no rows).

### 2.5 Edge cases demonstrated by the data

- completed runs with usage: 18/18 `runs.cost_usd` exactly equals the usage sum (`costAgrees=true`); e.g. run_95 $0.250781772.
- completed run with no usage rows: `run_3a4578fa7b6ffebae1` → cost null, usage null (honest unknown, not RC-1).
- failed/budget runs with provider-only usage: 7/7 null (RC-1).

## 3. RC-2 — live→terminal Events tab never shows the persisted ledger

### 3.1 Reproduce

```powershell
node docs/AUDIT-WAVE-6/forge/probes/static-probe.mjs
```

Raw excerpt (`evidence/probe-static.json`):

```json
{
  "source": {
    "resetOnRunId": [{"line":116,"text":"  useEffect(() => {"},{"line":117,"text":"    setTab('overview');"},{"line":118,"text":"    setEvents([]);"},{"line":119,"text":"  }, [runId]);"}],
    "persistedFetch": [{"line":129,"text":"  const persistedEvents = useApiResource<RunStreamEvent[]>("},{"line":130,"text":"    (signal) => (runId && terminal ? getRunEvents(runId, signal) : Promise.resolve([])),"},{"line":131,"text":"    [runId, terminal],"},{"line":132,"text":"  );"}],
    "selector": [{"line":133,"text":"  const visibleEvents = events.length > 0 ? events : persistedEvents.data ?? [];"}],
    "streamHook": [{"line":135,"text":"  const streamStatus = useRunStream(run && !terminal ? runId ?? null : null, (event) => {"},{"line":136,"text":"    setEvents((previous) => [...previous.slice(-99), event]);"},...}],
    "eventsHeading": [{"line":1009,"text":"        title={terminal ? 'Persisted events' : 'Live events'}"},{"line":1012,"text":"            ? 'Terminal runs load the persisted event ledger (latest 500). The snapshot remains the source of truth.'"},...}]
  },
  "selectorTruthTable": [
    {"state":"fresh terminal load (events=[])","inputs":{"live":0,"persisted":108},"visible":108,"usesPersisted":true},
    {"state":"watched live to terminal (events capped at 100)","inputs":{"live":100,"persisted":108},"visible":100,"usesPersisted":false,"missingRows":8,"headingWouldBe":"Persisted events (terminal === true)"}
  ],
  "liveBufferCap": {"codeLine":"setEvents((previous) => [...previous.slice(-99), event]);","maxRows":100}
}
```

### 3.2 The prior fix claim is not what the code does

```
docs/TRACE/20261103T2200Z/03-forgewright-fixes.md:82
  "RunDetailPage.tsx:127-133 loads it only when terminal, merges local/live vs persisted, …"

web/src/pages/RunDetailPage.tsx:133
  const visibleEvents = events.length > 0 ? events : persistedEvents.data ?? [];
```

There is no merge: it is a two-way select, and a non-empty live array always wins. `RunStreamEvent` has no `seq` (`web/src/api-types.ts:102-106`), so a dedupe/merge would need a shape change anyway.

### 3.3 Test coverage gap (why this survived)

```
e2e/trace-fixes.spec.ts:4-23
  test('terminal Events tab renders the persisted ledger instead of an empty live state', …)
  → page.goto a fresh terminal run, click Events, assert the heading and one type.
test/unit/trace-fixes.test.ts:156-167
  → only mapPersistedRunEvents rows; no component/transition.
```

No test opens the page while the run is non-terminal. The fresh-load path does work (108/108, 102/102, 55/55), which is why the existing test is green.

### 3.4 Runtime limitation

No non-terminal run exists (`/api/runs/active = null`; 25/25 terminal) and paid runs are forbidden. The live→terminal transition itself was **not** executed; the static data flow above is exhaustive (`events` has exactly two writers: the reset effect at `:118` and the stream callback at `:136`; `visibleEvents` has one definition at `:133`), so the contradiction cannot be explained by another path. Exact missing evidence: a live run watched to completion or a test-only route-intercepted transition (added by the proposed test).

## 4. RC-3 — emitted ≠ subscribed; live payload shape differs

### 4.1 Source-derived diff (`evidence/probe-api.json` → `source`)

```powershell
node docs/AUDIT-WAVE-6/forge/probes/api-probe.mjs
```

```json
{
  "emittedNotSubscribed": ["agent.failed","context.skipped","phase.skipped","repair.stalled","run.queued"],
  "subscribedNotEmitted": ["agent.delta","check.completed","confidence.recorded","failure.clustered","file.revised","heartbeat","learning.eval","learning.promotion","learning.trace","repair.completed","review.completed","run.needs_review","run.paused","run.updated","step.completed","step.started"],
  "emittedCount": 16,
  "subscribedCount": 27
}
```

`STREAM_EVENT_TYPES` is `web/src/hooks/useApi.ts:72-100`; the emitted set is derived from every `emitEvent(` call in `src/`:
`run.ts:224,229,234,293,300,304,310,316,327,332,336,342,367,423,426,430,433,451,464,481,497,501,601,603,608,669,679,717,719,724,731,735,742,749,762,767,788,811,820,825,831,833,848,851,858,885,978,1087,1088`, `manager.ts:135,157,186`.

### 4.2 Production rows prove the dropped types exist

```powershell
node -e "… SELECT type, COUNT(*) FROM events GROUP BY type …"
```

```text
agent.started 171, agent.completed 166, phase.started 140, phase.completed 135,
route.decided 99, file.written 96, context.packed 84, run.started 25, run.queued 25,
run.completed 18, run.failed 7, agent.failed 5, repair.stalled 1
```

`agent.failed` payload example (run_2bb2, seq 713):

```json
{"stepId":"stp_cb1623ba3e89c5ed26","agentId":"python-engine","phase":"generating","code":"E_BUDGET_UNKNOWN_RESERVATION","message":"E_BUDGET_UNKNOWN_RESERVATION"}
```

`repair.stalled` payload (run_abf5, seq 658): `{"reason":"attempt budget exhausted","attempts":2}`.
`run.queued` payload (every run, first event): `{"runId":"…","preset":"full-build"}`.
`phase.skipped`/`context.skipped`: 0 rows (B2 routing enabled); emitted only at `run.ts:497,679,788`.

### 4.3 Raw SSE replay contains the named frames

```powershell
node docs/AUDIT-WAVE-6/forge/probes/api-probe.mjs
```

`evidence/sse-abf5-raw.txt` (first/last frames):

```
id: 552
event: run.queued
data: {"schema":"hive.api.v1","type":"run.queued","data":{"runId":"run_abf5fe78aab1e932ff","preset":"full-build"},"meta":{"seq":552,"runId":"run_abf5fe78aab1e932ff","replay":true}}

id: 658
event: repair.stalled
data: {"schema":"hive.api.v1","type":"repair.stalled","data":{"reason":"attempt budget exhausted","attempts":2},"meta":{"seq":658,"runId":"run_abf5fe78aab1e932ff","replay":true}}

id: 659
event: run.failed
data: {"schema":"hive.api.v1","type":"run.failed","data":{"code":"GATE_FAILED","checks":[{"id":"stub.scan","status":"fail","detail":"1 placeholder marker(s), first at line 121","file":"src/probes/tool_access.py","line":121,"mandatory":true}]},"meta":{"seq":659,"runId":"run_abf5fe78aab1e932ff","replay":true}}
```

`evidence/sse-2bb2-raw.txt` contains `event: agent.failed` at id 713.

### 4.4 Browser delivery test (real Chrome, real stream, `evidence/probe-ui.json`)

The probe reads `STREAM_EVENT_TYPES` from the source, opens two `EventSource`s to the same `/stream`, one registering the exact app list and one registering only the 5 missing names:

```json
"abf5": {"deliveryDiff":{"appReceived":106,"apiFrames":108,"appMissed":2,"unsubscribedReceivedWhenRegistered":2,"onmessageFrames":0},
         "delivery":{"appList":{"counts":{"run.started":1,"phase.started":11,"agent.started":20,"agent.completed":20,"phase.completed":11,"route.decided":14,"context.packed":14,"file.written":14,"run.failed":1},"messages":0,"errors":0,"total":106},
                     "missingList":{"counts":{"run.queued":1,"repair.stalled":1},"messages":0,"errors":0,"total":2}}},
"2bb2": {"deliveryDiff":{"appReceived":53,"apiFrames":55,"appMissed":2,"unsubscribedReceivedWhenRegistered":2,"onmessageFrames":0},
         "delivery":{"missingList":{"counts":{"run.queued":1,"agent.failed":1},"total":2}}},
"95":   {"deliveryDiff":{"appReceived":101,"apiFrames":102,"appMissed":1,"unsubscribedReceivedWhenRegistered":1,"onmessageFrames":0}}
```

`onmessageFrames = 0` on all three proves every frame is a named event, so unlisted names have no delivery path.

### 4.5 The persisted terminal path *does* show them — so this is live-only loss

`evidence/probe-ui.json` for the terminal DOM:

```json
"abf5": {"dom":{"eventsHeading":"Persisted events","rowCount":108,"domTypeCounts":{"repair.stalled":1,"run.queued":1,…},"containsUnsubscribedTypes":{"repair.stalled":true,"run.queued":true,"agent.failed":false,…}}},
"2bb2": {"dom":{"eventsHeading":"Persisted events","rowCount":55,"domTypeCounts":{"agent.failed":1,"run.queued":1,…},"containsUnsubscribedTypes":{"agent.failed":true,"run.queued":true,…}}}
```

### 4.6 Live vs persisted payload shape

- Server SSE frame: `data: {schema, type, data:<payload>, meta:{seq,runId,replay}}` (`src/server/app.ts:853-857`).
- Live client stores the whole parsed envelope: `useApi.ts:126-139` (`let data = event.data; data = JSON.parse(event.data); … onEventRef.current({type, data, receivedAt})`).
- Persisted mapper stores the bare payload: `src/shared/run-events.ts:19-25` (`data: row.payload ?? row.data ?? null`).
- The Events tab renders `JsonPreview value={event.data}` (`RunDetailPage.tsx:1042`), so the same event shows `{schema,type,data,meta}` live and `{…payload}` after a fresh terminal load.

### 4.7 Broken hop (file:line)

- `web/src/hooks/useApi.ts:72-100` (missing 5 names; 16 names with no emitter).
- `web/src/hooks/useApi.ts:124-150` (per-type listeners; no unregistered delivery; `onmessage` dead).
- `web/src/hooks/useApi.ts:126-139` (envelope stored as data).
- `src/shared/run-events.ts:19-25` (payload stored as data).
- emitters as in §4.1.

## 5. RC-4 — `/events` false-positive truncation

### 5.1 Reproduce (production, all 25 runs)

```powershell
node docs/AUDIT-WAVE-6/forge/probes/census-probe.mjs
```

Raw output (`evidence/probe-census-console.txt`, full rows `evidence/events-route-census.json`):

```json
{
  "runs": 25,
  "falsePositiveTruncationCount": 24,
  "falseNegativeTruncationCount": 0,
  "runsLosingLiveRows": 25,
  "runsOver100Subscribed": ["run_abf5fe78aab1e932ff","run_95c11797b4923b4277"],
  "lossTypes": ["agent.failed","repair.stalled","run.queued"]
}
```

Per-run sample (all 25 agree returned==DB; only the first run is correct):

```text
run_007238… dbCount=9   returned=9   dropped=0 apiTruncated=false
run_9c4659… dbCount=32  returned=32  dropped=0 apiTruncated=true
run_abf5…   dbCount=108 returned=108 dropped=0 apiTruncated=true   firstSeq=552 lastSeq=659
run_95…     dbCount=102 returned=102 dropped=0 apiTruncated=true
run_2bb2…   dbCount=55  returned=55  dropped=0 apiTruncated=true
```

The first returned row for abf5 is `run.queued` seq 552, which DB evidence proves is the run's first event (`evidence/probe-api.json` → `db.abf5First`), so no event is missing despite `truncated:true`.

### 5.2 Broken hop (file:line)

`src/server/app.ts:818-833`:

```ts
const after = Math.max(0, Number(query.after ?? 0) || 0);
const current = lastEventId(id);                                   // 659, per-run max
const window = config.limits.eventReplayWindow;                    // 500
const start = Math.max(after, Math.max(0, current - window));      // 159, global-seq math
const all = getEvents(id, start, config.limits.eventReplayWindow); // seq > 159 → all 108
const events = all.slice(0, window);
return {
  events,
  truncated: after < start || current - start > events.length,     // 0 < 159 → true
  lastEventId: events.length > 0 ? events[events.length - 1].seq : current,
};
```

`seq` is `INTEGER PRIMARY KEY AUTOINCREMENT` on the shared `events` table (`src/server/db/migrations.ts:54-55`); `getEvents` is per-run (`src/server/runs/recorder.ts:58-69`). The window is applied in the wrong (global) coordinate space.

### 5.3 Peer probe re-executed by this seat

```powershell
& node_modules\.bin\tsx.cmd docs\AUDIT-WAVE-6\logic\probe-routes.ts
```

(`evidence/peer-logic-probe-rerun.txt`):

```text
green | events window: run with 550 events returns window and flags truncation
         actual: truncated=true, events=500
RED   | events window: complete 20-event run must not claim truncation
         expected: truncated=false, events=20, lastEventId=570
         actual  : truncated=true, events=20, lastEventId=570
```

### 5.4 Current consumer

`web/src/api.ts:327-332` returns only the mapped rows and drops `truncated`/`lastEventId`; the Events tab cannot disclose a real truncation. The API contract is wrong but there is no current UI falsehood from this flag (unlike RC-2, which lies about the ledger itself).

## 6. RC-5 — UI reads fields the API never provides

```powershell
node docs/AUDIT-WAVE-6/forge/probes/field-audit.mjs
```

`evidence/api-field-audit.json`:

```json
{
  "snapshotKeys": ["artifacts","checks","lastEventId","run","steps","truncated"],
  "snapshotHasLimits": false,
  "routeProvides": {"snapshotLimits": false, "checkFileAny": true, "checkCodeAny": false, "checkDurationMsAny": false},
  "checksTableColumns": ["id:TEXT","run_id:TEXT","check_id:TEXT","status:TEXT","detail:TEXT","mandatory:INTEGER","file:TEXT","line:INTEGER","created_at:TEXT"],
  "firstCheckRow": {"id":"chk_218864165912c7b66d","check_id":"plan.coverage","status":"pass","detail":"15 planned files present","mandatory":1,"file":null,"line":null,"created_at":"…"}
}
```

- `RunDetailPage.tsx:199-201` reads `snapshot.data.limits.maxCostUsd`; the snapshot route (`app.ts:802-816`) returns no `limits`, so `costCap` is always null and `CostMeter` never shows the cap (`lead-ui-abf5.png` has no "/ cap" suffix).
- `RunDetailPage.tsx:636-660` renders a **Code** column from `check.code` and a **Time** column from `check.durationMs`; `insertCheck`/`getChecks` (`recorder.ts:284-303`) never store or return them and the `checks` table has no such columns (`migrations.ts:88-99`); `durationMs` has no producer anywhere in `src/` (`grep durationMs` → only `shared/types.ts:215,327`). Both columns are permanently "—".

No false statement is rendered (the UI prints "—"), so this is absent capability, P3.

## 6b. RC-6 / RC-7 — Checks duplicate keys and the mislabeled "Replay truncated" badge

### 6b.1 Checks table keys (`evidence/checks-tab-probe.json`, screenshot `ui-abf5-checks.png`)

```powershell
node docs/AUDIT-WAVE-6/forge/probes/checks-probe.mjs
```

```json
{
  "api": {"checkRows": 16, "distinctCheckIds": 5,
          "checkIdCounts": {"plan.coverage":3,"secret.scan":3,"stub.scan":4,"syntax.all":3,"verification.plan":3},
          "snapshotTruncated": false, "artifacts": 0},
  "dom": {"rowCount": 16, "domDistinctIds": 5,
          "domIds": ["plan.coverage","secret.scan","stub.scan","stub.scan","syntax.all","verification.plan", …]},
  "consoleMessages": [{"type":"error","text":"Failed to load resource: the server responded with a status of 404 (Not Found)"}],
  "duplicateKeyWarnings": []
}
```

- `Recorder.getChecks` maps `id: String(row.check_id)` (`src/server/runs/recorder.ts:293-303`), discarding the unique DB row id `checks.id`.
- `ChecksTab` renders `<tr key={check.id}>` (`RunDetailPage.tsx:650`) over 16 rows with 5 distinct ids.
- **Measured correction to peer W6-L-14:** the production React build emits **no** duplicate-key warning, and all 16 rows render. The proven defect is the non-unique key and the inability to distinguish verification passes (no pass/timestamp column; Time is dead per RC-5), not a collapsed table. The console error is the unrelated `/favicon.ico` 404 (weaver F10).

### 6b.2 "Replay truncated" label

```
src/server/app.ts:806-814   truncated: allArtifacts.length > artifacts.length   // artifact cap 200
web/src/pages/RunDetailPage.tsx:330   {snapshot.data?.truncated ? <span className="badge badge-warn">Replay truncated</span> : null}
```

`snapshot.truncated` is false for abf5/95 (0 and 20 artifacts; `evidence/api-field-audit.json`), so the badge is never shown today. If a run exceeds 200 artifacts, the badge would claim event replay was truncated while only the artifact list was capped. Static, P3, never triggered.

## 7. R-1 — `run_abf5` Running/7 steps: REFUTED as a steady-state UI defect

### 7.1 Current UI/API convergence, 3/3 runs (`evidence/probe-ui.json`)

```json
"abf5": {"expected":{"status":"failed","steps":20,"events":108,"lastEventId":659},
          "dom":{"badges":["FAILED","DONE","20 STEPS","TERMINAL · SNAPSHOT"],"eventsHeading":"Persisted events","rowCount":108},
          "convergence":{"statusMatches":true,"stepsMatches":true,"eventRowsMatch":true,"typesMatch":true}},
"95":   {"expected":{"status":"completed","steps":19,"events":102,"lastEventId":972},
          "dom":{"badges":["COMPLETED","DONE","19 STEPS","COMPLETE · SNAPSHOT"],"eventsHeading":"Persisted events","rowCount":102},
          "convergence":{"statusMatches":true,"stepsMatches":true,"eventRowsMatch":true,"typesMatch":true}},
"2bb2": {"expected":{"status":"failed","steps":9,"events":55,"lastEventId":714},
          "dom":{"badges":["FAILED","DONE","9 STEPS","TERMINAL · SNAPSHOT"],"eventsHeading":"Persisted events","rowCount":55},
          "convergence":{"statusMatches":true,"stepsMatches":true,"eventRowsMatch":true,"typesMatch":true}}
```

Screenshots: `evidence/ui-abf5-events.png`, `evidence/ui-95-events.png`, `evidence/ui-2bb2-events.png`.

### 7.2 No stream/poll on terminal; the poll is non-terminal-only

```json
"observation": {"initialRequests":["/api/runs/run_abf5…/snapshot","/api/meta","/api/health","/api/runs/run_abf5…/events"],
                "initialSnapshotRequests":1,"initialStreamRequests":0,
                "windowMs":6000,"windowRequests":[],"windowStreamRequests":0,"windowSnapshotRequests":0}
```

Same for 95 and 2bb2. Source: `RunDetailPage.tsx:135-139` (stream only when `run && !terminal`), `:141-145` (5 s poll only when `!terminal`), `e2e/ui-audit.spec.ts:127-147` pins 0 stream for terminal.

### 7.3 The only window where "Running + 7 steps" is true

`evidence/probe-ui.json` → `staleCaptureWindow`:

```json
{
  "run": {"status":"failed","created_at":"2026-11-04T03:08:16.957Z","started_at":"2026-11-04T03:08:16.979Z","finished_at":"2026-11-04T03:15:46.742Z"},
  "sevenRowsExistFrom": "2026-11-04T03:09:33.029Z",
  "eightRowsExistFrom": "2026-11-04T03:09:52.479Z",
  "windowSeconds": 19.5,
  "terminalAt": "2026-11-04T03:15:46.742Z"
}
```

Step rows are inserted at step start (`recorder.ts:165-191`), so a snapshot taken in that 19.5 s window shows `status=running` with exactly 7 step rows. Any later capture must be stale (frozen tab / lost network), and the page then shows the explicit warning "Refresh failed (…); showing the last persisted snapshot" (`RunDetailPage.tsx:312-318`), not a silent lie. A capture before 03:09:33 shows ≤6 steps.

The existing repo screenshot `docs/UI-WAVE-1/shots/run-detail-overview.png` shows `19 STEPS` for run_95 (crop `evidence/crop-uiwave1-95-header.png`), confirming the step badge reads the persisted snapshot count.

## 8. R-2 — `run.cancelled` is subscribed: REFUTED

```
web/src/hooks/useApi.ts:76          'run.cancelled',
src/server/pipeline/run.ts:885      emitEvent(runId, status === 'cancelled' ? 'run.cancelled' : 'run.failed', …)
src/server/runs/manager.ts:186      emitEvent(runId, 'run.cancelled', { code:'E_CANCELLED', source:'no-controller' })
```

DB census: 0 cancelled rows (never exercised), but both sides of the contract exist. Not a defect.

## 9. R-3 — Wave-5 stub false positive no longer reproduces

```powershell
node --import tsx -e "import fs from 'node:fs'; import {scanText} from './src/server/verify/stub-scan.ts'; const p='workspace/runs/run_abf5fe78aab1e932ff/.staging/attempt-1/src/probes/tool_access.py'; console.log('findings='+scanText('src/probes/tool_access.py', fs.readFileSync(p,'utf8')).length); …"
```

Output:

```text
findings=0
src/probes/identity.py -> 0
src/probes/learning_loop.py -> 0
src/probes/memory.py -> 0
src/main.py -> 0
```

The historical `stub.scan` failure is preserved in the ledger: `run_abf5` seq 659 payload `{"code":"GATE_FAILED","checks":[{"id":"stub.scan","status":"fail","detail":"1 placeholder marker(s), first at line 121","file":"src/probes/tool_access.py","line":121,"mandatory":true}]}`. The stored file line 121 is `"not implemented",` inside a tuple of marker strings; the current rule only flags `raise|throw|return … not implemented` (`src/server/verify/stub-scan.ts:44-48`). Historical evidence only — not a current defect.

## 10. U-1/U-2 — peer route probes re-executed (route half only)

```powershell
& node_modules\.bin\tsx.cmd docs\AUDIT-WAVE-6\logic\probe-routes.ts
```

Output (`evidence/peer-logic-probe-rerun.txt`) — selected RED lines:

```text
RED   | events window: complete 20-event run must not claim truncation
         expected: truncated=false, events=20, lastEventId=570
         actual  : truncated=true, events=20, lastEventId=570
RED   | state guard: persistence layer rejects completed -> running
         expected: throw E_ILLEGAL_RUN_TRANSITION / status stays completed
         actual  : status persisted as running (no guard)
RED   | error propagation: LlmError E_LLM_RATE_LIMIT must persist its own code
         expected: run.errorCode=E_LLM_RATE_LIMIT, event.code=E_LLM_RATE_LIMIT
         actual  : run.errorCode=E_INTERNAL, event.code=E_INTERNAL, message=DeepSeek rate limit reached after 3 attempts.
RED   | failure branch: a failed run keeps commit totals out of runs.cost_usd
         expected: runs.cost_usd tracks committed spend (0.0009)
         actual  : committed=0.0009, runs.cost_usd=null
RED   | error registry: every code persisted on a run exists in REFUSALS
         actual  : missing=GATE_FAILED,E_CANCELLED,E_RUN_TIMEOUT,E_LLM_RATE_LIMIT,E_PROVIDER_EMPTY
RED   | startup interrupt: interrupted is a terminal status with a code, message and event
         actual  : status=interrupted, error_code=null, error_message=null, events=0
```

Route probe for U-1 (HTTP 410) is in the same run (see `peer-logic-probe-rerun.txt`); the *browser* 410 loop was not observed (no run with a >500-event reconnect gap). U-1 remains UNVERIFIED at the client half.

## 10b. Peer cross-check — registry, gate logging, trace flag, payload shapes

```powershell
node docs/AUDIT-WAVE-6/forge/probes/peer-crosscheck.mjs
```

`evidence/peer-crosscheck.json`:

```json
{
  "errorRegistry": {
    "refusalCodeCount": 85,
    "missingOnRunRows": ["GATE_FAILED","E_CANCELLED","E_RUN_TIMEOUT","E_LLM_RATE_LIMIT","E_PROVIDER_EMPTY"],
    "present": {"E_CANCELLED": false, "E_RUN_TIMEOUT": false, "GATE_FAILED": false}
  },
  "errorsLog": {"rows": 18, "byCode": {"E_RUN_TIMEOUT": 15, "E_BUDGET_UNKNOWN_RESERVATION": 1, "E_BUDGET_EXCEEDED": 2}, "gateFailedRows": 0},
  "gateFailures": [
    {"id":"run_9c4659ee2d4fbb40bf","error_code":"GATE_FAILED","error_message":"Mandatory verification failed"},
    {"id":"run_abf5fe78aab1e932ff","error_code":"GATE_FAILED","error_message":"Mandatory verification failed"}
  ],
  "traceCompleteWithoutTrace": [
    {"id":"run_007238d763a3956e74","status":"completed","trace_complete":1,"trace_rows":0},
    … 7 rows total …
  ],
  "runFailedPayloadShapes": [
    {"runId":"run_9c4659ee2d4fbb40bf","keys":["checks","code"]},
    {"runId":"run_abf5fe78aab1e932ff","keys":["checks","code"]},
    {"runId":"run_1e5add0b6ba2e3c736","keys":["code","message"]},
    {"runId":"run_23af9b7837448cb24a","keys":["code","message"]},
    {"runId":"run_2bb2f8edf3043fe89e","keys":["code","message"]},
    {"runId":"run_65da49c3948f9d8f5c","keys":["code","message"]},
    {"runId":"run_26e2456caef4b8be0c","keys":["code","message"]}
  ]
}
```

Interpretation: `GATE_FAILED` is not a registry code and gate failures are not in `errors.jsonl` (2 runs, 0 rows); 7 completed runs carry `trace_complete=1` with no trace row; `run.failed` has two payload shapes in production (a third `timedOut` shape exists only in the executor catch, `manager.ts:157`, with no specimen). These corroborate peer W6-L-07/L-08/L-12; none is a UI lie today (the UI error chip uses `run.errorMessage`, and the Events tab shows raw JSON).

## 11. Raw payload / route-field inspection (mandate item 4)

Representative runs: `run_abf5…` (failed gate, 0 artifacts), `run_2bb2…` (failed budget, agent.failed, 9 steps), `run_95…` (completed, 20 artifacts, 19 steps). Raw responses: `evidence/route-*-snapshot.json`, `route-*-events.json`, `route-*-detail.json`.

Route fields the UI consumes and whether they are present/correct:

| UI field | Source | abf5 | 95 | 2bb2 | Verdict |
|---|---|---|---|---|---|
| status / phase | snapshot.run | failed/done | completed/done | failed/done | correct |
| step count | snapshot.steps.length | 20 | 19 | 9 | correct |
| event rows | `/events` | 108 | 102 | 55 | correct on fresh terminal |
| costUsd | snapshot.run | null (usage $0.299980656) | 0.250781772 | null (usage $0.051138816) | **wrong for failures → RC-1** |
| promptTokens/completionTokens | snapshot.run | null (usage 547696/124569) | 380277/117961 | null (usage rows exist) | **wrong for failures → RC-1** |
| checks.code / durationMs | snapshot.checks | absent | absent | absent | absent by construction → RC-5 |
| limits.maxCostUsd | snapshot.limits | route has no `limits` | same | same | absent → RC-5 |
| errorCode/errorMessage | snapshot.run | GATE_FAILED / "Mandatory verification failed" | — | E_BUDGET_UNKNOWN_RESERVATION / same | correct |
| traceComplete | snapshot.run | false | true | false | correct |
| policyVersionId | snapshot.run | pol_36a0… | pol_36a0… | pol_36a0… | present |

Event payloads inspected: `run.queued{runId,preset}`, `run.started{runId,preset}`, `phase.started{phase,attempt?}`, `phase.completed{phase,status,failed,attempt?}`, `agent.started{stepId,agentId,phase}`, `agent.completed{stepId,agentId,phase,usage}`, `agent.failed{stepId,agentId,phase,code,message}`, `file.written{path,agentId,bytes}`, `route.decided{taskId,agentId,model,thinking,score}`, `context.packed{taskId,tokens,prefixHash,degraded}`, `repair.stalled{reason,attempts}` / `{signature}`, `run.failed{code,checks?}` / `{code,message}`. No payload exceeded the 8 KB truncation branch (`SELECT … LIKE '%truncated%'` → 0 rows). All 20 abf5 agent steps are `succeeded`; the only failures are checks (stub.scan, 16 check rows across 3 verification rounds) — consistent with a gate failure after a full generation phase.

One field-shape note (peer W6-L-13): for live events the UI preview shows the SSE envelope, for persisted rows the bare payload; the Events tab title/type/date fields are unaffected.

## 12. Evidence inventory (SHA-256 prefix, bytes)

```text
c3710e03d124ff13  2454  api-field-audit.json
71a79d699bf5fdcf  1262  checks-tab-probe.json
55d00e4b17ec0e51  2660  probe-checks-console.txt
a9f50a1bc025266d 142033  ui-abf5-checks.png
9df07208a6301420 17769  cost-truth.json
194c24bbbafcdaee 89687  crop-abf5-spend-not-measured.png
7f80e63e6de67fe8 67835  crop-uiwave1-95-header.png
94b2fe9bee65809a 16682  events-route-census.json
491cecf513a1c53d  8932  peer-logic-probe-rerun.txt
4f6438f7e3c94c96  2653  peer-crosscheck.json
90d4d0a53b0a475d  5582  probe-peer-crosscheck-console.txt
f4c6e8fdb30ba338 32060  probe-api.json
e749d2e12995678d 16868  probe-api-console.txt
25f5ceeb93ad64bb  1948  probe-census-console.txt
497a75135a86b2bd  4568  probe-cost-console.txt
ab30ddd7ccfebfc6  5126  probe-field-console.txt
a2e8666d261cf003  6354  probe-static.json
0ba2a0ccbc7eeefe 13172  probe-static-console.txt
8ce647c36e0a3e68 11150  probe-ui.json
43ddf0ce4d9432e2 23182  probe-ui-console.txt
a05c7c84f6f8e448 25700  route-2bb2-detail.json
ac0d664ec14defe2 19625  route-2bb2-events.json
2c20d9f761c17afd 25722  route-2bb2-snapshot.json
2c3ef1bffe0dd6f9 61574  route-abf5-detail.json
4cb739fdf2d27afd 38075  route-abf5-events.json
ae66cf3d0194d3d2 61596  route-abf5-snapshot.json
9ec3ef1859b3eced 15779  sse-2bb2-raw.txt
abd6d47b85a2d3aa 30286  sse-abf5-raw.txt
53e7a41b5d8b5778 140878 ui-2bb2-events.png
8bd8367d56c927f3 140404 ui-95-events.png
8c0f726d16211f3e 139621 ui-abf5-events.png
```

Probe sources (also under `docs/AUDIT-WAVE-6/forge/probes/`): `api-probe.mjs`, `ui-probe.mjs`, `census-probe.mjs`, `cost-probe.mjs`, `static-probe.mjs`, `field-audit.mjs`.

## 13. Reproduction commands (from repo root)

```powershell
node docs/AUDIT-WAVE-6/forge/probes/api-probe.mjs        # API truth, SSE frames, source diff, DB census
node docs/AUDIT-WAVE-6/forge/probes/ui-probe.mjs         # Chrome: DOM vs API, stream/poll observation, EventSource delivery
node docs/AUDIT-WAVE-6/forge/probes/census-probe.mjs     # /events truncation + live-ledger loss for all 25 runs
node docs/AUDIT-WAVE-6/forge/probes/cost-probe.mjs       # runs vs usage vs traces, 7 affected runs
node docs/AUDIT-WAVE-6/forge/probes/static-probe.mjs     # live→terminal selector data flow + prior-fix/e2e coverage
node docs/AUDIT-WAVE-6/forge/probes/field-audit.mjs      # UI-read vs route-provided fields, spend contradiction
node docs/AUDIT-WAVE-6/forge/probes/checks-probe.mjs     # Checks tab duplicate keys / DOM rows / console
& node_modules\.bin\tsx.cmd docs\AUDIT-WAVE-6\logic\probe-routes.ts   # peer probe re-run (temp DB; no prod writes)
node docs/AUDIT-WAVE-6/forge/probes/peer-crosscheck.mjs  # registry/gate-log/trace/payload cross-check
node --import tsx -e "…scanText…"                        # Wave-5 stub-scan recheck (see §9)
```

All probes exit 0; each prints a JSON summary. No probe writes to `data/`, `workspace/`, `vault/`, `logs/`, `src/`, `web/`, `test/` or `e2e/`.

## 14. Limitations / unverified

- No live paid run was started, so the live→terminal transition (RC-2) and the browser 410 loop (U-1) are not observed end-to-end; the static data flow is exhaustive and the missing evidence is named in `root-causes.md`.
- `phase.skipped`/`context.skipped` delivery loss is static-only (0 rows in B2; routing enabled).
- W6-L-08/L-09/L-11 were read from the peer report but not independently probed by this seat.
- No historical backfill was attempted; the 7 affected runs remain NULL by design of this audit (read-only).
