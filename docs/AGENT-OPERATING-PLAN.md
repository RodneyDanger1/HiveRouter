# HiveRouter — AI agent operating plan

This is the durable operating contract for AI agents working in this repository. It is subordinate to `docs/PLAN-v3.md` and `AGENTS.md`; it exists so work is routed to the right skill at the right moment instead of being improvised.

## 1. Read order (every turn that changes code)

1. `AGENTS.md` — repository rules and current wave.
2. `docs/PLAN-v3.md` §0, §3, §4, §6, §10, §11, §13 — contract, registry, lifecycle, algorithms, persistence, gates, DoD.
3. `docs/BACKLOG.md` — remaining work and acceptance gates.
4. Latest `docs/TRACE/**/TRACE-SUMMARY.md` — known defects, fixes, unverified items.
5. The target file, every caller, and the tests that pin the behavior.
6. `docs/WAVE-10-PLAN.md` for the current wave’s exact scope.

Do not treat a README, prompt, or historical wave note as permission to widen scope. `docs/PLAN-v3.md` wins over prose; running code wins over stale docs.

## 2. Current goal

**Wave 17 complete — two-seat production audit.** Seat A proved UI/API control truth (`weaver` + `agent-experience` + `trace`) and fixed D1 desktop dead toggle, D2 chat registry failure render-back, D3 resume retry key, D-A run-action eligibility, and D-B in-flight modal dismissal. Seat B audited ledger/state truth (`truthseeker` + `logic-debugger` + `auditor`) and fixed D-B1 terminal-phase guard, D-B2 stats unknown spend, and D-B3 normalized review-path identity; **P0-1 and P0-5 are delivered**. Both mandatory waves and independent plant/restore verification are in `docs/TRACE/WAVE-17/TRACE-SUMMARY.md`. **Next planned wave (not started): Wave 18 — P1-2 read-only repo tools, then P1-1 external repo index.**

## 3. Skill routing — when / why / where / output

| Skill | Use when | Why | Where it applies | Required output |
|---|---|---|---|---|
| `forgewright-recon` | Before any edit whose entry point/callers/tests are not already mapped | Prevents guessing and stale assumptions | Route → client → service/store → UI | Recon ledger with `path:line` |
| `forgewright-plan` | Before production code | Makes decisions and rollback explicit | Each seat’s task | Decision-complete plan |
| `logic-gatekeeper` | Before **every** mutation touching logic, persistence, authorization, money, or untrusted input | A patch without a root cause is a guess | Phase 1 JSON, then entry checks | Architecture, dataFlow, edgeCases, rootCause |
| `logic-debugger` | State machines, retries, stale cache, terminal states, error paths | Finds contradictions and non-reproduced behavior | `src/server/**`, cache/index transitions | Invariant, deterministic RED, GREEN |
| `forge` | A confirmed defect needs a minimal repair | Root cause, not symptom | One seam at a time | RED→GREEN, regression pin |
| `forgewright-lead` | Every coding task and final integration | The lead contract binds quality, tests, and evidence | Whole repo | Evidence-checked report |
| `capability-auditor` | Registry, prompt, allowlist, badge, or capability claims change | Prevents claimed-but-uncallable capability | `src/server/agents/**`, `src/shared/**`, UI census | Agent × capability matrix |
| `agent-experience` | UI copy, loading/empty/refusal states, discoverability | Users and agents must see truthful state | `web/src/**` | Bounded, truthful state model |
| `agent-learning-loop` | Any “learn”, “remember”, “improve”, “train”, promotion claim | Keeps L0/L1/L2 separate from L3/L4 | P7/learning docs, traces, candidates | Level claimed + evidence; no fake learning |
| `agent-native-design` | CLI/API affordance, schema discovery, exit codes, dry-run | Machines need stable contracts | `scripts/**`, API docs, CLI surfaces | Contract review/refactor |
| `integration-logic` | Client→route→service→store seam, missing refusal, generator/serve contract | Most defects live at seams | `web/src/api.ts`, `src/server/app.ts`, stores | Call-chain table; wired verdict |
| `weaver` | UI control→row tracing | A rendered control is a claim | `web/src/**`, live pages | Control matrix and fix seam |
| `trace` | Every tab/control audit | The chain must close on a real effect | All UI surfaces | 11-hop chain and verdict |
| `truthseeker` | Null/zero, money, usage, idempotency, ledger | Unknown must not become zero | `src/server/runs/**`, stats, terminal writes | Invariant and numeric evidence |
| `auditor` | Independent verification of adopted fixes | Reporter prose is not proof | Targeted RED/GREEN and gate | PASS/FAIL per claim |
| `research` | A fact is unknown or local code/docs conflict | Replace guesses with confirmed facts | Installed source, lockfile, official docs | Confirmed facts + remaining unknowns |
| `deep-research` | Research still leaves a decision blocked | Multiple independent sources are needed | External standards/APIs only | Question list + cited synthesis |
| `source-verification` / `source-freshness-checker` | Official external sources influence code | Prevent stale or invented facts | Docs/standards/pricing pages | Source label + fetch date |
| `evidence-check` / `claim-register-builder` | Before delivery | Catches overclaiming | Final report and docs | Claim/evidence/status table |

## 4. File map and ownership for Wave 17 (complete)

| Owner | Paths | Scope |
|---|---|---|
| Seat A | `web/**`, `e2e/**`, `docs/TRACE/WAVE-17/seat-a.md`, `seat-a-wave2.md` | Render→handler→client→route→store→render-back; E2E pins |
| Seat B | `src/server/**`, `test/unit/**`, `docs/TRACE/WAVE-17/seat-b.md`, `seat-b-wave2.md` | P0-1/P0-5, review/grounding, unit pins |
| Lead | `docs/**` except seat reports; `shared` contract; final integration | Plan, claim register, docs, full gates, commit |

Final integrated gate: **474 tests / 74 files**, **44/44 E2E**, stage **209/51/62/24**, verify exit 0, preflight PASS (RAM 2.06 GB, disk 7.76 GB), audit 0.

## 5. Invariants for this wave

- Disjoint write scopes; a seat that needs a forbidden path stops and requests Lead action.
- No mock/fake/demo/incomplete production code; no test weakening or skipped gate.
- Every adopted fix has a reproduced RED and an observed GREEN.
- P0-5: historical NULL/unknown spend must stay NULL; no zero backfill.
- P0-1: every production status/phase writer is either proven legal by the matrix or rejected by name.
- UI: each changed control has a complete render→store→render-back chain and a browser pin.
- Run actions must match server eligibility; an in-flight mutation owns its modal/drawer until it settles or fails visibly.
- Review findings and `reviewedFiles` must share one normalized path identity; unsafe paths stay fail-closed.
- No paid provider call, server restart, destructive action, or git write by a seat.
- A second wave with the same seats re-verifies wave 1 before the Lead folds.

## 6. Gates for Wave 17

```powershell
npx playwright test e2e/ui-audit.spec.ts e2e/wave17-controls.spec.ts e2e/wave17-actions.spec.ts
npm.cmd test -- --run test/unit/terminal-usage.test.ts test/unit/logic-run-state.test.ts
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run e2e
npm.cmd run verify
npm.cmd run assert-stage -- --stage=p7 --json
npm.cmd run preflight -- --port 0 --json
```

A seat is not done without its report and target command output. The Lead re-runs the target and full gate on the integrated tree before commit.
## 7. Stop conditions

- Root cause or caller map missing → stop and recon/research.
- A required field cannot be populated in logic-gatekeeper Phase 1 → no patch.
- A test would have to be weakened to pass → stop; the design is wrong.
- Scope drifts into approval/repo tools/tool loop/P7/parallelism → return to `docs/BACKLOG.md` and re-plan.
- Evidence contradicts a claim → the claim loses; record it as UNVERIFIED or CONTRADICTED.
