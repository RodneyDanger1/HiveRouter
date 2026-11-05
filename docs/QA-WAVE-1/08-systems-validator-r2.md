# QA WAVE 1 — ROUND 2 — Seat 8 Systems Validator

**Mode:** read-only independent systems validation. No product edits, no server restart, no installs, no git writes, no key reads. Only this report and `logs/qa-systems-r2.md` were written.
**Checkpoint:** P1-FIXES at 10:50; R2 window 10:51–10:57 -06:00.
**Verdict for testing: GO-WITH-FIXES.** The six P1 remediations are materially present and all requested gates are green. Two remaining P1-quality gaps should be fixed before treating the affected gates as authoritative: **OpenAPI still has zero operation response schemas**, and **`assert-stage` silently skips the package-script check because `package.json` has a UTF-8 BOM**. No new safety/P0 blocker found.

---

## 1. Gate receipt (quoted, 2026-11-03)

| Gate | Result | Observed evidence |
|---|---|---|
| `npm.cmd run verify` | **PASS** | typecheck; **209 tests / 26 files passed**; build 651.99 kB JS / 33.56 kB CSS; `stub-sweep: clean (77 files)`; `secret-scan: clean (123 files)` |
| `npm.cmd run e2e` | **PASS, 7/7** | 7 passed (22.3s); includes OpenAPI JSON, bodyless DELETE, learning pool refusal, key-route refusal, UI smoke |
| `assert-stage --stage=p7 --json` | **PASS but script count is vacuous** | `fallback:false` for a/p6a/p7; 125 files, 45 tables, 46 routes, **`scripts: 0`** (package.json has 23) |
| `preflight --port 0 --json` | **PASS** | exit 0; RAM 2.15/1.50 GB, disk 5.21/4.50 GB; Node v26.7.0, npm 11.19.0, Chrome found, port free |
| `key:import --status` | **PASS** | `{"configured":true,"source":"environment","fingerprint":"c30cfdbc","dataDir":"...\\data"}`; no key material |
| `learn --json` | **HONEST REFUSAL (exit 6)** | `E_LEARNING_POOL_EXHAUSTED`, 0 blocks/0 consents/0 suites/0 promotions |
| `repo-map -- --run run_094ae10475a8f3ea01 --json` | **PASS** | `ok:true`, 5 files, parsed imports/symbols |
| `integrity -- --run run_094ae10475a8f3ea01 --json` | **PASS** | 3/3 artifact hashes match; `manifestParity {ok:true,expected:3,actual:3}` |
| Live `/api/agents` | **PASS** | first item now includes `role,objective,outputKind,pathGlobs,rules,maxOutputTokens,staticPrior,priorVersion,promptVersion,schemaId,prompt,canWrite,canReview,canTest,badges` |
| Live `/openapi.json` | **PARTIAL** | `openapi:"3.1.0"`, `paths:40`, `components.schemas:3` (`Error`,`Run`,`RunEvent`); **0/43 operations have a JSON response schema** |
| Live `/api/learning/overview` | **PASS** | `enabled:false`, `reason:"E_LEARNING_POOL_EXHAUSTED"`, 0 blocks, consent false |

---

## 2. P1-FIXES claims re-checked

| AUD | Claim | R2 result |
|---|---|---|
| AUD-5 | `/api/agents` full AgentView; no unconditional schema-valid | **VERIFIED** by live JSON: full fields; router badges only `registered`; `schema-valid` only evidence-backed |
| AUD-10 | `maxCostUsd` validated, stored, honored | **VERIFIED (static + test)**: `app.ts:242,261,524`; `manager.ts:83-86,115-119`; `budget.ts:20-36`; `test/unit/logic-core.test.ts:56` passes in 209-test run |
| AUD-11 | API route feature gate | **PARTIAL/UNVERIFIED**: `app.ts:93-101` returns `E_LEARNING_DISABLED`/`E_ROUTING_DISABLED`; `pipeline/run.ts` has no `FEATURES`/`PHASE` gate and still imports/runs routing/guard unconditionally; A/B1 runtime not exercised (P1-FIXES says partial) |
| AUD-13 | State-based P7 refusals, no fake promotion | **VERIFIED for state honesty**: `app.ts:436-455` checks blocks/candidates/promotions; live overview/learn refuse; no token/promotion claimed. Promotion service still not wired when a pool exists (accepted in P1-FIXES) |
| P2 key ingress | `key:import` exists | **VERIFIED**: `scripts/key-import.ts`; status output; no key echo |
| P2 OpenAPI | Components added | **PARTIAL**: components present; operation response schemas absent |
| P2 stage manifests | Strict A/P6A/P7 | **VERIFIED** `fallback:false`; but script check is bypassed (R2-2) |
| P2 README | 209 tests, 7 E2E, LangGraph future | **PARTIAL**: line 73 says 209 and line 12 fixed; **README:96 still says 182** |

---

## 3. Remaining mismatches

### R2-1 — P1 — OpenAPI has components but no operation response schemas
- **Contract:** `docs/PLAN-v3.md:227` requires every route to have a Fastify JSON Schema response; an OpenAPI test rejects schema-less 2xx. The live API advertises 3 component schemas but zero operations reference them.
- **Evidence:** live `GET /openapi.json` (16:51Z) → `openapi=3.1.0`, `paths=40`, `components.schemas` = 3; scripted count of operations with `responses.*.content['application/json'].schema` = **0 / 43**. `app.ts:38-91` only configures manual components; no route has a `schema:` option (`app.ts` grep = 0 route schemas).
- **Why it bites:** consumers still cannot discover 2xx payloads; the advertised OpenAPI contract remains incomplete; the current E2E (`e2e/api-contract.spec.ts:6-13`) only checks JSON + `/api/health`, so it passes despite the gap.
- **Fix:** add request/response Fastify schemas to every route (or a central route-schema map), reference `components.schemas`, then extend the E2E to assert each operation has a 2xx JSON response schema. **GREEN:** `openapi` 3.1.0, ≥46 paths, 43/43 ops with JSON response schemas.

### R2-2 — P1 — `assert-stage` silently skips the package-script check
- **Contract:** `docs/PLAN-v3.md:13`/`scripts/assert-stage.mjs` must reject scripts not in the cumulative P7 allowlist; the gate must not silently pass a missing check.
- **Evidence:** `assert-stage --stage=p7 --json` → `"ok":true`, `"scripts":0`, while `package.json` has **23** scripts (including `key:import`). `package.json` begins with UTF-8 BOM bytes **EF BB BF**; `JSON.parse` in `readPackageScripts` throws; `assert-stage.mjs:208-215` catches and returns `[]`; `:281-294` then finds no unexpected scripts; `:311` reports 0.
- **Why it bites:** a leaked/unauthorized package script would pass `assert-stage` today; the gate’s green does not mean the script allowlist was checked.
- **Fix:** strip a leading BOM in `readText`/`readPackageScripts` (or parse with a BOM-tolerant reader) and **fail closed** on parse errors with a named `E_STAGE_MANIFEST_INVALID`; add a test that a planted script is rejected. **GREEN:** `scripts:23`, a planted `evil:script` produces `E_STAGE_LEAK`, and a corrupt/BOM package.json fails closed.

### R2-3 — P2 — README still claims 182 tests
- **Evidence:** `README.md:73` says `209 tests / 26 files`; `README.md:96` still says `unit/integration tests (182)`. Current `verify` = 209.
- **Fix:** update line 96 to 209 (or remove the duplicate count). **GREEN:** `grep 182 README.md` = none.

### R2-4 — P2 — Feature gating is route-only, not pipeline-level
- **Evidence:** `app.ts:93-101` gates learning/routing API routes; `pipeline/run.ts` has no `FEATURES`/`PHASE` checks and still imports/runs `routeTasks` and `evaluateLoopGuard` unconditionally. A/B1 runtime start was not exercised (P1-FIXES AUD-11 partial).
- **Why it bites:** an A/B1 CLI/API run that bypasses the gated routes can still execute P6a/P7 pipeline pieces, contrary to the stage-lock intent.
- **Fix:** gate the pipeline branch/nodes on `FEATURES` or `PHASE`; add a `HIVE_PHASE=A` run test. **GREEN:** A/B1 run refuses or skips P6a/P7 nodes with `E_ROUTING_DISABLED`/`E_LEARNING_DISABLED`.

### R2-5 — P2 — P7 promotion has no live token/service path (accepted)
- **Evidence:** `app.ts:436-455` returns state refusals; `requestApproval` never issues a token in this build; `LearningPage.tsx` approval/promotion controls therefore cannot succeed even with a pool. P1-FIXES explicitly **ACCEPTED** this (no pool/consent/eval).
- **Fix:** accepted limitation; keep the refusal honest in UI/README. If testing P7 promotion is desired, wire the module service and a mock eligible pool in a test, not a fake live promotion.

---

## 4. Unknowns / not exercised
- A/B1 **runtime start** and pipeline feature-gate behavior (route gate only; no restart).
- **Live P7 promotion/rollback** with a sealed pool/consent/eval (no pool, no consent; accepted).
- **Paid live `maxCostUsd` enforcement** end-to-end (unit test only; no paid call).
- **OpenAPI response-schema completeness** after a fix (currently 0/43).
- **`assert-stage` script check** after BOM fix (currently vacuous).
- **Preflight RAM margin** is environment-sensitive: 2.15/1.50 GB at 10:55; passed, but other QA agents can lower it.

---

## 5. Skills applied
| Skill | Use |
|---|---|
| **logic-debugger** | BOM/parse-catch false-pass; route/pipeline gate split; state refusals |
| **forge** | OpenAPI response schemas; stage/script gate; maxCost wiring |
| **smartfix** | RED evidence per remaining defect; minimal fix; GREEN gate |
| **capability-auditor** | P1-FIXES claim reconciliation; OpenAPI/script claims vs live outputs |
| **auditor** | Independent gate reruns; exact commands; unknowns; GO/NO-GO |
| **systems-validator** | Doc-to-code matrix for changed surfaces; live components/paths; versions |

---

## 6. Sources / files read
- `docs/QA-WAVE-1/P1-FIXES.md`; previous `docs/QA-WAVE-1/08-systems-validator.md`; `README.md`; `docs/PLAN-v3.md:227`.
- `src/server/app.ts` (OpenAPI/components/feature hook/learning routes), `src/server/runs/manager.ts`, `src/server/runs/budget.ts`, `src/server/pipeline/run.ts`, `scripts/assert-stage.mjs`, `scripts/key-import.ts`, `e2e/api-contract.spec.ts`, `package.json`, `config/releases/p7.json`.
- Commands: `verify`, `e2e`, `assert-stage`, `preflight`, `key:import --status`, `learn --json`, `repo-map`, `integrity`; live GETs `/api/health`, `/api/agents`, `/openapi.json`, `/api/learning/overview`, `/api/runs`.
- No key reads: only configured/source/fingerprint; no provider call.

**Final: GO-WITH-FIXES for testing.** Fix R2-1 (OpenAPI response schemas) and R2-2 (BOM/script-check false pass) before treating those gates as authoritative; R2-3/R2-4 are documentation/partial-runtime issues. No new P0 or safety blocker.

**End report.**
