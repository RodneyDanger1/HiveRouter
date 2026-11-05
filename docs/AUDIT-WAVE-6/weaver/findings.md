# W6 AUDIT — Weaver (front-to-back control/value audit)

- **Task:** `task-1` / `W6-AUD-01` (independent read-only Weaver audit seat)
- **Repo:** `C:\Users\Riley\Desktop\HiveRouter`
- **App:** `http://127.0.0.1:8787` — health `ok`, phase `B2`, db `ok`, key configured (`environment`, `c30cfdbc`), no active run at baseline.
- **Captured:** 2026-11-03 22:11–22:20 America/Chicago (2026-11-04T04:11–04:20Z)
- **Method:** source read + Playwright 1.64.1 with system Chrome (`channel=chrome`), viewport 1440×1000, live DOM inventory, network + console capture, read-only HTTP/DB probes. **No mocks used as proof.**
- **Write scope:** only `docs/AUDIT-WAVE-6/weaver/**`. No `src/`, `web/src/`, `test/`, `e2e/`, `package.json`, config, skills, production DB, workspace, or runs were modified. No git commands.
- **No-write proof:** all **150/150** files inventoried in `docs/AUDIT-WAVE-6/baseline.sha256` still hash-match after the audit (SHA-256 recomputed read-only).
- **Not exercised (read-only mandate):** Start run, Stop/cancel, Revise, Audit, Download, Open folder, prompt Save/Reset confirm, agent Run agent, learning approvals/promotions/rollback, provider-key ingress, server restart, paid provider calls.
- **Task tooling:** no `team_task_update` tool is exposed in this seat; the task was not claimable and this report is the handoff.

## 1. Verdict summary

| Measure | Value |
|---|---|
| Pages audited | 7 routes (6 static + run detail) + 404; run detail captured twice = **9 surfaces** |
| Control instances captured | **398** (350 across 7 pages, 48 run-detail baseline; 9 additional drawer controls; 37 agent cards / 150 vault rows / 25 run rows / 210 event rows inside those totals) |
| Server event types emitted | **16** |
| Client event types subscribed | **27** |
| Overlap | **11** |
| Emitted but unsubscribed | **5** (`run.queued`, `agent.failed`, `phase.skipped`, `context.skipped`, `repair.stalled`) |
| Subscribed but never emitted | **16** (15 types + `heartbeat`; server sends SSE comments) |
| Control families traced | **34** (11-hop chain each) |
| Family verdicts | 24 WIRED-AND-WORKS · 2 WIRED-BUT-DEAD · 1 REFUSED-BY-NAME · 7 UNVERIFIED |
| Confirmed defects | **13** (2 High, 4 Medium, 7 Low) + 5 observations |
| Run_abf5 screen | **stale mid-run capture — not a terminal-convergence bug** (see §7) |

**Top 5 defects by impact**

1. **F1 (High)** — the live SSE client silently drops 5 event types the server really emits, including `agent.failed` and `repair.stalled`.
2. **F2 (High)** — failed / cancelled / budget-exceeded runs never write usage totals to the run row, so the UI reports spend and tokens as *“Not measured”* although every provider call reported them.
3. **F3 (Medium)** — a run’s hard cost cap is persisted twice but is not served by any route, so the cap is never rendered anywhere.
4. **F4 (Medium)** — the Context tab renders four per-item columns that are never produced (`Tokens`, `Chars`, `Reason`, `Included`) and claims excluded items are shown; the route never reads `excluded_json`.
5. **F5 (Medium)** — every Routing decision displays a hardcoded `reason = "static prior route"`.

## 2. Deliverables

| File | Contents |
|---|---|
| `controls.json` | Per-page control inventory (selectors, roles, states, verdicts, render/handler, counts, gaps, probe corrections) from live DOM + source |
| `traces.json` | 34 control families × 11-hop chain (`render → handler → client → request → route → service → store → provider → response → render-back → re-entry`) with verdict + evidence |
| `payloads.json` | 16 server event types × emitter/payload/sample/consumer vs 27 client subscriptions; raw SSE frames; missing/dead lists |
| `findings.md` | This report |
| `evidence/api/*.json` | 36 raw API payloads (health/meta/stats/settings/agents/runs/learning/vault + both runs' snapshot/events/checks/routing/context/failures/retries/confidence/files) |
| `evidence/browser/*.json` | Live DOM/network/console captures, run-detail and tab captures, dialog probes, keyboard/focus probes, request census |
| `evidence/logs/*` | Raw SSE (108 frames), emitter grep, DB probes, key/unknown-route refusals, capture/build logs |
| `evidence/screens/*.png` | Full-page screenshots for every page, both run details, every tab, dialogs, vault preview |

Evidence counts: 34 screenshots, 14 browser captures, 36 API payloads, 20 log files, 13 probe/build scripts. All timestamps are wall-clock 2026-11-03 22:xx local.

## 3. Severity scale

- **P1 / High** — a stated value or event is wrong or absent on a routine path; an operator would act on false information.
- **P2 / Medium** — a rendered claim/control cannot be backed by its data path; a whole control family is misleading.
- **P3 / Low** — a11y/contract/copy defect with bounded impact; no data corruption; a named refusal or `—` protects the user.

## 4. Confirmed defects

### F1 — High — Live event stream drops 5 server-emitted event types

- **Expected:** while a run is active, the “Live events” table shows every event the server emits, especially `agent.failed` and `repair.stalled`.
- **Actual:** the server emits 16 types; the client subscribes to 27 names that **do not include** `agent.failed`, `phase.skipped`, `context.skipped`, `repair.stalled`, `run.queued`. EventSource dispatches named frames only to registered listeners, so those frames are discarded. 16 of the client’s 27 listeners are dead (no emitter at all).
- **Broken hop:** client subscription → `web/src/hooks/useApi.ts:72-100` (`STREAM_EVENT_TYPES`) and `:142-143` (`source.addEventListener(type, handler)`).
- **Evidence (live):**
  - Raw SSE replay for `run_abf5fe78aab1e932ff` contains **108 frames** including `event: run.queued` and `event: repair.stalled` (`evidence/logs/sse_abf5.txt`; frame `{"schema":"hive.api.v1","type":"repair.stalled","data":{"reason":"attempt budget exhausted","attempts":2},"meta":{"seq":658,...}}`).
  - Persisted ledger has the same: 108 events, types incl. `repair.stalled` 1, `run.queued` 1 (`evidence/api/run_abf5fe78aab1e932ff_events.json`).
  - Emitters: `agent.failed` `src/server/pipeline/run.ts:234`; `phase.skipped` `:497,788`; `context.skipped` `:679`; `repair.stalled` `:820,851`; `run.queued` `src/server/runs/manager.ts:135`.
  - Client list contains none of those names; `run.queued`/`repair.stalled` appear only after the run is terminal and the **persisted** path loads them (`RunDetailPage.tsx:129-133`).
- **Impact:** a live watcher does not see an individual agent failure, a routing/context skip, or a repair stall; the run can look stalled with no explanation. The persisted terminal ledger is correct, so this is a live-feed lie by omission.
- **Fix seam:** add the 5 names to `STREAM_EVENT_TYPES` (or switch to a catch-all subscription model), and remove the 15 never-emitted listeners. Server emitters need no change.
- **Also see:** `payloads.json` → `summary`, `missingSubscriptions`, `clientSubscribedOnly`.

### F2 — High — Failed/cancelled/budget runs show spend and tokens as “Not measured” although they were measured

- **Expected:** at terminal state, run-level `costUsd`, `promptTokens`, `completionTokens` aggregate the `usage` ledger for every outcome, or the copy says “not aggregated for failed runs”.
- **Actual:** only the success path (`finalize`) writes totals. Every non-completed run has `runs.cost_usd/prompt_tokens/completion_tokens = NULL` even though its usage rows are `source='provider'`, zero unknown rows, and every call has a known cost. The Run detail then renders **“Estimated spend — Not measured”** plus copy ***“The provider has not reported a cost yet.”*** (`web/src/components/ui.tsx:591-615`, copy at `:613`), and the runs ledger shows `—` in the Spend column.
- **Broken hop:** store/aggregate → `src/server/pipeline/run.ts:853-861` (gate fail returns before `usageTotals`), `:884-888` (exception/cancel path), `src/server/runs/manager.ts:150-157` (executor rejection). Only `run.ts:1017,1075-1084` computes and writes totals.
- **Evidence (read-only DB):** `evidence/logs/db-usage-probe.txt`

  | Run | Status | run.cost_usd | usage rows | summed usage cost | unknown rows |
  |---|---|---|---|---|---|
  | `run_abf5fe78aab1e932ff` | failed | **null** | 20 | **$0.299980656** | 0 |
  | `run_2bb2f8edf3043fe89e` | failed | null | 9 | $0.051138816 | 0 |
  | `run_9c4659ee2d4fbb40bf` | failed | null | 7 | $0.00955884 | 0 |
  | `run_26e2456caef4b8be0c` | budget_exceeded | null | 18 | $0.185232012 | 0 |
  | `run_65da49c3948f9d8f5c` | budget_exceeded | null | 9 | $0.045521616 | 0 |
  | `run_23af9b7837448cb24a` | budget_exceeded | null | 10 | $0.01270053 | 0 |
  | `run_1e5add0b6ba2e3c736` | budget_exceeded | null | 4 | $0.002719722 | 0 |
  | `run_95c11797b4923b4277` | completed | $0.250781772 | 19 | $0.250781772 | 0 |

  - Live abf5 page: `PROMPT TOKENS —`, `COMPLETION TOKENS —`, `Estimated spend Not measured`, yet the same page's timeline lists `604 in / 2,002 out / $0.0026` … per step (`evidence/browser/run-abf5-detail.json`, screenshot `evidence/screens/run-abf5-overview.png`).
  - Overview global total is `$0.924624168` (`evidence/api/stats.json`) and includes those usage rows, so the same page says the failed runs cost nothing while the aggregate includes their spend.
- **Impact:** false “not measured” on 7 of 25 runs; an operator cannot see what a failure cost; ledger and run detail disagree with the dashboard.
- **Fix seam:** call `usageTotals(runId)` and `updateRun({cost_usd,prompt_tokens,completion_tokens})` on every terminal path (gate-fail, catch/cancel, executor rejection); alternatively, have the snapshot route aggregate usage when the run row is null.

### F3 — Medium — Run cost cap is never displayed; value is persisted twice but served nowhere

- **Expected:** run detail shows spend against the run’s hard cap (e.g. `$0.2508 / $0.50 cap`); Settings shows configured limits.
- **Actual:** cap is stored per run in two places — `settings.run_limit:<runId> = {"maxCostUsd":0.5}` and `run_snapshots.snapshot_json.limits.maxRunCostUsd = 0.5` — but:
  - `GET /api/runs/:id/snapshot` returns only `{run,lastEventId,steps,checks,artifacts,truncated}` — **no `limits`** (`src/server/app.ts:802-816`).
  - `RunDetailPage` reads `snapshot.limits.maxCostUsd` (`web/src/pages/RunDetailPage.tsx:199-201`) → always `null`; `CostMeter` only appends the cap when non-null (`web/src/components/ui.tsx:607`).
  - `GET /api/settings` returns `limits` (`app.ts:212-218`) but `SettingsView` filters out every object and its `knownKeys` contain no `limits` path (`web/src/pages/SettingsPage.tsx:134-138`) → Runtime settings shows only MODEL, THINKING.
- **Broken hop:** response projection → snapshot route omits `limits`; settings component drops `limits`.
- **Evidence:** `evidence/logs/db-probe.txt` (run_limit rows for abf5/95 = 0.5; `snapshot has limits: true`); `evidence/api/run_abf5fe78aab1e932ff_snapshot.json` has no `limits` key; live `hasLimits:false` (`evidence/browser/run-95-detail.json`); screenshots show `Estimated spend $0.2508` with no cap and failed run `Not measured`.
- **Impact:** the “hard cost cap” is a core promise on Overview/Settings/run detail; the UI cannot show it.
- **Fix seam:** include `limits` (or `maxCostUsd`) from `run_limit:<id>`/run snapshot in the snapshot payload; render it in Settings instead of filtering nested `limits`.

### F4 — Medium — Context tab renders four never-populated columns and claims excluded items that are never fetched

- **Expected:** the copy says *“Included and excluded items are shown with reasons and estimated size”* (`web/src/pages/RunDetailPage.tsx:768`); the table advertises `Tokens / Chars / Reason / Included` (`:827`).
- **Actual:**
  - `included_json` persists only `{id, kind, path, tokens, mandatory}` and **tokens is written as `null`** for these items (packer returns null; `src/server/pipeline/run.ts:661`).
  - The route maps only `{id, path, kind, tokens, mandatory}` and hardcodes `agentId:null`, `maxTokens:null`; it never reads `excluded_json` (`src/server/app.ts:455-467`).
  - Live result: **129 context items across 29 packs — 0 have tokens, chars, reason, or included**. Every row renders `Tokens —`, `Chars —`, `Reason —`, `Included Not reported`; 0 excluded arrays were non-empty in these runs, but the route can never render one.
- **Broken hop:** pipeline persist → route projection → table columns.
- **Evidence:** `evidence/logs/db-context-probe.txt`, `evidence/api/run_abf5fe78aab1e932ff_context.json`, live panel text/tables in `evidence/browser/run-abf5-detail.json` (15 tables; table 0 rows `["brief","brief","—","—","Yes","—","Not reported"]`).
- **Impact:** 4 of 7 columns are decorative; the tab's core claim (included/excluded with reasons) is not backed by any data.
- **Fix seam:** persist per-item chars/reason/included and pack maxTokens/agent, return `excluded_json` as `included:false` rows with reasons, or remove the columns/claim.

### F5 — Medium — Every routing decision displays a hardcoded reason

- **Expected:** reason text reflects the decision’s actual rationale/features.
- **Actual:** `reason: 'static prior route'` is a literal in the map (`src/server/app.ts:423`), and decision-level `qualitySource`/`sampleSize` fall back to `'prior'`/`0` (`:416-417`). Live: all 14 abf5 decisions render “static prior route”; the DB `features_json` contains no reason field.
- **Broken hop:** response → `RunDetailPage.tsx:731` (`{decision.reason}`).
- **Evidence:** `evidence/api/run_abf5fe78aab1e932ff_routing.json`, live text in `evidence/browser/run-abf5-detail.json` (tab Routing), `src/server/app.ts:409-427`.
- **Impact:** a constant is presented as per-decision evidence; if routing later uses different inputs, this copy silently lies.
- **Fix seam:** derive/store the real reason, or omit the field rather than printing a constant.

### F6 — Low/Medium — Two different “truncated” flags are both wrong or mislabeled

- **Expected:** `GET /api/runs/:id/events.truncated` is true only if some of *this run’s* events were dropped; the run header's “Replay truncated” badge refers to event replay.
- **Actual:**
  - `truncated = after < start` where `start = max(after, current - 500)` uses the **global autoincrement seq** (`src/server/app.ts:824-832`). abf5 has 108 events, seq 552–659, all returned → `truncated:true`; completed run 102 events → `truncated:true`.
  - The UI ignores that flag entirely (`getRunEvents` drops it) and instead labels `snapshot.truncated` as **“Replay truncated”** (`RunDetailPage.tsx:330`); `snapshot.truncated` actually means **artifacts > 200** (`app.ts:806-814`).
- **Evidence:** `evidence/api/run_abf5fe78aab1e932ff_events.json`/`..._snapshot.json` (truncated true vs false), `evidence/logs/db-probe.txt` (events min 552/max 659/count 108), live `apiSnapshot.eventsTruncated:true` (`evidence/browser/run-abf5-detail.json`).
- **Impact:** an API consumer gets a false truncation signal; a >200-artifact run would show a badge that says replay is truncated when only the artifact list is.
- **Fix seam:** base events truncation on this run’s first seq or a `LIMIT+1` fetch; rename the snapshot badge to “Artifact list truncated” and/or use the events flag.

### F7 — Low — One Escape closes both dialog layers

- **Expected:** Escape closes only the topmost dialog (Reset confirmation), leaving the agent drawer open.
- **Actual:** with the agent drawer + Reset confirmation open, one Escape closed both (dialog count 2 → 0, drawer no longer visible). Both `Modal` instances register document-level `keydown` handlers that call `onClose` unconditionally (`web/src/components/ui.tsx:404-408`); the nested `ConfirmDialog` is rendered inside the outer `Modal` (`web/src/pages/AgentsPage.tsx:495-505`).
- **Evidence:** `evidence/browser/agents-drawer.json` (`dialogs:2`, `dialogsAfterEscape:0`, `drawerStillVisible:false`), screenshots `agents-reset-confirm.png`.
- **Impact:** destructive confirmations are dismissed together with the context that explains them; duplicated focus traps can also fight.
- **Fix seam:** only the top-most modal should handle Escape (dialog stack or `event.defaultPrevented`), and nested modals should portal outside the parent's trap.

### F8 — Low — Skip link scrolls but does not move keyboard focus

- **Expected:** activating “Skip to content” moves focus into `<main id="main-content">`.
- **Actual:** fresh load → Tab focuses the skip link; Enter sets `#main-content`, scrollY 58, but `document.activeElement` falls back to `BODY` because `<main>` has no `tabindex="-1"` (`web/src/components/AppShell.tsx:140`). Next Tab restarts at the top.
- **Evidence:** `evidence/logs/skip-probe.log`; `evidence/browser/pages.json#overview`.
- **Fix seam:** `tabIndex={-1}` on `<main>` and focus it on skip activation (or use `:target` + focus).

### F9 — Low — Tab widgets lack `aria-controls` / `aria-labelledby` associations

- **Expected:** each `role=tab` names its panel via `aria-controls`; the panel has an id and `aria-labelledby`.
- **Actual:** all 8 run tabs have `aria-controls = null`, panel has no id/label; the Learning tabs likewise. Keyboard behavior itself works (`ArrowRight` from Events wraps to Overview; `ArrowLeft` implemented at `ui.tsx:354-366`), and `aria-selected`/roving `tabIndex` are correct.
- **Evidence:** `evidence/browser/run-detail-controls.json#a11y`, `ui.tsx:333-371`, `RunDetailPage.tsx:396`.
- **Fix seam:** add stable tab/panel ids and `aria-controls`/`aria-labelledby`.

### F10 — Low — Every page logs a 404 console error for `/favicon.ico`

- **Expected:** no console errors on healthy pages.
- **Actual:** `GET /favicon.ico` → 404 (HTML), logged as a console error on `/`, `/no-such-page`, and any path loading the shell. No favicon link or asset exists in `web/dist/index.html`.
- **Evidence:** `evidence/browser/pages.json` console entries; `evidence/browser/run-detail-controls.json#http.favicon` (404).
- **Impact:** noise in every browser session and audit capture; no functional impact.
- **Fix seam:** add a favicon asset/link (or a 204 route).

### F11 — Low — Unknown API routes return `E_RUN_NOT_FOUND`

- **Expected:** an unknown API path returns a generic not-found code (e.g. `E_ROUTE_NOT_FOUND`).
- **Actual:** `GET /api/nope` → `404 {"error":{"code":"E_RUN_NOT_FOUND","message":"Run not found."}}`; `GET /api/settings/key` (no route) falls into the same handler. Cause: `setNotFoundHandler` returns `refusal(reply,'E_RUN_NOT_FOUND')` for **any** `/api` URL (`src/server/app.ts:969-970`).
- **Evidence:** `evidence/logs/unknown-api.txt`; `evidence/browser/run-detail-controls.json#http`.
- **Impact:** misleading diagnostics for clients; status code is correct.
- **Fix seam:** dedicated unknown-route refusal.

### F12 — Low — Checks “Time” column can never populate; “File→code” fallback can never fire

- **Expected:** `TIME` shows check duration; `FILE` falls back to `check.code`.
- **Actual:** `insertCheck` persists only id/status/detail/mandatory/file/line (`src/server/runs/recorder.ts:284-303`); the `checks` table has no `code`/`duration` columns (`src/server/db/migrations.ts:88-99`); `getChecks` returns no `code`/`durationMs`. Verifier does produce `code` for syntax failures (`src/server/verify/verifier.ts:118`), but it is dropped at insert. Live: all 21 check rows across two runs show `TIME —`.
- **Evidence:** live checks table in `evidence/browser/run-abf5-detail.json` / `...-95...`; `evidence/api/run_abf5fe78aab1e932ff_checks.json`.
- **Fix seam:** persist/return `code`/`durationMs` or drop the columns.

### F13 — Low — `E_PROMPT_TOO_LARGE` is used for too-short/empty/too-many-files inputs

- **Expected:** a refusal code/message that describes the actual failure.
- **Actual:** `E_PROMPT_TOO_LARGE` message is *“Prompt override exceeds the size limit.”* (`src/shared/refusals.ts:16`) but it is returned for: analyzer prompt <8 chars (`app.ts:229`), empty prompt (`:288`), empty agent input (`:313`), feedback <4 chars (`:890`) and **plan file count > 24** (`pipeline/run.ts:479`; manager.ts:81-82 also reuses it for empty/oversize brief).
- **Evidence (live, safe validation):** `POST /api/prompt/analyze {"prompt":"abc"}` → `422 {"code":"E_PROMPT_TOO_LARGE","message":"Prompt override exceeds the size limit.","details":{"reason":"prompt must be at least 8 characters","observed":3}}` (`evidence/logs/short-prompt-response.txt`).
- **Impact:** API clients get a false reason; the composer pre-validates so the UI rarely shows it.
- **Fix seam:** split codes (`E_PROMPT_TOO_SMALL`, `E_PLAN_TOO_LARGE`, `E_INPUT_REQUIRED`) or make the message condition-specific.

## 5. Observations (not counted as defects)

- **O1 — Learning inspect surfaces are unreachable in the refusal state.** `/api/learning/overview` returns `enabled:false, reason:E_LEARNING_POOL_EXHAUSTED, consentRequired:true, counts{traces:16, failures:2, datasets:0, sealedBlocks:0, completeSealedBlocks:0, candidates:0, evaluations:0, promotions:0, audit:11}` and 4 consent scopes, all inactive. The page intentionally shows only the refusal; all 8 tabs are `disabled` and the counts/scopes are not rendered. The refusal is truthful and named, but the existing DB evidence (16 traces / 11 audit) has no UI path while `enabled=false`. Evidence: `evidence/api/learning-overview.json`, `evidence/browser/learning.json`.
- **O2 — Vault exposes a stale QA temp root.** `vault/qa-api-temp/` (created 2026-11-03 10:33, containing four empty nested vault dirs) is rendered as a 5th vault root. The vault page faithfully renders the directory; the pollution is data hygiene, not wiring. Evidence: `evidence/api/vault-tree.json`, `evidence/browser/pages.json#vault`.
- **O3 — Runs filter is client-side over a 100-row page.** `listRuns(100)` then local filtering; the API supports `?status=` but the UI never sends it. At >100 runs the ledger count/filter silently caps. The filter list also omits the legal `interrupted` status (`web/src/pages/RunsPage.tsx:16` vs `src/shared/types.ts:1-12`). No live impact at 25 runs.
- **O4 — “Accepted tree” label on a failed run.** The workspace path card is labeled `Accepted tree` even when the run has 0 artifacts and failed; the path is real, the adjective is not. `RunDetailPage.tsx:385-386`; live abf5 shows `ACCEPTED TREE …` + `ARTIFACTS 0`.
- **O5 — Dead server write path for reviews.** `insertReview` and `getUserFeedback` have no callers (`src/server/runs/recorder.ts:326,380`; grep 0). The `reviews` table is never written; no review evidence reaches confidence components (`review: 0` on both runs). Dead capability, not a visible control.

## 6. Value provenance (displayed value → origin)

| Displayed value | Render site | Origin field | Route/service | Verdict |
|---|---|---|---|---|
| Run status badge | `RunDetailPage.tsx:323` | `runs.status` | `GET /runs/:id/snapshot` → recorder.getRun | OK (live failed/completed) |
| Phase badge | `:324` | `runs.phase` | same | OK (`done`) |
| Step count badge | `:325` | `snapshot.steps.length` | recorder.getSteps | OK (20/19) |
| Stream badge | `:326-329,154-162` | local `terminal` + `streamStatus` | no SSE for terminal | OK (Terminal/Complete · snapshot; 0 stream requests) |
| Created / Duration | `:333-334` | `createdAt/startedAt/finishedAt` | run row | OK (7m30s / 6m45s) |
| Prompt/completion tokens | `:335-336` | `run.promptTokens/completionTokens` | run row | **FAILED runs show —** (F2) |
| Snapshot hash | `:337` | `run.snapshotHash` (16 chars) | run row ↔ run_snapshots.hash | OK |
| Parent | `:338` | `run.parentRunId` link | run row | OK (audit run → parent click verified) |
| Cost / cap | `CostMeter :341` | `run.costUsd`, `snapshot.limits.maxCostUsd` | snapshot (no limits) | spend OK for completed; **cap always null** (F3); failed spend null (F2) |
| Error code/message | `:343-349` | `run.errorCode/errorMessage` | run row | OK (`GATE_FAILED`) |
| Workspace path | `:386` | `run.workspacePath` | run row | OK value, label “Accepted tree” (O4) |
| Overview step tokens/cost | `:510-512` | `steps.prompt_tokens/completion_tokens/cost_usd` | steps table | OK (but see F2 contradiction) |
| Checks counts | `:536` | `checks.length` + fail/unverified filter | checks table | OK (16/4 and 5/0) |
| Artifacts count | `:537` | `artifacts.length` | artifacts table | OK (0/20) |
| Trace complete | `:538` | `runs.trace_complete` | run row | OK (No/Yes) |
| Policy version | `:539` | `runs.policy_version_id` | run row | OK |
| File bytes/SHA | `:610-612` | artifacts row | artifacts table | OK |
| File content | `:617-618` | workspace file via `/files/content` | safePath + fs | OK (GET 200) |
| Check status/file/line | `:649-657` | checks row | checks table | OK; TIME/`code` dead (F12) |
| Routing decision reason | `:731` | hardcoded constant | app.ts:423 | **FAILS** (F5) |
| Routing candidates | `:739-750` | route_candidates row | app.ts:385-408 | OK (42 candidates) |
| Context pack usedTokens/prefix | `:811-815` | context_packs.est_tokens/prefix_hash | app.ts:461-463 | OK |
| Context item path/kind/mandatory | `:831-835` | included_json | app.ts:466 | OK |
| Context item tokens/chars/reason/included | `:833-837` | never produced | app.ts:466 | **FAILS** (F4) |
| Failure signature/category/count/severity | `:877-881` | failure_signatures/occurrences | app.ts:476-478 | OK |
| Failure repair status | `:881` | route omits `repairStatus` | app.ts:478 | Always — (projection gap; minor) |
| Retry rows | `:898-905` | retry_attempts | app.ts:484-485 | OK (empty) |
| Confidence decision/score/components | `:954-977` | confidence_records | app.ts:497-499 | OK (`needs_review`, 0.786667) |
| Confidence mandatory gaps | `:963-969` | route omits `mandatoryFailed/Unverified` | app.ts:499 | Block can never render (minor) |
| Event type/payload | `:1037-1043` | events table payload | app.ts:828-832 | OK persisted (108/102); live gap F1 |
| Learning reason/consent flag | `LearningPage.tsx:183-184` | overview.reason/consentRequired | `/learning/overview` | OK named refusal |
| Learning counts/scopes | not rendered | overview.counts/consent | same response | Available but hidden (O1) |
| Key configured/source/fingerprint | `OverviewPage.tsx:90-113`, `SettingsPage.tsx:46-58` | keyStatus() | `/settings/key-status` | OK (no key material) |
| Key checkedAt/balance | `SettingsPage.tsx:50,51-57` | absent | keyStatus() | Honest “Not reported” |
| Stats cards | `OverviewPage.tsx:166-195` | `/api/stats` | SQL aggregates | OK (37/25/1,367,744/524,716/$0.9246) |
| Vault tree/preview | `VaultPage.tsx:52-129` | `/vault/tree` + `/vault/file` | fs walk/safePath | OK (5 roots/150 rows) |
| Agent badges/evidence | `AgentsPage.tsx:167-175,376-397` | agent_evidence + stepped join | app.ts:261-268 | OK (registered/live/schema) |
| Prompt analysis card | `PromptAnalysisCard.tsx` | analyst response | POST `/prompt/analyze` | UNVERIFIED (paid; not clicked) |

## 7. run_abf5 — stale capture vs terminal-convergence bug

**Classification: STALE MID-RUN CAPTURE. No terminal-convergence defect reproduced.**

- Current live UI (2026-11-03 22:12, plus hard reload 1.5 s later): `FAILED`, `DONE`, **`20 STEPS`**, **`TERMINAL · SNAPSHOT`**; body contains **no** “Live stream”; network shows **0 `/api/runs/:id/stream` requests** for the terminal run. Evidence: `evidence/browser/run-abf5-detail.json` (`header.badges`, `afterReload`), screenshot `evidence/screens/run-abf5-overview.png`; independent lead capture `docs/AUDIT-WAVE-6/lead-ui-abf5.png` shows the same.
- API truth at the same moment: `status:failed`, `phase:done`, `steps:20`, `lastEventId:659`, 108 persisted events (`evidence/api/run_abf5fe78aab1e932ff_snapshot.json` / `_events.json`).
- The reported screen (“Running / 7 steps / Live stream”) is exactly the mid-run state: step #7 finished at `03:09:52.440Z`, step #8 began `03:09:52.479Z`, and the run failed at `03:15:46.742Z`. A 7-step snapshot could only exist from step #7 start (`03:09:33.029Z`) until step #8 start (`03:09:52.479Z`), i.e. more than six minutes before the `03:15:46.742Z` terminal write; a 5-second poll lag extends the visible window by at most 5 s. The capture is therefore consistent with a mid-run screenshot, not with a terminal page stuck on an old state.
- No code path pins `running` after a terminal transition: polling every 5 s while `!terminal` (`RunDetailPage.tsx:141-145`), SSE `run.failed` is subscribed, and a terminal snapshot renders the terminal badge. Long-open convergence could not be exercised live because no non-terminal run exists (baseline: no active run; creating one is prohibited).
- **Residual (unverified) risk:** if a run transitions terminal while the page is open, `visibleEvents` prefers the 100-event live buffer over the just-fetched persisted ledger (`RunDetailPage.tsx:133`), so the terminal Events tab may show fewer events until reload. Not observable in this DB; flagged for the next live run.

## 8. Event/payload audit (summary — full matrix in `payloads.json`)

- Server emits **16** types; client listens for **27**. The persisted path (`GET /events → mapPersistedRunEvents`) renders **all** types, which is why the terminal ledger is correct while the live feed is lossy.
- Transport is sound: SSE frames `id/event/data` with `{schema,type,data,meta:{seq,runId,replay}}`; 108 replay frames captured for abf5 including the 5 unsubscribed types; heartbeat is an SSE comment (`: ping`) and never becomes a named event.
- Every run's SSE default starts at `current − 500` using the global seq; a run with >500 events silently loses its earliest live frames (no marker) — not exercised (all runs <500).
- The persisted event payload is `{seq,runId,type,payload,createdAt}`; the live client stores the whole envelope as `data`, so the same Events “Inspect” row shows a different JSON shape live vs after reload. Cosmetic inconsistency, no data loss (verified from code + captured frames).

## 9. Control census (full inventory in `controls.json`)

| Surface | Route | Controls | Notes |
|---|---|---|---|
| Overview | `/` | 31 | 2 nav CTAs, composer (1 textarea, 3 selects, 1 input, 2 buttons), provider/stage cards, 4 stat cards, 5 recent-run rows (10 links) |
| Agents | `/agents` | 51 | Refresh, search, 2 filters, 37 cards (37 of 37 shown) |
| Runs | `/runs` | 63 | New run, Refresh, status filter, 25 rows × 2 links |
| Vault | `/vault` | 161 | Refresh, 5 roots, 150 tree rows (dirs+files) |
| Learning | `/learning` | 21 | 8 disabled tabs, reason, Open settings, Refresh status, links |
| Settings | `/settings` | 12 | Refresh, key panel, stage panel, runtime (2 rows), link |
| 404 | `/no-such-page` | 11 | Return to overview; HTTP 404 |
| Run detail (failed) | `/runs/run_abf5…` | 22 | Refresh, disabled Download, Open folder, 8 tabs; Events tab 130 with 108 Inspect rows |
| Run detail (completed) | `/runs/run_95…` | 26 | + Revise/Audit/Download anchor; Files tab 47 with 20 artifact rows |
| Agent drawer (overlay) | `/agents` | 9 | Close, Edit prompt, Reset, Save, prompt editor, Input/Mode/Max cost/Target/Run agent, Copy |

**Derived counts:** 398 visible control instances; shell contributes 10 per page; repeated widgets: 37 agent cards, 150 vault rows, 25 run rows, 210 event Inspect toggles, 14 routing decision cards per run, 14/15 context pack cards.

Keyboard/labels/destructive confirmations:
- Every form control has a label or aria-label; agent cards have `aria-label="Open <name>"`; icon links have aria-labels; modal traps Tab and initial focus (`ui.tsx:395-431`).
- Destructive actions use confirmation dialogs with explicit copy (Stop, Reset prompt, Audit); Stop is toned `danger`; the destructive `confirmLabel` is never “OK”.
- Nav menu uses a stable selector + `aria-expanded`; state-dependent label change was handled (probe correction 1).
- Defects: skip-link focus (F8), Escape across nested modals (F7), tab associations (F9).

## 10. Unverified / blocked

| Item | Exact blocker | What would prove it |
|---|---|---|
| Start run → pipeline → artifacts | Paid run creation prohibited | A real run with a throwaway budget and approval |
| Stop/cancel | Read-only mandate; no active run | Cancel a live run; observe `run.cancelled` + terminal snapshot |
| Revise / Audit | Creates paid child runs | One child run each; verify parent link + `runKind` |
| Download | Download prohibited | Click on completed run; verify ZIP contains 20 artifacts |
| Open folder | Spawns explorer window | Not appropriate in audit; static route verified |
| Agent prompt Save/Reset confirm | Writes production `settings` | PUT/DELETE on a disposable agent; verify snapshot pinning |
| Agent ad-hoc run | Paid provider call | One live call with a low cap |
| Analyze prompt / prompt analyst card | Paid provider call | One analysis of a short brief; verify quotes/repair |
| Learning approvals/promotions/rollback | Mutations + dataset empty/consent inactive | Sealed 65-case pool + consent + approval token |
| Live SSE end-to-end (F1 impact) | No non-terminal run | Start a run and watch the live event table; `agent.failed`/`repair.stalled` rows should appear with a fixed client |
| Terminal transition while open (live buffer vs ledger) | No non-terminal run | Run a job to completion with the detail page open, then inspect Events before reload |
| Provider 5xx / timeout / key absence | Would require breaking the healthy server | Fault injection outside the audit mandate |
| Runs ledger >100 | Only 25 runs exist | Seed 101+ runs; check filter/count honesty |
| Interrupted status | No interrupted run in DB | Restart with an active run (prohibited) |
| `truncated` on >200 artifacts / >500 events | No such run | Synthetic boundary data; not fabricated here |
| Stats unknown-usage behavior | 161/161 usage rows are `provider` with cost | Insert an unknown row in a disposable DB, not production |

## 11. Evidence index (all under `docs/AUDIT-WAVE-6/weaver/`)

- **Controls / traces / payloads:** `controls.json`, `traces.json`, `payloads.json`
- **API payloads:** `evidence/api/` (health, meta, stats, settings, key-status, agents, runs, learning overview/traces/datasets/candidates/evaluations/promotions/audit, vault-tree, both runs' snapshot/events/checks/routing/context/failures/retries/confidence/files)
- **Browser:** `evidence/browser/pages.json`, `run-abf5-detail.json`, `run-95-detail.json`, `run-detail-controls.json`, `agents-drawer.json`, `vault.json`, `runs-filter.json`, `learning.json`, `settings.json`, `navigation.json`, `interactions.json`, `micro.json`, `focus-order.json`, `run-audit-parent.json`
- **Logs:** `evidence/logs/sse_abf5.txt` (108 frames), `emitters.txt`, `db-probe.txt`, `db-usage-probe.txt`, `db-context-probe.txt`, `key-refusal.txt`, `unknown-api.txt`, `short-prompt-response.txt`, `skip-probe.log`, capture/build logs
- **Screenshots:** `evidence/screens/` (34: all pages, both runs, all tabs, dialogs, vault preview, filter state, parent run)
- **No-write proof:** `docs/AUDIT-WAVE-6/baseline.sha256` re-verified read-only: 150/150 hashes match.
- **Probe scripts (audit dir only):** `evidence/capture.mjs` … `capture6.mjs`, `db-*.mjs`, `skip-probe.mjs`, `build-controls.mjs`, `build-payloads.mjs`, `build-traces.mjs`

## 12. Method notes / probe corrections

1. `getByRole('button',{name:'Refresh'})` on `/` timed out → **probe error**: Overview has no Refresh control; the DOM inventory confirms 3 buttons (menu, Analyze prompt, Start run).
2. Accessible-name extraction reported the disabled Download as “This run has no artifacts to download.” → **harness artifact**: `nameOf` preferred `title` over `innerText`. The real accessible name is “Download” (content) with the title as description. Not a product defect.
3. First Tab after a click sequence focused the brand, not the skip link → **probe error**: focus was on the menu button. A fresh-load Tab lands on `.skip-link` (re-verified in `skip-probe.log`).
4. Vault row selection used a `.md`-filtered locator after the first row turned out to be a directory (no wrong-row claim).
5. All counts come from the rendered DOM at 1440×1000 with the vault tree at its default expansion; expanding/collapsing changes the row count (150 → 67 → 150 verified).
6. The app serves the built `web/dist` (built 22:01, source last modified 21:30); bundle strings match source for the audited areas. No dev server or second server was started.

## 13. Final verdict

The UI is broadly honest on the happy path: terminal-state handling (D09), refused learning (pool exhausted), key non-exposure, run detail tabs, vault read-only rendering, and the run ledger all behave as claimed. The two high-severity defects are **event-feed omission** and **measured-spend shown as “Not measured”**; the medium defects are **cap never surfaced**, **dead/mislabeled Context columns**, and a **hardcoded routing reason**. The abf5 “Running / 7 steps / Live stream” screen is a stale mid-run capture, not a convergence bug. No product files were modified; no destructive or paid action was performed.

