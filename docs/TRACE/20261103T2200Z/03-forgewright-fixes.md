# 03 — ForgeWright trace fixes (FIX phase)

**Seat:** 3/3 ForgeWright lead (`integration-architect`) · **Date:** 2026-11-03 16:21–16:35 America/Chicago
**Scope:** only the six confirmed handoff defects. No quarantined harness false negatives, no G1/G3/G5/G7 edits, no product files outside the owned list. No server restart, key access, paid runs, installs, or git.

## TRACE-01 — agent detail loses badges/evidence

**Research.** Read `src/server/app.ts:223-268` (list enriches; detail returned raw `getAgent`), `src/shared/types.ts` `AgentDefinition`, `web/src/pages/AgentsPage.tsx:374-397` (drawer reads `data.badges`/`data.evidence`). Unknown: whether detail had its own enrichment — **VERIFIED no**. Live 8787: `detail_badges=`, `detail_evidence=0`; list `registered,representative-live`, 5 rows.

**Phase 1**
```json
{"architecture":"app.ts owns list/detail shape; AgentDefinition is the registry record; AgentsPage drawer reads badges/evidence.","dataFlow":"AgentsPage -> getAgent -> GET /api/agents/:id -> app.ts -> registry; list route separately joins agent_evidence/steps.","edgeCases":["agent with evidence but no list visit","agent with no evidence","unknown id"],"rootCause":"The list route added badges/evidence while the detail route returned the raw registry record, so the same agent had two different API contracts."}
```

**Invariant / RED.** Same agent id must produce the same evidence surface in list and detail. RED: live 8787 detail vs list divergence above. **Boundary fix:** extract `toAgentView()` and use it on both routes.

**Fix.** `src/server/app.ts:31-76` helper; `:223-239` list uses it; `:232-239` detail queries the same evidence/step rows and returns it. **GREEN:** `test/unit/trace-fixes.test.ts` detail badges/evidence test; `e2e/trace-fixes.spec.ts` API parity test both pass. Drawer now receives the fields it renders.

## TRACE-02 — route candidates persisted but hardcoded empty

**Research.** Read `app.ts:302-328` (decisions only; candidates `[]`), `PRAGMA route_candidates` (17 columns, 19 rows), `web/src/pages/RunDetailPage.tsx:703-741` (candidate table already implemented), `web/src/api-types.ts` `RouteCandidateView`. Unknown: whether candidate table is populated — **VERIFIED yes**; route ignored it. Live 8787: `decisions=4`, `candidatesTotal=undefined`, `firstCandidates=0`; DB has 4 for the run.

**Phase 1**
```json
{"architecture":"route_decisions and route_candidates are separate SQLite tables; /routing maps decisions only.","dataFlow":"RoutingTab -> getRouting -> GET /routing -> route_decisions; route_candidates never queried -> candidates:[] -> UI branch unreachable.","edgeCases":["no candidates for a task","candidate not chosen","multiple candidates per task","rejected candidate"],"rootCause":"The response mapper hardcoded candidates/model/chosen and never queried the persisted route_candidates table."}
```

**Invariant / RED.** For a run, returned candidate count must equal persisted rows for that run/task. RED: 8787 `candidatesTotal` missing and `firstCandidates=0` while DB says 4. **Boundary:** the `/routing` response mapper.

**Fix.** `app.ts:305-378` reads `route_candidates` grouped by task, maps quality/source/sample/cost/latency/risk/feasible/chosen/reject reasons, returns `candidatesTotal`; `chosen` falls back to true only when no candidate rows exist. **GREEN:** unit `routing candidates` test; 8788 probe `decisions=4 candidatesTotal=4 firstCandidates=1`; typecheck. The existing UI table at `RunDetailPage.tsx:703-741` now has rows.

## TRACE-03 — revision files stored, never read (and race)

**Research.** Read `app.ts` revise route (stored `settings revision_files:<child>` after `createRun`), `pipeline/run.ts:201-240` (read all parent files; no settings read), `manager.ts:137-139` (executor queued in `queueMicrotask` before the app write). VERIFIED: no reader; the write could race the pipeline. **UNKNOWN:** whether any other caller reads `revision_files` — grep says no.

**Phase 1**
```json
{"architecture":"app.ts accepts files[]; createRun owns run_meta and queues execution; executeReviewRun selects parent files.","dataFlow":"RunDetailPage revise -> POST /revise -> app.ts createRun -> queueMicrotask executor -> executeReviewRun -> parentFiles (all).","edgeCases":["selected files valid subset","selected file absent from parent","empty files[]","revision starts before setting write"],"rootCause":"The API stored revision_files after createRun (a race) and the pipeline never read the setting, so every revision used all parent files."}
```

**Invariant / RED.** A revision with `files:[A]` must touch only A; parent B must remain byte-identical. RED (static): `grep revision_files` found only the write; no reader; all `parentFiles` passed to Cleaner/Sentinel.

**Fix.** App validates `files[]` against parent artifact paths (`E_INVALID_REVISION_SCOPE`) and passes them in `createRun.metadata.revisionFiles` (`app.ts:747-767`) before the executor runs. Pipeline `run.ts:37-52` `revisionFilesForRun()` reads `run_meta:<child>` and filters; `executeReviewRun` uses it at `:233`. **GREEN:** unit test filters A from `[A,B]`, no-scope returns all, invalid selection throws; typecheck. No live paid revision run was made.

## TRACE-04 — `schema-valid` badge has no producer

**Research.** `agent_evidence` schema; `app.ts:190` reads badge; grep all `INSERT agent_evidence` — only `pipeline/run.ts:37-47` with `representative-live`. Live DB: `representative-live 27`, `schema-valid 0`. VERIFIED.

**Phase 1**
```json
{"architecture":"pipeline agentStep records evidence after finishStep; app list maps badge rows to AgentView badges.","dataFlow":"agentStep success -> recordAgentEvidence -> agent_evidence -> GET /api/agents -> badges.","edgeCases":["representative agent","non-representative agent","duplicate step retry","stored run"],"rootCause":"The evidence writer returned early for non-representative agents and only inserted representative-live, so the read path for schema-valid had no producer."}
```

**Invariant / RED.** Every schema-validated successful agent step must insert a `schema-valid` evidence row. RED: live badge counts `schema-valid 0`; grep no producer.

**Fix.** `run.ts:54-70` always inserts `schema-valid` (deterministic id from badge/run/agent/step) and additionally `representative-live` when applicable. **GREEN:** unit test records a `router` step and asserts `['schema-valid']`; typecheck. A new successful run will surface the badge after Lead restart.

## TRACE-05 — POST /api/runs accepts bogus enums

**Research.** `app.ts` create route cast `as never`; `shared/types.ts` had literal types but no runtime arrays; `manager.ts` no enum check. VERIFIED from trace report's temp-DB probe: invalid enums → 202/queued.

**Phase 1**
```json
{"architecture":"app.ts is the HTTP boundary; createRun trusts its inputs; shared/types defines the enum domain.","dataFlow":"RunComposer -> api.ts -> POST /api/runs -> app.ts -> createRun -> SQLite/provider.","edgeCases":["bogus preset","bogus model","bogus thinking","bogus effort"],"rootCause":"The route cast untrusted body fields to `never`, bypassing runtime validation and allowing malformed runs to queue."}
```

**Invariant / RED.** Invalid enum input must return 422 before any run row. RED: trace temp-DB `preset=bogus-preset... status=queued` (202). **Boundary:** before `createRun`.

**Fix.** Added `MODEL_IDS`, `THINKING_MODES`, `EFFORTS` to `shared/types.ts`; added `E_INVALID_RUN_INPUT`; `app.ts:610-627` validates preset/model/thinking/effort and refuses 422 before `createRun`. **GREEN:** unit test invalid enums → 422 `E_INVALID_RUN_INPUT`, run count unchanged; 8788 probe → 422; valid routes untouched.

## TRACE-06 — terminal Events tab ignores persisted events

**Research.** `RunDetailPage.tsx:129` passes null to `useRunStream` when terminal; `EventsTab` renders only local events; no `getRunEvents` in `web/src/api.ts`. `/api/runs/:id/events` returns persisted rows. VERIFIED from trace report: run with 322 events, UI empty, no `/events` request.

**Phase 1**
```json
{"architecture":"RunDetailPage owns EventsTab state; api.ts owns HTTP; /events returns persisted rows; SSE only feeds live runs.","dataFlow":"terminal run -> useRunStream(null) -> EventsTab(empty local) -> empty state; /events never called.","edgeCases":["terminal with zero events","terminal with persisted rows","non-terminal live stream","events request error"],"rootCause":"The SSE dependency was disabled at terminal state and no persisted-event fetch path existed, so available events were hidden behind an empty live-state message."}
```

**Invariant / RED.** A terminal run with persisted events must render them; an empty ledger must say so. RED: 322 persisted events vs “No live events observed”; no `/events` network call.

**Fix.** New `getRunEvents()` (`web/src/api.ts:318-323`) maps persisted rows through `src/shared/run-events.ts`; `RunDetailPage.tsx:127-133` loads it only when terminal, merges local/live vs persisted, and passes loading/error/terminal to `EventsTab` (`:413`, `:1003-1030`). **GREEN:** `e2e/trace-fixes.spec.ts` terminal Events tab test and agent parity test pass against isolated 8788 with rebuilt `web/dist`; mapper unit test passes.

## Verification (commands + observed)

- `npm.cmd run typecheck` → exit **0**.
- `npm.cmd test -- --run test/unit/trace-fixes.test.ts` → **6 passed**.
- `npm.cmd run build` → **built in 2.06s**, exit **0** (regenerated `web/dist`).
- `E2E_BASE_URL=http://127.0.0.1:8788 playwright test e2e/trace-fixes.spec.ts` → **2 passed**, exit **0**.
- 8788 probes: routing `decisions=4 candidatesTotal=4 firstCandidates=1`; agent detail `badges=registered,representative-live evidence=5`; invalid enums → **422**.
- 8787 RED probes (old process): detail badges empty/evidence 0 vs list 5; routing candidates 0. Shared 8787 was not restarted.

## Files + SHA256

| File | SHA256 |
|---|---|
| `src/server/app.ts` | `4255EE3A00B6B1851C7C9ABDC5901B980626420CAA586DEEDD25435BED54D2E6` |
| `src/server/pipeline/run.ts` | `88E027C82E7C4B201883EAC6C67CE993E3C74C0CFB653B78A91ADB8AC3F9D97B` |
| `src/shared/types.ts` | `5F54A7AAC72EFDBD55C7F65D916B0EB630D40EFA797C1C73009F553629584790` |
| `src/shared/refusals.ts` | `0BF65C24DD6EF11D412E5124DF84CCFED471FB597BF1D0825278582FF71CE7EA` |
| `src/shared/run-events.ts` | `23C0542F3A996E55FE4FC130C37A145E53A524BAE7D4DCB21DABBAC04C4C602E` |
| `web/src/api.ts` | `476D5A68364B58F895D3B15EDF57D69B1FD9172C67BAC96E6C120B451D5CE908` |
| `web/src/pages/RunDetailPage.tsx` | `56C73CB7176CA74771EF9023326DFEC67C69275AF8469BB8E380D040CD24DA35` |
| `test/unit/trace-fixes.test.ts` | `86F2759C6A2A1EF5E37E70BE9563C955C1FAC06C884A152066AC76DCBA7224A3` |
| `e2e/trace-fixes.spec.ts` | `6783E7E462858C626519521C6A5D51505335E609F73FC207AE0DF8A7EF6B6B60` |

**Residual:** 8787 still runs the pre-fix process; Lead must restart for live UI/API to show all six fixes. TRACE-04’s badge requires a new successful run after restart; TRACE-03 was verified by unit invariant, not a paid live revision. No tests were weakened; no out-of-scope edits.
