# 02 — Forge trace, Trace campaign 20261103T2200Z

**Seat:** 2/3 Forge tracer (`logic-scripts`) · **Mode:** read-only; no product edits, server restart, key, or paid run.
**Inputs:** `docs/TRACE/20261103T2200Z/{WAVE-SHEET.md,01-capability-audit.md,controls.json}` · **Outputs:** this report + `traces.json`.
**Live:** `http://127.0.0.1:8787` phase B2, key configured, Chrome/Playwright read-only. **Static:** `web/src`, `src/server/app.ts`, routes, services, SQLite read-only.

## 1. Coverage

| Surface | Controls | Trace entries | Wired | Unverified | Refused | Dead | Defects |
|---|---:|---:|---:|---:|---:|---:|---:|
| Shell families (10 × 7 surfaces) | 70 | 10 | 70 | 0 | 0 | 0 | 0 |
| Overview | 30 | 30 | 29 | 1 (Start live) | 0 | 0 | 1 API |
| Agents | 51 | 51 | 45 | 6 (save/reset/run/inputs/copy) | 0 | 0 | 3 |
| Runs | 43 | 43 | 43 | 0 | 0 | 0 | 0 |
| Run detail | 34 | 34 | 27 | 6 (revise/audit/open-folder/copy) | 0 | 1 | 3 |
| Vault | 95 | 95 | 95 | 0 | 0 | 0 | 0 |
| Learning | 21 | 21 | 12 | 0 | 9 | 0 | 0 |
| Settings | 12 | 12 | 12 | 0 | 0 | 0 | 0 |
| Agent drawer | 13 | 13 | 3 | 10 | 0 | 0 | 2 |
| **Total** | **299** | **239** | **253** | **36** | **9** | **1** | **6** |

- **239 entries = 10 grouped shell families (70 instances) + 229 per-control local entries.** Agent cards (37), run brief/open pairs (30), and vault rows (84) are listed individually in `traces.json`; only the shell was grouped, as required.
- Live link-chain census: **37/37** `GET /api/agents/:id` 200; **15/15** run snapshots 200; **75/75** vault files 200; 9 vault directory toggles source/local; 6/6 shell nav clicks resolve; refresh controls produced `GET /api/agents`, `/api/runs`, `/api/vault/tree`, `/api/settings` + `/api/settings/key-status`; run-detail tabs 8/8 and routing/context/checks/failures/retries/confidence 200.
- OpenAPI live: **41 paths / 44 operations / 3 components / 0 operations missing a 2xx or 4xx response schema** — not a defect after the P1-OpenAPI fix.
- 404: `/missing-td` → **404 text/plain**; `/runs/does-not-exist` → 200 SPA (known client route) then run error state — not a dead control.

## 2. Chain tables (unique families)

| Family | Render → handler | API → route | Service → store | Response → render-back | Verdict |
|---|---|---|---|---|---|
| Shell nav/menu/skip/brand/trust (10) | `AppShell.tsx:52-127` | none; React Router | history | target route | WIRED (70/70) |
| Composer fields | `RunComposer.tsx:117-170` | none | localStorage draft | controlled values | WIRED |
| Start run | `RunComposer.tsx:76-109,208` | `startRun` `api.ts:316` → `POST /api/runs app.ts:528` | `createRun manager.ts:79` → executor | 202 `{runId}` → navigate | UNVERIFIED (no paid run) |
| Recent/run links | `RunTable.tsx:26,37` | `getRunSnapshot api.ts:305` → `app.ts:569` | recorder/SQLite | snapshot → RunDetail | WIRED 15/15 |
| Agents refresh/filter | `AgentsPage.tsx:73,100-121` | `GET /api/agents app.ts:177`; filters local | registry + evidence | 37 cards, filters | WIRED |
| Agent card → drawer | `AgentsPage.tsx:155,200-221` | `getAgent api.ts:393` → `app.ts:217` | registry only | drawer | WIRED; **F1/F4** |
| Agent save/reset/run | `AgentsPage.tsx:235,411,414,479` | PUT/DELETE `/api/agents/:id/prompt`, POST `/run` | settings/createRun | 200/202 | UNVERIFIED |
| Runs list/filter | `RunsPage.tsx:19,48` | `GET /api/runs app.ts:521`; filter local | recorder | 15 rows → failed 1 | WIRED |
| Run actions | `RunDetailPage.tsx:268,277,283,289,353` | snapshot, revise, audit, download, open-folder | `app.ts:569/647/528/489/512` | 200/202/download | WIRED: refresh/download; UNVERIFIED: revise/audit/folder |
| Run tabs | `RunDetailPage.tsx:387-407` | `/routing /context /checks /failures /retries /confidence` | query/SQLite | panels | WIRED 8/8; **F2/F6** |
| Vault tree/file | `VaultPage.tsx:29,92,107` | `GET /vault/tree app.ts:475`, `GET /vault/file app.ts:476` | `buildVaultTree`/safePath/fs | tree 84 → markdown | WIRED 75/75 files |
| Learning refusal | `LearningPage.tsx:164-168` | `GET /api/learning/overview app.ts:404` | learning DB counts | disabled tabs + `E_LEARNING_POOL_EXHAUSTED` | REFUSED-BY-NAME |
| Settings | `SettingsPage.tsx:34,47-56` | `/settings`, `/settings/key-status` | config/keyStatus | read-only status | WIRED |
| Agent drawer local | `AgentsPage.tsx:318-479` | none/local | React state | close/edit/save/reset | 3 WIRED, 10 UNVERIFIED |

## 3. Confirmed defects (ranked)

### TRACE-01 P2 — Agent drawer loses evidence badges
- **Control/tab:** each of 37 agent cards → drawer Evidence section (`AgentsPage.tsx:376-397`).
- **Chain:** card `AgentsPage.tsx:155` → `getAgent` `api.ts:393` → `GET /api/agents/:id` `app.ts:217-221` returns the raw registry `AgentDefinition`; it does **not** include `badges`/`evidence` that the list route adds at `app.ts:177-215`.
- **RED:** `GET /api/agents/architect` keys = `[id,name,group,…prompt]` with no badges/evidence; `GET /api/agents` architect = badges `["registered","representative-live"]` and 5 evidence rows. Live architect drawer renders **“No badge evidence”**.
- **Why product, not harness:** direct HTTP payload divergence; drawer source reads `data.badges`/`data.evidence`; no test-double involved.
- **Fix seam:** `src/server/app.ts:217-221` share the AgentView enrichment/query used at `:177-215`. Regression: detail payload contains badges/evidence; drawer shows live evidence.

### TRACE-02 P2 — Routing candidates persisted but never returned/rendered
- **Control/tab:** Run detail → Routing (`run-detail#22`).
- **Chain:** `RunDetailPage.tsx:657-700` → `getRouting api.ts:434` → `GET /routing app.ts:283-307`; route reads only `route_decisions` and hardcodes `candidates:[]`, `model:null`, `chosen:true`; `route_candidates` is never queried. UI candidate branch `RunDetailPage.tsx:703-741` is unreachable.
- **RED:** SQLite `route_candidates` = **2 rows for run_b8a8e239…, 19 total**; live `/routing` for that run = decisions 2, **candidatesTotal 0**; DB candidate columns `quality/sample_size/est_cost/latency/risk/score` are dropped; Routing tab DOM has no candidate table.
- **Why product:** persisted evidence is withheld; response contract advertises candidates but always returns none.
- **Fix seam:** `src/server/app.ts:283-307` query `route_candidates` and map fields; regression: API candidates length = DB rows, tab renders candidates.

### TRACE-03 P2 — Revision file selection stored then ignored
- **Control/tab:** Run detail → Revise / Revise accepted files (`run-detail#13/#17`).
- **Chain:** `RunDetailPage.tsx:214-221` → `reviseRun api.ts:339` → `POST /revise app.ts:647`; `app.ts:671-675` writes setting `revision_files:<runId>`; `executeReviewRun` `pipeline/run.ts:204-280` never reads it and revises all `parentFiles`.
- **RED (static contradiction):** `grep` finds `revision_files` only at the write in `app.ts:674`; no reader in `src/server`. A supplied `files[]` cannot restrict the child; all files are sent to Cleaner/Sentinel.
- **Why product:** accepted API data control has no effect; the revision scope claim is false.
- **Fix seam:** `pipeline/run.ts:204-220` read the setting and filter `parentFiles`; regression: revise `files:[A]`, A changes, B hash unchanged.

### TRACE-04 P2 — `schema-valid` evidence badge has no producer
- **Control/tab:** Agent card/drawer evidence badge (`app.ts:190`, `AgentsPage.tsx:380-385`).
- **Chain:** `/api/agents` reads `agent_evidence.badge='schema-valid'`; only writer is `pipeline/run.ts:42 recordAgentEvidence` with badge `representative-live`; no other `INSERT agent_evidence` exists.
- **RED:** live `agent_evidence` groups = **representative-live 27 only**; `/api/agents` badge counts = registered 37, representative-live 5, **schema-valid 0**; 37 cards/drawers never show Schema valid.
- **Why product:** the P1-FIXES claim “evidence-backed schema-valid” is not enforced; the read path is dead.
- **Fix seam:** `pipeline/run.ts:37-47` record schema-valid evidence after Zod-validated success (or remove the badge claim). Regression: evidence row + badge appears.

### TRACE-05 P2 — `POST /api/runs` accepts malformed enums and queues a run
- **Control/tab:** Overview → Start run API boundary (`overview#18`).
- **Chain:** `RunComposer.tsx:76-109` → `api.ts:316` → `app.ts:528-552` casts `body.preset/model/thinking as never`; `createRun manager.ts:79` has no runtime enum validation.
- **RED:** disposable in-process temp DB; `POST /api/runs` with `{preset:"bogus-preset",model:"bogus-model",thinking:"bogus-thinking"}` → **202**, row `preset=bogus-preset model=bogus-model thinking=bogus-thinking status=queued`.
- **Why product:** API boundary accepts invalid contracts; a malformed run can become active (and later provider errors). Not a UI-only issue.
- **Fix seam:** `app.ts:537-540` validate `PRESETS/MODEL_IDS/THINKING_MODES`, return 422 before `createRun`; regression: invalid enum → 422 and zero rows.

### TRACE-06 P2 — Terminal run Events tab hides persisted events
- **Control/tab:** Run detail → Events (`run-detail#26`).
- **Chain:** `RunDetailPage.tsx:129` passes `null` to `useRunStream` when terminal; `EventsTab` `:978-1018` renders only local `events` state, so it never calls `GET /api/runs/:id/events` (`app.ts:585-600`).
- **RED:** completed run `run_b8a8e239…`: `GET /events` 200, lastEventId **322**; live Events tab: **“No live events observed”** with “Snapshot last event id: 322”; network capture has no `/events` request.
- **Why product:** persisted 322 events are available; UI presents an empty-as-success state. Not a test-harness false negative.
- **Fix seam:** `RunDetailPage.tsx:129/406/978-1018` fetch persisted events when terminal (new `getEvents` helper) and render; Playwright regression: terminal Events tab lists persisted event types.

## 4. Auditor G findings — explicit disposition

- **G1 — NON-DEFECT.** Revise/Audit render twice (`RunDetailPage.tsx:277,362` and `:283,370`) but invoke the identical setters (`setReviseOpen`, `setAuditOpen`); no divergent handler or lost capability. Download is **not** duplicated (one link `:289`). The audit's “Download twice” is a counting error.
- **G2 — DEFECT (TRACE-01 + TRACE-04).** Agent evidence is lost in detail and `schema-valid` has no producer; live proof above.
- **G3 — NON-DEFECT.** Learning tabs are disabled (`LearningPage.tsx:164-168`); API returns `enabled:false`, `E_LEARNING_POOL_EXHAUSTED`; approval/promotion controls are not rendered. This is REFUSED-BY-NAME, not a dead control.
- **G5 — NON-DEFECT.** Settings shows configured/source/fingerprint only; `GET /api/settings/key-status` returns no balance/checkedAt; UI honestly shows “Not reported”. No secret leak, no false zero.
- **G7 — NON-DEFECT.** Runs status filter is intentionally client-side (`RunsPage.tsx:22-25`); live Completed filter reduced 15→12 and empty status has its own state (`:76-77`). No API call is expected.
- **G4/G6/G8 — not scored as defects:** G4 disabled state is truthful but lacks a specific hint; G6 unexercised negative paths; G8 action controls remain UNVERIFIED. No product evidence of lying status.
- **Quarantined test-harness false negatives confirmed:** navigation accessible-name reuse and first vault row selecting a directory; both are probe errors, not product defects.

## 5. HANDOFF TO FORGEWRIGHT

Confirmed defects only; no style notes.

1. **TRACE-01** — `src/server/app.ts:217-221` return enriched AgentView (badges/evidence) for `GET /api/agents/:id`, matching `:177-215`. Regression: API detail parity + drawer evidence.
2. **TRACE-02** — `src/server/app.ts:283-307` query/map `route_candidates` and stop hardcoding candidates/model/chosen; UI `RunDetailPage.tsx:703-741` renders them. Regression: API candidate count = DB; tab candidate rows.
3. **TRACE-03** — `src/server/pipeline/run.ts:204-220` read `revision_files:<child>` and restrict `parentFiles`; regression: files[] scope and parent hash unchanged.
4. **TRACE-04** — `src/server/pipeline/run.ts:37-47` record `schema-valid` evidence after validated success (or remove badge claim); regression: badge/evidence visible.
5. **TRACE-05** — `src/server/app.ts:537-540` validate preset/model/thinking before `createRun`; regression: invalid enum 422, no run.
6. **TRACE-06** — `web/src/pages/RunDetailPage.tsx:129/406/978-1018` load persisted events for terminal runs; regression: terminal Events tab shows `/events` rows.

Suggested regression commands after fixes:
`npm.cmd run typecheck`; targeted `vitest run test/unit/logic-* test/unit/llm* test/pipeline-qa.test.ts`; `npx playwright test e2e/app.spec.ts -g "run detail"`; explicit API probes for agents detail, routing candidates, events, invalid enum.
