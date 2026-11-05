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

**Wave 10 — P2-3 search index freshness.** A terminal run’s workspace is currently treated as immutable after the first search. If a published file changes, the disposable FTS index is silently stale. Wave 10 makes the index detect a changed workspace, rebuild before serving results, expose whether it was built/reused/rebuilt, and keep the response honest if the workspace is missing or empty. This is the only implementation scope for the wave.

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

## 4. File map and ownership for Wave 10

| Path | Role | Expected change |
|---|---|---|
| `src/server/search/run-search.ts` | Search/index owner | Workspace signature, persisted index state, rebuild policy, response state |
| `src/server/db/migrations.ts` | Schema owner | `run_search_index` table in `SEARCH_SQL` |
| `src/server/app.ts` | Route owner | Response shape only; no path input |
| `web/src/api-types.ts` | Client contract | `RunSearchResponse.indexState` |
| `web/src/pages/RunDetailPage.tsx` | UI owner | Show built/reused/rebuilt truthfully |
| `config/releases/p7.json` | Stage census | Add `run_search_index` |
| `test/unit/run-search.test.ts` | Regression pins | Rebuild, reuse, delete, missing-workspace tests |
| `docs/PLAN-v3.md`, `docs/CAPABILITY-MATRIX.md`, `docs/BACKLOG.md`, `README.md` | Census/docs | Update behavior and counts with OLD→NEW reasons |

## 5. Invariants for this wave

- Only one terminal run’s published text files are indexed. Never accept a caller-supplied path.
- Exclude `.staging/`, `staged/`, `RUN_REPORT.md`, `manifest.json`, symlinks, binaries, empty/NUL content, and files over 256 KB.
- Cap at 2,000 indexed files.
- No provider call, no shell, no generated-code execution, no P7 data, no write to the run workspace.
- An unchanged workspace must **not** rebuild; a changed workspace must rebuild **before** returning matches.
- Missing workspace is an empty, honest index state, not an error and not invented matches.
- The response must say which state the caller received: `built`, `reused`, or `rebuilt`.

## 6. Gates for Wave 10

```powershell
npm.cmd run typecheck
npm.cmd test -- --run test/unit/run-search.test.ts
npm.cmd test
npm.cmd run build
npm.cmd run e2e
npm.cmd run assert-stage -- --stage=p7 --json
npm.cmd run preflight -- --port 0 --json
```

Stage table count changes from 50 to 51. Do not update the count until `assert-stage` reports it. A wave is complete only when the RED path (workspace changed) and the reuse path (workspace unchanged) both have evidence.

## 7. Stop conditions

- Root cause or caller map missing → stop and recon/research.
- A required field cannot be populated in logic-gatekeeper Phase 1 → no patch.
- A test would have to be weakened to pass → stop; the design is wrong.
- Scope drifts into approval/repo tools/tool loop/P7/parallelism → return to `docs/BACKLOG.md` and re-plan.
- Evidence contradicts a claim → the claim loses; record it as UNVERIFIED or CONTRADICTED.
