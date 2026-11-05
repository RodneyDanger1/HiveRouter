# Wave 17 claim register — final

Date: 2026-11-05
Base: `db4e6d5` + Wave 17 integrated working tree (commit follows this record).
Vocabulary: `VERIFIED` (command/output or live read), `READ` (file inspected), `UNVERIFIED`, `CONTRADICTED`.

## Gate and repository facts

| id | claim | evidence | status |
|---|---|---|---|
| C-001 | Full suite is 474 tests / 74 files | Lead `npm.cmd test`: 74 passed, 474 passed | VERIFIED |
| C-002 | E2E is 44/44 | Lead `npm.cmd run e2e` after rebuild/restart: 44 passed | VERIFIED |
| C-003 | Stage census is 209 files / 51 tables / 62 routes / 24 scripts, no violations | `assert-stage --stage=p7 --json` | VERIFIED |
| C-004 | Verify is green; stub clean 104; secret clean 206 | `npm.cmd run verify` exit 0 | VERIFIED |
| C-005 | Preflight passes | JSON: free RAM 2.06 GB, disk 7.76 GB; exit 0 | VERIFIED |
| C-006 | Production dependency audit is clean | `npm audit --omit=dev`: 0 vulnerabilities | VERIFIED |
| C-007 | Live `/api/stats` reports partial, NULL totals, and unknown spend | `curl /api/stats`: partial true, totals null, unknownRunSpendRows 1, unknownChatSpendJobs 0 | VERIFIED |
| C-008 | No paid provider call / generated-code execution in the wave | no `test:live` or provider invocation; local test doubles only | VERIFIED by command history |
| C-009 | Current docs counts match the gate | README, PLAN §36, TRACE-SUMMARY, BACKLOG, CAPABILITY use 474/44/209/2.06/7.76/206 | VERIFIED |
| C-010 | Final commit is on `main` and pushed | commit/push output (to record after commit) | UNVERIFIED until push completes |

## P0 delivery

| id | claim | evidence | status |
|---|---|---|---|
| C-011 | P0-1 every production status/phase writer is audited | `test/unit/writer-matrix.test.ts`: SQLite trigger, all presets/terminal writers, 10×10 status + 11×11 phase pairs, static inventory | VERIFIED |
| C-012 | P0-1 dead terminal guard fixed | recorder requires every terminal-producing write to land on `done`; planted RED → restore → GREEN | VERIFIED |
| C-013 | P0-5 historical NULL is never backfilled to zero | spend-column UPDATE trigger, DB reopen, list/detail/snapshot, review of writers | VERIFIED |
| C-014 | P0-5 unknown aggregate spend is not shown as zero | `historical-usage.test.ts` 8 tests; live stats partial true / totals null | VERIFIED |

## UI/API fixes

| id | claim | evidence | status |
|---|---|---|---|
| C-015 | Desktop no longer renders the mobile nav toggle | `e2e/wave17-controls.spec.ts`; hidden at 1440, working at 390 | VERIFIED |
| C-016 | Chat names a `/api/agents` failure and recovers | same spec: 503 named, Retry restores 37 options | VERIFIED |
| C-017 | Resume retry reuses its idempotency key | same spec: equal keys on two aborted POSTs | VERIFIED |
| C-018 | Revise/Audit are hidden for statuses the server rejects | `e2e/wave17-actions.spec.ts`; budget-exceeded POSTs observed 409 E_INVALID_PARENT | VERIFIED |
| C-019 | In-flight modal/drawer dismissal cannot discard a failure | same spec; Close/Escape disabled; error rendered after failure | VERIFIED |
| C-020 | Review findings and `reviewedFiles` use normalized path identity | `test/unit/review-coverage.test.ts`; RED/green; unsafe paths fail closed | VERIFIED |
| C-021 | Wave 1 fixes still present and effective | wave-2 planted-defect restore hashes match seat-a §6 / seat-b hashes; targeted GREEN | VERIFIED |

## Residual / unverified

| id | claim | status | what would prove it |
|---|---|---|---|
| C-022 | Paid submits (Start, Analyze, Run agent, Revise/Audit, chat Send/fan-out) succeed end-to-end | UNVERIFIED | authorized budgeted live run |
| C-023 | Live Stop/cancel and resume success work through the browser | UNVERIFIED | active run fixture + staged resume fixture |
| C-024 | `E_ZIP_EMPTY` download refusal renders in the UI | UNVERIFIED | terminal run with no publishable files |
| C-025 | Run-row/idempotency-row insert is atomic on key-insert failure | UNVERIFIED (observation only) | fault-injection test of the two inserts |
| C-026 | Nested Reset confirm + drawer Escape behavior is exactly one layer | UNVERIFIED (read only) | browser probe |
| C-027 | `/api/runs` reports a total/truncation marker | UNVERIFIED (absent, not a defect) | contract change |
| C-028 | Cancel retry key is consumed by the route | UNVERIFIED (route ignores it; not a paid mutation) | route contract decision |
| C-029 | Review path case-folding and `.`-prefix policy are settled | UNVERIFIED (documented residual) | policy decision + tests |
| C-030 | Native CUA/native GUI proof exists | UNVERIFIED | CUA bridge; Playwright is current evidence |
| C-031 | Thread creation is idempotent | UNVERIFIED (known residual from Wave 16) | backend key contract |

## Sources

- `docs/TRACE/WAVE-17/TRACE-SUMMARY.md` — Lead gate and fold.
- `docs/TRACE/WAVE-17/seat-a.md`, `seat-a-wave2.md` — UI/API evidence.
- `docs/TRACE/WAVE-17/seat-b.md`, `seat-b-wave2.md` — ledger/state evidence.
- Commands quoted above; no external source was needed for this codebase audit.
