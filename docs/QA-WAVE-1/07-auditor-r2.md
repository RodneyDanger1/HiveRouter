# QA WAVE 1 — Round 2 Independent Auditor (`qa-auditor-r2`)

**Checkpoint:** 2026-11-03T10:51:28-06:00 · plan `698C1B…27C7` · lock `ADD08F…7AFF`
**Scope:** independent re-verification of the 13 P1 dispositions in `docs/QA-WAVE-1/P1-FIXES.md`; read-only product audit. Only this report and `logs/qa-auditor-r2.md` written.
**Verdict:** **NO-GO for testing.** No production-grade approval is possible yet; one **new P0/P1 regression** was reproduced: the RVS fix now rejects valid TSX/JSX files, so full-build React/NDS projects cannot pass verification. Several P1s are partial or accepted. All other source gates are green.
**No key reads/calls:** the running server already holds the key; no key value was read or printed. E2E made no provider calls.

## 1. Final gate receipt (current tree)

| Gate | Result | Raw evidence |
|---|---|---|
| `npm.cmd run verify` | **PASS** | typecheck + 210 tests / 26 files + build + stub-sweep 80 clean + secret-scan 127 clean; `VERIFY_EXIT:0` |
| `npm.cmd test` | **PASS — 210 tests / 26 files** | `Test Files 26 passed`, `Tests 210 passed` |
| `npm.cmd run build` | **PASS** | 2,328 modules; `index-D9001p49.js` 651.99 kB (warning only) |
| `npm.cmd run e2e` | **PASS — 7/7** | server was down (`ECONNREFUSED`) at 10:51; started the current tree once, health B2, then 4 contract + 3 UI tests passed |
| `assert-stage --stage=p7 --json` | **PASS, strict** | `fallback:false`, 125 files / 45 tables / 46 routes / **23 scripts**, `violations:[]` |
| `preflight --port 0 --json` | **PASS** | disk 5.24 > 4.5; RAM 2.67 > 1.5; Node/npm/Chrome/port pass |
| `stub-sweep` / `secret-scan` | **PASS** | 80 files / 127 files, 0 hits |
| `integrity --run run_007238d763a3956e74 --json` | **PASS** | artifact hash + `manifestParity:{ok:true,expected:1,actual:1}` |

**Transient observation:** at 10:56 `package.json` began with `EF BB BF` (UTF-8 BOM); `assert-stage` reported `scripts:0` because its `JSON.parse` silently returned `[]`. By 10:58 the BOM was gone and the stage gate reported `scripts:23`. This was a real fake-green window; current file is clean. Recheck `package.json` bytes in any future gate.

## 2. P1 disposition re-verification

| Audit ID | Ledger disposition | Independent result |
|---|---|---|
| **AUD-1** finalize per-file, not atomic | ACCEPTED risk | **PASS-WITH-NOTES** — `run.ts:819-855` still writes each accepted file via `atomicWrite`; README limitation documents the accepted testing-stage risk. |
| **AUD-2** overcommit rolled back with tx | FIXED | **PASS** — `budget.ts:77-91` updates row in `tx`, sets `overcommitted`, throws after commit; `logic-core.test.ts` asserts committed `2_000`; targeted 22 tests pass. |
| **AUD-3** needs_review cancel fake success | FIXED | **PASS-WITH-NOTES** — `manager.ts` cancels needs_review/queued/paused and releases leases; test passes. Route still returns `{cancelled:true}` when `cancelRun` returns false for an already-terminal run (P2). |
| **AUD-4** RVS plan ignored | FIXED | **FAIL — new regression.** Plan is passed to `verifyStaged`, but `run.ts:660` omits `syntax.tsx`/`syntax.jsx` from `availableChecks`. A valid TSX file gets `syntax.tsx:unverified` and `syntax.all:unverified`, both **mandatory**, so the gate fails. Runtime probe below. |
| **AUD-5** badges minted without evidence | FIXED | **PASS-WITH-NOTES** — unconditional `schema-valid` removed; but no producer ever inserts a `schema-valid` evidence row: live `/api/agents` shows `agents=37 schemaValid=0 representativeLive=4 mockRun=0`. The badge requirement is not satisfiable. |
| **AUD-6** trace cache/reasoning zeros | FIXED | **PASS** — `usageTotals` sums cache hit/miss/reasoning; `recordRunTrace` writes them into `traces`; code read. |
| **AUD-7** ad-hoc tests branch | FIXED | **PASS** — `executeAdhocRun` branches on `tests` first, uses `TestsSchema`, multiple files; route requires target only for `files`. |
| **AUD-8** repo-map unbounded | FIXED | **PASS-WITH-NOTES** — 2,000-file/10 MB caps, deny dirs/files, `.env*`/binary filter. Symlinks are still followed by `readdirSync` file handling; containment test absent (P2). |
| **AUD-9** integrity only artifacts | FIXED | **PASS-WITH-NOTES** — manifest parity and workspace containment added; **vault parity** still absent from the original finding. Runtime shows `manifestParity.ok:true`. |
| **AUD-10** maxCost ignored | FIXED | **PASS** — `CreateRunInput.maxCostUsd`, `run_limit` setting, `scopeCap('user', runId)`, `canAfford`; both run routes pass it; test pins 0.01 cap. |
| **AUD-11** feature flags unenforced | PARTIAL | **PASS-WITH-NOTES** — API `onRequest` returns `E_LEARNING_DISABLED`/`E_ROUTING_DISABLED`; the pipeline itself is not gated, and no A/B1 runtime start was performed. |
| **AUD-12** guard no caller | PARTIAL | **PASS-WITH-NOTES** — `finalize` calls `evaluateLoopGuard`, writes `learning_audit` and a warning check; it is a final warning, not the pause→needs_review loop. |
| **AUD-13** P7 HTTP hardcoded | ACCEPTED | **PASS-WITH-NOTES** — state-based refusals now: `POST /api/learning/approvals` with 0 blocks returns 422 `E_LEARNING_POOL_EXHAUSTED`; no promotion without pool/consent/eval. No live promotion. |

## 3. New defect (must fix before testing GO)

### R2-01 — P0/P1 — RVS false-fails every TSX/JSX file

**File:** `src/server/pipeline/run.ts:657-661`; `src/server/verify/verifier.ts:24-27,79-106`; `src/server/quality/rvs.ts:30-38`.
**Defect:** `availableChecks` lacks `syntax.tsx` and `syntax.jsx`. `planVerification` therefore marks those checks `unverified`; `verifyStaged` skips them (`shouldRun` false), then emits `syntax.tsx`/`syntax.jsx` **mandatory unverified** plus `syntax.all` **mandatory unverified**. A valid `.tsx` file can never pass the gate.
**RED evidence (runtime, temp dir, current source):**
```json
{"plan":[{"id":"syntax.tsx","status":"unverified"}],
 "checks":[{"id":"syntax.tsx","status":"unverified","mandatory":true},
           {"id":"syntax.all","status":"unverified","mandatory":true}]}
```
**Why it bites:** the React, NDS, Tailwind, and TS/TSX engines are core catalog engines; any full-build with a `.tsx` UI file fails verification regardless of code quality. A repair loop cannot fix a missing check ID.
**Minimal fix:** add `syntax.tsx` and `syntax.jsx` to `availableChecks`; add `syntax.css` only if a CSS parser exists (otherwise keep static-only with an explicit non-mandatory `unverified`, not a mandatory fail). Add a test: valid `App.tsx` passes; invalid `App.tsx` fails; no `syntax.all` pass when a planned syntax check is skipped.
**GREEN required:** RVS plan schedules `syntax.tsx` planned; `verifyStaged` runs it; valid TSX gate `pass`; invalid TSX gate `fail`; `syntax.all` is not pass when any syntax check is skipped.

## 4. Other residuals / unverified

- **AUD-5 schema-valid 0/37**: add an evidence producer after schema validation, or remove `schema-valid` from the DoD/UI. Current live badge set is `registered` + representative-live only.
- **AUD-9 vault parity**: integrity compares manifest↔artifacts, not vault index/file parity; add or mark P2 accepted.
- **AUD-11 feature gate**: API-only; `HIVE_PHASE=A/B1` startup and pipeline routing/learning behavior not exercised. HTTP gate test exists; runtime stage not.
- **AUD-12 guard**: final-only warning; no pause state, no 10-minute needs_review, no budget release from guard. This is a P7 feature gap, accepted by ledger as partial.
- **AUD-13 P7**: no live promotion/rollback; no 390-case pool/consent; state refusals are correct for this build.
- **Docs drift:** README/P1-FIXES say 209 tests; current suite is **210**. E2E 7/7 confirmed; no traces/screenshots (disabled).
- **Server state:** the shared 8787 process was not running at 10:51; I started the current tree once for E2E, did not restart a live process. The `npm.cmd start` wrapper job later exited 1 while the detached server remained healthy (PID 17508, `/api/health` status ok, B2).
- **No key access:** no key value read or printed; no live provider call in this round.

## 5. Final

**NO-GO for testing** until R2-01 is fixed (add TSX/JSX to RVS available checks and gate-test it). Also close or explicitly accept: schema-valid evidence producer (AUD-5), vault parity (AUD-9), feature gate/pipeline gating (AUD-11), and guard pause semantics (AUD-12). AUD-1/AUD-13 are accepted testing-stage risks with documentation. After those, the current tree can move to **GO-WITH-FIXES** for testing; production is still out of scope.
