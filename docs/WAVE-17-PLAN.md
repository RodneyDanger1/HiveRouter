# Wave 17 decision plan — two-seat production audit

Date: 2026-11-05
Owner: HiveRouter lead
Baseline: `db4e6d5` (455 tests / 71 files; 38/38 E2E; 204 stage files / 51 tables / 62 routes / 24 scripts)
Current plan: [AGENT-OPERATING-PLAN](AGENT-OPERATING-PLAN.md) → Wave 16 complete; P0-1/P0-5 and P1 remain.

## 1. Outcome

Two independent professional engineering seats close the two highest-risk remaining classes at once:

- **Seat A — UI/API control truth:** every touched rendered control has a proven handler → client → route → service → store → response → render-back path; only confirmed defects are fixed.
- **Seat B — ledger/state truth:** the terminal/usage/review/persistence paths are audited against invariants, with P0-1 and P0-5 evidence or a named blocker.

Both seats may improve production code within disjoint ownership. The Lead folds, independently re-verifies, runs the full gates, and updates the single current documentation set.

## 2. Current behavior / evidence

- `db4e6d5` is clean and green: 455 tests / 71 files, 38/38 E2E, stage 204, verify exit 0.
- P0-1 has a pure `STATUS_TRANSITIONS`/`PHASE_TRANSITIONS` test (`test/unit/logic-run-state.test.ts`) but not a complete production-writer matrix.
- P0-5 has historical-NULL coverage in `test/unit/terminal-usage.test.ts:195-208`; no broader store/API audit is recorded.
- UI audit coverage exists in `e2e/ui-audit.spec.ts`; recent work fixed favicon, key-ingress copy, DSH claim, retry keys, and chat fan-out.
- Capability matrix still records absent repo tools, tool loop, approval, checkpoints, parallel generation, P7 evaluator, and native CUA.

## 3. Decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Run exactly two permanent seats with disjoint write scopes | One broad agent | The user requested two tailored seats; overlap causes lost writes |
| Seat A owns `web/**` + `e2e/**`; Seat B owns `src/server/**` + `test/unit/**` | Shared files | Disjoint ownership is enforceable |
| Seat reports live under `docs/TRACE/WAVE-17/seat-a.md` and `seat-b.md` | Both edit shared docs | Lead owns final documentation |
| Each seat uses exactly 3 assigned skills, with the common planning/recon/forge contract | Random skill use | The request mandates 2–3 synchronized skills and a standard coding persona |
| Seat A: `weaver` + `agent-experience` + `trace` | UI-only visual review | Controls must be proven to the store and back |
| Seat B: `truthseeker` + `logic-debugger` + `auditor` | Test-only review | Null/zero, transitions, and independent evidence are the risks |
| Two waves for the same seats | New seats per wave | Preserves context/ownership and satisfies the mandatory second-wave requirement |
| Lead does not accept seat claims without rerunning targeted tests and the gate | Trust receipts | Independent verification is required |

## 4. Seat assignments

### Seat A — UI/API control truth

- **Persona:** professional software engineer; production-only code; complete wiring; no mock/demo/incomplete work.
- **Owned paths:** `web/**`, `e2e/**`, `docs/TRACE/WAVE-17/seat-a.md`.
- **Forbidden:** `src/server/**`, `test/unit/**`, shared docs, package files, git writes, paid calls, destructive actions.
- **Skills (3):** `weaver`, `agent-experience`, `trace`.
- **Mandatory operating skills:** `forgewright-lead`, `forgewright-plan`, `forgewright-recon`, `forge` for every confirmed fix.
- **First wave:** inventory the current UI at 1440/390 against live APIs; find up to 3 confirmed control/wiring defects; fix them with E2E proof; run targeted Playwright and report.
- **Second wave:** after Lead review, re-audit the touched areas plus one untouched high-traffic surface (Runs, Settings, or Agents); fix only confirmed defects; run `npm.cmd run e2e`.
- **Report:** control table, render/handler/API/route/store/render-back evidence, RED/GREEN, commands/output, residual.

### Seat B — ledger/state truth

- **Persona:** same professional engineer standard.
- **Owned paths:** `src/server/**`, `test/unit/**`, `docs/TRACE/WAVE-17/seat-b.md`.
- **Forbidden:** `web/**`, `e2e/**`, shared docs, package files, git writes, paid calls, destructive actions.
- **Skills (3):** `truthseeker`, `logic-debugger`, `auditor`.
- **Mandatory operating skills:** `forgewright-lead`, `forgewright-plan`, `forgewright-recon`, `forge` for every fix.
- **First wave:** audit P0-5 historical NULL/zero and terminal/usage consistency; audit P0-1 production status/phase writers against the matrix. Fix confirmed defects, add RED/GREEN tests, report.
- **Second wave:** independently re-verify the first-wave fixes (planted-defect/fail-restore where practical), then audit review coverage/duplicate-run/stats boundaries; fix confirmed defects only.
- **Report:** invariant, path:line, RED failure, GREEN, test commands, independent verification, residual.

## 5. Failure modes

| Failure | Expected |
|---|---|
| Seat finds no confirmed defect | Report audit evidence and no code change; no invented bug |
| A test is skipped or weakened | Reject the fix; report FAIL |
| Seat needs a forbidden file | Stop and request Lead-owned change; do not cross scope |
| Confusing API/version behavior | Use `research`; if still unresolved, use `deep-research` and mark UNVERIFIED |
| Paid/live side effect needed | Do not run; route to Lead with exact command |
| Concurrent edits | Disjoint scopes; Lead is the only shared-doc/package writer |
| Second wave confirms no regression | Re-run targeted tests + full gate; report PASS-WITH-NOTES |

## 6. Tests and gates

```powershell
# Seat A
npx playwright test e2e/ui-audit.spec.ts
npm.cmd run e2e

# Seat B
npm.cmd test -- --run test/unit/terminal-usage.test.ts test/unit/logic-run-state.test.ts
npm.cmd test

# Lead integration
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run e2e
npm.cmd run verify
npm.cmd run assert-stage -- --stage=p7 --json
npm.cmd run preflight -- --port 0 --json
```

Acceptance: each seat has a truthful report, at least one independently verified code change or an evidence-backed no-defect result, no forbidden-path writes, and the integrated tree stays green.

## 7. Rollback

Per seat, revert only its owned files; no migrations or route-contract changes are authorized in this wave. The Lead retains the clean pre-wave commit for a full revert.

## 8. Out of scope / blockers

- New P1 capabilities (repo index/tools/tool loop/approval/checkpoints/parallel/P7 evaluator) are not implemented in this wave; their absence remains documented.
- No paid provider call, no test weakening, no git write by a seat.
- No package/dependency changes by a seat; Lead owns those.
- If a defect requires a server/UI contract change across both scopes, the Lead coordinates it as a separate decision.

## 9. Execution status

Complete. Both seats delivered and passed independent re-verification; Lead folded D1–D3, D-B1–D-B3, D-A/D-B, the shared stats contract/notice, and the docs correction. Final gate: **474 tests / 74 files**, **44/44 E2E**, stage **209 files / 51 tables / 62 routes / 24 scripts**, verify exit 0, preflight PASS (RAM 2.06 GB, disk 7.76 GB), audit 0. Evidence: `docs/TRACE/WAVE-17/TRACE-SUMMARY.md`.

