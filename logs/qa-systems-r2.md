# qa-systems-r2 — Seat 8 Round 2 Journal

**Wave:** QA-WAVE-1 ROUND 2 · **Seat:** 8 `qa-systems` · **Mode:** read-only systems validation.
**Target:** HiveRouter working tree after P1 remediation (`docs/QA-WAVE-1/P1-FIXES.md`).
**Window:** 10:51 P1-FIXES read → 10:57:06 report complete.
**STATUS:** DONE — report at `docs/QA-WAVE-1/08-systems-validator-r2.md`; no product edits.

## 10:51 — input review
- Read `docs/QA-WAVE-1/P1-FIXES.md` (39 lines): Lead claims 209 tests/26, e2e 7/7, strict stage, preflight PASS, live smoke PASS; P1s AUD-1..AUD-13 dispositions; P2 OpenAPI components/key:import/README/stage.
- Re-read R1 report; carried forward the six skill lenses and the changed-surface list.
- Inspected current `package.json` mtime 10:46 and new `key:import` script; `app.ts` mtime 10:46; `README` 10:49.

## 10:52 — verify (requested)
- `npm.cmd run verify` → **PASS**.
  - typecheck clean.
  - `vitest`: **26 files / 209 tests passed**.
  - build: 651.99 kB JS / 33.56 kB CSS; chunk-size warning only.
  - `stub-sweep: clean (77 files)`.
  - `secret-scan: clean (123 files)`.

## 10:53 — e2e (requested)
- `npm.cmd run e2e` against the running server, no restart → **7/7 passed** (22.3s).
- Includes OpenAPI JSON/health, bodyless DELETE, learning pool refusal, key-route refusal, UI/run-detail/approval smoke.

## 10:54 — stage / preflight / key / learn (requested)
- `assert-stage --stage=p7 --json` → `ok:true`, fallback false for a/p6a/p7; 125 files, 45 tables, 46 routes, **`scripts:0`**. Suspicious.
- `preflight --port 0 --json` → **exit 0**; RAM 2.15/1.50 GB, disk 5.21/4.50, Node v26.7.0, npm 11.19.0, Chrome found, port free.
- `key:import --status` → exit 0; `configured:true`, `source:"environment"`, fingerprint `c30cfdbc`; no key material.
- `learn --json` → exit 6; `E_LEARNING_POOL_EXHAUSTED`, 0 blocks/consent/suites/promotions.

## 10:55 — repo-map / integrity / live surfaces
- `repo-map --run run_094ae10475a8f3ea01 --json` → exit 0; 5 files, imports/symbols parsed.
- `integrity --run run_094ae10475a8f3ea01 --json` → exit 0; 3/3 artifact hashes, manifestParity 3/3.
- Live `/api/agents` → **full AgentView** now present: role/objective/rules/pathGlobs/maxOutputTokens/staticPrior/priorVersion/schemaId/prompt; router badges only `registered`.
- Live `/api/learning/overview` → `enabled:false`, `E_LEARNING_POOL_EXHAUSTED`, 0 blocks, consent false.
- Live `/openapi.json` → `openapi:3.1.0`, paths 40, components.schemas 3 (`Error`,`Run`,`RunEvent`); scripted count of operations with JSON response schema = **0/43**.
- `e2e/api-contract.spec.ts:6-13` only asserts JSON + `/api/health`, so it does not catch response-schema absence.

## 10:56 — BOM/root cause of scripts:0
- `package.json` first bytes = **EF BB BF** (UTF-8 BOM).
- `assert-stage.mjs:208-215` does `JSON.parse(readText(package.json))` in a `try/catch` and returns `[]` on error; `:281-294` then finds no unexpected scripts; `:311` reports `scripts:0`, despite package.json having **23** scripts.
- This is a false-pass stage gate: a leaked/unauthorized package script would not be detected.
- README:73 says 209 tests, but README:96 still says 182; stale duplicate.

## 10:57 — report
- Wrote `docs/QA-WAVE-1/08-systems-validator-r2.md` (9,913 bytes).
- Findings: R2-1 OpenAPI response schemas (P1); R2-2 BOM/assert-stage script false pass (P1); R2-3 README 182 stale (P2); R2-4 feature gate route-only/pipeline partial (P2/unknown); R2-5 P7 token/service path absent (accepted).
- Verified remediations: AgentView full, maxCost, key:import, P7 state refusals, repo-map/integrity, strict stage manifests, 209 tests, 7 E2E, preflight PASS.
- Final verdict: **GO-WITH-FIXES for testing**; fix R2-1/R2-2 before treating API/stage gates as authoritative.

## Limits / unknowns
- No A/B1 runtime start (no restart); pipeline-level feature gate remains unexercised.
- No live P7 promotion/rollback (no pool/consent; accepted).
- No paid live maxCost run (unit test only); no key read.
- Current preflight margin passed (2.15 GB) but is environment-sensitive.
- Only two files written; no product edits, installs, git, or key access.

**STATUS: DONE.**
