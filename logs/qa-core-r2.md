# qa-core-r2 — independent logic re-verification journal

**STATUS:** 5 PASS / 1 FAIL (item 4, RVS unplanned syntax false pass)
**Mode:** read-only; wrote only `docs/QA-WAVE-1/01-core-r2.md` and this log.
**Time:** 2026-11-03 10:51–10:56 America/Chicago.
**Lenses:** logic-debugger (gate/state), forge (root cause), auditor (independent probes).

## 10:51 — read / frame
- Read `P1-FIXES.md`, current `budget.ts`, `manager.ts`, `recorder.ts`, `verifier.ts`, pipeline trace/verify call sites, app feature hook.
- Six items to falsify: overcommit persistence; needs_review cancel + active guard; per-run cap; RVS skipped-check honesty; trace cache/reasoning sums; feature refusals.
- No product edits; temp DB/staging directories only, removed after probes.

## 10:52 — deterministic probes 1–5
Command: piped ESM probe through `tsx` stdin:
`@'…'@ | cmd /c "node_modules\.bin\tsx.cmd -"`

Observed:
```
ITEM1 {"threw":true,"state":"committed","committedMicroUsd":2000}
ITEM2 {"before":"run_review","cancelled":true,"status":"cancelled","after":null}
ITEM3 {"cap":10000,"canAfford5000":false,"reserve5000Threw":true}
ITEM4 [{"id":"plan.coverage","status":"pass","mandatory":true,"detail":"1 planned files present"},{"id":"verification.plan","status":"warn","mandatory":false,"detail":"RVS planned 2 check(s); 1 syntax check(s) skipped by plan"},{"id":"syntax.all","status":"pass","mandatory":true,"detail":"all verifiable files parse"}]
ITEM5 {"costUsd":0.01,"promptTokens":10,"completionTokens":5,"cacheHitTokens":400,"cacheMissTokens":100,"reasoningTokens":50}
```
- Item 4 FAIL: bad Python was never parsed; `verification.plan` reports the skip, but `syntax.all` is a mandatory pass. `gateStatus` would not fail; false green.
- Item 5 trace write alignment checked at `pipeline/run.ts:54-70`; not executed.

## 10:53 — feature gate probe
Command: fresh process `HIVE_PHASE=A`, dynamic `buildApp`, `app.inject`:
```
GATE {"url":"/api/learning/overview","status":403,"code":"E_LEARNING_DISABLED"}
GATE {"url":"/api/stats/router","status":403,"code":"E_ROUTING_DISABLED"}
GATE {"url":"/api/runs/run_x/routing","status":403,"code":"E_ROUTING_DISABLED"}
GATE {"url":"/api/health","status":200,"code":null}
```
No server restart; in-process inject only.

## 10:54 — targeted tests
Command: `cmd /c "node_modules\.bin\vitest.cmd run test/unit/logic-core.test.ts test/pipeline-qa.test.ts test/unit/quality.test.ts"`
Observed:
```
✓ test/unit/quality.test.ts (11 tests)
✓ test/unit/logic-core.test.ts (11 tests)
✓ test/pipeline-qa.test.ts (4 tests)
Test Files 3 passed; Tests 26 passed
```
Note: 26 tests do not exercise the item-4 false `syntax.all` pass; the FAIL is probe-only.

## 10:55 — typecheck
Command: `cmd /c "npm.cmd run typecheck"`
Observed: `tsc --noEmit` exit **0**, no diagnostics.

## Residuals
- Item 4 requires a product fix in `src/server/verify/verifier.ts`: unplanned/unverified syntax must surface as mandatory `unverified` and `syntax.all` must not pass; `verification.plan` should enumerate all skipped checks, not syntax only.
- Trace cache/reasoning aggregate verified; trace row persistence READ only.
- A/B1 pipeline start gating remains partial per P1-FIXES; feature hook only.
- No edits outside the two assigned files.

**STATUS: DONE (5 PASS, 1 FAIL).**
