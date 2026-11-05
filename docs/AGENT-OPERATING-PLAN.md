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

**Wave 15 — full UI/capability/truth audit.** Inspect every rendered route and control, trace confirmed seams, fix the current false key-ingress instructions and the false DSH read claim, add real `--from-env` local key import, close the favicon 404, remove unused dependency baggage, and make the current docs/capability matrix match the running code. Out-of-scope capabilities stay explicitly absent.

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

## 4. File map and ownership for Wave 15

| Path | Role | Expected change |
|---|---|---|
| `web/src/pages/SettingsPage.tsx`, `OverviewPage.tsx` | Key-ingress copy | Show the real `npm.cmd run key:import -- --from-env` command; remove the false DSH read claim |
| `scripts/key-import.ts` | Local key ingress | Add `--from-env`; reject symlink/oversized file/stdin input; keep key out of stdout |
| `src/server/security/keys.ts` | App-secret reader | Reject symlink/oversized/non-regular app-secret; keep 5s cache and no key logging |
| `web/index.html`, `web/public/favicon.svg` | Shell asset | Serve a real favicon and remove the `/favicon.ico` 404 |
| `package.json`, `package-lock.json` | Dependency hygiene | Remove unused `@langchain/core` / `@langchain/langgraph` only if no source/test import remains |
| `docs/PLAN-v3.md`, `README.md`, `docs/CAPABILITY-MATRIX.md`, `docs/STOP-WORK-FLAWS.md` | Truth/docs | Correct key-ingress and DSH claims; record all confirmed UI/CLI defects and capability boundaries |
| `test/unit/key-ingress.test.ts` | Regression pin | `--from-env`/file-bound/refusal behavior via temp data dir |
| `e2e/ui-audit.spec.ts` | UI pin | Settings/Overview show the real command; no DSH read claim; favicon response 200 |
| `docs/TRACE/WAVE-15/` | Evidence | Control trace, capability audit, before/after, residuals |

## 5. Invariants for this wave

- The browser never receives or displays key material; the real local import command is discoverable.
- `--from-env` reads only `DEEPSEEK_API_KEY`, never echoes it, and fails closed if absent/invalid.
- Key files are regular, non-symlink, ≤64 KiB; the runtime reader applies the same bound.
- DSH is not read at runtime; no current docs/UI may claim a DSH consent-gated read.
- A favicon request must not be a console error.
- Removing a dependency requires zero imports/usages, lockfile update, and a clean build/test.
- Every capability matrix row must match a route/service or be explicitly absent/partial.
- No paid provider call; no generated-code execution; no test weakening.

## 6. Gates for Wave 15

```powershell
npm.cmd test -- --run test/unit/key-ingress.test.ts
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run e2e
npm.cmd run assert-stage -- --stage=p7 --json
npm.cmd run preflight -- --port 0 --json
```

A wave is complete only when the UI/console audit, key-import command, docs claim check, full suite, E2E, stage, and preflight all have quoted evidence.

## 7. Stop conditions

- Root cause or caller map missing → stop and recon/research.
- A required field cannot be populated in logic-gatekeeper Phase 1 → no patch.
- A test would have to be weakened to pass → stop; the design is wrong.
- Scope drifts into approval/repo tools/tool loop/P7/parallelism → return to `docs/BACKLOG.md` and re-plan.
- Evidence contradicts a claim → the claim loses; record it as UNVERIFIED or CONTRADICTED.
