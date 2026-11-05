# Wave 17 — two-seat production audit index

Date: 2026-11-05
Base: `db4e6d5` (455 tests / 71 files; 38/38 E2E; 204 stage files)
Plan: [WAVE-17-PLAN](../../WAVE-17-PLAN.md)

## Seats

| Seat | Owner | Skills | Paths | Wave 1 | Wave 2 |
|---|---|---|---|---|---|
| A — UI/API control truth | `seat-ui-integration` (subagent) | `weaver`, `agent-experience`, `trace` | `web/**`, `e2e/**` | Control trace + confirmed fixes | Independent UI re-verification + adjacent surface |
| B — ledger/state truth | `seat-ledger-integrity` (subagent) | `truthseeker`, `logic-debugger`, `auditor` | `src/server/**`, `test/unit/**` | P0-5 NULL/zero + P0-1 writer matrix | Independent re-verification + adjacent store audit |

Both seats are bound by `forgewright-lead` + `forgewright-plan` + `forgewright-recon` + `forge`, no fake/mock/incomplete code, no paid/destructive/git actions, and truthful reports.

## Lead artifacts

- `docs/WAVE-17-PLAN.md` — decision-complete plan.
- `CLAIM-REGISTER.md` — current claims and UNVERIFIED items.
- `NEXT-STEPS.md` — prioritised way forward after the audit.
- `seat-a.md` — Seat A evidence (seat-owned).
- `seat-b.md` — Seat B evidence (seat-owned).
- `TRACE-SUMMARY.md` — Lead fold after both waves and gates (created at completion).

## Current status

Wave 1 complete: Seat A fixed D1/D2/D3; Seat B fixed D-B1/D-B2 and P0-1/P0-5. Wave 2 complete: both seats independently re-verified wave 1 (planted defect → named RED → byte-identical restore → GREEN), and each audited one adjacent surface. Seat A fixed D-A (Revise/Audit eligibility) and D-B (in-flight modal dismissal); Seat B fixed D-B3 (normalized review path identity).

Lead integrated the shared `RunStats` fields and Overview counts, rebuilt/restarted, and ran the full gate on the quiescent tree: **474 tests / 74 files**, **44/44 E2E**, stage **209/51/62/24**, verify exit 0, preflight PASS (RAM 2.06 GB, disk 7.76 GB), audit 0. Live `/api/stats` reports `partial:true`, null totals, `unknownRunSpendRows:1`, `unknownChatSpendJobs:0`. Final evidence: [TRACE-SUMMARY](TRACE-SUMMARY.md). No paid provider call; no generated-code execution.
