# Wave 17 — Seat B: Ledger/State Truth (wave 2)

Date: 2026-11-05
Base: `db4e6d5` + integrated wave-1/Lead changes. Starting tree hashes were identical to the wave-1 final hashes (`app.ts 20ed0258…`, `recorder.ts 3a3f398d…`, `writer-matrix.test.ts 9f914285…`, `historical-usage.test.ts e2088c94…`). Server was running on `127.0.0.1:8787`; it was not restarted. No git write, no paid call, no live DB mutation.
Owner: Seat B (`src/server/**`, `test/unit/**`, this report).
Skills: `truthseeker` + `logic-debugger` + `auditor`, under `forgewright-lead` / `forgewright-plan` / `forgewright-recon` / `forge` / `logic-gatekeeper`.

Job: independently re-verify wave-1 D-B1/D-B2 by planted-defect/fail-restore, audit one adjacent integrity surface (review coverage/eligibility), fix only confirmed defects, run targeted tests then the full suite, report truthfully.

## 0. Phase 1 gate — written before the D-B3 mutation

```json
{
  "phase1": {
    "architecture": "src/server/pipeline/run.ts reviewGateChecks is the single review-gate classifier: it turns a parsed ReviewResult into CheckResult[] (primary verdict + optional REVIEW_UNREVIEWED coverage), which the pipeline persists via insertCheck and completionStatus consumes. Path identity is security/paths.ts normalizeRel, already applied to reviewedFiles coverage (run.ts:276-284); finding grounding (run.ts:264-271) is the outlier that validates via normalizeRel but compares the raw string.",
    "dataFlow": "provider ReviewSchema JSON -> agentStep -> reviewGateChecks(runId, kind, review, allowedPaths) -> insertReview + CheckResult[] -> insertCheck rows -> getChecks /api/runs/:id and the run report -> completionStatus. Untrusted input: finding.file and reviewedFiles entries from the model; allowedPaths from the validated plan/parent workspace.",
    "edgeCases": [
      "finding file 'src\\\\app.ts' (Windows separator) for allowed path 'src/app.ts': normalizeRel maps it to 'src/app.ts' but the raw compare fails -> REVIEW_UNGROUNDED, while the same declaration in reviewedFiles counts as coverage",
      "finding file '../secret.ts': normalizeRel throws -> ungrounded (must stay refused)",
      "clean review with reviewedFiles ['src\\\\a.ts'] and allowed ['src/a.ts','src/b.ts']: only src/b.ts is unreviewed",
      "non-critical separator-only finding with verdict pass: currently warns REVIEW_UNGROUNDED_WARNING instead of passing"
    ],
    "rootCause": "grounded() discards the value returned by normalizeRel and compares the raw finding path against the normalized allowed set, so a finding that names an allowed plan file with a backslash separator is classified as citing a path outside the plan while the identical reviewedFiles declaration is accepted as coverage."
  }
}
```

The D-B1/D-B2 re-verification below re-plants already-known defects; it is an audit operation, not a new fix. Every planted file was restored from a byte backup and the restored sha256 was compared before the next step.

## 1. Independent re-verification of wave-1 fixes (auditor protocol)

Method: copy the integrated files to `%TEMP%`, re-plant the exact pre-fix code, run the wave-1 named test, restore with `Copy-Item`, compare sha256 to the starting hash, re-run green. Backups were outside the repository and were deleted afterwards.

### 1.1 D-B1 — terminal-phase guard (`src/server/runs/recorder.ts`)

Planted state: the reverse of the wave-1 diff hunk (pre-fix guard, the version at HEAD). Byte identity was proven: `git hash-object src/server/runs/recorder.ts` = `d754e33a1482c1c55f45fb43fa37784675359a63` = `git rev-parse HEAD:src/server/runs/recorder.ts`.

```text
npm.cmd test -- --run test/unit/writer-matrix.test.ts

 ❯ test/unit/writer-matrix.test.ts (7 tests | 1 failed)
     × refuses a terminal status that is not closed at the terminal phase 26ms
 FAIL  test/unit/writer-matrix.test.ts > P0-1 production status/phase writers > refuses a terminal status that is not closed at the terminal phase
 AssertionError: expected [Function] to throw an error
 Test Files  1 failed (1)
      Tests  1 failed | 6 passed (7)
```

Restore: sha256 `3a3f398d85013bfc1058b9e94d6017a203c06fff571684b9de1e43c28312c73e` (identical to the starting hash).

```text
npm.cmd test -- --run test/unit/writer-matrix.test.ts
 Test Files  1 passed (1)
      Tests  7 passed (7)
```

**D-B1: PASS.** RED reproduced, restore byte-identical, GREEN observed.

### 1.2 D-B2 — stats unknown spend (`src/server/app.ts`)

Planted state: the pre-fix `/api/stats` block (`const partial = unknownUsageRows > 0;`, no unknown-run/chat counters, no response fields). Byte identity was proven: `git hash-object src/server/app.ts` = `3eb7f7d5f20e1cd2efa8eab6157b109992cd1755` = `git rev-parse HEAD:src/server/app.ts`.

```text
npm.cmd test -- --run test/unit/historical-usage.test.ts

 ❯ test/unit/historical-usage.test.ts (8 tests | 4 failed)
     × does not report a complete total when a terminal run has spend nowhere in the ledger
     × keeps the total complete when the stale NULL run row is backed by measured usage rows
     × marks unknown chat spend as partial instead of adding it as zero
     × keeps a terminal run with no usage rows as unknown spend, even when it never started
 AssertionError: expected false to be true        # partial stayed false
 AssertionError: expected undefined to be +0      # unknownRunSpendRows
 AssertionError: expected undefined to be 2       # unknownChatSpendJobs
 AssertionError: expected undefined to be 1
 Test Files  1 failed (1)
      Tests  4 failed | 4 passed (8)
```

Restore: sha256 `20ed025836f52f1ddc604af49d9d7352e5d9663852bc1b5d9d9aaddd75339e54` (identical to the starting hash).

```text
npm.cmd test -- --run test/unit/historical-usage.test.ts
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

### 1.3 Live integration evidence (read-only, no restart)

The running process was queried with a read-only GET; no restart and no write.

```text
GET http://127.0.0.1:8787/api/stats
{ "agentCount": 37, "runCount": 30,
  "totalPromptTokens": null, "totalCompletionTokens": null, "totalCostUsd": null,
  "measuredPromptTokens": 2102789, "measuredCompletionTokens": 807551,
  "measuredCostUsd": 1.188757662, "chatCostUsd": 0.0007362,
  "unknownUsageRows": 0, "unknownRunSpendRows": 1, "unknownChatSpendJobs": 0,
  "partial": true }
```

This independently reproduces the Lead's integrated state: the fixed response shape is live, totals are NULL while unaccounted spend exists, and `unknownRunSpendRows:1` matches the one live terminal run with no ledger rows. **D-B2: PASS** (server process not touched).

## 2. Adjacent surface audit — review coverage/eligibility

**Invariant audited:** a review finding's `file` and a `reviewedFiles` entry are the same kind of path declaration, so the gate must classify the same declaration identically; coverage must never be claimable for a path outside the review's input set, and normalization must never turn an outside path into a plan path.

### 2.1 Recon ledger

- Target behavior: `reviewGateChecks` (`src/server/pipeline/run.ts:256-325`) turns a `ReviewResult` into `CheckResult[]`: primary verdict (`REVIEW_CRITICAL` fail at `:303`, `REVIEW_CHANGES_REQUIRED`/`REVIEW_UNGROUNDED_WARNING` warn at `:313`, pass at `:319`) plus one non-mandatory `REVIEW_UNREVIEWED` coverage warning (`:286-294`).
- Entry: `grounded()` `src/server/pipeline/run.ts:264-272`; declaration coverage `:276-285`.
- Callers (all production review phases): `:455`, `:466` (revise/audit cleaning+hardening), `:895`, `:907` (generation cleaning+hardening), `:998` (repair). Each passes an `allowedPaths` set equal to the input file set it sends the reviewer (`parentFiles` / `plan.files` / `allPlanned`).
- Tests + command: `test/unit/p0-truth.test.ts:35-129` (grounded/ungrounded critical, ungrounded warning, full coverage, partial coverage, critical+partial); `test/unit/agents.schemas.test.ts:88-96` (schema default); new `test/unit/review-coverage.test.ts`. Command: `npm.cmd test -- --run test/unit/p0-truth.test.ts test/unit/review-coverage.test.ts`.

### 2.2 Surface audit matrix

| Check | Evidence | Verdict |
|---|---|---|
| Coverage cannot be claimed for a path outside the plan; invalid declarations are ignored and the allowed file stays unreviewed | `run.ts:276-285`; `test/unit/p0-truth.test.ts:97-114` | VERIFIED |
| Reviewer input set equals `allowedPaths` at every caller, so a declared-coverage path is a path the reviewer was given | callers at `run.ts:455,466,895,907,998`; read | VERIFIED (read) |
| Partial coverage names exactly the allowed files not declared, sorted | `run.ts:285-294`; `p0-truth.test.ts:97-114`; new test 3 | VERIFIED |
| Full coverage leaves only the primary check (no false coverage warning) | `run.ts:324`; `p0-truth.test.ts:84-95`; new test 1 | VERIFIED |
| A coverage warning cannot suppress a critical fail (primary stays first and mandatory) | `run.ts:296-305,324`; `p0-truth.test.ts:116-128` | VERIFIED |
| `warn` coverage maps to `completed_with_warnings`, pass maps to `completed` | `run.ts:1083-1086`; `p0-truth.test.ts:97-114`; new test 2/3 | VERIFIED |
| Paths outside the plan, unsafe paths, and separator lookalikes stay ungrounded | `run.ts:264-272`; `p0-truth.test.ts:49-59`; new test 4 | VERIFIED |
| A finding and a `reviewedFiles` declaration naming the same plan file get the same classification | `run.ts:264-285` — **contradicted before fix**, see D-B3 | **DEFECT (fixed)** |

### 2.3 Confirmed defect D-B3 (fixed): grounding discarded the normalized path

**Location:** `src/server/pipeline/run.ts:264-271` (pre-fix), consumers `:274`, `:300`, `:303`, `:310`, `:313`.

**Root cause:** `grounded(file)` called `normalizeRel(file)` but ignored its return value, then compared the **raw** string against `allowed`. `normalizeRel` treats `\` as a separator (`security/paths.ts:24`), and the adjacent `reviewedFiles` branch does use the normalized value (`run.ts:278-280`). A separator-only path therefore counted as *coverage* but not as *grounded*.

**Observable contradiction:** a finding citing `src\app.ts` for the plan path `src/app.ts`, with `reviewedFiles: ['src\app.ts']`:
- pre-fix: `REVIEW_UNGROUNDED` for a critical finding (the run claims the file is outside the plan, while the same declaration proves its coverage), and `REVIEW_UNGROUNDED_WARNING` + status `warn` for a non-critical finding with `verdict: pass` (the run becomes `completed_with_warnings` instead of `completed`);
- post-fix: `REVIEW_CRITICAL` (still a mandatory fail, but the correct named code) and `pass` respectively.

This defect cannot produce a false pass in either direction: ungrounded findings are fail-closed, and a critical finding fails regardless of its grounding code. It is a named-truth defect (wrong code/claim and a spurious warning), not a gate-bypass.

**RED** (`test/unit/review-coverage.test.ts` against the pre-fix gate):

```text
 ❯ test/unit/review-coverage.test.ts (4 tests | 2 failed)
     × grounds a critical finding whose path differs only by separator, and counts the same declaration as coverage
     × does not raise an ungrounded warning for a non-critical finding whose path differs only by separator
     ✓ names only the truly missing file when a normalized declaration already covers its path
     ✓ still refuses findings that cite paths outside the plan, including separator-only lookalikes
 AssertionError: expected 'REVIEW_UNGROUNDED' to be 'REVIEW_CRITICAL' // Object.is equality
 AssertionError: expected 'warn' to be 'pass' // Object.is equality
 Test Files  1 failed (1)
      Tests  2 failed | 2 passed (4)
```

**Fix** (`src/server/pipeline/run.ts:264-272`, one expression):

```ts
const grounded = (file: string): boolean => {
  try {
    // Normalize before the membership test: a finding and a reviewedFiles
    // declaration naming the same plan file must be classified identically.
    return allowed.has(normalizeRel(file));
  } catch {
    return false;
  }
};
```

**GREEN:**

```text
npm.cmd test -- --run test/unit/review-coverage.test.ts test/unit/p0-truth.test.ts
 Test Files  2 passed (2)
      Tests  14 passed (14)
```

**Re-plant proof** (auditor step on the final fixed tree): restored the pre-fix `grounded`, observed the same 2/4 RED with the same assertions, restored the post-fix file from a byte copy; sha256 `10af6116628d7f1aad1a6ea9a902e107133e80839ecadac512eee3737396a5e4` identical after restore; GREEN again `4 passed (4)`.

### 2.4 Tests added

`test/unit/review-coverage.test.ts` (4 tests) — separator-only grounded critical (`REVIEW_CRITICAL`, single check, no "ungrounded" detail); separator-only non-critical stays `pass`/`completed`; coverage names only `src/b.ts` when `src\a.ts` was declared; `../secret.ts` and `src\outside.ts` still `REVIEW_UNGROUNDED` (no weakening). The two negative controls pass before and after the fix by design.

## 3. Commands and observed output

```text
npm.cmd test -- --run test/unit/writer-matrix.test.ts -> 7 passed (7)
npm.cmd test -- --run test/unit/historical-usage.test.ts -> 8 passed (8)
npm.cmd test -- --run test/unit/review-coverage.test.ts -> 4 passed (4)
targeted cluster (14 files: writer-matrix, historical-usage, review-coverage, p0-truth,
  terminal-usage, terminal-writers, startup-interrupt, run-transition-guard, stats-truth,
  resume-run, runs-list-api, run-timeout, logic-run-state, agents.schemas)
  Test Files  14 passed (14)
       Tests  73 passed (73)
npm.cmd run typecheck -> exit 0 (no diagnostics)
npm.cmd run stub-sweep -> stub-sweep: clean (104 files)
npm.cmd run secret-scan -> secret-scan: clean (206 files)
npm.cmd test
  Test Files  74 passed (74)
       Tests  474 passed (474)      # base 470 + 4 new
```

No test was weakened, skipped, or deleted. `npm.cmd test` was run after all plants were restored and after the D-B3 fix.

Final sha256 (`Get-FileHash`):

```text
20ed025836f52f1ddc604af49d9d7352e5d9663852bc1b5d9d9aaddd75339e54  src/server/app.ts
3a3f398d85013bfc1058b9e94d6017a203c06fff571684b9de1e43c28312c73e  src/server/runs/recorder.ts
10af6116628d7f1aad1a6ea9a902e107133e80839ecadac512eee3737396a5e4  src/server/pipeline/run.ts
9f91428535d49335d7f331f1ddd9ce52c8ca1610e6b6ce188fbed98f11766d2d  test/unit/writer-matrix.test.ts
e2088c94f8b888d30bb582ea436c41659aa3394e5971df6df38cbd51ad5dcb64  test/unit/historical-usage.test.ts
2511947f6dffb67085dae7e3185111c960cb91d3f03a0ef5fa0e2906e584886b  test/unit/review-coverage.test.ts
```

`app.ts`, `recorder.ts`, `writer-matrix.test.ts` and `historical-usage.test.ts` are byte-identical to the wave-1 finals; the only production delta in this wave is the one `grounded()` change, plus the new test file. No temporary edit remains; backups were deleted.

## 4. Claim register

| Claim | Evidence | Status |
|---|---|---|
| D-B1 planted defect fails the named wave-1 test and the byte restore restores GREEN | `writer-matrix` RED 1/7, planted blob == HEAD `d754e33a…`, restore sha256 `3a3f398d…`, GREEN 7/7 | VERIFIED |
| D-B2 planted defect fails the named wave-1 tests and the byte restore restores GREEN | `historical-usage` RED 4/8, planted blob == HEAD `3eb7f7d5…`, restore sha256 `20ed0258…`, GREEN 8/8 | VERIFIED |
| The live server advertises the fixed stats contract with unaccounted spend flagged | read-only `GET /api/stats` (§1.3) | VERIFIED |
| Findings and `reviewedFiles` declarations now share one path identity | `run.ts:264-285`; RED/GREEN + re-plant in §2.3 | VERIFIED |
| Coverage remains fail-closed: outside/unsafe/separator-lookalike paths stay ungrounded; coverage cannot be claimed for non-input files | new test 4; `p0-truth.test.ts:49-59,97-114`; caller read | VERIFIED |
| The gate status is never made more permissive for a critical finding (still mandatory fail) | `run.ts:296-305`; new test 1 | VERIFIED |
| Full suite green after the fix | `npm.cmd test` 474/474, 74 files | VERIFIED |
| A review coverage warning turns a run into `completed_with_warnings` | `p0-truth.test.ts:97-114`, new test 3 | VERIFIED |
| Windows case differences (`src/APP.ts` vs `src/app.ts`) are still treated as different paths | code read (`normalizeRel` preserves case); not exercised | UNVERIFIED (policy residual) |
| Idempotency run-row/idempotency-row atomicity under a failed key insert | code read only (`manager.ts:119-149`); no repro run | UNVERIFIED (not audited this wave) |

## 5. Residual, not done, and Lead-owned requests

Not done (not confirmed defects / out of the fixed scope):

- `./`-prefixed references (`./src/app.ts`) are still rejected by `normalizeRel` (dot segment), so they remain ungrounded/uncounted. This is the pre-existing path-safety policy; the fix deliberately did not widen path identity.
- Windows case-insensitive identity is not implemented: `src/APP.ts` vs `src/app.ts` still differ (conservative false warning/false ungrounded on a case-insensitive FS).
- `applyRevisions` (`run.ts:1093-1099`) still compares revision paths raw, so a revision naming an allowed file with a separator-only path fails `E_AGENT_OUTPUT_MISMATCH`. Fail-closed; separate seam, not changed.
- Test files generated in the `testing` phase after cleaning/hardening are not part of any review's input; the coverage warning is scoped to each review's input set, so this is not a false pass but it is a coverage gap for published tests. Unchanged.
- The repair loop replaces the earlier review checks (`run.ts:998-1002`), so a post-repair clean review supersedes cleaning/hardening verdict checks in the final checks array (all rows remain in the `checks` table). Not changed; noted for Lead review.
- Run-creation atomicity window identified while choosing the surface: `createRun` inserts the run row before the idempotency record (`manager.ts:119-149`); a failed key insert would leave an orphan queued run and make a same-key retry hit `E_ACTIVE_RUN_EXISTS` until restart. Read-only observation; no repro executed, not fixed, recorded so the Lead can schedule it.

Lead-owned requests:

1. Rerun the gate independently on the integrated tree (`npm.cmd test`, `typecheck`, `build/e2e/verify` as your contract requires); my evidence is unit-level plus one read-only live `/api/stats`.
2. Decide whether the D-B3 severity warrants folding it into the wave commit as a truth fix (it changes a named code and can remove a spurious `completed_with_warnings`, but it cannot bypass the gate).
3. If the idempotency atomicity residual is in wave-17 scope, it needs its own Phase 1 + fault-injection RED; I did not touch run creation.
4. `docs/TRACE/WAVE-17/INDEX.md` and the final `TRACE-SUMMARY.md` are Lead-owned; this report is the only Seat B doc write.

## 6. Done / Not done / Unverified

| Done | Evidence |
|---|---|
| D-B1 independently re-verified (plant → RED → byte restore → GREEN) | §1.1 |
| D-B2 independently re-verified (plant → RED → byte restore → GREEN) | §1.2 |
| Live integrated stats contract checked read-only | §1.3 |
| Adjacent review-coverage/eligibility surface audited | §2.2 |
| D-B3 confirmed, fixed minimally, RED/GREEN/re-plant proven | §2.3 |
| 4 new unit tests; targeted cluster and full suite green | §2.4, §3 |
| No forbidden paths touched, no git write, no restart, no paid call, temp fixtures removed | §3, §5 |

| Not done | Reason |
|---|---|
| No second confirmed defect in the audited surface | Coverage/grounding audit found one defect; the remaining edges are policy residuals, reported above rather than invented as defects |
| No idempotency defect fix | Read-only observation (§5); not the selected surface and needs its own fault-injection RED |

| Unverified | What would prove it |
|---|---|
| Windows case-insensitive path identity behavior/policy | A platform-specific policy decision plus tests; current behavior is read-only evidence |
| Idempotency run-row/key atomicity under a failed insert | A fault-injection test (e.g. an `idempotency_keys` insert trigger that aborts) showing the orphan row, then a fix |
| Browser rendering of the review codes | Seat A / Lead E2E evidence; Seat B did not touch `web/**` |
