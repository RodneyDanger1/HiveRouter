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

**Wave 11 — P2-4 mobile/keyboard pass.** Verify `/analysis`, run-detail Search, the mobile shell navigation, and run-detail tabs at 390×844 and keyboard-only. Fix only confirmed responsive/accessibility defects; no API, DB, or router behavior changes. Wave 10 search freshness is complete and remains covered by its tests.

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

## 4. File map and ownership for Wave 11

| Path | Role | Expected change |
|---|---|---|
| `e2e/mobile-keyboard.spec.ts` | New regression suite | Mobile Analysis/Search overflow, keyboard tabs, mobile nav focus |
| `web/src/components/AppShell.tsx` | Shell owner | Only if the closed mobile sidebar remains focusable |
| `web/src/components/ui.tsx` | Tabs owner | Only if tab selection/focus or ARIA linkage is insufficient |
| `web/src/pages/AnalysisPage.tsx` / `web/src/styles.css` | Responsive owner | Only if the 390 px test finds real overflow |
| `docs/TRACE/WAVE-11/TRACE-SUMMARY.md` | Evidence | Tests, screenshots, fixes, residual |
| `docs/PLAN-v3.md`, `docs/CAPABILITY-MATRIX.md`, `docs/BACKLOG.md`, `README.md` | Census/docs | Update P2-4 and counts |

## 5. Invariants for this wave

- No API, DB, search, run-state, or generated-code behavior changes.
- No paid provider call; no secret read; no destructive action.
- Mobile checks use a 390×844 viewport; keyboard checks use real focus and `aria-selected`/`aria-expanded`.
- A hidden mobile sidebar must not receive keyboard focus.
- A wide table may scroll inside its wrapper, but the document must not overflow horizontally.
- Fix only defects reproduced by the new tests; do not redesign the UI.

## 6. Gates for Wave 11

```powershell
npx playwright test e2e/mobile-keyboard.spec.ts
npm.cmd run e2e
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run assert-stage -- --stage=p7 --json
npm.cmd run preflight -- --port 0 --json
```

Stage counts should not change unless a real source file is added beyond the E2E spec (which is already in the stage paths). A wave is complete only when the mobile overflow, keyboard tab, and hidden-nav focus paths have evidence.

## 7. Stop conditions

- Root cause or caller map missing → stop and recon/research.
- A required field cannot be populated in logic-gatekeeper Phase 1 → no patch.
- A test would have to be weakened to pass → stop; the design is wrong.
- Scope drifts into approval/repo tools/tool loop/P7/parallelism → return to `docs/BACKLOG.md` and re-plan.
- Evidence contradicts a claim → the claim loses; record it as UNVERIFIED or CONTRADICTED.
