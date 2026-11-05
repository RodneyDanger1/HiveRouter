# QA Wave 1 — Round 2 + final remediation ledger

**Final gates (Lead, current tree):**
- `npm.cmd run verify` → PASS: typecheck; **213 tests / 27 files**; build; stub-sweep clean (79); secret-scan clean (127).
- `npm.cmd run e2e` → **16/16 PASS** (4 API contract + 3 app + 9 UI audit, system Chrome).
- `npm.cmd run assert-stage -- --stage=p7 --json` → `ok:true`, `fallback:false`, files 129, tables 45, routes 46, **scripts 23**, violations `[]`.
- `npm.cmd run preflight -- --port 0 --json` → `ok:true`, disk 5.12/4.50 GB, Node/npm/Chrome/port pass.
- `npm.cmd run test:live -- --yes` → PASS `deepseek-flash`, cost `$0.00001605`.
- Live TSX build `run_b8a8e239a57052f146` → completed, `$0.00422067`, `src/App.tsx` + `tests/test_app.test.tsx`, `syntax.all: pass`, `verification.plan: pass`.
- Live max-cost enforcement: `run_23af9b7837448cb24a` hit `E_BUDGET_EXCEEDED` at the requested `$0.05` cap (cap is not ignored).

## Round-2 blockers closed

| ID | Finding | Fix | Evidence |
|---|---|---|---|
| R2-01 | Valid TSX/JSX could never pass: RVS `availableChecks` omitted `syntax.tsx`/`syntax.jsx` | Added both to `src/server/pipeline/run.ts`; verifier remains fail-closed | Live TSX run above; `test/pipeline-qa.test.ts` 6/6 |
| R2-02 | `/api/agents` was serialized as `{"0":...}` object; UI showed zero agents | Removed Fastify `onRoute` response-schema mutation; OpenAPI schemas are doc-only | Browser CARDS 37; E2E UI 9/9; 43/43 operations have response content |
| R2-03 | OpenAPI 0/43 operations referenced a response schema | `decorateOpenApiDocument` adds typed 2xx/4xx content | `assertOpenApiResponses` + E2E openapi |
| R2-04 | package.json BOM made `assert-stage` silently report `scripts:0` | package.json no BOM; stage parser strips BOM and fails closed | stage receipt above |
| R2-05 | Agent-drawer Mode was not precisely labelled | `id`/`htmlFor` + `aria-label="Mode"` | UI audit 9/9 |
| R2-06 | UI audit test assumptions (nav duplicate, honest "unavailable" copy, duplicate Close) | tests fixed; product behavior kept honest | UI audit 9/9 |
| R2-07 | P6a pipeline not gated by `FEATURES` | `pipelineCapabilities()` gate + fallback; API route gate already present | `src/server/pipeline/features.ts`; typecheck/tests |

## Remaining / accepted (not silently claimed fixed)

1. **AUD-1 finalize**: per-file atomic writes, not a whole-tree directory swap. Accepted testing-stage risk; documented in README.
2. **P7 live promotion/rollback**: no 390-case sealed pool, consent, or paired live evaluation. `learn` returns `E_LEARNING_POOL_EXHAUSTED` (exit 6); HTTP routes return state-based refusals. No promotion claimed.
3. **A/B1 runtime start**: route-level feature gate exists; a full A/B1 pipeline start was not exercised.
4. **`schema-valid` badge**: no evidence producer, so no badge is shown (honest absence rather than a fake).
5. **390px Recent runs table**: horizontal scroll, not a card reflow (data reachable; accepted).
6. **Multi-process active-run / periodic lease reaper**: process-local startup guard only.
7. **Generated code is never executed**: static verification only, by design.
8. **All 37 agents live**: registry/schema/engine and representative live agents only; no claim that all 37 were called live.

## Claim strength

- VERIFIED by Lead command/output: gates above, UI 16/16, live TSX run, budget cap, stage/preflight/live smoke.
- READ: 13 P1 dispositions, dropped-agent changes, reports.
- UNVERIFIED: P7 promotion, A/B1 runtime, whole-tree atomic finalize, multi-process guard, all-37 live.
