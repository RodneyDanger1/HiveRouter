# Wave 17 — two-seat production audit evidence

Date: 2026-11-05
Baseline: `db4e6d5` (455 tests / 71 files; 38/38 E2E; stage 204 files / 51 tables / 62 routes / 24 scripts).
Commit: `706aa98` on `main` (pushed). Final: **474 tests / 74 files**, **44/44 E2E**, stage **209 files / 51 tables / 62 routes / 24 scripts**, verify exit 0, preflight PASS (free RAM 2.06 GB, disk 7.76 GB), `npm audit --omit=dev` 0.

## Seats

| Seat | Skills | Ownership | Wave 1 | Wave 2 |
|---|---|---|---|---|
| A — UI/API control truth | `weaver`, `agent-experience`, `trace` | `web/**`, `e2e/**` | D1/D2/D3 fixes + 3 E2E pins | re-verification of D1/D2/D3; adjacent action/state audit; D-A/D-B fixes + 3 E2E pins |
| B — ledger/state truth | `truthseeker`, `logic-debugger`, `auditor` | `src/server/**`, `test/unit/**` | P0-1/P0-5: D-B1/D-B2 fixes + 15 unit tests | record → named RED → byte restore → GREEN; adjacent review-coverage audit; D-B3 fix + 4 unit tests |
| Lead | `forgewright-lead` | shared types/UI notice, docs, gates, commit | integrated wave 1 + restart | integrated wave 2 + final gate |

## Confirmed defects fixed

| ID | Defect | Root cause | Fix |
|---|---|---|---|
| D1 | Desktop rendered and activated the mobile nav toggle | `.icon-button` declared after `.topbar-menu` at equal specificity overrode `display:none` | `.topbar .topbar-menu` base/media selectors |
| D2 | Chat swallowed `/api/agents` failure | no render path for `agents.error`/`agents.loading` | `ErrorPanel` + retry; placeholders; selects/create/send disabled with named code |
| D3 | Resume retry minted a fresh idempotency key | key created inside `resumeRun` per call | optional caller key; memoized per `runId` |
| D-B1 | Terminal-phase guard covered only 2 of 5 terminal statuses | `updateRun` checked only completed/completed_with_warnings | any write producing a terminal status must land on `done`; `E_ILLEGAL_RUN_TRANSITION` |
| D-B2 | Unknown spend was aggregated as zero | `/api/stats` derived `partial` only from `usage.source='unknown'` | `unknownRunSpendRows` + `unknownChatSpendJobs`; partial forces NULL totals, measured sums stay visible |
| D-A | Run detail offered Revise/Audit for statuses the server rejects | UI used `TERMINAL_STATUSES`; server accepts only completed/completed_with_warnings/failed | `REVISABLE_STATUSES` gate + state-specific hints |
| D-B | Drawer/confirmation modals could be dismissed mid-flight and discard the failure | no busy guard on Escape/backdrop/X/Close | `Modal.busy` vetoes dismissal; `ConfirmDialog` forwards it; drawer disables Close/Edit/Reset/Save |
| D-B3 | `grounded()` discarded `normalizeRel(file)` and compared the raw path | mixed normalized/raw identity between findings and `reviewedFiles` | compare `allowed.has(normalizeRel(file))`; fail-closed for outside/unsafe paths |

## RED → GREEN

- Wave 1 A: 3 new controls tests **3 failed** before fixes, **3 passed** after.
- Wave 1 B: writer-matrix **1 failed / 6 passed**, historical-usage **4 failed / 4 passed** before; **7/7** and **8/8** after.
- Wave 2 A: D1/D2/D3 planted RED each and restored to matching hashes; D-A/D-B **3 failed** before, **3 passed** after.
- Wave 2 B: D-B1/D-B2 re-planted and restored byte-identically; D-B3 **2 failed / 2 passed** before, **4/4** after.
- Lead integrated: full unit **474/474**; full E2E **44/44**.

## Live evidence

- `/api/stats` after rebuild/restart: `partial:true`, totals `null`, `measuredCostUsd:1.188757662`, `unknownRunSpendRows:1`, `unknownChatSpendJobs:0`.
- A wave 2 verified a real `budget_exceeded` snapshot's Revise/Audit POSTs returned `409 E_INVALID_PARENT`; the UI now hides those actions and gives the state-specific hint.
- B wave 2 live read-only `/api/stats` independently returned the same partial/unknown shape.

## Gates (Lead, quiescent tree)

```text
npm.cmd run typecheck          -> exit 0
npm.cmd test                   -> 74 files / 474 tests passed
npm.cmd run build              -> built
npm.cmd run e2e                -> 44 passed
npm.cmd run verify             -> exit 0; stub clean 104; secret clean 206
assert-stage --stage=p7 --json -> 209 files / 51 tables / 62 routes / 24 scripts; violations []
npm.cmd run preflight --json   -> PASS; free RAM 2.06 GB, disk 7.76 GB
npm.cmd audit --omit=dev       -> 0 vulnerabilities
```

## Residual / unverified

- No paid provider call; paid submits (Start, Analyze, Run agent, Revise/Audit submit, chat Send/fan-out), live Stop/cancel, resume **success**, and download refusal paths remain unverified.
- `createRun` inserts the run row before the idempotency record (`manager.ts:119-149`); a failed key insert could leave an orphan with a later `E_ACTIVE_RUN_EXISTS` observation. Not reproduced/fixed; separate fault-injection item.
- Nested Reset confirm + drawer both close on Escape (read, not driven); `/api/runs` has no total/truncation marker; cancel retry sends a key the route ignores; busy veto assumes eventual request settlement (no client fetch timeout). Recorded, not changed.
- Review path identity: `.`-prefixed paths remain rejected; Windows case differences are not case-folded; `applyRevisions` still raw-compares revision paths; post-clean test files are outside review input; repair replaces earlier review checks. Documented residual.
- Full paid live `test:live` and native CUA were not run. Playwright is the interaction evidence.
- E2E refreshes tracked `docs/UI-WAVE-1/shots/*`; the Lead reverted those generated image changes so the commit contains product/docs code only.
