# W6-AUD-05 — Logic-Gatekeeper gate record (Wave 6, task-5)

- **Seat:** independent read-only Logic-Gatekeeper. Skill: `logic-gatekeeper` (loaded before acting).
- **Repo:** `C:\Users\Riley\Desktop\HiveRouter` (B2, 25 runs, no active run at audit time; no `.git`).
- **Write scope:** only `docs/AUDIT-WAVE-6/gate/**`. No `src/`, `web/src/`, `test/`, `e2e/`, config, `package.json`, skills, production DB, `workspace/runs`, `logs/`, `data/`, or `vault/` write. No fixes, no subagents, no git, no paid calls, no server restart.
- **Task:** W6-AUD-05 — gate the 11 approved fixes AF-01…AF-11 in `docs/AUDIT-WAVE-6/capability/FORGEWRIGHT-DIRECTIVE.md`.
- **Timestamp:** 2026-11-03 22:40–23:00 America/Chicago (2026-11-04T04:40–05:00Z).
- **Evidence rule:** every premise below is either (a) re-read in the current source at `file:line`, (b) reproduced by a read-only command in this session, or (c) quoted from a captured evidence file. Anything not reproduced is labelled **UNVERIFIED** and is not used to approve a fix.

> **Bottom line.** **11 approved, 0 rejected.** One is APPROVED (AF-03); ten are APPROVED-WITH-CONDITIONS. No AF requires a new route/table/migration/script/dependency, a paid call, or a historical backfill. One input-integrity defect was found in the directive's provenance narrative (forge files it calls missing are present); it does not invalidate any AF because every source premise was independently re-verified, but it is recorded and the forge program is not used as authority where it conflicts with the source.

---

## 1. Input integrity — findings and corrections

### 1.1 The forge record is **not** missing (directive premise is false)

The directive §0 (`FORGEWRIGHT-DIRECTIVE.md:13`) and `capability-audit.md:104` state that `docs/AUDIT-WAVE-6/forge/patch-proposals.json` and "any handoff file" do not exist. They do exist, and they predate the audit/directive:

```text
Get-ChildItem docs\AUDIT-WAVE-6\forge
handoff.md              16992  11/3/2026 10:33:12 PM
patch-proposals.json    35950  11/3/2026 10:32:35 PM
red-evidence.md         36074  11/3/2026 10:32:45 PM
root-causes.md          36932  11/3/2026 10:32:27 PM
evidence/  probes/
Test-Path patch-proposals.json -> True
Test-Path handoff.md           -> True
ConvertFrom-Json -> valid JSON; proposals=7; ids=P-1..P-7
FORGEWRIGHT-DIRECTIVE.md mtime 10:39:53 PM; capability-audit.md mtime 10:40:12 PM
```

**Consequence:** do not "reconstruct P-1…P-5 from prose" and do not treat the forge program as absent. I read `patch-proposals.json` and `handoff.md` in full. The AF queue remains valid because each AF was verified against source, but the audit's evidence-integrity narrative is wrong and the directive's §0 statement is stale.

### 1.2 What the verified forge file changes (and does not)

| Forge proposal | Disposition in this gate |
|---|---|
| P-1 (terminal usage) | **Superseded by AF-01 + AF-07.** Compatible intent; AF-01's `usageFields` helper is the approved form. P-1's "route the catch through markTerminal" is not required; the directive's patch-the-existing-`updateRun` form is approved so there is exactly one terminal row write. |
| P-2 (Events selector) | **Superseded by AF-03.** Its suggested `e2e` route-interception test is **NOT approved** — the directive forbids faking the live→terminal transition and the audit task forbids fake data. P-2's selector is also superseded by AF-03's object-argument selector. |
| P-3 (event vocabulary) | **Superseded by AF-02.** AF-02's shared `RUN_EVENT_TYPES` registry + `schema`-marker unwrap is stricter than P-3's local list edit. P-3's note to include the `run.ts:885` ternary in the static test is **adopted as a gate condition**. |
| P-4 (`/events` truncation) | **REJECTED as a recipe. Do not implement.** Its `getEvents(id, after, window + 1)` is an ASC `LIMIT`, so it returns the *oldest* `window+1` rows after the cursor; slicing the tail does not yield the newest window for a run with more than `window` rows (CA-05; same flaw as `root-causes.md:184`). AF-04's count+DESC recipe is approved instead. |
| P-5 (cap + check columns) | **Split into AF-05 + AF-10.** P-5's e2e assertion that the column headers are exactly `Check/Status/Mandatory/Detail/File` is not approved because it would edit the pinned run-detail e2e; the unit tests cover the change. |
| P-6 (checks key) | **Superseded by AF-10.** AF-10 returns the DB row identity (`rowId`) instead of an index key; stronger and stable. |
| P-7 (badge) | **Superseded by AF-04.** Approved badge text is **"Artifacts truncated"** (directive AF-04), not P-7's "Artifact list truncated". |

**Reopen evidence for the rejected P-4 recipe:** a replacement that provably returns the newest `window` rows for a run with `> window` events after `after`, and passes the boundary tests in AF-04 (0, 2, exactly 3, 4 with `window=3`, `after` cursor, newest-seq assertion). An ASC `LIMIT window+1` cannot satisfy it.

### 1.3 Other premise corrections (minor, none blocking)

| Claim in the directive | Verified state | Gate action |
|---|---|---|
| AF-01 "Both gate paths" funnel through `markTerminal` | There are **three** gate call sites: `src/server/pipeline/run.ts:341` (review/audit), `:432` (adhoc), `:857` (full build) | No change to the fix; all three inherit `markTerminal`. AF-01 conditions enumerate all three event emits. |
| AF-08 "src/server/app.ts:449-469" | The route opens at `:445`; the item mapping is `:466`; `excluded_json` is never read (`:449-469` range is correct for the pack projection) | No change; anchor on the route block `:445-470`. |
| AF-05 cap provenance | Confirmed: `run_snapshots.snapshot_json.limits` is `config.limits` (global 0.5) via `src/server/runs/snapshot.ts:52-83`; per-run lives in `settings.run_limit:<id>`; `run_23af…` has per-run 0.05 while its snapshot says 0.5 (`evidence-limits.txt`) | AF-05 **must** use `runBudgetUsd(id)`; serving the snapshot value is rejected. |
| AF-06 "31 unregistered codes" | 85 `REFUSALS` keys; 31 distinct `E_*` literals in `src/` are unregistered (including all 22 `E_LLM_*`, `E_CANCELLED`, `E_RUN_TIMEOUT`, `GATE_FAILED`, `E_PROVIDER_*`) | AF-06 fixes identity; it must **not** expand `REFUSALS`. |
| AF-09 "AgentPlanSchema has zero production callers" | Confirmed: only `prompts.ts:48` mentions it, `registry.ts:753` defines it, `test/unit/agents.schemas.test.ts` tests it; no `src/` caller | AF-09 premise stands. |
| Baseline unit suite green | `evidence-test-baseline.txt`: 38 files / 249 tests passed | Quoted; not re-run (read-only gate; running the suite would write `data/logs` as the baseline suite already does). |

---

## 2. Invariant confirmation

| Invariant | Evidence in this gate | Verdict |
|---|---|---|
| Baseline source unchanged (150/150) | Recomputed all `baseline.sha256` entries: `ok=150 mismatch=0 missing=0`. `BASELINE.md` says 150 files. | **CONFIRMED** |
| Stage census `routes:48 tables:45 scripts:24` | `node scripts\assert-stage.mjs --stage=p7 --json` (read-only) → `ok:true, files:150, tables:45, routes:48, scripts:24, violations:[]` | **CONFIRMED** |
| No new route/table/migration/script in the approved set | Walked every AF edit: no `app.get/post/...` addition, no `CREATE TABLE`, no migration group, no `package.json` script. AF-07 adds one `REFUSALS` entry (not a route). New test files increase `files` only; that is allowed and must be reported honestly. | **CONFIRMED** |
| Additive API only | AF-05 adds `limits`; AF-08 adds `included`/`reason` and excluded rows; AF-10 adds `rowId`; AF-01/AF-07 add event keys. **One deliberate exception:** AF-11 omits the fabricated `reason` key when no rationale is derivable (the client type is `reason?: string`; no consumer or e2e pins it). No other key is removed or renamed. | **CONFIRMED WITH ONE SCOPED EXCEPTION** |
| No historical backfill | No AF writes `runs.cost_usd`, `traces`, `agent_evidence`, `checks`, or events for historical rows. AF-01/AF-07 are forward-only; the 7 NULL-cost runs stay NULL. | **CONFIRMED** |
| R-1 refuted (abf5 stale capture) | AF-03 does not change status/step convergence; fresh terminal load path is unchanged. | **PRESERVED** |
| R-2 refuted (`run.cancelled` subscribed) | AF-02 keeps `run.cancelled`; AF-06 preserves the ternary at `run.ts:885`; `manager.ts:186` unchanged. | **PRESERVED** |
| R-3 refuted (stub-scan false positive) | No AF touches `src/server/verify/**` or the scanner. | **PRESERVED** |
| `e2e/api-contract.spec.ts:62-64` pin | No AF changes the unknown-route handler or the pin; AF-04 does not touch `/api/nope`. | **PRESERVED** |
| `e2e/ui-audit.spec.ts:127-147` terminal-no-SSE pin | AF-03 keeps `useRunStream(run && !terminal …)`; AF-04/AF-08/AF-10 do not open a stream for terminal runs. No edit to that test. | **PRESERVED** |
| P7 / learning refused, no data | No AF edits `src/server/learning/**`, no promotion/consent/sealed-pool code, no learning seed. `/api/learning/overview` refusal is untouched. | **PRESERVED** |
| No secrets / no fake data / no paid run | No AF adds key material or a provider call. Tests use DB/HTTP doubles only; no seed rows are used as production proof. | **CONFIRMED** |

---

## 3. Gate summary

| AF | P | Verdict | Primary files | Conditions (count) | Blockers |
|---|---|---|---|---|---|
| AF-01 | P1 | **APPROVED-WITH-CONDITIONS** | `src/server/runs/recorder.ts`, `src/server/runs/manager.ts`, `src/server/pipeline/run.ts`, `test/unit/terminal-usage.test.ts` | 8 | none |
| AF-02 | P1 | **APPROVED-WITH-CONDITIONS** | `src/shared/run-events.ts`, `web/src/hooks/useApi.ts`, `test/unit/event-contract.test.ts` | 8 | none |
| AF-03 | P1 | **APPROVED** | `src/shared/run-events.ts`, `web/src/pages/RunDetailPage.tsx`, `test/unit/run-events-selection.test.ts` | 0 blocking (receipt note: live transition unverified) | none |
| AF-04 | P2 | **APPROVED-WITH-CONDITIONS** | `src/server/runs/recorder.ts`, `src/server/app.ts`, `web/src/pages/RunDetailPage.tsx`, `test/unit/events-window.test.ts` | 6 | none |
| AF-05 | P2 | **APPROVED-WITH-CONDITIONS** | `src/server/app.ts`, `test/unit/snapshot-limits.test.ts` | 5 | none |
| AF-06 | P2 | **APPROVED-WITH-CONDITIONS** | `src/shared/refusals.ts`, `src/server/pipeline/run.ts`, `src/server/runs/manager.ts`, `test/unit/error-code.test.ts`, `test/unit/terminal-error-code.test.ts` | 6 | none |
| AF-07 | P2 | **APPROVED-WITH-CONDITIONS** | `src/shared/refusals.ts`, `src/shared/run-events.ts`, `src/server/runs/manager.ts`, `test/unit/startup-interrupt.test.ts`, `test/unit/logic-core.test.ts` (isolation only) | 6 | none |
| AF-08 | P2 | **APPROVED-WITH-CONDITIONS** | `src/server/app.ts`, `web/src/pages/RunDetailPage.tsx`, `test/unit/context-excluded.test.ts` | 5 | none |
| AF-09 | P2 | **APPROVED-WITH-CONDITIONS** | `src/server/agents/registry.ts`, `src/server/pipeline/run.ts`, `web/src/pages/AgentsPage.tsx`, `test/unit/agent-plan-contract.test.ts` | 6 | none |
| AF-10 | P3 | **APPROVED-WITH-CONDITIONS** | `src/shared/types.ts`, `src/server/runs/recorder.ts`, `web/src/pages/RunDetailPage.tsx`, `test/unit/checks-identity.test.ts` | 5 | none |
| AF-11 | P3 | **APPROVED-WITH-CONDITIONS** | `src/server/app.ts`, `test/unit/routing-reason.test.ts` | 5 | none |

Counts: **11 approved** (1 clean + 10 with conditions), **0 rejected**, **12 new test files**, **1 existing test file isolated (assertions unchanged)**.

### 3.1 Writer order and collisions (one writer, strict order)

Approved order: **AF-01 → AF-02 → AF-03 → AF-04 → AF-05 → AF-06 → AF-07 → AF-08 → AF-09 → AF-10 → AF-11**. Do **not** parallelize.

Files touched by more than one AF (implement in this order; later fixes must preserve earlier edits):

| File | AFs | Conflict note |
|---|---|---|
| `src/server/pipeline/run.ts` | AF-01, AF-06, AF-09 | AF-01 edits the catch `updateRun`/event and gate emits; AF-06 edits the code mappers at `:233-234`/`:871-875`; AF-09 edits the adhoc plan branch `:404-407`. AF-06 must not remove AF-01's payload/cost fields. |
| `src/server/runs/manager.ts` | AF-01, AF-06, AF-07 | AF-01 edits `markTerminal`, the executor catch and the no-controller cancel; AF-06 edits the executor catch's code line; AF-07 rewrites `markStartupInterrupted`. AF-06 must preserve AF-01's `usageFields`/event additions. |
| `src/server/runs/recorder.ts` | AF-01, AF-04, AF-10 | AF-01 adds `usageFields`; AF-04 adds `countEventsAfter`/`getRecentEvents`; AF-10 changes `getChecks`. Disjoint functions. |
| `src/server/app.ts` | AF-04, AF-05, AF-08, AF-11 | Four disjoint route blocks: events `:818-833`, snapshot `:802-816`, context `:445-470`, routing `:371-428`. |
| `src/shared/run-events.ts` | AF-02, AF-03, AF-07 | AF-02 defines `RUN_EVENT_TYPES`/`RESERVED_EVENT_TYPES`/`STREAM_EVENT_TYPES`/`normaliseStreamEvent`; AF-03 adds the selector; AF-07 appends `run.interrupted` to `RUN_EVENT_TYPES`. AF-07 must not duplicate `STREAM_EVENT_TYPES`. |
| `src/shared/refusals.ts` | AF-06, AF-07 | AF-06 adds `codeOfError`; AF-07 adds `E_RUN_INTERRUPTED`. Disjoint. |
| `web/src/pages/RunDetailPage.tsx` | AF-03, AF-04, AF-08, AF-10 | Selector `:133`; badge `:330`; context `:768,823-844`; checks `:640-660`. Disjoint blocks. |
| `test/unit/logic-core.test.ts` | AF-07 only | Isolation edit (redirect `config.dataDir`) only; assertions unchanged. |
| New test files | one per AF; AF-06 has two (12 total) | No two AFs write the same new file. |

No two fixes write the same **new** test file. The directive's example "run.ts touched by AF-01/06/07" is slightly off: AF-07 touches `manager.ts`, not `run.ts`; the real triples are `run.ts` (01/06/09) and `manager.ts` (01/06/07).

---

## 4. Per-fix Phase-1 and Phase-2 records

The Phase-1 object is the skill's required pre-write record: `architecture`, `dataFlow`, `edgeCases`, `rootCause`. The Phase-2 object records the gate checks: entry validation, callers, fail-closed, tests, rollback. "Verdict" follows the Phase-2 record.

---

### AF-01 (P1) — Terminal runs record the usage they actually spent

**Phase-1**

```json
{
  "phase1": {
    "architecture": "Terminal run rows are written by four writers: markTerminal (used by the three gate-fail sites), the executeRun catch updateRun (run.ts:884), the executor-rejection catch in manager.ts:150-157, and the no-controller cancel in manager.ts:179-185. Usage is recorded per provider call in the usage table by insertUsage (recorder.ts:332-353) and aggregated honestly by usageTotals (recorder.ts:355-378). Only finalize() (run.ts:1075-1084) currently copies the aggregate to the run row.",
    "dataFlow": "Provider onHttpAttemptEnd -> insertUsage(runId, stepId, agentId, usage) -> usage table. Terminal writer -> updateRun({cost_usd,prompt_tokens,completion_tokens}) -> runs row -> GET /api/runs/:id/snapshot -> RunDetailPage CostMeter. The event path goes markTerminal/emitEvent -> events.payload_json -> SSE or GET /events.",
    "edgeCases": [
      "zero usage rows: all three fields NULL, never 0",
      "one source='unknown' row: all three NULL (usageTotals contract)",
      "two provider rows: exact SUM (use approximate float assertions)",
      "duplicate terminal write (markTerminal called twice): same sum, last-write-wins, one terminal state",
      "executor rejection after an earlier terminal row: same sum, no double count (usage rows are per call, not per terminal write)",
      "budget_exceeded: the spend that tripped the cap is written",
      "cancelled via controller: only completed calls are summed",
      "cancelled with no controller: no usage rows -> NULL",
      "raw message equals code for a bare Error('E_PROVIDER_EMPTY'): the event message must still be human, not a copy of the code"
    ],
    "rootCause": "Only finalize() copies usageTotals into the run row, so every other terminal writer (gate fail via markTerminal, the executeRun catch, executor rejection, and no-controller cancel) leaves runs.cost_usd/prompt_tokens/completion_tokens NULL even though provider usage rows exist, which makes the run detail print 'Not measured' for measured spend."
  }
}
```

**Phase-2**

| Gate check | Record |
|---|---|
| Entry validation | No new untrusted input. `usageFields(runId)` queries by run id; unknown run is handled by the existing 404 at the route. Malformed usage is already normalized by `insertUsage`. |
| Callers stable | `markTerminal` signature unchanged; `updateRun` patch is additive; `usageTotals` unchanged; `finalize`/`run.completed` unchanged. The executor catch keeps its `status:'failed'` and `timedOut` classification. |
| Fail-closed | Unknown usage stays NULL (not 0); no terminal row claims spend it does not know. A missing usage row cannot be mistaken for zero. |
| Reproduction | SUPPORTED: production DB evidence (`evidence-db-probe.txt`: 7 runs / $0.606852192 unreported; abf5 20 usage rows / $0.299980656) and the peer probe `failure branch` RED. Source re-read at every writer. |
| Exact lines verified | `run.ts:853-861` gate, `:868-888` catch (`:884` updateRun), `:341,432,857` markTerminal, `:342,433,858` emits, `:1075-1084` finalize; `manager.ts:150-157,179-185,250-258`; `recorder.ts:355-378`. |
| Tests expected | New `test/unit/terminal-usage.test.ts`: (1) two provider rows -> SUM; (2) unknown row -> all NULL; (3) no rows -> all NULL; (4) duplicate markTerminal -> unchanged; (5) `app.inject` snapshot `run.costUsd` == SUM (host header `127.0.0.1:${config.port}`); (6) a real `run.failed` event payload has `costUsd` and `message !== code`; (7) temp `config.dataDir`/`config.workspaceDir`, restore in `finally`; (8) an unregistered bare code (`E_PROVIDER_EMPTY`) still yields a human message. |
| Rollback | Revert `recorder.ts` (`usageFields`), `manager.ts` (three patches), `run.ts` (catch + three gate emits), and delete the new test file. No schema/data impact; rows already written keep their values; historical rows stay NULL. |
| Verdict | **APPROVED-WITH-CONDITIONS** |

**Binding conditions**

1. `usageFields(runId)` must be a thin mapping of `usageTotals` to `{cost_usd,prompt_tokens,completion_tokens}`; do not duplicate the SQL and do not change `usageTotals` semantics or its cache/reasoning fields.
2. Apply usage fields to **all four** terminal writers: `markTerminal`, `run.ts` catch, manager executor catch, manager no-controller cancel. The directive's bullet list is not the whole set; the semantics sentence is.
3. Add `costUsd` and a human `message` to **all** terminal `run.failed`/`run.cancelled` emits: `run.ts:342,433,858,885` and `manager.ts:157,186`. A gate emit's `message` is the same sentence already passed to `markTerminal` (`Mandatory verification failed` / `Single-agent verification failed`). For the catch emits, if the raw message equals the code, use `REFUSALS[code].message` when the code is registered; if the code is unregistered, use a status-aware sentence (`The run failed with <code>.` / `The run was cancelled.`). **Never** emit the code as the message for a bare `Error('E_PROVIDER_EMPTY')`, `E_PROVIDER_TRUNCATED`, or `E_CANCELLED`. Keep `redactString(...).slice(0,500)`.
4. Do not change the status mapping, `run.completed` payload, `budget_reservations`, `/api/stats`, the historical 7 rows, or the `usageTotals` contract.
5. Test #6 must drive a real production path without a paid call: use `createRun` + `setExecutor(executeRun)` with `preset:'revise'` and no parent (throws `E_INVALID_PARENT` inside the try, exercising `run.ts:884-885`), and/or `createRun` + an executor that rejects (exercising `manager.ts:150-157`). Do **not** call `emitEvent` by hand and claim it proves the production path. The three gate emits are covered only by code inspection; the receipt must say so.
6. New tests must redirect `config.dataDir` and, if `createRun` is used, `config.workspaceDir` to `fs.mkdtempSync` and restore in `finally`; no writes to `data/**`, `workspace/**`, `logs/**`.
7. Use approximate float assertions (`toBeCloseTo`) for summed REAL columns.
8. Do not add a new source file; put `usageFields` in `src/server/runs/recorder.ts`. No dependency, route, table, migration, or script.

**Risks (accepted):** the gate-path event payload is not runtime-tested without a provider call; the receipt must mark it unverified. The `costUsd` in an event is computed after the row write; at terminal time no in-flight usage writer exists on these paths, so row and event agree in practice.

---

### AF-02 (P1) — One event vocabulary: subscribe to everything the server emits, and deliver the payload

**Phase-1**

```json
{
  "phase1": {
    "architecture": "The server writes every run event through emitEvent (recorder.ts:36-51) and names every SSE frame (app.ts:853-857). The client subscribes by name in useApi.ts:72-100/143-144; EventSource dispatches named frames only to registered listeners, so unlisted names are dropped and onmessage never fires. The live handler stores the whole envelope (useApi.ts:124-140) while the persisted mapper stores row.payload (run-events.ts:19-25).",
    "dataFlow": "emitEvent -> events.payload_json -> SSE frame {schema:'hive.api.v1',type,data,meta} or GET /events row {type,payload,createdAt} -> useRunStream/ mapPersistedRunEvents -> RunStreamEvent{type,data,receivedAt} -> Events tab.",
    "edgeCases": [
      "non-JSON frame: keep raw text, no throw",
      "frame without an event: name (onmessage): type must remain 'run.event'",
      "heartbeat: SSE comment, must never become a named event",
      "payload that itself has a data key but no schema marker: must NOT be unwrapped",
      "envelope with schema and data but a non-string type: fall back to the frame name",
      "emitEvent ternary (run.cancelled/run.failed): the static test must still see both literals",
      "after AF-07: run.interrupted is a 17th emitted type and must be in the registry"
    ],
    "rootCause": "The client's hard-coded subscription list (useApi.ts:72-100) omits five types the server really emits (run.queued, agent.failed, phase.skipped, context.skipped, repair.stalled), and the handler stores the SSE envelope instead of the inner payload, so a live page silently drops those rows and renders a different data shape than the persisted ledger."
  }
}
```

**Phase-2**

| Gate check | Record |
|---|---|
| Entry validation | `normaliseStreamEvent` accepts `unknown`; non-record/null/array/string return `{type:rawType,data:rawData}` and never throw. The handler keeps its try/catch JSON parse and raw-text fallback. |
| Callers stable | `useRunStream(runId,onEvent)` unchanged; `mapPersistedRunEvents` unchanged; `/stream` route unchanged. |
| Fail-closed | An emitted type missing from the registry fails the static contract test instead of being silently dropped; a payload without the schema marker is not unwrapped. |
| Reproduction | SUPPORTED: `evidence-events.txt` (16 emitted / 27 subscribed / overlap 11 / 5 missing), browser probe 106/108, 53/55, 101/102; source re-read. |
| Exact lines verified | `useApi.ts:72-100` list, `:124-144` handler, `:143` registrations; `app.ts:854` named frame; `run-events.ts:19-25`; emit sites incl. `run.ts:885` ternary and `manager.ts:157,186`. |
| Tests expected | New `test/unit/event-contract.test.ts`: (1) every `emitEvent` type literal in `src/server/**/*.ts` ∈ `RUN_EVENT_TYPES` (including the ternary; see condition 5); (2) every `RUN_EVENT_TYPES` member ∈ `STREAM_EVENT_TYPES`, no duplicates; (3) the five previously-missing names are present; (4) envelope unwrap returns `{type:'agent.failed',data:{code:'E_LLM_RATE_LIMIT'}}`; (5) plain payload/non-record/string no-throw; payload with `data` key but no `schema` not unwrapped. |
| Rollback | Revert `src/shared/run-events.ts` additions and `useApi.ts` handler/list; delete the new test. No API change. |
| Verdict | **APPROVED-WITH-CONDITIONS** |

**Binding conditions**

1. `RUN_EVENT_TYPES` is the authoritative emitted set. It must include the 16 current types and, after AF-07, `run.interrupted`. The final comment must not say "16 emitted" once AF-07 lands.
2. `RESERVED_EVENT_TYPES` keeps the 16 currently-subscribed-never-emitted names including `heartbeat` (D-24: do not delete listeners). `STREAM_EVENT_TYPES = [...RUN_EVENT_TYPES, ...RESERVED_EVENT_TYPES]` with no duplicates.
3. `normaliseStreamEvent` unwraps only records with `schema === 'hive.api.v1'` **and** a `data` property; otherwise returns the raw type/data. It must not import React or any client-only module.
4. The handler must keep: JSON parse with raw fallback; heartbeat filter; `receivedAt: new Date().toISOString()`; `source.onmessage = handler`; and the **`event.type === 'message' → 'run.event'`** mapping (the directive's edge case requires it, although the change bullet omits it).
5. The static test must extract **all** `emitEvent` type literals, including the `run.ts:885` ternary (`run.cancelled`/`run.failed`) and manager literals. A regex that only matches a string literal in the second argument is insufficient.
6. No new event type in AF-02; AF-07 owns `run.interrupted`. Do not change `mapPersistedRunEvents`, the SSE route, or the 5 s poll.
7. Do not delete or rename the reserved listeners; do not add server emitters for them.
8. No new dependency/file; no API change.

**Risks (accepted):** a payload with `type`/`data` keys but no `schema` is now treated as a raw payload (intentional; prevents spoofing the event name). The live delivery of the five types is proven by the probe's listener counts, not by a live run watched in this gate (no paid run).

---

### AF-03 (P1) — The terminal Events tab shows the persisted ledger

**Phase-1**

```json
{
  "phase1": {
    "architecture": "RunDetailPage keeps a 100-row live buffer in state (RunDetailPage.tsx:99,116-119,136) and fetches GET /events when terminal (:129-132). The display selector (:133) prefers any non-empty live array over the persisted ledger; the heading/description (:1009-1013) already claim the persisted ledger.",
    "dataFlow": "useRunStream -> setEvents(prev.slice(-99)+event) -> visibleEvents. At terminal: getRunEvents -> mapPersistedRunEvents -> persistedEvents.data. EventsTab receives visibleEvents + persistedEvents.loading/error.",
    "edgeCases": [
      "terminal=true, live=100, persisted=108 -> 108",
      "terminal=true, live=100, persisted=0 -> 0 (honest ledger empty state)",
      "terminal=false, live=100, persisted=108 -> 100 (persisted not fetched)",
      "terminal=false, live=0, persisted=0 -> 0",
      "terminal + persisted loading -> loading panel, not empty table",
      "terminal + persisted error -> ErrorPanel",
      "runId change -> events reset as today",
      "fresh terminal load -> unchanged (existing e2e)"
    ],
    "rootCause": "visibleEvents = events.length > 0 ? events : persistedEvents.data ?? [] keeps an in-memory live buffer (capped at 100 and missing the five unsubscribed types) even after the run becomes terminal, so the fetched 108-row ledger is discarded while the heading says 'Persisted events'."
  }
}
```

**Phase-2**

| Gate check | Record |
|---|---|
| Entry validation | Typed arrays; the caller passes `persistedEvents.data ?? []`; no untrusted input. |
| Callers stable | No API change; `useRunStream`/`getRunEvents` unchanged; the stream remains disabled at terminal (`:135`). |
| Fail-closed | At terminal the persisted ledger (or its honest empty/error state) wins; a stale live buffer can no longer masquerade as the persisted ledger. |
| Reproduction | SUPPORTED static truth table (`probe-static.json`, `weaver/findings.md:252`). The live→terminal transition is **UNVERIFIED** by design (no non-terminal run; paid runs forbidden). |
| Exact lines verified | `:99,116-119,129-133,136,1009-1013`; e2e `trace-fixes.spec.ts:4-23` is fresh-terminal only. |
| Tests expected | New `test/unit/run-events-selection.test.ts`: four-case truth table. Existing `e2e/trace-fixes.spec.ts` stays green. No route-interception test. |
| Rollback | Revert the selector export/import and the one-line call site; delete the new test. |
| Verdict | **APPROVED** |

**Receipt requirements (not blocking conditions):** state that the live→terminal transition remains unverified; do not fake it with a live run, a route-intercepted "running then failed" sequence, or seed data. The forge P-2 e2e route-interception proposal is **not approved**.

---

### AF-04 (P2) — `/events` truncation means "this run's events were dropped"

**Phase-1**

```json
{
  "phase1": {
    "architecture": "events.seq is one AUTOINCREMENT sequence for every run (migrations.ts:54-61). GET /api/runs/:id/events (app.ts:818-833) computes start = max(after, current-window) from the per-run last seq but the seq values are global, then fetches ASC and compares counts. getEvents (recorder.ts:58-69) is ASC LIMIT.",
    "dataFlow": "request after -> clamp -> (count of this run's rows with seq>after) -> newest window rows -> {events,truncated,lastEventId} -> web getRunEvents maps rows only (it drops truncated/lastEventId).",
    "edgeCases": [
      "after=0, run has 0/2/exactly-window/window+1 events",
      "after at the last seq -> {events:[],truncated:false,lastEventId:current}",
      "after negative or NaN -> 0 (existing clamp)",
      "after future cursor -> no rows, truncated=false, lastEventId=current",
      "a run whose first seq is far above the window -> false (historical false positive)",
      "concurrent append between count and fetch: truncated must still mean 'a row with seq>after was not returned' and rows must be the newest window"
    ],
    "rootCause": "The route derives the replay window from the global AUTOINCREMENT seq instead of counting this run's rows, so any short run after the shared ledger passes ~500 rows reports truncated:true while returning every row (24/25 runs; abf5 108/108)."
  }
}
```

**Phase-2**

| Gate check | Record |
|---|---|
| Entry validation | Keep `Math.max(0, Number(query.after ?? 0) || 0)`; unknown run 404 `E_RUN_NOT_FOUND` unchanged; `window` from config. |
| Callers stable | Response keys unchanged; `web/src/api.ts:327-332` unchanged; `/stream` untouched; no new route. |
| Fail-closed | `truncated` is true only when at least one row with `seq>after` was not returned; rows are the newest window (or all). No false truncation on complete replays. |
| Reproduction | SUPPORTED: 24/25 census + throwaway-DB probe (`red-probes.md` probe 4); source re-read. |
| Exact lines verified | `app.ts:818-833`; `recorder.ts:58-69`; `RunDetailPage.tsx:330`. |
| Tests expected | New `test/unit/events-window.test.ts`, `config.limits.eventReplayWindow=3` (save/restore), `app.inject` with host header: 0/2/3/4 events; assert count, `truncated`, `lastEventId`, and the newest 3 seqs for 4; an `after`-cursor case; after=last; negative/NaN. |
| Rollback | Revert `app.ts` events block, remove the two recorder helpers, revert the badge text, delete the new test. |
| Verdict | **APPROVED-WITH-CONDITIONS** |

**Binding conditions**

1. Add `countEventsAfter(runId, after)` and `getRecentEvents(runId, after, limit)` to `src/server/runs/recorder.ts`; `getRecentEvents` uses `ORDER BY seq DESC LIMIT ?` then reverses and uses the same row mapping as `getEvents`.
2. Compute truncation and rows from a **consistent** snapshot: either one SQL statement using `COUNT(*) OVER ()` on the DESC query, or a read transaction covering count+fetch. A plain count-then-ASC-fetch can under-report truncation when a run appends between the two reads; that violates the stated invariant. The rows must always be the newest window.
3. Keep the `after` clamp; `truncated = total > returned.length` (or equivalent); `lastEventId` = last returned seq else `lastEventId(id)`; unknown run 404 unchanged.
4. Keep the response keys exactly `{events,truncated,lastEventId}`; do not change `GET /stream`; do not add an events badge in this batch.
5. UI badge text must be exactly **"Artifacts truncated"** (driven by `snapshot.truncated`, the 200-artifact cap). Do not use forge P-7's "Artifact list truncated".
6. **Do not implement forge P-4** (`getEvents(id, after, window + 1)` + slice). It is an ASC query and returns the oldest window for `>window` runs. Tests: `window=3`, 4 events -> returned seqs are the newest 3; exactly 3 -> `truncated=false`; 0 -> `lastEventId=0`; `after` at the last seq -> empty/false/current.

**Risks (accepted):** the count/fetch consistency condition is a hardening requirement; the current UI calls `/events` only for terminal runs, so the race is not currently reachable through the page, but the API contract is general and must hold.

---

### AF-05 (P2) — Snapshot serves the per-run cost cap

**Phase-1**

```json
{
  "phase1": {
    "architecture": "GET /api/runs/:id/snapshot (app.ts:802-816) returns run/lastEventId/steps/checks/artifacts/truncated but no limits. The UI reads snapshot.limits.maxCostUsd (RunDetailPage.tsx:199-201) and CostMeter appends the cap only when numeric (ui.tsx:606-613). runBudgetUsd (budget.ts:44-46) reads settings.run_limit:<id> and clamps to config.limits.maxRunCostUsd via scopeCap (budget.ts:20-37). run_snapshots.snapshot_json.limits is config.limits (snapshot.ts:52-83), i.e. the global cap, not the per-run cap.",
    "dataFlow": "settings.run_limit:<runId> -> scopeCap('user',runId) -> runBudgetUsd -> snapshot.limits.maxCostUsd -> RunDetailPage readNumber -> CostMeter capUsd.",
    "edgeCases": [
      "no run_limit row -> config.limits.maxRunCostUsd",
      "run_limit above global -> min() clamps to global",
      "run_limit 0.03 -> 0.03 (not 0.5)",
      "unknown run -> 404 E_RUN_NOT_FOUND unchanged",
      "all six pre-existing snapshot keys still present"
    ],
    "rootCause": "The snapshot route never serves the cap the UI reads, and the only persisted cap in run_snapshots is the global config cap, so the run detail can never display the truthful per-run cap."
  }
}
```

**Phase-2**

| Gate check | Record |
|---|---|
| Entry validation | `runBudgetUsd` validates the stored JSON, requires finite >0, and clamps; invalid/missing rows fall back to the global cap. Unknown run 404. |
| Callers stable | Additive key; no route change; Settings page untouched (D-20). |
| Fail-closed | The cap is never null/undefined; a malformed run_limit falls back to the global cap; the global cap is never presented as a per-run cap. |
| Reproduction | SUPPORTED: live snapshot key dump + `evidence-limits.txt` (run_23af per-run 0.05 vs snapshot 0.5; abf5 0.5/0.5). |
| Exact lines verified | `app.ts:14` import, `:802-816`; `budget.ts:20-46`; `RunDetailPage.tsx:199-201`; `ui.tsx:607`; `snapshot.ts:52-83`. |
| Tests expected | New `test/unit/snapshot-limits.test.ts`: `run_limit` 0.03 -> 0.03; no row -> config global; run_limit above global -> clamped; the six old keys still present; unknown run 404. Optional e2e only if it does not modify the pinned `e2e/ui-audit.spec.ts:127-147`. |
| Rollback | Revert the one `limits` line; no schema/data effect. |
| Verdict | **APPROVED-WITH-CONDITIONS** |

**Binding conditions**

1. Use `runBudgetUsd(id)` **only**. Serving `run_snapshots.snapshot_json.limits.maxRunCostUsd` / the global config cap is **rejected** (this is the CA-04 provenance correction).
2. Add exactly `limits: { maxCostUsd: runBudgetUsd(id) }`; keep every existing snapshot key; no route/method change; no Settings change.
3. The value must never be `null`/`undefined`; malformed `run_limit` falls back to the global cap; above-global is clamped by `scopeCap`.
4. Do not modify the pinned e2e block. If an e2e assertion is added, it must be outside `:127-147` and must not change the terminal-no-SSE assertions; skipping the optional e2e is acceptable (the unit test is the required proof).
5. Additive only.

---

### AF-06 (P2) — Preserve the provider error code through every terminal writer

**Phase-1**

```json
{
  "phase1": {
    "architecture": "LlmError carries the failure identity in .code (client.ts:63-80) and prose in .message. Three mappers derive the code from the message prefix: agentStep (run.ts:231-235: step.error_code and agent.failed), the executeRun catch (run.ts:868-888), and the manager executor catch (manager.ts:145-157).",
    "dataFlow": "provider/agent error -> chatJson throws LlmError(code,prose) -> agentStep finishStep/emitEvent -> rethrow -> executeRun catch -> runs.error_code/run.failed; or executor rejection -> manager catch -> runs.error_code/run.failed. recordError receives the same code.",
    "edgeCases": [
      "LlmError('E_LLM_RATE_LIMIT', prose) -> E_LLM_RATE_LIMIT in run/step/event",
      "bare Error('E_PROVIDER_EMPTY') -> E_PROVIDER_EMPTY",
      "Error('E_AGENT_OUTPUT_MISMATCH: x') -> E_AGENT_OUTPUT_MISMATCH (not the full message)",
      "a code with lowercase/punctuation -> ignored; message prefix or E_INTERNAL",
      "AbortError with prose -> E_INTERNAL; status still cancelled via signal.aborted",
      "non-Error throw -> String(error) prefix or E_INTERNAL",
      "a Node errno object {code:'ENOENT'} must not become a run error code"
    ],
    "rootCause": "The mappers read the human message (message.startsWith('E_')) instead of LlmError.code, so a provider failure with a prose message (e.g. 'DeepSeek rate limit reached after 3 attempts.') is persisted and emitted as E_INTERNAL, losing the provider identity in runs.error_code, steps.error_code, and the run.failed/agent.failed payloads."
  }
}
```

**Phase-2**

| Gate check | Record |
|---|---|
| Entry validation | `codeOfError(error: unknown)` accepts anything; validates the code as a string with the `E_` shape; non-Error and null safe; never throws. |
| Callers stable | Helper only; the three mapper signatures and the error/status messages are unchanged; HTTP error mapping (`app.ts:992-1004`) untouched; `recordError` behavior untouched. |
| Fail-closed | A code that does not match the shape falls back to the message prefix then `E_INTERNAL`; the status map remains failed/cancelled/budget_exceeded as today. |
| Reproduction | SUPPORTED: peer probe `run.errorCode=E_INTERNAL, event.code=E_INTERNAL` for `LlmError('E_LLM_RATE_LIMIT', prose)`; source re-read; no production provider-failure specimen (unverified runtime). |
| Exact lines verified | `client.ts:63-80`; `run.ts:231-235,868-888`; `manager.ts:145-157`; `refusals.ts:9-105`. |
| Tests expected | New `test/unit/error-code.test.ts`: the six cases + `ENOENT`. New `test/unit/terminal-error-code.test.ts`: `initDb(':memory:')`, `setExecutor(() => Promise.reject(new LlmError('E_LLM_RATE_LIMIT', 'DeepSeek rate limit reached after 3 attempts.')))`, `createRun`, await a tick, assert `getRun(id).errorCode === 'E_LLM_RATE_LIMIT'` and the `run.failed` payload code; restore executor and temp `config.dataDir`/`workspaceDir` in `finally`. |
| Rollback | Revert `refusals.ts` helper and the three mapper call sites; delete the two new tests. No schema/data change. |
| Verdict | **APPROVED-WITH-CONDITIONS** |

**Binding conditions**

1. Add `codeOfError` to `src/shared/refusals.ts`; the first branch must require the **`E_` prefix** (`/^E_[A-Z0-9_]+$/`), not merely uppercase. Node errno codes (`ENOENT`, `ECONNREFUSED`, `ENOSPC`) must not become run error codes; they fall through to the message prefix and then `E_INTERNAL`. The directive's looser `/^[A-Z][A-Z0-9_]*$/` is **not approved**.
2. Use the helper in exactly the three mappers. Preserve precedence: the `signal.reason` `E_RUN_TIMEOUT` check first in `run.ts`; `timedOut` first in `manager.ts`; do not change the status mapping (`E_RUN_TIMEOUT → failed`, aborted/`E_CANCELLED → cancelled`, `E_BUDGET_EXCEEDED → budget_exceeded`).
3. Do **not** expand `REFUSALS` in this batch; all 31 unregistered codes stay unregistered. Do not change provider/agent messages or redaction.
4. Keep `recordError`, `app.ts:992-1004`, and the HTTP classification unchanged.
5. The test must cover the `ENOENT` case; the run.ts mapper is runtime-unverified because a provider failure needs a paid call — state it in the receipt. The manager mapper is exercised by the executor rejection test.
6. No new file/dependency; `run.ts:233-234` now persists the **code**, not the full prefixed message, for `steps.error_code` (this is the intended identity restoration).

**Risks (accepted):** an LlmError with a code but a message whose prefix is a different `E_` code is now classified by `.code` (correct). `E_LLM_*` codes remain non-HTTP/registry codes; the UI error chip will display the code, which is the truthful identity.

---

### AF-07 (P2) — `interrupted` is an explained terminal state

**Phase-1**

```json
{
  "phase1": {
    "architecture": "markStartupInterrupted (manager.ts:192-204) is called once at startup (index.ts:43) before the server listens. It selects active run ids and performs one bulk UPDATE to interrupted (no error code/message/event/log), then releases reservations. index.ts logs the returned count.",
    "dataFlow": "startup -> initDb -> recoverFinalizeDirectories -> markStartupInterrupted -> SELECT active ids -> UPDATE runs(status=interrupted,phase=done,finished_at) -> releaseReservationsForRun -> return changes. No event or log is emitted today.",
    "edgeCases": [
      "zero active runs -> return 0, no events/logs",
      "one queued and one running run -> one run.interrupted event each, one log record each",
      "second call -> 0 (the non-terminal WHERE excludes them)",
      "unknown usage for an interrupted run -> costUsd null",
      "a run that becomes terminal between SELECT and UPDATE must not be downgraded",
      "existing logic-core test expects a return of 1 and released reservations"
    ],
    "rootCause": "markStartupInterrupted writes the interrupted status with a bare UPDATE, so the run is terminal but carries no error_code/error_message, emits no event, and leaves no error-log record; a page opened after a restart shows 'Interrupted' with no explanation and the error ledger has no entry."
  }
}
```

**Phase-2**

| Gate check | Record |
|---|---|
| Entry validation | No untrusted input; ids come from the DB. The terminal message is a constant from `REFUSALS`. |
| Callers stable | `index.ts:43` call unchanged; return value is still the count; `releaseReservationsForRun` still runs after the terminal write; no route change. |
| Fail-closed | Every row that becomes `interrupted` is explained (code+message), has exactly one `run.interrupted` event, appears in `errors.jsonl`, and releases its reservations; a row not actually transitioned is not rewritten. |
| Reproduction | SUPPORTED: peer probe `status=interrupted, error_code=null, error_message=null, events=0`; source re-read; **0 production interrupted rows**, so forward-only (no specimen). |
| Exact lines verified | `manager.ts:192-204`; `index.ts:43`; `state-machines.md` rows 36/48; existing `logic-core.test.ts:175-196`. |
| Tests expected | New `test/unit/startup-interrupt.test.ts`: one queued + one running (1 usage row); temp `config.dataDir`; call; assert rows' status/error_code/error_message; exactly one `run.interrupted` per run with code and costUsd; two `source:'run'` records in `temp/logs/errors.jsonl`; second call returns 0 and writes nothing. Existing `logic-core.test.ts` interrupt case must still return 1 and release reservations, with `config.dataDir` isolated. |
| Rollback | Revert the `E_RUN_INTERRUPTED` entry, the `run.interrupted` registry entry, and the `markStartupInterrupted` body; delete the new test; revert the isolation-only edit in `logic-core.test.ts`. No schema/data change. |
| Verdict | **APPROVED-WITH-CONDITIONS** |

**Binding conditions**

1. Add only `E_RUN_INTERRUPTED: { http: 409, exit: 4, retryable: false, message: 'The run was interrupted by a server restart.' }` to `REFUSALS`; add `'run.interrupted'` to `RUN_EVENT_TYPES` (no other event type).
2. Preserve the conditional transition guard: only rows still in `('queued','running','paused','needs_review')` are transitioned; do not use an unconditional per-id update that could downgrade a run that finished between SELECT and UPDATE. Emit/log/release only rows actually transitioned. Return the count of transitioned rows.
3. Order per row: terminal row write (status, phase, finished_at, error_code, error_message, usage fields) → exactly one `run.interrupted` event with `code`, `message`, `costUsd` → `recordError({source:'run', code:'E_RUN_INTERRUPTED', message, runId})` → `releaseReservationsForRun(id)`.
4. Use the `REFUSALS.E_RUN_INTERRUPTED.message` constant for both `error_message` and the event/log message; `costUsd` is `usageFields(id).cost_usd` (null when unknown); do not emit `run.failed`.
5. The existing `test/unit/logic-core.test.ts` interrupt test must be isolated from the product log (temp `config.dataDir`, restore in `finally`) without weakening its assertions. This is required because AF-07 adds a `recordError` call that the existing test would otherwise append to `data/logs/errors.jsonl` during `npm test`.
6. Do not change `getActiveRunId`, the startup call order, `index.ts`, or the returned count semantics. No learning/P7 change.

**Risks (accepted):** the SELECT→UPDATE race is closed by the condition-2 guard; the function runs pre-listen and is single-threaded. `markStartupInterrupted` is exported and could be called later, so the guard is required, not merely defensive.

---

### AF-08 (P2) — Context tab shows what the data actually contains

**Phase-1**

```json
{
  "phase1": {
    "architecture": "context_packs has included_json and excluded_json (migrations.ts:245-257). The pipeline writes included items {id,kind,path,tokens,mandatory} (run.ts:651-668; tokens is null because the packer does not persist them) and excluded items {id,reason} (packer.ts:163-243; run.ts:662). GET /api/runs/:id/context (app.ts:445-470) reads only included_json and maps {id,path,kind,tokens,mandatory}; the UI advertises Tokens/Chars/Reason/Included columns and claims 'with reasons and estimated size' (RunDetailPage.tsx:768,827).",
    "dataFlow": "packContext -> pack.items/pack.excluded -> context_packs.included_json/excluded_json -> GET /context -> packs[].items + top-level items -> ContextItems table.",
    "edgeCases": [
      "excluded_json missing/malformed -> [] (no 500)",
      "reason missing -> 'excluded'",
      "included item tokens:null -> the Tokens column is removed, so no misleading dash",
      "zero packs -> existing empty state",
      "packs[0].usedTokens/prefixHash unchanged",
      "excluded and included items share the same id space? they are distinct optional items",
      "the pre-existing duplicate aggregate card will render excluded rows twice; do not fix in this batch"
    ],
    "rootCause": "The context route never reads context_packs.excluded_json (which the packer does write as {id,reason}) and the included items never carry real token/char values, so the Context tab advertises four columns that can never be populated and claims to show exclusions it never fetches."
  }
}
```

**Phase-2**

| Gate check | Record |
|---|---|
| Entry validation | `JSON.parse(excluded_json)` in try/catch -> []; `String(item.reason ?? 'excluded')`; never emits raw context text. |
| Callers stable | `packs[].items`, `usedTokens`, `prefixHash` preserved; top-level `items` remains `packs.flatMap`; the client `ContextItemView` already has optional `reason`/`included`. |
| Fail-closed | Malformed excluded JSON produces no fabricated rows and no 500; absent reasons get a literal 'excluded'; no column claims a never-produced value. |
| Reproduction | SUPPORTED: source + DB pragma/census (84 packs / 343 items / 0 tokens / 0 non-empty excluded); weaver 129/29 abf5 slice. |
| Exact lines verified | `app.ts:445-470` (mapping `:466`); `run.ts:651-668` (`:661` tokens null); `packer.ts:163-243`; `api-types.ts:154-165`; `RunDetailPage.tsx:768,823-844`. |
| Tests expected | New `test/unit/context-excluded.test.ts`: insert a `context_packs` row with included/excluded JSON; `app.inject GET /context` (host header); excluded row present with `included:false` + reason; included rows `included:true`; `packs[0].usedTokens` unchanged; malformed `excluded_json` no 500. |
| Rollback | Revert the route projection and the UI columns/description; delete the new test. No packer/DB change. |
| Verdict | **APPROVED-WITH-CONDITIONS** |

**Binding conditions**

1. Route: parse `excluded_json` (same try/catch as included); included items get `included: true`; append excluded items as `{id, path: null, kind:'excluded', tokens: null, mandatory: false, reason: String(item.reason ?? 'excluded'), included: false}`. Keep `packs`/`items` shapes and `usedTokens`/`prefixHash`; no raw context text in the response.
2. UI: `ContextItems` drops **Tokens** and **Chars** columns; keeps Path/Kind/Mandatory/Reason/Included; `ContextTab` description becomes exactly "Included and excluded items are listed; exclusions carry a reason. No raw context is dumped here."; no packer/DB/`est_tokens` change.
3. Do not fix the pre-existing duplicate aggregate `looseItems` rendering in this batch; report it as an observation. Excluded rows will appear in both the pack table and the aggregate table; that is accepted for this batch.
4. Tests must use the host header and cover the malformed case; no raw text in the fixture.
5. Additive fields/rows only; no new route/table.

**Risks (accepted):** the top-level `items` array now includes excluded rows, and `ContextViewPanel` already renders an aggregate copy; the duplication is pre-existing and explicitly out of scope. The `included` key is optional on the client type.

---

### AF-09 (P2) — Make the advertised plan contract callable

**Phase-1**

```json
{
  "phase1": {
    "architecture": "Every plan-output agent advertises schemaId 'agent-plan' (registry.ts:48-54,112-146). AgentPlanSchema (registry.ts:753-788) is the union of ProjectPlanSchema + router/epic/cartographer kind shapes. The adhoc plan path (run.ts:404-407) validates with ProjectPlanSchema; the full-build architect path (run.ts:470-471) also uses ProjectPlanSchema. The runtime contract (prompts.ts:34-48) tells router/epic/cartographer to use the matching kind variant. AgentPlanSchema has no src caller; CandidateDraftSchema (registry.ts:819-826) is not used by the text path.",
    "dataFlow": "adhoc run_meta.agentId -> getAgent -> outputKind 'plan' -> callAgentJson(agent.id, ..., ProjectPlanSchema) -> chatJson safeParse + repair -> AGENT_OUTPUT.json. Builder path: architect -> callAgentJson(... ProjectPlanSchema) -> plan -> files.",
    "edgeCases": [
      "router/epic/cartographer kind payload -> accepted after the fix",
      "architect ProjectPlan payload -> accepted (union)",
      "router payload missing summary -> fails E_LLM_SCHEMA_INVALID",
      "router-shaped payload for architect -> accepted by the union (intentional leniency per the advertised agent-plan contract)",
      "text agent -> no schema claim; the UI hint no longer claims validation",
      "full-build architect path -> unchanged ProjectPlanSchema"
    ],
    "rootCause": "The registry advertises the AgentPlanSchema union for every plan agent and the runtime contract tells router/epic/cartographer to return kind-discriminated payloads, but the only plan consumer validates ProjectPlanSchema, so a documented router/epic/cartographer payload fails validation after the repair retries; the UI's blanket 'Output is schema-validated' claim is also false for the text path."
  }
}
```

**Phase-2**

| Gate check | Record |
|---|---|
| Entry validation | Zod `safeParse` at `chatJson` (client.ts:628); an invalid plan payload yields `E_LLM_SCHEMA_INVALID` through the existing repair loop; no silent acceptance. |
| Callers stable | `callAgentJson` signature unchanged; full-build architect path unchanged; write path `AGENT_OUTPUT.json` unchanged; no prompt/hash/schemaId change. |
| Fail-closed | A payload that matches none of the union variants fails with the existing schema error; the UI claim is literally true for every output kind. |
| Reproduction | SUPPORTED static: zero `src/` callers of AgentPlanSchema, schema mismatch at `run.ts:406`, prompt line 48, UI line 477. No paid plan-agent run (runtime unverified). |
| Exact lines verified | `registry.ts:48-54,112-146,753-788,819-826`; `prompts.ts:34-48`; `run.ts:404-407,470-471`; `AgentsPage.tsx:477`; `test/fixtures/agents/fixtures.ts`. |
| Tests expected | New `test/unit/agent-plan-contract.test.ts`: four plan agents parse their documented payload (reuse fixtures); router missing `summary` fails; `planOutputSchemaFor('router')` accepts ProjectPlan; a static source assertion that the adhoc plan branch uses `planOutputSchemaFor` and the full-build architect call still uses `ProjectPlanSchema`; existing `agents.schemas.test.ts`/`agents.registry.test.ts` remain green. |
| Rollback | Revert the registry selector, the one call-site change, and the UI hint; delete the new test. No API/data/schema change. |
| Verdict | **APPROVED-WITH-CONDITIONS** |

**Binding conditions**

1. Add `PLAN_AGENT_IDS` and `planOutputSchemaFor(agentId)` to `src/server/agents/registry.ts`; return `AgentPlanSchema` for the four plan agents. Keep `ProjectPlanSchema` exported and unchanged.
2. Use the selector only at the adhoc plan branch `run.ts:404-407`. The full-build architect call `:470-471` stays `ProjectPlanSchema`. Do not change the file-write/`planned` logic.
3. Change the AgentsPage hint to exactly "Structured JSON outputs are schema-validated before they are stored; text output is stored as text." Do not add validation for `candidate-draft` in this batch (truth-telling only; no scope explosion).
4. Do not change `schemaId`, `outputKind`, prompt text, `PROMPT_SOURCE_MAP`, `PROMPT_HASHES`, or the model output format.
5. The tests must include a static source assertion for the wiring (otherwise the selector can be added and never used). Use the existing fixtures; do not seed a run.
6. No paid run; runtime behavior of the plan agents remains unverified and must be stated. No new file/dependency.

**Risks (accepted):** the union accepts a `kind` payload for `architect` (and a ProjectPlan for router) — intentional leniency consistent with the advertised `agent-plan` schema. This is not a validation weakening for files/review/tests.

---

### AF-10 (P3) — Checks: unique row identity and no dead columns

**Phase-1**

```json
{
  "phase1": {
    "architecture": "checks.id is a unique DB row id; checks.check_id is the repeated verifier id (migrations.ts:88-99). insertCheck generates `chk_…` for id and stores check.id as check_id (recorder.ts:284-291). getChecks maps id = check_id and drops the row id (recorder.ts:293-303). The UI keys rows by check.id and renders a Time column from durationMs and a code fallback (RunDetailPage.tsx:640-660); neither code nor durationMs is persisted or returned.",
    "dataFlow": "verifyStaged -> CheckResult {id(verifier),...} -> insertCheck(row id/check_id) -> getChecks -> snapshot.checks/GET /checks -> ChecksTab key/cells.",
    "edgeCases": [
      "multiple verification passes -> repeated check_id but distinct DB row ids",
      "old payloads without rowId -> fallback key check.id",
      "zero checks -> existing empty state",
      "created_at ties at millisecond resolution -> do not assert tie order",
      "no migration: rowId is derived from the existing primary key"
    ],
    "rootCause": "getChecks replaces the unique DB row id with the repeated verifier check_id, so a run with multiple verification passes renders duplicate React keys and the Checks tab cannot distinguish passes; the Time column and check.code fallback read fields that are never persisted or returned."
  }
}
```

**Phase-2**

| Gate check | Record |
|---|---|
| Entry validation | `rowId` is derived from the DB, not user input; optional in the shared type; old payloads remain valid. |
| Callers stable | `CheckResult` additive field; `insertCheck` unchanged; `snapshot.checks`/`GET /checks` automatically carry rowId; no route change. |
| Fail-closed | Every persisted check row gets a unique key; no column claims a never-produced value; missing rowId falls back to the old key. |
| Reproduction | SUPPORTED: DB census (abf5 16 rows / 5 ids), source re-read; forge measured 16 DOM rows and 0 key warnings (no collapse). |
| Exact lines verified | `recorder.ts:284-303`; `migrations.ts:88-99`; `RunDetailPage.tsx:640-660`; `types.ts:206-217`. |
| Tests expected | New `test/unit/checks-identity.test.ts`: two checks with the same id and different detail -> getChecks returns 2 rows with distinct `rowId`; `GET /checks` returns both; no migration. Avoid a strict created_at tie order (insert distinct timestamps if ordering is asserted). |
| Rollback | Revert the optional `rowId`, the getChecks mapping, and the UI key/column changes; delete the new test. No schema/data change. |
| Verdict | **APPROVED-WITH-CONDITIONS** |

**Binding conditions**

1. Add optional `rowId?: string` to `CheckResult`; `getChecks` adds `rowId: String(row.id)`; **no migration**; `insertCheck` unchanged.
2. UI keys on `check.rowId ?? check.id`; delete the `<th>Time</th>` and its cell; the File cell becomes `check.file ? \`${check.file}${check.line ? ':'+check.line : ''}\` : '—'` (drop `check.code`); keep Check/Status/Mandatory/Detail/File and the badge.
3. Do not modify `e2e/ui-audit.spec.ts`; the existing Checks tab visit must remain green. No new route/table/migration.
4. Tests: distinct `rowId` for duplicate `check_id`; both rows returned; if asserting order, use explicit distinct `created_at` values rather than relying on millisecond ties.
5. Preserve all persisted check fields and ordering; no raw context/secret text in the test fixtures.

---

### AF-11 (P3) — Routing reason derives from the decision, not a literal

**Phase-1**

```json
{
  "phase1": {
    "architecture": "GET /api/runs/:id/routing (app.ts:359-443) parses route_decisions.features_json into `features` and builds each decision. The `reason` field is the literal 'static prior route' (:423). ccr always persists qualitySource:'prior', sampleSize:0 today (ccr.ts:263-264,566-567), so the literal is currently true, but it is a guaranteed lie if routing uses learning data. The client type is `reason?: string` (api-types.ts:124-143); the UI renders it only when truthy (RunDetailPage.tsx:731).",
    "dataFlow": "ccr route result -> route_decisions.features_json -> GET /routing parse -> decision.reason -> RunDetailPage RouteDecisionCard.",
    "edgeCases": [
      "features={} -> reason key absent (not null)",
      "features.reason='learned v2' -> wins",
      "features.qualitySource absent -> omit the composed sentence",
      "sampleSize absent -> n=0; non-finite sampleSize -> n=0",
      "model/thinking absent -> omitted; non-string -> omitted",
      "non-string qualitySource -> omit the sentence (no '[object Object]')",
      "historical rows keep their features; no backfill"
    ],
    "rootCause": "The routing route returns the constant string 'static prior route' for every decision instead of a value composed from that decision's persisted features, so the UI presents a hard-coded claim as per-decision evidence; the constant is currently true only because ccr always writes qualitySource:'prior'/sampleSize:0."
  }
}
```

**Phase-2**

| Gate check | Record |
|---|---|
| Entry validation | `features_json` is already parsed in try/catch -> {}; the derivation checks `typeof`/finiteness and never throws. |
| Callers stable | `reason` remains optional in the client type; no other decision/candidate key changes; ordering/`allocatedCostUsd`/`reserveUsd` unchanged. |
| Fail-closed | When no rationale is known the field is absent, so the UI shows nothing rather than a fabricated sentence; a real persisted reason wins. |
| Reproduction | SUPPORTED static: literal at `app.ts:423`, render at `RunDetailPage.tsx:731`, ccr always prior; weaver F5 and live 14/14 decisions. |
| Exact lines verified | `app.ts:359-443` (`:423`); `ccr.ts:263-264,566-567`; `RunDetailPage.tsx:731`; `api-types.ts:124-143`. |
| Tests expected | New `test/unit/routing-reason.test.ts`: row with `{qualitySource:'prior',sampleSize:0,model:'deepseek-flash',thinking:'disabled'}` -> reason contains `prior`, `n=0`, model; row with `{}` -> `'reason' in decision === false`; row with `{reason:'learned v2'}` -> `'learned v2'`; non-string qualitySource/empty features -> no reason. |
| Rollback | Revert the one `reason` expression; no data/API/schema change. |
| Verdict | **APPROVED-WITH-CONDITIONS** |

**Binding conditions**

1. Derive from the decision's own `features`: prefer a string `features.reason`; else if `qualitySource` is a non-empty string, compose `"<source>-based selection (n=<n>)"` plus ` · model <model>` / ` · thinking <thinking>` only when those are non-empty strings; `n` = a finite number (or 0 when absent/non-finite).
2. Omit the `reason` key entirely when nothing is known (conditional spread). This is the **single approved exception** to "additive API only": no other key may be removed or renamed. The receipt must state it.
3. Keep every other decision/candidate key, ordering, `allocatedCostUsd`, `reserveUsd`; no UI change (the UI already renders only truthy reasons); no DB writer change; no backfill.
4. Do not output `NaN`, `[object Object]`, `undefined`, or a literal fallback. A non-string/invalid `qualitySource` must not produce a sentence.
5. Tests must include the empty-features absence assertion (`'reason' in decision === false`) and the persisted-reason precedence.

**Risks (accepted):** current data will display "prior-based selection (n=0) · model … · thinking …" instead of "static prior route"; this is truthful and composed from the same fields the API returns. A future writer that persists a real `reason` wins without a code change.

---

## 5. Rejected / deferred

### 5.1 Rejected fixes

**None of AF-01…AF-11 is rejected.** No AF failed the Phase-1/Phase-2 gate.

The only rejected **recipe** in scope is forge **P-4**, whose ASC `LIMIT window+1` cannot return the newest window for a run with more than `window` rows. AF-04 replaces it. Reopen evidence: a recipe that returns the newest `window` rows for `>window` after-cursor events and passes the AF-04 boundary tests.

### 5.2 Deferred / not approved (do not implement)

The directive §5 dispositions are carried forward unchanged. In particular:

| ID | Item | Disposition |
|---|---|---|
| D-01…D-04 | nested-modal Escape, skip-link focus, tab aria-controls, favicon | deferred (UI/a11y; no data truth) |
| D-05 | unknown-route `E_RUN_NOT_FOUND` | deferred; pinned by `e2e/api-contract.spec.ts:62-64` |
| D-06 | refusal-code split | deferred |
| D-07/D-08 | learning inspect UI / stale vault root | deferred (P7 honesty / data hygiene) |
| D-09…D-11 | runs filter, "Accepted tree" label, dead reviews | deferred |
| D-12 | gate logging + `GATE_FAILED` registration | deferred (the message part is in AF-01) |
| D-13 | `trace_complete` invariant | deferred (would need finalize reorder + historical repair) |
| D-14 | learning variant machine | deferred (P7 unreachable) |
| D-15 | full state guard | **rejected** (phase matrix contradiction + unhandled-rejection risk) |
| D-16 | 410 reconnect loop | deferred (unverified) |
| D-17 | cancel ack race | deferred (unreproduced) |
| D-18 | full failure-payload vocabulary / `run.budget_exceeded` | deferred (AF-01 covers touched paths) |
| D-19 | `receivedAt` semantics | deferred (AF-03 covers array selection) |
| D-20 | Settings nested `limits` display | deferred |
| D-21 | wire `PHASE_TRANSITIONS` | **rejected** |
| D-22 | historical cost/trace backfill | **rejected** |
| D-23 | seed runs/events for proof | **rejected** (fake data) |
| D-24 | delete the 16 reserved listeners | deferred (keep) |
| R-1/R-2/R-3 | refuted claims | **do not fix**; preserved |
| U-1/U-2 | unverified | **do not implement** without new evidence |

Forge proposals P-1/P-2/P-3/P-5/P-6/P-7 are superseded by the AFs as described in §1.2; they are **not** additional implementation input. P-2's route-interception e2e and P-5's column-header e2e are explicitly not approved.

---

## 6. What "done" must show (gate acceptance)

The forgewright receipt is accepted only if all of the following are quoted with command + output:

1. `npm.cmd run typecheck` clean.
2. `npm.cmd run test` -> baseline 249 + new tests, all pass; quote the summary. No existing test weakened; `test/unit/logic-core.test.ts` assertions unchanged.
3. `npm.cmd run build` succeeds.
4. `node scripts\assert-stage.mjs --stage=p7 --json` -> `violations: []`, `routes: 48`, `tables: 45`, `scripts: 24`; new test files reported honestly in `files`.
5. `npm.cmd run e2e` against a restarted local server -> all specs pass; pinned `e2e/api-contract.spec.ts:62-64` and `e2e/ui-audit.spec.ts:127-147` untouched and green.
6. `npm.cmd run preflight -- --port 0 --json` PASS (or the documented environment refusal).
7. `node docs\AUDIT-WAVE-6\capability\probe-db-readonly.mjs` before/after: historical `sumRunCost` unchanged (no backfill); a new failed run in a throwaway DB shows non-null cost.
8. Per-AF files/line ranges, test names, and the unverified items (AF-01 gate-event runtime, AF-03 live transition, AF-06 run.ts mapper runtime, AF-09 plan-agent runtime, AF-10 created_at tie order if not pinned) stated in the receipt.
9. `npm run stub-sweep` -> no TODO/FIXME/placeholder in changed files; no secret in any diff/log; no paid call; no restart except the local dev server.

---

## 7. Blockers

- **None for the approved set.** All 11 fixes are implementable with the stated files/tests and no paid call.
- **Unverified by mandate (must be stated, not faked):** live→terminal Events transition (AF-03); provider-failure runtime specimen (AF-06 run.ts mappers); plan-agent runtime execution (AF-09); gate-event payload at runtime (AF-01); >200 artifacts / >500 events boundaries (AF-04). These do not block implementation; they block claiming runtime proof.
- **Input-integrity defect:** the directive/capability-audit claim that forge's `patch-proposals.json` and `handoff.md` are missing is false. It is recorded here; no AF premise depends on it. If the parent wants the audit narrative corrected, the evidence is §1.1.
