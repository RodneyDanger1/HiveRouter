# QA WAVE 1 — Seat 7 Independent Auditor (`qa-auditor`)

**Checkpoint:** 2026-11-03T10:22:05-06:00 · plan `698C1B…27C7` · lock `ADD08F…7AFF`
**Scope:** independent verification of seats 1–6; no product code or other reports edited. Only this report and `logs/qa-auditor.md` written.
**Verdict:** **NO-GO for a production gate.** No product P0 was found; **13 P1 findings remain**, including dead controls, dead P6a wiring, incomplete scripts, a false budget-overcommit claim, and a latent active-run/cancel deadlock. All six fixer seats are **PASS-WITH-NOTES**; their adopted fixes are real and the final source gates pass. The wave itself is acceptable with notes; the product is not yet production-GO.
**Key note:** at direct user request, the supplied DeepSeek key was written only to gitignored `.env.local` and used for a live smoke; the key value is not recorded in this report or log. The shared server was restarted to load the current tree because the 10:14 process predated every fixer edit. Rotate the key if this transcript is shared.

## 1. Final gate receipt (current tree, after restart)

| Gate | Result | Evidence |
|---|---|---|
| `npm.cmd run typecheck` | **PASS** | exit 0, 10:38 |
| `npm.cmd test` | **PASS — 205 tests / 26 files** | 22 unit + 4 pipeline/script files; exit 0 |
| `npm.cmd run build` | **PASS** | 2,328 modules, `index-B2G_9W28.js` 651.47 kB / gzip 195.89; warning only |
| `npm.cmd run e2e` | **PASS — 7/7** after restart | 4 contract + 3 UI tests, system Chrome, `E2E_EXIT:0` |
| `npm.cmd run verify` | **PASS** | typecheck + 205 tests + build + stub + secret; exit 0 |
| `assert-stage --stage=p7 --json` | **PASS, strict** | `fallback:false`, 124 files / 45 tables / 46 routes / 22 scripts, `violations:[]` |
| `preflight --port 0 --json` | **PASS** | disk 5.29 GB > 4.5; RAM 3.43 GB > 1.5; Node/npm/Chrome/port pass |
| `stub-sweep` | **PASS** | 77 files, 0 hits |
| `secret-scan` | **PASS** | 122 files, 0 hits |
| `test:live -- --yes` | **PASS** | `deepseek-flash`, `finishReason:stop`, cost $0.00001605, evidence `docs/verification/live-smoke-2026-11-03T16-40-53-583Z.json` |

**Stale-server finding:** the shared 8787 process started at **10:14:27**; `app.ts` was edited through **10:34:27**. Before restart, `npm.cmd run e2e` was **4 passed / 3 failed** against that old process (HTML `/openapi.json`, 415 bodyless DELETE, learning `enabled:true`). After restart, all 7 pass. The failures were stale-process artifacts, not current-code regressions. This must be recorded so no one treats the pre-restart red E2E as product evidence.

## 2. Seat verdicts

| Seat | Verdict | Basis / residuals |
|---|---|---|
| **1 `qa-core`** | **PASS-WITH-NOTES** | 9 fixes (budget committed/reserved, canAfford holds, expired key, startup release, null usage, multi-extension device names, terminal phase, UI-route allowlist, secret regex) verified by 27 targeted tests and 205 full. Notes: the report’s claim that `commit(actual > reserved)` “records actual then raises” is **false** (the update is rolled back by `tx`); finalize atomicity, periodic reaper, multi-process active-run are residuals. |
| **2 `qa-pipeline`** | **PASS-WITH-NOTES** | 4 fixes (fenced revision hash, Python child-env secret strip, warning-only status, test paths outside `tests/`) verified by 15 targeted + 205 full. Open P1: PIPE-05 trace telemetry zeros; PIPE-06 RVS computed but unused; PIPE-07 ad-hoc tests branch uses the files path. P2: PIPE-08 manifest collision, PIPE-09 live badge minting, PIPE-10 wrong refusal. |
| **3 `qa-api`** | **PASS-WITH-NOTES** | 5 fixes (bodyless DELETE, OpenAPI JSON route, strict stage manifests, learning `enabled:false`, event/SSE bounds) plus download/snapshot hardening. Independently confirmed after restart: 7/7 E2E, strict stage, OpenAPI JSON. Residuals R1 (path-only OpenAPI, no schemas) and R2 (API-only surfaces) remain. |
| **4 `qa-ui`** | **PASS-WITH-NOTES** | 8 UI fixes (learning refusal banners, mock option disabled, context Tokens/Mandatory, honest role/freeze/metric/none-measured copy, download zero-artifact gating); UI 3/3 E2E. Note: the server still ignores the visible `maxCostUsd` control (qa-systems S3), so a dead authority path remains server-side; live revise/audit/ad-hoc UI effects unverified. |
| **5 `qa-agents`** | **PASS-WITH-NOTES** | 4 fixes (root-glob routing, pathGlobs capability guard, `--run` usage exits, bench key exit) verified by 96 targeted tests. Open P1: O1 repo-map no 2,000-file/10 MB cap or secret deny-list; O2 integrity-check lacks manifest/vault parity. O3 path containment P2. No live agent capability proven. |
| **6 `qa-learning`** | **PASS-WITH-NOTES** | 2 fixes (complete 65-case pool count, malformed approval expiry) verified by 44 learning tests; honest `E_LEARNING_POOL_EXHAUSTED` refusal and no promotion. Open: guard loop is unit-tested but never called from the run graph; HTTP approval/promotion/rollback routes are hardcoded refusals (S4), so the learning UI is unreachable end-to-end. |

**No seat is FAIL:** every adopted fix has a RED/GREEN or a code/test receipt; no out-of-scope product edit or test weakening was found. Test scan found no `.skip`, `.only`, or fabricated assertions; 205 tests are real.

## 3. Independent P1 findings (remaining blockers)

| ID | File:line | Finding | Evidence |
|---|---|---|---|
| **AUD-1** | `src/server/pipeline/run.ts:792-864` | Finalize copies accepted files one-by-one (`atomicWrite` per file); a crash mid-finalize leaves a partially updated accepted tree. Plan requires atomic directory swap/rename. | READ: per-file loop; qa-core residual 1. |
| **AUD-2** | `src/server/runs/budget.ts:71-75` + `db/database.ts:50-64` | `commit(actual > reserved)` updates the row then throws inside `tx`; `tx` rolls back, so the overrun is not recorded. qa-core’s “records actual” claim is unsupported. | READ; no overcommit test exists. |
| **AUD-3** | `src/server/runs/manager.ts:26-30`, `:146-152`; `app.ts:531-540` | `getActiveRunId` includes `needs_review`; `cancelRun` returns `false` when no controller exists, but the route always returns `{cancelled:true}`. A `needs_review` run cannot be stopped, blocks new runs, and reports a fake success. No production path sets `needs_review` today (guard is dead), so it is latent. | READ; run-state/cancel path. |
| **AUD-4** | `src/server/pipeline/run.ts:641-668` | RVS `verifyPlan` is computed and persisted but `verifyStaged` is called without it; all checks run regardless of risk tier/budget. P6a RVS is dead wiring. | READ; qa-pipeline PIPE-06. |
| **AUD-5** | `src/server/pipeline/run.ts:34-40`; `src/server/app.ts:119-121` | `recordAgentEvidence` and `/api/agents` mint `representative-live`/`schema-valid` without the required evidence rows; any completed step can badge an agent live, and `schema-valid` is unconditional. | READ; qa-pipeline PIPE-09 / qa-systems S13. |
| **AUD-6** | `src/server/pipeline/run.ts:53-55` | Trace cache/reasoning tokens are hardcoded 0; trace cost is right but telemetry is false. | READ; qa-pipeline PIPE-05. |
| **AUD-7** | `src/server/pipeline/run.ts:304-313` | Ad-hoc `tests` agents take the `files` branch, require a single `targetPath`, and can never use `TestsSchema`/multiple test files. | READ; qa-pipeline PIPE-07. |
| **AUD-8** | `scripts/build-repo-map.ts:47-60` | No 2,000-file/10 MB cap, no `.env*`/`data`/`.git`/binary/secret deny-list; reads binaries as UTF-8. | READ; qa-agents O1. |
| **AUD-9** | `scripts/integrity-check.ts:29-37` | Only artifact hashes; no manifest or vault parity despite name/contract. | READ; qa-agents O2. |
| **AUD-10** | `src/server/app.ts:422-438`, `:181-190`; `web/src/components/RunComposer.tsx:54` | `maxCostUsd` is sent by UI and documented but never read/enforced; cap is fixed $0.50. Dead cost control. | READ; qa-systems S3. |
| **AUD-11** | `src/server/app.ts:319-375`; `src/shared/features.ts` | `FEATURES`/`HIVE_PHASE` is not enforced on routes or graph; A/B1 still register P7 routes and P6a routing, causing table-missing failures instead of `E_LEARNING_DISABLED`. | READ; qa-systems S5. |
| **AUD-12** | `src/server/learning/guard.ts`; no caller | `evaluateLoopGuard` is exported/tested but never invoked by the pipeline; L4 guard is dead. | rg: only `learning/index.ts` export. |
| **AUD-13** | `src/server/app.ts:369-376` | `/api/learning/approvals|promotions|rollback` are unconditional refusal stubs; no import of approval/promotion service. P7 HTTP path is dead even with a pool/candidate. | READ; qa-systems S4. |

**P2 notes:** OpenAPI path-only (`components.schemas` empty) — qa-api R1; `/api/scripts`/ops/stats routes have no UI; missing local key-import command (S6); README says 182 tests vs 205; `DatabaseSync` deprecated alias; `.qa-api-results` test output is not in `.gitignore`; slow-client SSE buffer unbounded; no periodic lease reaper; one-active-run is process-local; E2E traces disabled for this wave.

## 4. Claim verification / rejected claims

- **qa-core “Budget overcommit records actual”** — **REJECTED**. `tx` rolls back the update when `commit` throws; no overcommit test. This is a false clean claim, not a code success.
- **qa-systems “OpenAPI live empty”** — **PARTIAL/STALE**. The pre-restart server was old; after restart `/openapi.json` is JSON with paths, but `components.schemas` is empty. Report the schema gap, not “empty OpenAPI.”
- **qa-api “7/7 E2E on 8788”** — **INDEPENDENTLY CONFIRMED** after restarting 8787 on current code: 7/7 pass.
- **qa-ui “no known dead UI control”** — **PARTIAL**. No UI-only dead control found, but the visible max-cost control is ignored by the server (AUD-10).
- **qa-learning “guard implemented”** — **PARTIAL**. Module/unit tests exist; no production call site (AUD-12).
- **qa-agents “scripts usage fixed”** — **CONFIRMED** for exit 2/7; O1/O2 remain unimplemented.
- **qa-pipeline “staging/repair no partial accepted tree”** — **REJECTED for finalize**: repair staging is safe, but finalize is not atomic (AUD-1).
- **No fake promotion**: P7 pool/consent absent; learning overview `enabled:false`; `learn` exits 6. Confirmed.

## 5. Remaining unverified / not executed

1. **3-file live micro-suite** — only a 256-token live JSON smoke was run; no full build under the live provider.
2. **P7 promotion/rollback end-to-end** — no sealed 390-case pool, no consent, no candidate; HTTP routes are stubs; no promotion claimed.
3. **Live revision/audit/ad-hoc run** — not executed (paid/side-effect boundary); UI seams only.
4. **All 37 agents live** — registry/mock only; six representative-live is the plan limit.
5. **OpenAPI typed schemas** — path-only; no request/response JSON Schema.
6. **Stage A/B1 runtime** — only B2 current tree exercised; `HIVE_PHASE=A/B1` not started.
7. **Budget overcommit recovery** — no test of actual > reserved.
8. **Multi-process one-active-run** — process-local check only.
9. **Periodic lease reaper** — startup only.
10. **E2E trace/screenshot artifacts** — disabled for this wave; no trace inspection.

## 6. Scope / test integrity / secret checks

- **No scope violations found:** qa-core changed runs/db/security/logic/scripts; qa-pipeline pipeline/verify; qa-api app/config/e2e/playwright; qa-ui web; qa-agents agents/routing/shared/scripts; qa-learning learning/scripts. No product file outside its seat.
- **No test weakening:** no `.skip`/`.only`/empty catch; 205 tests; targeted RED/GREEN receipts in journals.
- **Secrets:** `secret-scan` 122 clean; `stub-sweep` 77 clean; no key-like string in `web/dist` (qa-ui scan); no key in reports/logs. The user-supplied key is only in gitignored `.env.local`; no value in this report.
- **E2E:** 7/7 after restart; pre-restart 4/7 was stale server, recorded above. `verify` exit 0.

## 7. Final

**NO-GO for production.** The wave is **PASS-WITH-NOTES**: all six seats delivered real RED/GREEN fixes and the final source gates are green; no product P0 was found. Production GO is blocked by **13 P1 findings** — most importantly the ignored max-cost control, dead RVS/guard/P7 HTTP wiring, non-atomic finalize, false overcommit/badge/trace evidence, unbatched repo-map/integrity scripts, and the latent `needs_review` cancel deadlock. After those are fixed or explicitly accepted in writing (and the key is rotated if this transcript is shared), the product can move to **GO-WITH-FIXES**.
