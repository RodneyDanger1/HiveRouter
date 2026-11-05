# W6-IMP-01 — ForgeWright product-writer progress

- **Task:** W6-IMP-01 (Wave 6 implementation, single product writer).
- **Repo:** `C:\Users\Riley\Desktop\HiveRouter` (B2 working tree, 25 runs, no `.git`).
- **Seat:** sole product writer. Skill `forgewright-lead` loaded before acting.
- **Write scope:** `src/server/**`, `src/shared/**`, `web/src/**`, `test/unit/**`, `e2e/**` (new files only), plus this receipt folder. No other path written.
- **Authority:** `docs/AUDIT-WAVE-6/gate/approved-fixes.json` and `gate.md` control; the directive is read for intent but the gate conditions bind.
- **Order:** AF-01 → AF-02 → AF-03 → AF-04 → AF-05 → AF-06 → AF-07 → AF-08 → AF-09 → AF-10 → AF-11. Strict serial, one writer.
- **Evidence rule:** every claim below is either a command output, a file:line read in this session, or explicitly UNVERIFIED.

## Mandatory reads completed before the first edit

| Input | Read |
|---|---|
| `docs/AUDIT-WAVE-6/gate/approved-fixes.json` | full (589 lines) |
| `docs/AUDIT-WAVE-6/gate/gate.md` | full (708 lines) |
| `docs/AUDIT-WAVE-6/capability/FORGEWRIGHT-DIRECTIVE.md` | full (394 lines) |
| `docs/AUDIT-WAVE-6/capability/capability-audit.md` | full (303 lines) |
| `docs/AUDIT-WAVE-6/capability/findings-verdicts.json` | full (149 lines) |
| `docs/AUDIT-WAVE-6/weaver/findings.md` | full (327 lines) |
| `docs/AUDIT-WAVE-6/logic/findings.md` | full (388 lines) |
| `docs/AUDIT-WAVE-6/logic/event-payload-truth.md` | full (174 lines) |
| `docs/AUDIT-WAVE-6/forge/root-causes.md` | full (323 lines) |
| Raw DB evidence (read-only `node:sqlite`, `data/hive.db`) | run_abf5: 108 events seq 552–659, 20 usage rows $0.299980656, run cost NULL, terminal `run.failed {code,checks}`; run_95: 102 events seq 871–972, 19 usage rows $0.250781772 = run cost, terminal `run.completed {runId,status,files,costUsd}` |
| Source at every cited line | read in this session (see per-AF records) |

## Gate conditions carried (extract that binds implementation)

- No new route/table/migration/script/dependency; stage stays routes 48 / tables 45 / scripts 24 / violations [].
- No historical backfill; historical NULL cost rows stay NULL.
- Pinned tests untouched: `e2e/api-contract.spec.ts:62-64`, `e2e/ui-audit.spec.ts:127-147`.
- `test/unit/logic-core.test.ts` is the only existing unit test file that may change, and only to isolate `config.dataDir` (assertions unchanged).
- No paid call; no server restart; no fake data; no test weakening; no TODO/FIXME/placeholder.
- AF-11's conditional omission of the fabricated `reason` key is the only approved exception to additive API.

## Pre-write records (root cause + data flow + edge case)

### AF-01 — terminal usage
- **Root cause:** only `finalize()` (`src/server/pipeline/run.ts:1075-1084`) copies `usageTotals` into the run row; `markTerminal` (`manager.ts:250-258`), `run.ts:884`, `manager.ts:150-156`, `manager.ts:179-185` write status/error only, so measured spend stays NULL.
- **Data flow:** `insertUsage` → `usage` table → `usageTotals` → terminal writer row + terminal event → `GET /snapshot` → `CostMeter`.
- **Edge cases:** 0 usage rows → NULL; any `source='unknown'` → all NULL; two provider rows → SUM; duplicate `markTerminal` → same values; bare code error (`E_PROVIDER_EMPTY`) event message is human; no backfill.
- **Evidence:** read `recorder.ts:355-378`, `manager.ts:135-204,250-258`, `run.ts:868-888`, and DB rows above.

### AF-02 — event vocabulary
- **Root cause:** `web/src/hooks/useApi.ts:72-100` lacks 5 emitted types; `:143-144` registers only listed names; `:124-140` stores the SSE envelope, persisted mapper stores `payload`.
- **Data flow:** `emitEvent` → `events.payload_json` → SSE frame `{schema,type,data,meta}` → handler → `RunStreamEvent{type,data,receivedAt}`.
- **Edge cases:** non-JSON raw text; unnamed frame → `run.event`; heartbeat comment; payload with `data` but no `schema` must not unwrap; ternary `run.ts:885` literals must be seen by the static test.

### AF-03 — terminal Events tab
- **Root cause:** `RunDetailPage.tsx:133` prefers any non-empty live array over the fetched ledger.
- **Data flow:** live buffer (100 cap) vs `/events` persisted rows → `visibleEvents` → `EventsTab`.
- **Edge cases:** truth table (terminal/non-terminal × live/persisted sizes); loading/error branches unchanged; no clearing/flash.

### AF-04 — `/events` truncation
- **Root cause:** `app.ts:825-830` derives the window from the global AUTOINCREMENT seq; `getEvents` is ASC LIMIT.
- **Data flow:** `after` clamp → per-run count → newest-window DESC fetch → `{events,truncated,lastEventId}`.
- **Edge cases:** 0/2/3/4 events at window 3; newest seqs returned; after cursor at last seq; negative/NaN after; unknown run 404.

### AF-05 — snapshot cap
- **Root cause:** snapshot (`app.ts:802-816`) omits `limits`; `run_snapshots.limits` is the global cap.
- **Data flow:** `settings.run_limit:<id>` → `scopeCap` → `runBudgetUsd` → `snapshot.limits.maxCostUsd` → `CostMeter`.
- **Edge cases:** absent limit → global; above global → clamp; malformed → global; never null; unknown run 404.

### AF-06 — provider code identity
- **Root cause:** three mappers read `message.startsWith('E_')` instead of `LlmError.code` (`run.ts:231-235,868-888`; `manager.ts:145-157`).
- **Data flow:** provider error → `LlmError(code, prose)` → mapper → runs/steps/events.
- **Edge cases:** prose message; bare code message; `E_X: detail`; lowercase code; AbortError; non-Error; Node errno `ENOENT` must not become a run code.

### AF-07 — interrupted terminal
- **Root cause:** `markStartupInterrupted` (`manager.ts:192-204`) bulk-updates status without code/message/event/log.
- **Data flow:** startup → select active → conditional transition → event → log → release reservations.
- **Edge cases:** zero active; two active runs; second call 0; unknown usage → costUsd null; concurrent terminal write must not be downgraded.

### AF-08 — context excluded
- **Root cause:** `app.ts:445-470` reads only `included_json`; UI advertises Tokens/Chars/Reason/Included that are never produced.
- **Data flow:** packer excluded items `{id,reason}` → `context_packs.excluded_json` → route projection → Context table.
- **Edge cases:** missing/malformed excluded JSON → []; missing reason → 'excluded'; included rows `included:true`; malformed JSON no 500; usedTokens unchanged.

### AF-09 — plan contract
- **Root cause:** `AgentPlanSchema` has zero production callers; adhoc plan path validates `ProjectPlanSchema` (`run.ts:404-407`); UI overclaims.
- **Data flow:** adhoc `run_meta.agentId` → `outputKind 'plan'` → `callAgentJson(..., schema)` → `AGENT_OUTPUT.json`.
- **Edge cases:** kind payload accepted; router missing `summary` fails; router accepts ProjectPlan (union); full-build architect unchanged.

### AF-10 — checks identity
- **Root cause:** `getChecks` maps `id = check_id`, dropping the unique DB row id; UI keys on it and renders dead Time/`code` fields.
- **Data flow:** `insertCheck` row → `getChecks` → snapshot/GET checks → ChecksTab key/cells.
- **Edge cases:** duplicate `check_id` → distinct `rowId`; old payloads fall back; no migration.

### AF-11 — routing reason
- **Root cause:** `app.ts:423` literal `'static prior route'`.
- **Data flow:** `route_decisions.features_json` → route map → `decision.reason` → UI only when truthy.
- **Edge cases:** `{}` → key absent; persisted `reason` wins; non-finite sampleSize → 0; non-string qualitySource/model/thinking → omitted; no NaN/[object Object].

## AF ledger (append after each fix)

| AF | Status | Files | Targeted test | Result |
|---|---|---|---|---|
| baseline unit run | done | — | `npm.cmd run test -- --run` | 38 files / 249 tests passed |
| AF-01 | done | `src/server/runs/recorder.ts` (+usageFields), `src/server/runs/manager.ts` (markTerminal, executor catch, no-controller cancel, terminalEventMessage), `src/server/pipeline/run.ts` (catch + 3 gate emits), `test/unit/terminal-usage.test.ts` | `npm.cmd run test -- --run test/unit/terminal-usage.test.ts` | 8/8 passed; typecheck clean |
| AF-02 | done | `src/shared/run-events.ts` (RUN_EVENT_TYPES, RESERVED_EVENT_TYPES, STREAM_EVENT_TYPES, normaliseStreamEvent), `web/src/hooks/useApi.ts` (shared list + unwrap), `test/unit/event-contract.test.ts` | `npm.cmd run test -- --run test/unit/event-contract.test.ts` | 8/8 passed; typecheck clean |
| AF-03 | done | `src/shared/run-events.ts` (selectVisibleEvents), `web/src/pages/RunDetailPage.tsx` (:134 selector), `test/unit/run-events-selection.test.ts` | `npm.cmd run test -- --run test/unit/run-events-selection.test.ts test/unit/event-contract.test.ts test/unit/trace-fixes.test.ts` | 20/20 passed; existing trace-fixes green; typecheck clean |
| AF-04 | done | `src/server/runs/recorder.ts` (countEventsAfter, getRecentEvents), `src/server/app.ts` (:818-850 events block), `web/src/pages/RunDetailPage.tsx` (badge text), `test/unit/events-window.test.ts` | `npm.cmd run test -- --run test/unit/events-window.test.ts` | 8/8 passed; typecheck clean |
| AF-05 | done | `src/server/app.ts` (snapshot limits), `test/unit/snapshot-limits.test.ts` | `npm.cmd run test -- --run test/unit/snapshot-limits.test.ts` | 6/6 passed; typecheck clean |
| AF-06 | done | `src/shared/refusals.ts` (codeOfError), `src/server/pipeline/run.ts` (agentStep + catch), `src/server/runs/manager.ts` (executor catch), `test/unit/error-code.test.ts`, `test/unit/terminal-error-code.test.ts` | `npm.cmd run test -- --run test/unit/error-code.test.ts test/unit/terminal-error-code.test.ts test/unit/run-timeout.test.ts` | 11/11 passed; typecheck clean |
| AF-07 | done | `src/shared/refusals.ts` (E_RUN_INTERRUPTED), `src/shared/run-events.ts` (run.interrupted), `src/server/runs/manager.ts` (markStartupInterrupted), `test/unit/startup-interrupt.test.ts`, `test/unit/logic-core.test.ts` (isolation only) | `npm.cmd run test -- --run test/unit/startup-interrupt.test.ts test/unit/logic-core.test.ts test/unit/event-contract.test.ts` | 20/20 passed (logic-core 11 incl. interrupt); typecheck clean |
| AF-08 | done | `src/server/app.ts` (context excluded projection), `web/src/pages/RunDetailPage.tsx` (columns + description), `test/unit/context-excluded.test.ts` | `npm.cmd run test -- --run test/unit/context-excluded.test.ts` | 3/3 passed; typecheck clean |
| AF-09 | done | `src/server/agents/registry.ts` (PLAN_AGENT_IDS, planOutputSchemaFor), `src/server/pipeline/run.ts` (adhoc plan branch), `web/src/pages/AgentsPage.tsx` (hint), `test/unit/agent-plan-contract.test.ts` | `npm.cmd run test -- --run test/unit/agent-plan-contract.test.ts test/unit/agents.schemas.test.ts test/unit/agents.registry.test.ts` | 21/21 passed; typecheck clean |
| AF-10 | done | `src/shared/types.ts` (rowId), `src/server/runs/recorder.ts` (getChecks rowId), `web/src/pages/RunDetailPage.tsx` (key/columns), `test/unit/checks-identity.test.ts` | `npm.cmd run test -- --run test/unit/checks-identity.test.ts` | 4/4 passed; typecheck clean |
| AF-11 | done | `src/server/app.ts` (routing reason derivation), `test/unit/routing-reason.test.ts` | `npm.cmd run test -- --run test/unit/routing-reason.test.ts test/unit/trace-fixes.test.ts` | 11/11 passed; typecheck clean |
| final gates | done | — | `npm.cmd run typecheck`; `npm.cmd run test -- --run`; `npm.cmd run build`; `node scripts\assert-stage.mjs --stage=p7 --json`; `npm.cmd run stub-sweep`; `npm.cmd run secret-scan`; `npm.cmd run preflight -- --port 0 --json` | typecheck exit 0; 50 files / 312 tests passed; build exit 0; stage files 162 / tables 45 / routes 48 / scripts 24 / violations []; stub-sweep clean (86 files); secret-scan clean (160 files); preflight ok:false `E_RESOURCE_INSUFFICIENT` (free RAM 1.08 GB < 1.5 GB required — documented environment refusal) |






