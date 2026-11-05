# Wave 6 — trace-first front-to-back repair report

## Verdict

Wave 6 found and fixed the real wiring/logic defects behind the run-detail and Settings/Learning complaints. The `run_abf5` "Running / 7 steps / Live" screen was a **mid-run capture**, not a convergence bug; the current page is `Failed / 20 steps / Terminal · Snapshot`. The confirmed defects were deeper: five server event types were silently dropped, failed terminal runs lost measured spend, the terminal Events tab kept the live buffer, `/events` reported false truncation, provider error codes were overwritten with `E_INTERNAL`, and several UI columns/fields had no producer.

**Final state:** B2 healthy, no active run, 26 persisted runs. Product diff: **12 changed + 12 added, 0 missing**; historical data untouched; P7 remains honestly refused.

## Process and seats

| Seat | Skill | Work | Result |
|---|---|---|---|
| `weaver-audit` | weaver + trace | 398 control instances, 9 surfaces, 34 families × 11 hops, live Chrome/network/DB | 13 confirmed defects + 5 observations; run_abf5 correctly refuted |
| `logic-debugger-audit` | logic-debugger | 16 findings, 11 deterministic probes on throwaway DB/live reads | P1 error-code loss + failed-run spend; state/SSE/truncation/interrupt defects |
| `forge-rootcause` | forge | Independent root causes, 7 proposals, peer reconciliation | P1/P2 roots corroborated; P-4 recipe defective; R-1/R-2/R-3 refuted |
| `capability-auditor` | capability-auditor | 50 verdicts, 37-agent matrix, route/event/payload census | 38 supported, 3 refuted, 5 unverified; 11 approved fixes; corrected cap provenance |
| `logic-gatekeeper` | logic-gatekeeper | Re-read every seam; Phase-1/2 per AF; collision/order audit | 11 approved (1 clean, 10 conditional), 0 rejected; rejected unsafe state guard + invalid P-4; caught input-integrity error |
| `forgewright-lead` | forgewright-lead | Sole product writer; 11 AFs in strict order; 12 new test files | 312 tests/50 files; build/stage/sweeps green; no backfill/P7 data |
| Lead | — | Baseline hashes/backups, restart, e2e, final API/DOM evidence, trace skill | Final gates and trace v1.2.0 |

**Capacity note:** the Team API was already at its 8-member cap from prior-session inactive teammates, so the six roles ran as fresh independent subagents rather than `spawn_teammate`; task IDs and write scopes were preserved and the product writer remained single. The subagent toolset did not expose `team_task_update`; the Lead maintained the board.

## Confirmed findings and disposition

| Finding | Sev | Evidence | Disposition |
|---|---|---|---|
| run_abf5 Running/7 steps | refuted | step 7 ended 03:09:52; current UI Failed/20; fresh load no stream | no fix; stale capture |
| Live SSE drops 5 emitted types | P1 | source list 27 vs 16 emitted; Chrome 106/108, 53/55, 101/102; onmessage=0 | AF-02 |
| Failed/budget/cancelled runs show "Not measured" | P1 | 7 runs, $0.606852192 measured; abf5 20 usage rows/$0.299980656; only finalize wrote usage | AF-01 |
| Terminal Events tab ignores persisted ledger | P1 | `RunDetailPage.tsx:133` prefers live buffer; heading says persisted; fresh terminal is correct | AF-03 |
| `/events` truncated=true on complete replays | P2 | 24/25 runs; abf5 108/108 seq 552–659 | AF-04 |
| Provider error code becomes E_INTERNAL | P1 | LlmError.code ignored by three mappers; 31 unregistered literals (not expanded) | AF-06 |
| Run state guard dead | P3 | zero production callers; phase matrix contradicts review/adhoc/catch/startup edges | deferred unsafe |
| Startup interrupt silent | P2 | status interrupted, no code/message/event/log | AF-07 |
| Snapshot omits per-run cap | P2 | UI reads `snapshot.limits`; runBudget 0.5 vs global snapshot 0.5 for 23af's 0.05 | AF-05 |
| Context columns never produced | P2 | 84 packs/343 items/0 tokens; excluded_json never read | AF-08 |
| Routing reason hardcoded | P3 | literal `static prior route` | AF-11 |
| Checks duplicate keys/dead Time | P3 | 16 rows/5 ids; no code/duration columns | AF-10 |
| AgentPlanSchema no production caller | P2 | registry advertises plan agents; adhoc branch validates ProjectPlanSchema | AF-09 |
| Refused/deferred | — | nested-modal Escape, skip-link focus, tab ARIA, favicon, unknown-route code, refusal split, learning UI, state guard, 410 loop, backfill | not implemented; reasons in gate §5 |

## Fixes and tests

| AF | Change | Tests |
|---|---|---|
| AF-01 | `usageFields` on all terminal writers; costUsd + human message on terminal events | `terminal-usage` 8/8 |
| AF-02 | shared `RUN_EVENT_TYPES`/`RESERVED`/`STREAM` + `normaliseStreamEvent`; client subscribes all emitted types, unwraps inner payload | `event-contract` 8/8 |
| AF-03 | pure `selectVisibleEvents`; terminal → persisted ledger | `run-events-selection` 5/5 + existing trace-fixes |
| AF-04 | per-run count + newest-window DESC; badge `Artifacts truncated` | `events-window` 8/8 |
| AF-05 | snapshot `limits.maxCostUsd = runBudgetUsd(id)` | `snapshot-limits` 6/6 |
| AF-06 | `codeOfError`; structured E_ code preserved; no RefUSALS expansion | `error-code` 9/9 + `terminal-error-code` 1/1 |
| AF-07 | `E_RUN_INTERRUPTED`, `run.interrupted`, guarded transition/event/log/usage/release | `startup-interrupt` 1/1; logic-core 11/11 isolation-only |
| AF-08 | excluded rows + `included`; remove Tokens/Chars and false claim | `context-excluded` 3/3 |
| AF-09 | `planOutputSchemaFor` at adhoc plan branch; UI hint truthful | `agent-plan-contract` 6/6 + existing schema/registry |
| AF-10 | additive `rowId`; unique keys; remove Time/code fallback | `checks-identity` 4/4 |
| AF-11 | reason derived from decision features; omitted when unknown | `routing-reason` 4/4 |

## Verification

| Gate | Result |
|---|---|
| Baseline hashes | 150/150 matched before edits |
| Final diff | 12 changed + 12 added + 0 missing; exactly approved files/tests |
| Typecheck | PASS |
| Unit | **50 files / 312 tests passed** (baseline 38/249; +63 tests) |
| Build | PASS (pre-existing chunk advisory only) |
| E2E | **26/26 passed** after restart |
| Verify | PASS |
| Strict stage | **162 files / 45 tables / 48 routes / 24 scripts**, violations [] |
| Preflight | PASS after server stop (node/npm/disk/ram/chrome/port) |
| Stub/secret scans | clean (86 / 160 files) |
| Live API | abf5 108 events truncated=false; snapshot cap 0.5; routing reason derived; context included=true; checks rowId distinct |
| Live UI | Failed/20/Terminal, Persisted events with run.queued/repair.stalled; run95 `$0.2508 / $0.5000 cap`, no Tokens/Chars/Time columns, no static-prior literal |
| P7 | `E_LEARNING_POOL_EXHAUSTED`, 0 complete blocks, 0 consent, 0 promotions; no data created |
| Historical rows | 7 NULL-cost/token rows remain NULL; no backfill |

## Trace skill update

- Both copies updated to **v1.2.0**, byte-identical SHA-256 `996071B14C5AE5022CB5A70B433911CE737580B7BE5F45CC6F5565700C3A9A0C`.
- Added event/payload/terminal-state trace, emitted/subscribed/delivered parity, live-vs-persisted shape, failed-terminal usage truth, per-run truncation, error-code identity, derived-value provenance, timestamp/quiescence reconciliation, peer-file/recipe verification and dead-guard safety.
- Research note: `verification/trace-skill-research.md`.

## Unverified / not done

- Live→terminal Events tab transition was not executed (no non-terminal paid run; faking forbidden); selector truth table + fresh terminal only.
- Provider-failure runtime for the `run.ts` agent-step mapper and plan-agent runtime need paid provider calls; pure helper/manager integration/static wiring proven.
- AF-01 gate-event payloads at runtime are code-inspection only.
- >500-event boundary tested at window 3; 410 SSE reconnect loop client half unproven.
- No paid `test:live` in this batch (deliberate no-spend); last baseline live smoke was `$0.0000321` on the prior tree.
- Preflight fails while the server is running on this low-RAM host (free RAM floor); it passes after stopping the server. This is environmental, documented.
- Deferred UX/a11y items: nested-modal Escape, skip-link focus, tab ARIA, favicon, unknown-route code, refusal-code split, learning inspect UI, state-guard wiring, 410 loop, historical backfill.

## Artifacts

- `docs/AUDIT-WAVE-6/BASELINE.md`, `baseline.sha256`, `final.sha256`, `backup/`
- `weaver/` (controls, traces, payloads, findings, 34 screenshots/36 API captures)
- `logic/` (findings, red-probes, state-machines, event-payload-truth, probes)
- `forge/` (root-causes, red-evidence, patch-proposals, handoff, probes/evidence)
- `capability/` (audit, 50 verdicts, FORGEWRIGHT-DIRECTIVE, probes)
- `gate/` (gate.md, approved-fixes.json)
- `forgewright/` (PROGRESS.md, RECEIPT.md)
- `verification/` (verification.md, trace-skill-research.md, UI screenshots)
