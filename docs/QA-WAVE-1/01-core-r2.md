# QA Wave 1 — Round 2, independent logic re-verification (`qa-core-r2`)

**Mode:** read-only re-verification; no product edits. Wrote only this file and `logs/qa-core-r2.md`.
**Inputs:** `docs/QA-WAVE-1/P1-FIXES.md`; current merged tree; `runs/budget.ts`, `runs/manager.ts`, `runs/recorder.ts`, `pipeline/run.ts`, `verify/verifier.ts`, `app.ts`.
**Verdict:** **5 PASS, 1 FAIL.** Items 1, 2, 3, 5, 6 behave as claimed. Item 4 is **not honestly fixed**: the unplanned syntax check is skipped and a generic warning is emitted, but `syntax.all` is still a mandatory **pass** (“all verifiable files parse”), so a gate can pass without checking syntax. No product edits made.

## Results

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | Budget overcommit records `committed_micro_usd` then throws | **PASS** | `ITEM1 {"threw":true,"state":"committed","committedMicroUsd":2000}` |
| 2 | `needs_review` cancel returns true and unblocks active guard | **PASS** | `ITEM2 {"before":"run_review","cancelled":true,"status":"cancelled","after":null}` |
| 3 | Per-run `maxCostUsd` enforced by `reserve`/`canAfford` | **PASS** | `ITEM3 {"cap":10000,"canAfford5000":false,"reserve5000Threw":true}` |
| 4 | RVS plan passed; unplanned check skipped/reported | **FAIL** | `ITEM4 [... {"id":"verification.plan","status":"warn"...1 syntax check(s) skipped...},{"id":"syntax.all","status":"pass","mandatory":true,...}]` |
| 5 | Trace cache/reasoning sums | **PASS** | `ITEM5 {"costUsd":0.01,"promptTokens":10,"completionTokens":5,"cacheHitTokens":400,"cacheMissTokens":100,"reasoningTokens":50}` |
| 6 | Feature hook returns `E_LEARNING_DISABLED` / `E_ROUTING_DISABLED` | **PASS** | `403 E_LEARNING_DISABLED`; `403 E_ROUTING_DISABLED`; `/api/health` 200 |

## Item detail

### 1 — PASS — overcommit persistence
- Code: `src/server/runs/budget.ts:77-91` updates `state='committed', committed_micro_usd=actual` inside `tx`, sets `overcommitted`, then throws **after** commit.
- Probe: reserve 1,000, commit 2,000 → throw `E_BUDGET_OVERCOMMIT`; row remained `committed`, `committed_micro_usd=2000`.
- Existing test: `test/unit/logic-core.test.ts:30-37` passes. **VERIFIED.**

### 2 — PASS — needs_review cancel
- Code: `src/server/runs/manager.ts:157-180`: no controller + status in `needs_review|queued|paused` → release reservations, set `cancelled/done`, emit `run.cancelled`, return true.
- Probe: insert `needs_review`; `getActiveRunId()` before = `run_review`; `cancelRun` = true; status `cancelled`; after = `null`.
- Route: `app.ts:617-619` maps false to `E_RUN_NOT_CANCELLABLE`; true returns `{cancelled:true}`. **VERIFIED** (manager and route wiring).

### 3 — PASS — per-run cap
- Code: `budget.ts:20-37` reads `run_limit:<id>` and clamps to global; `reserve` uses it at line 58; `canAfford` uses `scopeCap('user', runId)` at line 117; `createRun` validates/stores `maxCostUsd` at `manager.ts:83-85,115-119`.
- Probe: stored `maxCostUsd=0.01` → `scopeCap=10000`; reserve 6,000; `canAfford(5000)=false`; reserve 5,000 throws `E_BUDGET_EXCEEDED`.
- Existing test: `logic-core.test.ts:38-44,56-69`. **VERIFIED.**

### 4 — FAIL — unplanned syntax check is skipped, but `syntax.all` falsely passes
- Code: `src/server/verify/verifier.ts:24-27` only runs `plannedCheckIds` plus path/plan; `:79-88` increments `skippedByPlan` and does **not** run `checkSyntax`; `:93-99` pushes `verification.plan` warn; `:103` unconditionally pushes `syntax.all: pass, mandatory:true` when `syntaxFailures===0`.
- Probe: staged `bad.py` = `def broken(:`; plan = only `path.safety` + `plan.coverage` planned. Output:
  - `plan.coverage: pass`
  - `verification.plan: warn` — “1 syntax check(s) skipped by plan”
  - `syntax.all: pass` — “all verifiable files parse”
- Why it bites: the only mandatory syntax check is absent/skipped, yet the gate receives a mandatory pass and `gateStatus` cannot fail. This is a false green; the unverified plan entry (`syntax.python`, status `unverified`) is not surfaced as a check.
- Exact patch (for owner): in `verifyStaged`, track skipped check IDs and emit `syntax.<lang>` as `unverified`/mandatory when its plan status is not planned; only push `syntax.all: pass` when every verifiable file actually ran and passed; otherwise `syntax.all` must be `unverified`/`skipped` with detail. `verification.plan` should list secret/stub skipped checks too, not only syntax.
- Required GREEN: same probe must not contain a mandatory `syntax.all: pass`; it must contain a mandatory `syntax.python: unverified` (or status `skipped` wired to gate failure), and `gateStatus` returns `fail`/`pass_with_warnings`, never `pass` for an unverified mandatory check.
- Existing tests do not cover this (26 targeted tests passed without exercising the unplanned-syntax aggregate).

### 5 — PASS — cache/reasoning sums
- Code: `runs/recorder.ts:355-378` sums `cache_hit_tokens`, `cache_miss_tokens`, `reasoning_tokens`; null if any `source='unknown'`.
- Probe: one provider row (10 prompt, 5 completion, 400 hit, 100 miss, 50 reasoning, $0.01) → exact sums returned.
- Trace write: `pipeline/run.ts:54-70` aligns `cache_hit_tokens`, `cache_miss_tokens`, `reasoning_tokens` in the `INSERT INTO traces` and values; `ON CONFLICT` updates them. **READ** for trace write; **VERIFIED** for totals.
- Note: trace insert was not executed in this read-only probe; code alignment checked. Residual: no test currently asserts a persisted `traces` row’s cache/reasoning columns.

### 6 — PASS — feature gates
- Code: `app.ts:93-101` onRequest hook, before Host/Origin hook: learning prefix → `E_LEARNING_DISABLED`; routing/stats/context/failures/retries/confidence → `E_ROUTING_DISABLED`.
- Probe: fresh process with `HIVE_PHASE=A`, `app.inject`:
  - `/api/learning/overview` → **403 `E_LEARNING_DISABLED`**
  - `/api/stats/router` → **403 `E_ROUTING_DISABLED`**
  - `/api/runs/run_x/routing` → **403 `E_ROUTING_DISABLED`**
  - `/api/health` → **200**
- Limitations: tested at HTTP hook only; pipeline A/B1 start gating remains partial per P1-FIXES. No live server restart; fresh in-process app.

## Commands run

1. Probe 1–5: `@'…probe…'@ | cmd /c "node_modules\.bin\tsx.cmd -"` → raw `ITEM1..ITEM5` above.
2. Probe 6: `HIVE_PHASE=A` + dynamic `buildApp` + `app.inject` → raw `GATE` lines above.
3. `cmd /c "node_modules\.bin\vitest.cmd run test/unit/logic-core.test.ts test/pipeline-qa.test.ts test/unit/quality.test.ts"` → **3 files, 26 tests passed**.
4. `cmd /c "npm.cmd run typecheck"` → **exit 0**, no diagnostics.

## Residuals / limitations
- Item 4’s false `syntax.all` pass is a real gate-integrity defect; no product edits were permitted in this round.
- `verification.plan` detail counts only syntax skips; skipped `secret.scan`/`stub.scan` are not enumerated.
- Trace cache/reasoning persistence is code-aligned but not exercised end-to-end in this read-only probe.
- Other P1-FIXES residuals remain as documented: whole-tree atomic finalize, no periodic reaper, A/B1 runtime start gating, P7 live promotion absent.

## Claim strength
- **VERIFIED:** items 1, 2, 3, 5 (aggregate), 6; targeted 26/26; typecheck.
- **READ:** trace INSERT alignment; verifier line logic.
- **FAIL:** item 4 because a mandatory pass is asserted without running the check.
