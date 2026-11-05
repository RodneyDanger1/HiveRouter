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

**Wave 13 — P0-4 terminal writer truth.** Failed, cancelled, budget-exceeded, and interrupted runs must have matching run/step/event/snapshot/usage/trace rows. A terminal write must leave no `started` step; manager-owned terminal paths must record the terminal trace and set `trace_complete` from that result. No router data-model or UI changes.

## 3. Skill routing — when / why / where / output

| Skill | Use when | Why | Where it applies | Required output |
|---|---|---|---|---|
| `forgewright-recon` | Before any edit whose entry point/callers/tests are not already mapped | Prevents guessing and stale assumptions | Route → client → service/store → UI | Recon ledger with `path:line` |
| `logic-gatekeeper` | Before **every** mutation that touches logic, persistence, authorization, money, or untrusted input | A patch without a root cause is a guess | Phase 1 JSON, then entry checks | Architecture, dataFlow, edgeCases, rootCause |
| `logic-debugger` | State machines, retries, stale cache, terminal states, error paths | Finds contradictions and non-reproduced behavior | `src/server/**`, cache/index transitions | Invariant, deterministic RED, GREEN |
| `forge` | A confirmed defect needs a minimal repair | Root cause, not symptom | One seam at a time | RED→GREEN, regression pin |
| `forgewright-lead` | Final integration, gates, docs, commit | The lead owns the tree and the receipt | Whole repo | Evidence-checked report |
| `capability-auditor` | Registry, prompt, allowlist, badge, or capability claims change | Prevents claimed-but-uncallable capability | `src/server/agents/**`, `src/shared/**`, UI census | Agent × capability matrix |
| `agent-experience` | UI copy, loading/empty/refusal states, discoverability | Users and agents must see truthful state | `web/src/**` | Bounded, truthful state model |
| `agent-learning-loop` | Any “learn”, “remember”, “improve”, “train”, promotion claim | Keeps L0/L1/L2 separate from L3/L4 | P7/learning docs, traces, candidates | Level claimed + evidence; no fake learning |
| `agent-native-design` | CLI/API affordance, schema discovery, exit codes, dry-run | Machines need stable contracts | `scripts/**`, API docs, CLI surfaces | Contract review/refactor |
| `integration-logic` | Client→route→service→store seam, missing refusal, generator/serve contract | Most defects live at seams | `web/src/api.ts`, `src/server/app.ts`, stores | Call-chain table; wired verdict |
| `trace` | Every tab/control change or audit | A rendered control is a claim | All UI surfaces | 11-hop chain and verdict |
| `research` | A fact is unknown or local code/docs conflict | Replace guesses with confirmed facts | Installed source, lockfile, official docs | Confirmed facts + remaining unknowns |
| `evidence-check` | Before delivery | Catches overclaiming | Final report | Claim/evidence/status table |

## 4. File map and ownership for Wave 13

| Path | Role | Expected change |
|---|---|---|
| `src/server/runs/recorder.ts` | Run/step writer | Settle open steps on every terminal `updateRun`; expose step settlement for the startup raw-SQL writer |
| `src/server/runs/manager.ts` | Manager terminal paths | Close steps for executor catch, no-controller cancel, and startup interrupt; record terminal trace |
| `src/server/runs/terminal-trace.ts` | New trace owner | Move terminal trace recording out of the pipeline so manager can use it without a cycle |
| `src/server/pipeline/run.ts` | Pipeline trace caller | Preserve `recordRunTrace` as a wrapper/re-export; no behavior change beyond shared helper |
| `test/unit/terminal-writers.test.ts` | New integration matrix | failed/cancelled/budget/interrupted × run/step/event/snapshot/usage/trace |
| `docs/TRACE/WAVE-13/TRACE-SUMMARY.md` | Evidence | RED/GREEN and residuals |
| `docs/PLAN-v3.md`, `docs/CAPABILITY-MATRIX.md`, `docs/BACKLOG.md`, `README.md` | Census/docs | Update P0-4 and counts |

## 5. Invariants for this wave

- A terminal run must never have a `started` step.
- The terminal event, run row, step rows, usage row, trace row, and `trace_complete` must describe the same outcome.
- Failed, cancelled, budget_exceeded, and interrupted all close steps; step status is `failed` for failed/budget/interrupted and `cancelled` for cancelled.
- Step error code/message must match the terminal code/message; no silent closure.
- The startup interrupt raw SQL must settle steps explicitly because it intentionally bypasses `updateRun`.
- No API shape change; no UI change; no paid provider call.
- Trace recording remains P7-gated and must not fabricate a row when disabled.

## 6. Gates for Wave 13

```powershell
npm.cmd test -- --run test/unit/terminal-writers.test.ts test/unit/terminal-usage.test.ts test/unit/startup-interrupt.test.ts
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run e2e
npm.cmd run assert-stage -- --stage=p7 --json
npm.cmd run preflight -- --port 0 --json
```

A wave is complete only when each of the four terminal statuses has a run/step/event/snapshot/usage/trace assertion, with RED evidence for any missing row or open step.

## 7. Stop conditions

- Root cause or caller map missing → stop and recon/research.
- A required field cannot be populated in logic-gatekeeper Phase 1 → no patch.
- A test would have to be weakened to pass → stop; the design is wrong.
- Scope drifts into approval/repo tools/tool loop/P7/parallelism → return to `docs/BACKLOG.md` and re-plan.
- Evidence contradicts a claim → the claim loses; record it as UNVERIFIED or CONTRADICTED.
