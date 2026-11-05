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

**Wave 12 — P0-3 per-file byte bound at the schema boundary.** Agent file/test/review output must be rejected before persistence when its UTF-8 content exceeds `config.limits.maxFileBytes`, with a bounded `E_FILE_TOO_LARGE` refusal and no wasted schema-repair calls. Keep `writeStaged` as defense in depth. No router data-model, route, or UI changes.

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

## 4. File map and ownership for Wave 12

| Path | Role | Expected change |
|---|---|---|
| `src/server/agents/registry.ts` | Schema owner | Byte-bounded content schemas for file emission, tests, and review revisions |
| `src/server/llm/client.ts` | Provider boundary | Preserve a schema issue’s `E_*` code and stop repair retries for a deterministic size refusal |
| `src/shared/refusals.ts` | Refusal registry | Add `E_FILE_TOO_LARGE` |
| `test/unit/agents.schemas.test.ts` | Schema pins | Exact-limit passes; over-limit carries `E_FILE_TOO_LARGE`; tests/review content too |
| `test/unit/llm.client.test.ts` | Identity/no-retry pin | Mock oversized schema response → `E_FILE_TOO_LARGE`, one request, no repair |
| `docs/TRACE/WAVE-12/TRACE-SUMMARY.md` | Evidence | RED/GREEN, exact counts, residual |
| `docs/PLAN-v3.md`, `docs/CAPABILITY-MATRIX.md`, `docs/BACKLOG.md`, `README.md` | Census/docs | Update P0-3 and counts only if tests change |

## 5. Invariants for this wave

- The byte bound is UTF-8 bytes, not JavaScript characters; exact limit passes, limit+1 fails.
- No file content is persisted before the schema refusal; `writeStaged` remains as defense in depth.
- The refusal is typed and bounded: `E_FILE_TOO_LARGE`; no generic `E_INTERNAL` or `E_LLM_SCHEMA_INVALID`.
- A deterministic size refusal must not trigger JSON repair requests; no extra provider cost.
- No provider live call; no generated-code execution; no key read.
- Applies to file emission, generated tests, and review file revisions.

## 6. Gates for Wave 12

```powershell
npm.cmd test -- --run test/unit/agents.schemas.test.ts test/unit/llm.client.test.ts
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run e2e
npm.cmd run assert-stage -- --stage=p7 --json
npm.cmd run preflight -- --port 0 --json
```

Stage counts should not change unless a source file is added. A wave is complete only when the schema boundary test and the provider identity/no-repair test have RED→GREEN evidence.

## 7. Stop conditions

- Root cause or caller map missing → stop and recon/research.
- A required field cannot be populated in logic-gatekeeper Phase 1 → no patch.
- A test would have to be weakened to pass → stop; the design is wrong.
- Scope drifts into approval/repo tools/tool loop/P7/parallelism → return to `docs/BACKLOG.md` and re-plan.
- Evidence contradicts a claim → the claim loses; record it as UNVERIFIED or CONTRADICTED.
