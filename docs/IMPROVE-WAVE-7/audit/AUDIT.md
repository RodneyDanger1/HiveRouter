# AUDIT — IMPROVE-WAVE-7 (independent, read-only)

- **Auditor role:** independent read-only verification. Skill `auditor` loaded before acting.
- **Repo:** `C:\Users\Riley\Desktop\HiveRouter` (no `.git`; `Test-Path .git` = False).
- **Write scope:** only `docs/IMPROVE-WAVE-7/audit/**`. No product/test/config/`package.json`/DB/workspace/logs/skills/scripts edits; no git; no paid calls; no server restart by this auditor; no subagents.
- **Time:** 2026-11-04 00:15–00:33 America/Chicago (UTC−06:00). Final snapshot `00:32:26`.
- **Evidence rule:** VERIFIED = command output observed in this session; READ = source/doc read; INFERRED = derived from verified evidence; UNVERIFIED = not executed. Everything below is one of these.

## 0. Snapshot, quiescence, and the mid-audit move

The tree **moved during this audit**. The move is recorded here because it changes what the report counts refer to.

| Time | Event |
|---|---|
| 00:14:06 | `REPORT.md` v1 written; claimed 3/3 targeted, **51 files / 315 tests**, phase matrix unwired (content read) |
| 00:18:54 | `npm.cmd test -- --run test/unit/run-transition-guard.test.ts` → **3 passed (3)** (v1 file; output not persisted) |
| 00:20:32 | full suite started on the v1 tree |
| 00:20:49 | **`src/server/runs/recorder.ts` changed** 17,549 → 18,274 bytes (added terminal-phase + completed→done invariants); sha256 `52C46813…` |
| 00:20:56 | **`test/unit/run-transition-guard.test.ts` changed** 51 lines/3 tests → 71 lines/5 tests; sha256 `C126A93B…` |
| 00:20:49–00:23 | the in-flight full suite became **mixed-version**: 51 files / 317 tests / **2 failed** / **315 passed** (the 2 new phase tests failed against the old recorder). Captured in `audit/full-suite.out.txt`. This is why that run is discarded. |
| 00:22:40 | `web/dist` assets rebuilt |
| 00:24:14 | server restarted by the orchestrator (PID 11168; `/api/health` ok) |
| 00:24:43 | `REPORT.md` v2 written; now claims **5/5**, **51 files / 317 tests**, status edges **plus terminal-phase immutability** |
| 00:25:26–00:26:11 | E2E run on the restarted server (new recorder + rebuilt dist): **26/26 passed** |
| 00:28:32 | a second, unrelated `docs/IMPROVE-WAVE-7/audit2/` appeared, authored by another writer. **Not used as evidence here.** |

I messaged the parent at 00:21:36 with the moving-tree/blocker notice; the final REPORT update at 00:24:43 resolved the report/code mismatch. All verdicts below are against the frozen **v2 snapshot**. `README.md` and `docs/PLAN-v3.md` were **not** updated (see Finding F1).

**Frozen hashes** (`audit/snapshot.txt`):

```text
52C46813…B9833A  src/server/runs/recorder.ts
C126A93B…073529E  test/unit/run-transition-guard.test.ts
A67F1347…D303F3  web/src/api.ts
AC49CCF8…40A8D4  web/src/pages/RunsPage.tsx
B02A692E…F0FDE4  web/src/pages/SettingsPage.tsx
295F2705…7C77  e2e/ui-audit.spec.ts
C2301DDE…4D895A  docs/IMPROVE-WAVE-7/REPORT.md
```

## 1. Verdicts

| # | Claim | Verdict |
|---|---|---|
| 1 | `updateRun` rejects terminal→running and queued→completed, allows queued→running and same-status writes; CAS cannot overwrite a concurrently changed status; legitimate lifecycle writes still work | **PASS-WITH-NOTES** |
| 2 | Runs filtering is server-side via `GET /api/runs?status=…`; queued/paused/interrupted included; no client-side 100-row blind spot; count truthful | **PASS-WITH-NOTES** |
| 3 | Settings renders nested `limits`/`features` scalars without objects/key material; E2E additions are additive | **PASS** |
| 4 | Counts/claims real: 51 files/315 tests; E2E 26/26; stage 163/45/48/24; no unrelated changes; no backfill/P7 data | **PASS-WITH-NOTES** (315 is the pre-move count; current is **317**) |
| 5 | Phase-transition matrix intentionally unwired, not falsely claimed fixed | **PASS** |

**Overall: PASS-WITH-NOTES.** No product defect was found on the frozen snapshot; the notes are a stale-doc finding (F1), a residual 100-row display cap (F2), and three low-severity edge observations (F3–F5). This is **not** a NO-SHIP on product behaviour. The audited gate is green: unit **51 files / 317 tests passed**, E2E **26/26**, stage **violations []**, typecheck **PASS**, stub/secret scans clean.

## 2. Claim 1 — status guard, CAS, lifecycle

**Source (READ, current):** `src/server/runs/recorder.ts:150-188`. It reads `status, phase`; calls `assertStatusTransition` (`:162`); rejects terminal phase changes (`:164-166`); requires `completed`/`completed_with_warnings` to use phase `done` (`:167-173`); writes with `AND status = ?` CAS (`:176-181`) and throws `RunTransitionError` when `changes !== 1` (`:183-187`). Matrix: `src/server/logic/run-state.ts:27-54`, assert at `:135-146`.

**RED reproduced on a clean copy** (`audit/probe-red.ts` + `red-copy-recorder.ts`; the copy is the verified backup body, sha256 `83223417…`, with only four import specifiers rewritten; in-memory DB):

```text
RED pre-fix: completed->running  → NO-THROW (defect reproduced); row = status running, phase done
RED pre-fix: queued->completed   → NO-THROW (defect reproduced); row = status completed, phase intake
```

`red-copy-recorder.ts` is the old `updateRun` from `docs/IMPROVE-WAVE-7/backup/src/server/runs/recorder.ts:155-158` (no guard). The two named old tests were exactly the two cases in REPORT v1. The mixed suite (`full-suite.out.txt`) shows **315 passing tests plus the 2 new phase tests failing against the v1 recorder** (status guard only; the worker had loaded the pre-00:20:49 module), which is consistent with the 315 report-time count.

**GREEN probe (VERIFIED, `audit/probe-transitions.out.json`, 38 cases, throwaway file DB under `audit/`, deleted after run):**

- legal: `queued→running` ok; running→completed with phase done ok; **same-status writes** (status-only and status+phase) ok; `running↔paused`, `running↔needs_review`, terminal same-status idempotent write ok; `queued→cancelled` and `queued→failed` ok.
- illegal: `completed→running`, `completed→failed`, `completed→budget_exceeded`, `queued→completed`, `failed→running` → all throw `RunTransitionError` / `E_ILLEGAL_RUN_TRANSITION`; rows unchanged (completed stayed completed/done; queued stayed queued/intake).
- post-v2 phase invariants: terminal phase-only write `completed:done → planning` throws; `running→completed` without phase done throws; terminal same-phase write still succeeds.
- production helpers: `markRunning` + `markTerminal(completed, done)` → completed/done; `cancelRun` on a queued no-controller run → cancelled/done (`E_CANCELLED`) and returns true.
- CAS (injection of a competing writer between the `SELECT` and the guarded `UPDATE` via a second SQLite connection): competitor `running→failed` + caller `paused` → throws, row stays **failed**; competitor `running→completed` + caller idempotent `running` → throws, row stays **completed**; competitor `running→failed` + caller phase-only `planning` → throws, row stays **failed**; control with no competitor → succeeds. **Fail-closed confirmed, no stale overwrite.**
- edge: missing run with a status patch is a silent no-op (0 changes, no throw) — pre-existing; invalid status string throws `ZodError` rather than `RunTransitionError` — pre-existing shape, no production caller.

**Lifecycle evidence:** full suite **51/317 passed** (`audit/full-suite-2.out.txt`, pre/post source hash identical); E2E **26/26** on the restarted server (`audit/e2e.out.txt`); direct production-helper probe above. All production `updateRun` call sites were read: `manager.ts:165,197,282,286-294`, `pipeline/run.ts:884,1075`; every completed write carries phase `done`, and every failure/cancel writer uses a legal edge. `markStartupInterrupted` (`manager.ts:211-239`) uses its own guarded SQL and never calls `updateRun`.

**Notes (not failures):** (a) phase-only CAS race error builds `RunTransitionError('status', currentStatus, undefined, …)` (`recorder.ts:186`), so `to`/message show `running -> ` — fail-closed but imprecise; (b) missing-run no-op and `ZodError` shape above; (c) the full phase graph is still not enforced — only the two terminal/completed invariants (consistent with REPORT v2 and Claim 5).

## 3. Claim 2 — server-side Runs filter

**Source (READ):** `web/src/api.ts:309-316` sends `URLSearchParams({limit})` + `status` unless `all`; `web/src/pages/RunsPage.tsx:16` lists all 10 statuses (`all, queued, running, paused, completed, completed_with_warnings, failed, cancelled, budget_exceeded, needs_review, interrupted`), `:20` passes `status` into `useApiResource(..., [status])`, `:53-54` renders `list.length` + “server-filtered”; no `useMemo`/client filter remains. Route `src/server/app.ts:752-757` clamps `limit` to 1–100 and calls `listRuns(limit, query.status)`; `recorder.ts:204-208` runs `SELECT id FROM runs WHERE status = ? … LIMIT ?`.

**Live proof (VERIFIED, `audit/probe-ui.out.json`, server after the 00:24:14 restart):**

```text
GET /api/runs?limit=100                  → 30 rows, label "30 runs · server-filtered"
GET /api/runs?limit=100&status=failed    → 3 rows,  label "3 runs · server-filtered"
GET /api/runs?limit=100&status=queued    → 0 rows,  honest empty state
requests observed: exactly the three URLs above (status change triggers a new request)
```

The screenshot `audit/live-runs-failed.png` shows the Failed selector, 3 FAILED rows, and “3 runs · server-filtered”. Direct API probes also returned 3/3 failed, 0/0 queued/paused/interrupted, and 0 for `status=bogus` (unknown status is an empty result, not a 500).

**Note (F2):** the count is the number of **returned** rows. `/api/runs` returns `{runs}` only, no `total`; the UI keeps `limit=100`, so if more than 100 runs matched a filter the label would say “100 runs” and rows beyond 100 would still be invisible. The original defect (filtering only the first 100 rows **overall**) is fixed; the remaining cap is a display/pagination limitation, not a client-side filter. Current live data (30 runs, max 23 per status) cannot exercise >100 empirically.

## 4. Claim 3 — Settings flattening and additive E2E

**Source (READ):** `web/src/pages/SettingsPage.tsx:134-177`; `flatten(prefix,value,depth)` returns for non-objects/arrays/`depth>2`, pushes only scalars, recurses objects, and is called for `limits` and `features` (`:156-157`); top-level `knownKeys` path unchanged. `/api/settings` (`app.ts:212-218`) returns `limits: config.limits`, `features: FEATURES`, plus a `key` status object. `config.limits.retentionDays` is a **second-level** object (`config.ts:47`), so this also exercises two-level flattening.

**Live proof (VERIFIED, `audit/probe-ui.out.json`, `audit/live-settings.png`):** 18 `limits.*` labels rendered, including `limits.briefChars`, `limits.maxRunCostUsd = 0.5`, `limits.eventReplayWindow = 500`, and `limits.retentionDays.{events,context,traces,eval}`; `features.routing/learning` shown; `[object Object]` absent; `sk-[A-Za-z0-9_-]{20,}` absent. The key card shows only a short fingerprint (`c30cfdbc`), not key material; the `key` object is never passed to `SettingsView`.

**E2E additive, not weakened (VERIFIED):** backup e2e hash equals Wave 6 final (`BEB742D3… == W6 final`); `fc.exe` diff against backup shows exactly **two added lines** (`e2e/ui-audit.spec.ts:256-257`) and no removed/changed assertions. E2E **26/26 passed** (`audit/e2e.out.txt`) after the 00:24:14 restart.

## 5. Claim 4 — counts, territory, data

| Gate | Observed (VERIFIED) |
|---|---|
| Targeted | `run-transition-guard` **5/5** (`audit/targeted-after-move.out.txt`) |
| Full unit | **51 files / 317 tests passed** (0 failed, 0 skipped) — `audit/full-suite-2.out.txt`, pre/post source hashes identical |
| Typecheck | `tsc --noEmit` exit 0 (`audit/typecheck.out.txt`) |
| E2E | **26 passed** (`audit/e2e.out.txt`) |
| Stage | `files 163, tables 45, routes 48, scripts 24, violations []` (`audit/assert-stage.out.txt`) |
| Stub / secret | `stub-sweep: clean (86 files)`; `secret-scan: clean (161 files)` |

**315 vs 317:** the v1 REPORT's 315 was real for the 3-test snapshot: the mixed run that straddled the edit shows **315 passed + 2 new phase tests failed**. The v2 REPORT correctly says 317. The audited frozen snapshot is 317/317. This is a **report-version fact**, not a fabricated count.

**No unrelated file changes (VERIFIED vs Wave 6 `final.sha256`, 162 entries):** exactly **5 changed** — `src/server/runs/recorder.ts`, `web/src/api.ts`, `web/src/pages/RunsPage.tsx`, `web/src/pages/SettingsPage.tsx`, `e2e/ui-audit.spec.ts`; **0 missing**; exactly **1 new file in the audited code directories** — `test/unit/run-transition-guard.test.ts`. `package.json`, config, scripts, and all other tests are hash-identical to Wave 6 final. `audit/hash-compare-vs-w6.txt`. (The W6 manifest omits three pre-existing root config files — `package-lock.json`, `tsconfig.json`, `vitest.config.ts`; all predate Wave 6 and were untouched.) Stage 162→163 files is the one new test. No test file was weakened: the only edited test is the e2e spec, +2 assertions; the new unit file is additive.

**No historical backfill / no P7 data (VERIFIED):** `data/hive.db` mtime `11/3 23:31:20`, `-wal` mtime `11/3 23:34:57` — no DB write during Wave 7 (00:06+). Read-only census (`audit/probe-db.out.json`): 30 runs (23 completed, 4 budget_exceeded, 3 failed), latest `created_at 2026-11-04T05:31:42Z` (pre-Wave-7); `consent_records=0`, `sealed_pool=0`, `sealed_pool_blocks=0`, `promotions=0`, `post_promotion_monitor=0`. No paid `test:live` was run by this audit; E2E uses GETs, a 422 refusal, a 403 refusal, and route interception.

**Finding F1 (documentation, not product):** `README.md:94` and `:120` still say “315 tests / 51 files”, and `docs/PLAN-v3.md:506` still says “GREEN 3/3; full unit 315 tests / 51 files”. REPORT v2 says 5/5 / 317. These two docs are stale and should be regenerated before the wave is called closed. This is the only substantive discrepancy found.

## 6. Claim 5 — phase matrix still unwired

`grep` over `src/` for `PHASE_TRANSITIONS|assertPhaseTransition|transitionPhase|allowedNextPhases` returns **only definitions/uses inside `src/server/logic/run-state.ts`** (matrix `:56-68`, assert `:148-155`, transition helpers `:190,200`). No production caller imports the phase matrix. REPORT v2 (`:33-36`) explicitly separates “status edges plus terminal-phase immutability” from the full graph and says the full `PHASE_TRANSITIONS` graph is not wired; `:99-101` repeats the deferral. The new invariants added at 00:20:49 are **not** the matrix: `isTerminalStatus` membership plus completed→done. Claim 5 is accurate; no false claim of a fixed phase matrix.

## 7. Residual risks / findings

1. **F1 (low, docs):** stale counts in `README.md:94,120` and `docs/PLAN-v3.md:506` (315 / 3/3) vs REPORT v2 and observed 317 / 5/5.
2. **F2 (low, product):** Runs page still displays at most 100 returned rows and has no `total`; the “N runs · server-filtered” label undercounts above 100 matches. The original cross-100 filtering blind spot is fixed.
3. **F3 (low, product):** phase-only CAS race throws `RunTransitionError` with `to = undefined` (`recorder.ts:186`); correct refusal code, imprecise payload/message.
4. **F4 (low, product):** `updateRun` with an unknown run id + status patch is a silent no-op (no throw); invalid status strings throw `ZodError`, not the named refusal (pre-existing).
5. **F5 (scope):** full phase graph is unguarded; only terminal immutability and completed→done are enforced (explicitly deferred by REPORT v2).
6. **F6 (process):** the product tree moved mid-audit (source/test 00:20:49–56, server restart 00:24:14, REPORT v2 00:24:43); the first full-suite run was mixed-version and discarded. A clean freeze is required for any future audit.
7. **F7 (verification limit):** the `Build PASS` row was not independently re-run (it writes `web/dist` outside the audit write scope); the 00:22:40 rebuilt dist was served and E2E 26/26 passed, so build health is INFERRED, not VERIFIED.
8. **F8 (environment side effects):** sanctioned commands regenerated `docs/UI-WAVE-1/shots/*` and `.qa-api-results/*`; the full suite appended `E_RUN_TIMEOUT` records to `data/logs/errors.jsonl` (pre-existing test-log side effect, not a Wave 7 code change).

## 8. Claims register

| Material statement | Status |
|---|---|
| Guard + terminal-phase/completed-done code at `recorder.ts:150-188` | VERIFIED (read) |
| Pre-fix `updateRun` accepted both defects | VERIFIED (clean-copy probe; backup hash) |
| Current guard rejects the 5 illegal cases, allows legal/same-status, CAS fail-closed | VERIFIED (38-case probe) |
| Production helpers `markRunning`/`markTerminal`/`cancelRun` still work | VERIFIED (probe) |
| Full suite 51/317, targeted 5/5, E2E 26/26, stage counts, typecheck | VERIFIED (outputs in audit/) |
| 315 was the pre-move count | INFERRED (mixed run 315 passed + 2 new failed against the v1 recorder; REPORT v1 read) |
| Server-side filter + live requests/counts | VERIFIED (probe + source) |
| No client-side filter remains | VERIFIED (source; no `useMemo`) |
| Count is total-truthful above 100 | **REFUTED** — capped at 100, no total (F2) |
| Settings renders nested scalars, no object/key leak | VERIFIED (live DOM text) |
| E2E assertion change is +2 only | VERIFIED (fc diff; backup == W6 final) |
| No unrelated code/test/config changes | VERIFIED (162-file hash compare) |
| No historical backfill / no P7 data | VERIFIED (DB/WAL mtime + census) |
| `PHASE_TRANSITIONS` has no production caller | VERIFIED (grep) |
| Build PASS | UNVERIFIED (F7; dist served green) |
| True external-process CAS under production load | UNVERIFIED (simulated via second connection; single-process app) |
| Behaviour beyond Chrome / mobile filter interaction | UNVERIFIED (not probed; out of claim scope) |

## 9. Commands run (exact)

```text
npm.cmd test -- --run test/unit/run-transition-guard.test.ts   → 5 passed (5)
npm.cmd test                                                   → Test Files 51 passed (51); Tests 317 passed (317)
npm.cmd run e2e                                                → 26 passed (1.5m)
npm.cmd run typecheck                                          → exit 0 (no output)
npm.cmd run assert-stage -- --stage=p7 --json                  → ok:true; 163/45/48/24; violations []
npm.cmd run stub-sweep                                         → clean (86 files)
npm.cmd run secret-scan                                        → clean (161 files)
.node_modules\.bin\tsx.cmd docs\IMPROVE-WAVE-7\audit\probe-transitions.ts  → 38 cases (see JSON)
.node_modules\.bin\tsx.cmd docs\IMPROVE-WAVE-7\audit\probe-red.ts          → 2 defects reproduced
node docs\IMPROVE-WAVE-7\audit\probe-db.mjs                    → 30 runs; P7 tables zero
node docs\IMPROVE-WAVE-7\audit\probe-ui.mjs                    → filter requests/counts + settings
```

Artifacts in this directory: `full-suite-2.out.txt`, `full-suite.out.txt` (mixed, discarded), `targeted-after-move.out.txt`, `e2e.out.txt`, `typecheck.out.txt`, `assert-stage.out.txt`, `stub-sweep.out.txt`, `secret-scan.out.txt`, `probe-*.json`, `hash-compare-vs-w6.txt`, `snapshot.txt`, `live-*.png`, `probe-*.ts|mjs`, `red-copy-recorder.ts`.
