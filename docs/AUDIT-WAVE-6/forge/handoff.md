# W6-AUD-03 / task-3 — Forge handoff

## Identity and status

- Task: `task-3` (W6-AUD-03), independent read-only Forge root-cause seat.
- Repo: `C:\Users\Riley\Desktop\HiveRouter`; baseline B2, no active run, 25 runs; source matches `docs/AUDIT-WAVE-6/baseline.sha256`; live server up since `2026-11-04T03:42:05Z`; `web/dist` built `04:01:15Z` (after newest `web/src` edit).
- `team_task_update` is **not mounted** in this seat, so task-3 was not claimed through the team tool; this is the audit record.
- Wrote only `docs/AUDIT-WAVE-6/forge/`: `root-causes.md`, `red-evidence.md`, `patch-proposals.json`, `handoff.md`, `probes/*.mjs`, `evidence/*`. No `src/`, `web/src/`, `test/`, `e2e/`, `package.json`, `config/`, skill, workspace, run, vault, log, production DB write; no fix implemented; no subagent; no git (no `.git`); no paid call; no server restart; no mock used as proof.
- Row counts before/after: `runs=25 events=972 usage=161 steps=171 checks=88 artifacts=61`, unchanged; `/api/runs/active` stays `null`.

## Top root causes (ranked)

1. **P1 RC-1 — failure terminals drop measured spend/tokens (7/25 runs, $0.606852192).**
   `src/server/pipeline/run.ts:853-861` and `:868-888` mark runs terminal without copying `usageTotals`; `src/server/runs/manager.ts:250-258` has no usage fields; only the success path `run.ts:1075-1084` writes cost/tokens. `run_abf5` has 20 provider usage rows ($0.299980656, 547 696/124 569 tokens) and a `traces` row with the same numbers, while `runs.cost_usd` is NULL and the UI says "Not measured / The provider has not reported a cost yet" (`web/src/components/ui.tsx:591-614`). `/api/stats` total $0.924624168 vs sum of run rows $0.317771976 — difference exactly the 7 runs.
   **Fix P-1**: add `usageTotals` to `markTerminal` (manager) and route `run.ts:884` through it. No schema change, callers stable, no backfill.

2. **P1 RC-2 — live→terminal Events tab never shows the persisted ledger (unique to this seat).**
   `web/src/pages/RunDetailPage.tsx:133`: `visibleEvents = events.length > 0 ? events : persistedEvents.data ?? []`. `events` is reset only on `runId` change (`:116-119`), capped at 100 (`:136`), and not cleared when the stream closes at terminal (`:135`); the persisted fetch happens exactly at terminal (`:129-132`) but is ignored if the live array is non-empty. The heading/description already say "Persisted events … latest 500" (`:1009-1013`). A fresh terminal load is correct (108/108, 102/102, 55/55 measured); a run watched to completion shows ≤100 live rows and loses the unsubscribed types. The prior TRACE-06 receipt claims a "merge" that does not exist (`docs/TRACE/20261103T2200Z/03-forgewright-fixes.md:82`); the E2E only covers a fresh load (`e2e/trace-fixes.spec.ts:4-23`).
   **Fix P-2**: pure selector in `src/shared/run-events.ts`; terminal → persisted (or empty), non-terminal → live. No API change. Live→terminal transition is **not executed** (no non-terminal run; paid runs forbidden); static data flow is exhaustive; the proposed selector unit test + route-intercepted E2E covers it.

3. **P2 RC-3 — emitted ≠ subscribed event vocabulary + live payload shape.**
   5 emitted types absent from `STREAM_EVENT_TYPES` (`web/src/hooks/useApi.ts:72-100`): `run.queued`, `phase.skipped`, `agent.failed`, `context.skipped`, `repair.stalled`; 16 subscribed types never emitted. Browser proof on the real stream: app-list listener got 106/108 (abf5), 53/55 (2bb2), 101/102 (95); a listener for the missing names got exactly the dropped rows; `onmessage` = 0. Persisted terminal DOM does show the missing rows, so this is live/replay loss only. Live `data` is the whole SSE envelope; persisted `data` is the bare payload (`useApi.ts:126-139` vs `src/shared/run-events.ts:19-25`).
   **Fix P-3**: add the 5 names, unwrap the envelope, add a source contract test (`emitted ⊆ subscribed`). Keep/delete the 16 dead listeners separately.

4. **P2 RC-4 — `/events` false-positive truncation on 24/25 runs.**
   `src/server/app.ts:818-833` mixes per-run `lastEventId` with the global AUTOINCREMENT `seq`: `start = max(after, current-500)` and `truncated = after < start || current - start > events.length`. All 25 runs returned every DB row (0 dropped), yet 24 report `truncated:true` (abf5 108/108 first seq 552, last 659). `web/src/api.ts:327-332` drops the flag today, so no current visual falsehood.
   **Fix P-4**: fetch `window + 1` rows after the cursor; `truncated = rows.length > window`; return the newest window. Tests cover 0/20/500/501/550-event and `after` cases.

5. **P3 RC-5 — run detail reads fields the API never provides (unique to this seat, also weaver F3/F12).**
   `RunDetailPage.tsx:199-201` reads `snapshot.limits.maxCostUsd` but `/snapshot` returns no `limits`, so the cap is never shown; `:655-658` renders `check.code`/`check.durationMs` but `insertCheck`/`getChecks` never persist/return them (`checks` table has no such columns; `durationMs` has no producer). Always "—", no false claim. `/api/settings` also nests `limits` under an object the SettingsView filters out.
   **Fix P-5**: add `limits: { maxCostUsd: runBudgetUsd(id) }` to the snapshot route (one line, `runBudgetUsd` already imported); remove the two empty check columns (a persisted `code` would need a new migration; `durationMs` has no producer).

6. **P3 RC-6 — Checks rows keyed by non-unique `check.id` (shared W6-L-14, with a measured correction).**
   abf5 has 16 check rows over 5 ids (`stub.scan`×4, others ×3); `getChecks` maps `id=check_id` and `ChecksTab` uses `key={check.id}` (`RunDetailPage.tsx:650`). Chrome probe: all 16 rows render, **no duplicate-key console warning** in the production build — the peer's "collapses the rows" claim is not observed. The real defect is the non-unique key and the inability to distinguish verification passes (no pass/time column).
   **Fix P-6**: unique key (`${check.id}-${index}`) and optionally return `checks.created_at` for a pass column.

7. **P3 RC-7 — "Replay truncated" badge is about the artifact cap (shared W6-L-15).**
   `RunDetailPage.tsx:330` renders `snapshot.truncated`, which is `allArtifacts.length > 200` (`app.ts:806-814`), not event replay. Never triggered today (max 20 artifacts). **Fix P-7**: rename to "Artifact list truncated"; if event truncation should be visible, add a separate field after P-4.

## Refuted (do not fix)

- **`run_abf5` "Running / 7 steps"** — stale/mid-run capture, not a convergence defect. Fresh Chrome: `FAILED · DONE · 20 STEPS · TERMINAL · SNAPSHOT`, 108 persisted rows; `/snapshot` `failed/20/lastEventId 659`. 3/3 terminal runs match the API exactly; terminal pages issue 1 `/snapshot` + 1 `/events` + 0 `/stream` and 0 further requests in 6 s. The only window where Running+7 steps is true is `03:09:33.029Z`–`03:09:52.479Z` (19.5 s), between step 7 and step 8 insertion; the run then reached 20 steps and failed at `03:15:46.742Z`. The page warns explicitly if a refresh fails, so a frozen tab is visible, not silent. Shared with peer W6-L-00.
- **`run.cancelled` not subscribed** — false: `useApi.ts:76` has it; `run.ts:885` and `manager.ts:186` emit it (0 rows in this DB, never exercised).
- **Wave-5 stub false positive still fails `run_abf5`** — false: current `scanText` returns 0 findings on the stored `.staging/attempt-1/src/probes/tool_access.py`; line 121 is a string literal inside a marker tuple, and the current rule only flags `raise|throw|return … not implemented` (`stub-scan.ts:44-48`). Historical ledger row preserved.
- **"The terminal Events tab shows no persisted events"** — false on fresh terminal loads (3/3 exact); only the live→terminal transition is broken (RC-2).
- **Missing `step.started`/`agent.delta`/`review.completed`/…** — never emitted; dead subscription surface, not event loss.
- **Peer W6-L-14 "ChecksTab collapses multi-pass checks"** — not observed: Chrome shows all 16 rows and 0 duplicate-key console errors in the production build. The real defect is the non-unique key / indistinguishable passes (RC-6), not a collapsed table. This is a peer finding rechecked, not assumed.

## Unverified (do not implement blind)

- **U-1 (P3)** 410 `E_REPLAY_WINDOW_EXCEEDED` on SSE reconnect → EventSource reconnects with the same Last-Event-ID forever; the client only sets `'reconnecting'` (`useApi.ts:148-150`) and cannot read the 410 body. Route half re-probed (`HTTP 410, code=E_REPLAY_WINDOW_EXCEEDED`); no run has a >500-event reconnect gap, and paid runs are forbidden. Missing evidence: a live run (or a temp-server fixture with >500 events between disconnect/reconnect) with a browser capture of the retries. Shared with W6-L-10.
- **U-2 (P3)** run state machine is dead code; peer probe re-run shows `completed → running` persists with no guard. No production illegal transition observed. Product decision wire-vs-delete. Shared with W6-L-03.
- Peer-only W6-L-08 (trace_complete untied), L-09 (learning variant machine), L-11 (cancel ack window) were read but not independently re-probed by this seat; they remain as the peer reported them.

## Peer reconciliation (W6-AUD-02, `docs/AUDIT-WAVE-6/logic/`)

I read `findings.md`, `red-probes.md`, `state-machines.md`, `event-payload-truth.md` (and the probe scripts) and re-ran `probe-routes.ts` on its throwaway DB (`evidence/peer-logic-probe-rerun.txt`) for the overlapping items. I also read the Weaver report (`docs/AUDIT-WAVE-6/weaver/findings.md`), which independently corroborates F1=RC-3, F2=RC-1, F3/F12=RC-5, F6=RC-4/RC-7 and the RC-2 residual; its other findings (Context columns, routing reason, a11y/refusal copy) are outside this seat's root-cause set.

| Peer | This seat |
|---|---|
| W6-L-00 stale capture | REFUTED as defect (agrees) |
| W6-L-01 provider code → E_INTERNAL | SUPPORTED (peer probe re-run; no production specimen) — affects the UI error chip for provider failures; not duplicated as a proposal here |
| W6-L-02 failed runs lose spend | SUPPORTED = RC-1; added traces/stats contradiction |
| W6-L-03 state machine dead | SUPPORTED via re-run; U-2 |
| W6-L-04 event drift | SUPPORTED = RC-3; added delivery counts |
| W6-L-05 `/events` truncated | SUPPORTED = RC-4; added 24/25 production census |
| W6-L-06 interrupted silent | SUPPORTED via re-run; no row in this DB; UI would show `Interrupted` with no explanation |
| W6-L-07 GATE_FAILED no log/registry | SUPPORTED (static + `errors.jsonl` cross-check): not in the 85 REFUSALS codes; 0 log rows for 2 gate failures; UI chip uses `run.errorMessage`, low visual impact |
| W6-L-08 trace_complete untied | SUPPORTED as invariant break (7 completed runs with flag=1, 0 trace rows); historical cause unverified |
| W6-L-09 learning variant machine | not independently verified here |
| W6-L-10 410 loop | U-1 (route half verified, browser half unverified) |
| W6-L-11 cancel ack race | not independently verified here |
| W6-L-12 failure payload drift | SUPPORTED: 2 observed `run.failed` shapes `{code,checks}` / `{code,message}`; no current consumer |
| W6-L-13 live vs persisted event view | SUPPORTED = RC-2 + RC-3 |
| W6-L-14 checks non-unique key | SUPPORTED (key); the "collapses rows" claim is REFUTED by my Chrome probe (16 rows render, no warning) = RC-6 |
| W6-L-15 "Replay truncated" mislabel | SUPPORTED (static, never triggered) = RC-7 |

No file owned by the peer was modified; no duplicate proposals were created for their items except RC-1/RC-3/RC-4/P-5 where this seat has independent production evidence or a distinct fix seam.

## Suggested integration order

1. **P-1** (cost truth; highest user impact, smallest diff: 2 source edits + 1 optional).
2. **P-2** (Events tab truth; 1 shared function + 1 call site + unit test).
3. **P-3** (event vocabulary + payload shape; 1 list + handler + contract test).
4. **P-4** (`/events` truncation; 1 route hunk + unit test).
5. **P-5** (P3 cleanup; snapshot limits + column removal).
6. **P-6/P-7** (P3 cleanup; unique check keys, badge label).
7. Re-run `npm.cmd run verify`, `npm.cmd run e2e`, and a real run-detail acceptance pass (failed run must show numeric spend/tokens; a watched run must show the persisted ledger).

## Acceptance checks for the fixes (not yet run)

- A failed run with provider usage shows a numeric spend and prompt/completion tokens in the run detail and the runs list; `/api/stats` total equals `SUM(runs.cost_usd)` for runs with usage.
- A run watched from running to terminal shows the persisted ledger (abf5: 108 rows) and the heading matches the source; fresh terminal loads unchanged.
- `GET /events` on every persisted run: `truncated=false` iff returned count == per-run DB count.
- Checks tab has no permanently "—" Code/Time columns; the cost cap renders the effective per-run cap.

## Evidence map

- `root-causes.md` — falsifiable sentences, hypotheses/probes, exact file:line roots, rankings, refutations, peer reconciliation.
- `red-evidence.md` — commands + raw output for every claim, reproduction commands, evidence hashes, limitations.
- `patch-proposals.json` — 5 proposals with exact edits, edge cases, tests, rollback, preserved evidence; `notProposed` records refuted/unverified items.
- `probes/*.mjs` — eight read-only probes (`api-probe`, `ui-probe`, `census-probe`, `cost-probe`, `static-probe`, `field-audit`, `peer-crosscheck`, `checks-probe`).
- `evidence/` — raw route JSON, SSE frames, DB censuses, browser JSON/screenshots, peer-probe re-run, cropped screenshots.

## Claims register

| Claim | Source | Status |
|---|---|---|
| 7/25 runs have measured usage but NULL run cost; $0.606852192 | production DB read-only + `/api/stats` | verified by tool |
| `run_abf5` cost $0.299980656 / 547 696 / 124 569 in usage and traces | production DB read-only | verified by tool |
| UI says "Not measured / has not reported" for abf5 | fresh Chrome screenshot + `ui.tsx:591-614` | verified by tool + file |
| Fresh terminal UI/API match on 3/3 runs | Chrome DOM + routes | verified by tool |
| 7-step value only reachable in 19.5 s window | DB step rows + Chrome | verified by tool |
| 5 emitted types unsubscribed, 16 dead listeners | source scan + Chrome EventSource | verified by tool |
| `/events` false-positive truncation 24/25 | route + DB census | verified by tool |
| `snapshot.limits`, `checks.code/durationMs` absent | route key dump + schema | verified by tool |
| Checks rows use 5 ids for 16 rows; no production key warning; all rows render | Chrome probe | verified by tool |
| "Replay truncated" flag is artifact truncation, not replay | source route + badge | verified from source (never triggered) |
| Live→terminal selector defect | source data flow + truth table | verified from source (runtime transition unverified) |
| 410 reconnect loop at the client | route probe + source | unverified (browser half missing) |
| Provider error codes lost as `E_INTERNAL` | peer probe re-run | verified by tool (temp DB); no production specimen |
| State-machine guard unwired | peer probe re-run + grep | verified by tool (temp DB) |

## Requests / notes for the Lead

- Confirm whether a **historical backfill** of the 7 affected run rows is desired; this audit deliberately did not write to production DB. Without a backfill the UI will keep saying "Not measured" for those historical runs even after P-1 (future runs are fixed).
- Confirm whether the 16 subscribed-never-emitted event types are planned (`step.*`, `agent.delta`, learning.*) or should be deleted; P-3 does not decide that.
- The live→terminal defect (RC-2) needs a test that does not require a paid run; the proposed Playwright route-interception test is a test double only in `e2e/`, not product code.
- If the team prefers a shared `RUN_EVENT_TYPES` constant over a source-scanning contract test, P-3's test can be swapped; the list edit and envelope unwrap stay the same.

## Receipt

- Deliverables in `docs/AUDIT-WAVE-6/forge/`: `root-causes.md`, `red-evidence.md`, `patch-proposals.json` (7 proposals, valid JSON), `handoff.md`; `probes/` (8 read-only probes); `evidence/` (31 files: raw route JSON, SSE frames, DB censuses, Chrome DOM JSON, screenshots, peer-probe re-run, peer cross-check).
- No product/test/config/workspace/run/vault/log/DB edit; no fix implemented; no commit (no `.git`); no paid call; no server restart; no subagent. The only test double used for proof is the peer's throwaway-DB probe, re-executed by this seat and labelled as such; all other evidence is live read-only API/DB/browser.
- Baseline source hashes match `docs/AUDIT-WAVE-6/baseline.sha256`; live DB row counts unchanged (`runs=25 events=972 usage=161 steps=171 checks=88 artifacts=61`); `/api/runs/active` remains `null`.
- `team_task_update` is not mounted; this report is the task-3 handoff.
- Evidence rule met: every "verified by tool" claim has a command and raw output in `red-evidence.md`; every unproven claim is marked UNVERIFIED with the exact missing evidence.
