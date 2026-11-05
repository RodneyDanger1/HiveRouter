# QA WAVE 1 — Seat 8 Systems Validator

**Mode:** read-only systems validation. No product edits, no server restart, no installs, no git writes, no key access. Only this report and `logs/qa-systems.md` were written.
**Checkpoint:** wave sheet 2026-11-03T10:22:05-06:00; audit window 10:31:53–10:35 -06:00.
**Verdict:** **CONDITIONAL / NOT CURRENTLY GREEN.** 6 P1, 8 P2, no P0. The product is largely aligned to its pinned stack, but the current environment fails `preflight` (RAM 1.44 GB < 1.50 GB), the live OpenAPI surface is empty, several UI/API contracts are mismatched, and P7 promotion is not wired end-to-end.
**Claim strength:** **VERIFIED** for live GETs, commands, hashes, installed versions, and file:line reads; **READ/INFERRED** for static contracts; **UNVERIFIED/BLOCKED** for current E2E, full verify, `HIVE_PHASE=A/B1` runtime, and a 3-file live micro-suite.

---

## 1. Gate receipt (current, 2026-11-03)

| Gate | Result | Evidence |
|---|---|---|
| `npm.cmd run typecheck` | **PASS** | exit 0, 10:29 |
| `npm.cmd test` | **PASS, 201 tests / 26 files** | 10:27, `Test Files 26 passed`, `Tests 201 passed` |
| `npm.cmd run preflight -- --port 0 --json` | **FAIL / BLOCKED** | exit 1, `E_RESOURCE_INSUFFICIENT`, ram `1.44 < 1.50`; disk 5.28 > 4.5; Node/npm/Chrome/port pass |
| `node scripts/assert-stage.mjs --stage=p7 --json` | **PASS** | fallback false for a/p6a/p7; 125 files, 45 tables, 46 routes, 22 scripts; violations [] |
| `node scripts/stub-sweep.mjs --json` | **PASS** | 77 scanned, 0 hits |
| `node scripts/check-secrets.mjs --json` | **PASS** | 119 scanned, 0 hits; 2 synthetic test fixtures classified |
| `npm.cmd run e2e` | **CHECKPOINT PASS / not rerun** | wave sheet: 3 passed; static: `e2e/app.spec.ts` contains 3 tests; config `channel:'chrome'` |
| `docs/verification/live-smoke-*.json` | **PASS (micro-call)** | `ok:true`, 63 prompt/11 completion tokens, `finishReason:"stop"`, cost `$0.00001605`, balance `$1.94`, key source `environment` |
| `package-lock.json` / `PLAN-v3.md` hashes | **MATCH wave sheet** | `ADD08FE…7AFF` / `698C1B…27C7` |

---

## 2. Validation matrix

| Surface | Official/contract source | Code reality | Verdict |
|---|---|---|---|
| DeepSeek base URL/model IDs | `https://api-docs.deepseek.com/quick_start/pricing` (read 2026-11-03): `https://api.deepseek.com`, `deepseek-flash`, `deepseek-v4-pro` | `src/server/config.ts:31`; `src/server/llm/client.ts:674` | **PASS** |
| DeepSeek `thinking`, `response_format`, `max_tokens`, `user_id`, usage fields, finish reasons | `https://api-docs.deepseek.com/api/create-chat-completion` (read 2026-11-03) | `client.ts:664-699`, `:214-254`, `:832-875` | **PASS** |
| DeepSeek peak/off-peak pricing | Official page: peak 01–04 and 06–10 UTC Mon–Fri **excluding Chinese public holidays**; prices match | `config.ts:49-66`; `isPeakUtc` `client.ts:270-276` **does not exclude Chinese holidays** | **P2 mismatch** |
| DeepSeek price arithmetic | 1M-token prices; cache hit/miss + output | `computeCostUsd` `client.ts:278-295`; live smoke cost matches 63/11 usage | **PASS** |
| `node:sqlite` | `https://nodejs.org/docs/latest-v26.x/api/sqlite.html` (read 2026-11-03): `Database`; `DatabaseSync` deprecated alias; synchronous | `src/server/db/database.ts:3,20-24` uses `DatabaseSync`; WAL/foreign_keys/busy_timeout; tests pass | **PASS with P2 version note** |
| Fastify 5 / `reply.hijack` | `https://fastify.dev/docs/latest/Reference/Reply/` shows v5.12.8 and `.hijack()`; `package.json:43` 5.12.8 | SSE route `app.ts:484-520` uses `reply.hijack()` and raw SSE | **PASS** |
| OpenAPI / route schemas | `docs/PLAN-v3.md:227`: every route has Fastify JSON Schema response; OpenAPI test rejects schema-less 2xx | `app.ts` has **0** route `schema:` options; live `GET /openapi.json` returns `openapi=[]`, `paths=0` | **P1 FAIL** |
| Playwright system Chrome | `https://playwright.dev/docs/browsers`: `channel:'chrome'` targets installed branded Chrome | `playwright.config.ts:12` `channel:'chrome'`; 3 E2E tests; wave sheet 3 passed | **PASS (checkpoint)** |
| Exact versions | `package.json:35-71` pins; `npm.cmd ls --depth=0` installed tree matches all pins, no invalid peers; Node v26.7.0, npm 11.19.0 | Node/npm/Chrome checks in preflight pass | **PASS** |
| 37 agents | `docs/PLAN-v3.md`/catalog; `REGISTRY` invariant | `test/unit/agents.registry.test.ts` 37 unique/order; `agents.engine` 14, `agents.hash` 3, `agents.schemas` 6; all pass | **PASS** |
| 182 tests | README lines 68/90 and wave sheet checkpoint | Current `npm.cmd test` = **201 tests / 26 files**, 10:27 | **P2 stale claim** |
| 65/50/390 | `docs/PLAN-v3.md:251`: 15 dev + 50 holdout = 65; 6 blocks = 390; tests | `src/server/learning/sealed-pool.ts:178` requires 15+50; `:275` requires 6 blocks; `learning-pool` tests pass | **PASS** |
| Budget caps | README:107 / plan: per-run $0.50, eval $3.00, cycle $4.50 | `config.ts:40-42`; `budget.ts:20-24`; caps enforced in reservations | **PASS (code)**; UI cap ignored below |
| P7 refusal | `docs/PLAN-v3.md:277`: `P7_REFUSED` valid; `AGENTS.md:9` | Live `/api/learning/overview` = `reason:"E_LEARNING_POOL_EXHAUSTED"`, 0 blocks/0 consents; `scripts/learn.ts:36-40` exit 6; `learning-cli` test passes | **PASS (honest refusal)** |
| Stage split | `docs/PLAN-v3.md:13,66`; `README.md:58`; `AGENTS.md:6`; `config/releases/{a,p6a,p7}.json` | `assert-stage --stage=p7` pass, no fallback; all 3 manifests present; README says A/P6a manifests are absent | **P2 stale doc**; runtime gating missing (P1 below) |
| Key ingress | `docs/PLAN-v3.md:158`: local `hive key import`; README:32-37; Settings UI:65-69 | No `hive` binary/script; `saveAppKey`/`clearAppKey` in `security/keys.ts` have **no caller**; only env key works; app forbids key routes `app.ts:100-101` | **P1 FAIL** |
| `/api/agents` list contract | `web/src/api-types.ts:49` `AgentView extends AgentDefinition`; UI uses `role` at `AgentsPage.tsx:58,164` | Live first agent has no `role`, `objective`, `prompt`, `rules`, `pathGlobs`, `maxOutputTokens`, `staticPrior`, `priorVersion`, `schemaId` (app `:117-130`) | **P1 FAIL** |
| Ad-hoc/run `maxCostUsd` | `docs/PLAN-v3.md:132` ad-hoc `{maxCostUsd}`; UI sends `RunComposer.tsx:54`, `AgentsPage.tsx:294` | `app.ts:181-190`, `:422-438` never read or pass `maxCostUsd`; `createRun` input has no field; effective cap fixed `$0.50` | **P1 FAIL** |
| Feature flags | `features.ts:6-15` `FEATURES`; plan `:66` says A/B1 return `E_LEARNING_DISABLED` | `FEATURES` only returned in `/health`, `/meta`, `/settings`; no route/graph gate; `isFeatureEnabled` unused; learning routes always registered | **P1 FAIL (stage lock)** |
| P7 approval/promotion/rollback | Plan `:215,:259`; UI `LearningPage.tsx:583-590` | `app.ts:368-375` are hardcoded refusals; no import of `learning/promotion.ts`; no token issuance | **P1 FAIL (dead controls)** |
| Badge evidence | Plan `:126`: badges from `agent_evidence`; `representative-live` six fixed; `schema-valid` valid+invalid fixture | `app.ts:114-116` always adds `registered`+`schema-valid`, and any succeeded step adds `representative-live` | **P2 overclaim** |
| Live micro-suite | Plan `:299`: 3-file micro-suite ≤$0.50; `:310` `test:live --max-cost/--p7` | `scripts/live-smoke.ts` only accepts `--yes`, performs one 256-token JSON call; no `--max-cost`/`--p7`; evidence is one micro-call | **P2/UNVERIFIED** |

---

## 3. P1 defects (fix requests)

### S1 — Live OpenAPI is empty; the plan requires route schemas
- **Contract:** `docs/PLAN-v3.md:227` — every route has Fastify JSON Schema response; an OpenAPI test rejects schema-less 2xx.
- **Reality:** `src/server/app.ts` registers `@fastify/swagger`/UI (`:38-46`) but **no route defines `schema:`**; live `GET http://127.0.0.1:8787/openapi.json` at 16:29Z returned `openapi=[]` and `paths=0`.
- **Why it bites:** the advertised API gateway is not machine-describable; clients/agents cannot discover contracts; the plan’s OpenAPI gate cannot exist.
- **Fix request:** add request/response JSON Schemas to every route (or a central route-schema map), regenerate OpenAPI 3.1; add a test asserting `openapi` is set and every 2xx has a schema.
- **GREEN:** `/openapi.json` has `openapi:"3.1.0"`, ≥46 paths, and schema coverage; test passes.

### S2 — `/api/agents` violates the UI’s `AgentView`
- **Contract:** `web/src/api-types.ts:49` (`AgentView extends AgentDefinition`); UI reads `agent.role` (`AgentsPage.tsx:58,164`) and detail fields (`:344-358`).
- **Reality:** live `GET /api/agents` first item (router) has only `id,name,group,outputKind,verificationSupport,languages,promptVersion,canWrite,canReview,canTest,badges,evidence`; it lacks `role,objective,prompt,rules,pathGlobs,maxOutputTokens,staticPrior,priorVersion,schemaId`. Source `app.ts:117-130`.
- **Why it bites:** list cards show “No role description”; search by role silently fails; the TypeScript type lies about the payload.
- **Fix request:** return the full `AgentDefinition` fields needed by the list (at minimum `role,objective`), or narrow `AgentView` to a partial list type and fetch detail in the drawer.
- **GREEN:** `/api/agents` item satisfies `AgentView`; E2E search by role/description succeeds.

### S3 — `maxCostUsd` is accepted by the UI and ignored by the server
- **Contract:** `docs/PLAN-v3.md:132` ad-hoc API takes `maxCostUsd`; UI sends it in `RunComposer.tsx:54` and `AgentsPage.tsx:294`.
- **Reality:** `POST /api/runs` (`app.ts:422-438`) and `POST /api/agents/:id/run` (`:181-190`) never read `maxCostUsd`; `createRun` (`runs/manager.ts:43-49`) has no field; enforcement is fixed `config.limits.maxRunCostUsd = 0.50` (`config.ts:40`).
- **Why it bites:** the visible “Max run cost” control is dead; a user requesting $0.05 is silently allowed up to $0.50, and a user requesting $2.00 is silently capped at $0.50.
- **Fix request:** validate a positive finite cap (e.g. ≤ configured hard cap), thread it into the run/snapshot/policy and budget reservation, and record it; or remove the control and state the fixed cap.
- **GREEN:** a run with cap $0.05 aborts at/below $0.05 with `E_BUDGET_EXCEEDED`; a $2.00 request is either honored within hard limits or refused by name.

### S4 — P7 approval/promotion/rollback are hardcoded stubs
- **Contract:** `docs/PLAN-v3.md:215` approval issuance returns `{approvalToken,expiresAt,tokenId}`; `:259` promotion/rollback consume a token; UI `LearningPage.tsx:583-590` calls them.
- **Reality:** `app.ts:368-375`: approvals always `E_LEARNING_NO_BASELINE`; promotions always `E_LEARNING_INSUFFICIENT_SAMPLE`; rollback always `E_LEARNING_ROLLBACK_UNAVAILABLE`. There is no import of the promotion/approval service.
- **Why it bites:** the P7 UI controls can never succeed, even if a sealed pool/consent/candidate existed; the module is unit-tested but the product surface is dead. The current zero-pool refusal is honest, but the route is a stub, not the planned refusal path.
- **Fix request:** wire the routes to `learning/approval.ts`/`promotion.ts` with staged checks (pool → candidate → eval → token → promotion/rollback), or disable/remove the controls and label the surface “not available in this build.” Do not fake a token or promotion.
- **GREEN:** no-candidate path returns the named refusal; a mock eligible candidate issues a token, consumes it once, and a second use is refused; no auto-apply.

### S5 — Feature flags/stage lock are reported but not enforced
- **Contract:** `docs/PLAN-v3.md:66` — P7 routes are registered only under B2; A/B1 return `E_LEARNING_DISABLED`; stage lock A/B1/B2.
- **Reality:** `features.ts:6-15` defines `FEATURES`; `app.ts` imports it only for `/health`, `/meta`, `/settings`; `isFeatureEnabled` is unused. Learning routes are registered unconditionally (`app.ts:314-375`); `run.ts` always runs P6a routing. With `HIVE_PHASE=A`, migrations omit P6a/P7 tables (`db/database.ts:25-27`) but the learning/routing routes remain reachable, producing table-missing failures instead of the named refusal.
- **Why it bites:** the advertised stage lock is documentation-only at runtime; a stage branch can expose or crash unsupported routes. The current default B2 masks it.
- **Fix request:** gate route registration and graph nodes on `FEATURES`/`PHASE`; return `E_LEARNING_DISABLED` for A/B1 learning; make A/B1 routing refusal by name; add a `HIVE_PHASE=A` route test.
- **GREEN:** `HIVE_PHASE=A` `/api/learning/*` returns 403 `E_LEARNING_DISABLED`; A graph does not call route/learning; B2 current behavior unchanged.

### S6 — The documented local key-import path does not exist
- **Contract:** `docs/PLAN-v3.md:158` (`hive key import --from-env|--file`), `README.md:32-37` (app-secret `data/secrets/deepseek.json`), `SettingsPage.tsx:65-69` prints `hive key import --from-env`.
- **Reality:** no `hive` binary, npm `bin`, or npm script exists; `saveAppKey`/`clearAppKey` in `security/keys.ts:59-78` have no caller; the only working source is `DEEPSEEK_API_KEY`/`.env.local`; `/api/settings/key` is intentionally forbidden (`app.ts:100-101`).
- **Why it bites:** users following the UI/README cannot configure the second supported key source; the “app-secret” branch is dead in practice.
- **Fix request:** implement the local import command/path (writes `data/secrets/deepseek.json` 0600, validates key shape, updates key status) or remove the claim and say “environment only.” Do not add a key HTTP route.
- **GREEN:** `hive key import --from-env` writes the file 0600 and `/api/settings/key-status` reports `source:"app-secret"`; or docs/UI exactly match env-only behavior.

---

## 4. P2 findings

| ID | Finding | Evidence | Fix request |
|---|---|---|---|
| S7 | Peak pricing overcharges Chinese public holidays | Official pricing page says holidays are off-peak; `client.ts:270-276` only checks weekday/hour | Add a holiday calendar or label estimates “peak-window only, holidays not modeled” |
| S8 | `DatabaseSync` is a deprecated alias | Node 26 docs: `DatabaseSync` deprecated alias for `Database`; `db/database.ts:3,20` | Migrate to `Database`; typecheck/tests |
| S9 | README test count and stage-manifest claims are stale | README:68/90 “182” vs current 201 tests; README:58 says A/P6a allowlists absent but `config/releases/{a,p6a,p7}.json` all exist; `assert-stage` no fallback | Update README to 201 and current manifests |
| S10 | LangGraph dependency is installed but unused | README:12 “LangGraph… for graph orchestration”; `grep` `@langchain|langgraph` in `src` = 0 matches; `package.json:40-41` | Either use it (and test) or remove the dependency and README claim |
| S11 | `/api/scripts` advertises dry-run for `bench`/`learn` but refuses them | `app.ts:294-311`: list includes paid `bench`,`learn` with `dryRun:true`; allowlist excludes both | Align list/allowlist or implement explicit paid-dry-run refusal |
| S12 | No Scripts UI despite planned read-only/dry-run surface | `web/src/api.ts` has no scripts functions; no scripts route in `App.tsx`; plan `:241` | Add the page or mark the API internal/unsupported |
| S13 | Badges overclaim `schema-valid`/`representative-live` | `app.ts:114-116`; live router badges `registered,schema-valid` with no evidence; plan `:126` requires fixture/evidence and six fixed live agents | Derive only from `agent_evidence`; add fixture evidence rows |
| S14 | Ad-hoc preset is outside `PRESETS` | `app.ts:183` `preset:'adhoc'`; `shared/types.ts:39` presets exclude `adhoc`; `RunRecord.preset` typed `Preset` | Add `adhoc` to the enum or use a non-preset kind/field |
| S15 | `live-smoke` ignores plan flags and only proves a micro-call | `scripts/live-smoke.ts:14-33` accepts only `--yes`; one 256-token JSON call; plan `:299` 3-file micro-suite, `:310` `--max-cost/--p7` | Implement flags or correct the plan/README; record the 3-file micro-suite separately |
| S16 | Orphaned API surfaces | UI `api.ts` has no client for `/api/ops/system`, `/api/ops/reports/:kind`, `/api/stats/router`, `/api/scripts*`, `/api/runs/active`, `/api/runs/:id/events`, `/api/runs/:id/files` | Mark internal/deprecated or wire UI/CLI; list in API docs |
| S17 | P7 promotion docs overstate end-to-end implementation | README:57 says approval tokens/promotion/rollback implemented and unit-tested; module true, HTTP/UI stubs (S4) | Say “module-tested, HTTP promotion not wired in this build” |

---

## 5. Incompleteness / dead-surface census
- `node scripts/stub-sweep.mjs --json` — 77 source files, **0 TODO/FIXME/NotImplemented/placeholder hits**.
- `node scripts/check-secrets.mjs --json` — 119 files, **0 secret hits**; 2 allowed synthetic fixtures in `test/pipeline-qa.test.ts:74-75`.
- Functional incompleteness is **not** marker-based: hardcoded P7 routes (S4), absent key import (S6), ignored `maxCostUsd` (S3), unused feature flags (S5), unused LangGraph deps (S10), missing scripts UI (S12), and empty OpenAPI (S1).
- Dead exports/dead config: `saveAppKey`/`clearAppKey` (no caller), `config.dshCredentialsPath` (no runtime reader), `isFeatureEnabled` (no caller).
- Orphan/dead routes per S16; `/api/settings/key` is an intentional refusal, not orphaned.

---

## 6. Numeric claims
| Claim | Status | Evidence |
|---|---|---|
| 37 agents | **VERIFIED** | registry invariant + tests |
| 182 tests | **STALE** | current `npm.cmd test` = **201 passed / 26 files** at 10:27; checkpoint wave sheet 182 is historical |
| 3 Playwright tests / system Chrome | **VERIFIED (checkpoint)** | `e2e/app.spec.ts` 3 tests; config `channel:'chrome'`; wave sheet 3 passed; **not rerun** this seat |
| 65 dev+holdout / 390 pool | **VERIFIED (code)** | `sealed-pool.ts:178,275`; `learning-pool` tests |
| $0.50 / $3.00 / $4.50 caps | **VERIFIED (code)** | `config.ts:40-42`; `budget.ts` |
| UI max-cost control | **FAIL** | ignored by server (S3) |
| P7 / live smoke | **PARTIAL** | overview/CLI refusal honest; promotion path stub; live smoke only a micro-call |
| Package-lock / plan hashes | **VERIFIED** | match wave sheet exactly |

---

## 7. P7 and stage split (task asks)
- **P7 refusal: honest at the overview/CLI level.** Live `/api/learning/overview` reports `E_LEARNING_POOL_EXHAUSTED` with `sealedBlocks:0`, `consentRequired:true`, and `promotions:0`; `scripts/learn.ts` exits 6 when `blocks<6`; `learning-cli` test passes. No promotion is claimed.
- **But P7 is not end-to-end wired.** `POST /api/learning/approvals|promotions|rollback` are unconditional refusals (S4), so the UI approval/promotion/rollback controls are dead even if a pool existed. This is a truthful refusal but not the planned implementation.
- **Stage split is documented:** `README.md:58`, `AGENTS.md:6,10`, plan `:13,:66`. `config/releases/{a,p6a,p7}.json` now all exist; `assert-stage --stage=p7` passes with no fallback. README's “A/P6a allowlists are not present” is stale (S9). Runtime flag enforcement is missing (S5).

---

## 8. Unknowns / unverified
- **Current E2E**: not rerun (no server restart; wave sheet 3 passed; 3 tests static).
- **Full `npm.cmd run verify`**: not run (build + tests + sweeps; preflight currently red).
- **`HIVE_PHASE=A/B1` runtime**: not exercised (no restart); static evidence predicts missing-table/route behavior (S5).
- **DeepSeek holiday behavior**: not live-tested; code bug is static (S7).
- **P7 promotion with a valid pool/consent**: no pool/consent; not tested; S4 static.
- **3-file live micro-suite ≤$0.50**: not evidenced; only one 256-token live smoke call.
- **Agent badge evidence**: no `agent_evidence` rows for `schema-valid`; live badges are derived, not fixture-proven.
- **OpenAPI**: live empty is verified; whether a later fix produces schemas is unverified.

---

## 9. Skills applied
| Skill | Finding |
|---|---|
| **logic-debugger** | S3/S4/S5 dead paths; S2 list/detail state contract; S1 empty OpenAPI; S14 enum mismatch |
| **forge** | S1 route schemas; S5 phase gating; S13 badge derivation; version/route integration |
| **smartfix** | RED evidence per defect; minimal fix requests; no product edits; gate receipt |
| **capability-auditor** | S13 badges; S2 API/UI type lie; S3 authority/control; S9/S10 claims |
| **auditor** | Independent live probes; gate receipt; numeric/claim reconciliation; unknowns |
| **systems-validator** | Doc-to-code matrix for DeepSeek/Node/Fastify/Playwright; exact versions; stage/P7 surfaces |

---

## 10. Sources / files read
- Official: `https://api-docs.deepseek.com/quick_start/pricing`, `https://api-docs.deepseek.com/api/create-chat-completion` (both 2026-11-03); `https://nodejs.org/docs/latest-v26.x/api/sqlite.html`; `https://fastify.dev/docs/latest/Reference/Reply/`; `https://playwright.dev/docs/browsers`.
- Local: `package.json`, `package-lock.json` (hash), `README.md`, `AGENTS.md`, `docs/PLAN-v3.md` (hash), `docs/QA-WAVE-1/WAVE-SHEET.md`, `src/server/{app,config,db/database,llm/client,runs/manager,runs/budget,runs/snapshot,security/keys,learning/sealed-pool}.ts`, `web/src/{api,api-types}.ts`, `web/src/pages/{AgentsPage,SettingsPage,LearningPage}.tsx`, `web/src/components/RunComposer.tsx`, `playwright.config.ts`, `scripts/{live-smoke,learn}.ts`, `scripts/{assert-stage,stub-sweep,check-secrets}.mjs`, `e2e/app.spec.ts`, `config/releases/*.json`, `docs/verification/live-smoke-*.json`.
- Commands/probes: `npm.cmd test`, `npm.cmd run typecheck`, `preflight --port 0 --json`, `assert-stage --stage=p7 --json`, `stub-sweep --json`, `check-secrets --json`, `npm.cmd ls --depth=0`, `Get-FileHash`, live GET `/api/health`, `/api/meta`, `/api/learning/overview`, `/api/agents`, `/openapi.json`.
- No key material read; live key status showed fingerprint only.

**End report.**
