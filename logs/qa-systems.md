# qa-systems — Seat 8 Systems Validator Journal

**Wave:** QA-WAVE-1 · **Seat:** 8 `qa-systems` · **Mode:** read-only systems validation.
**Target:** HiveRouter working tree, plan v3, package-lock hash `ADD08FE…7AFF`, plan hash `698C1B…27C7`.
**Window:** 10:22 wave received → 10:32:53 report complete.
**STATUS:** DONE — report at `docs/QA-WAVE-1/08-systems-validator.md`; no product edits.

## 10:22 — task clock / first read
- Task received at `2026-11-03T10:22:37-06:00` (prompt clock).
- Read `docs/QA-WAVE-1/WAVE-SHEET.md` (44 lines): systems scope, read-only rule, start gates, 20-minute window, required report/evidence.
- Read `AGENTS.md` (13 lines): stack lock, no fake code, key sources, stage lock, P7 refusal.
- Checked repo root: docs/QA-WAVE-1 only had the wave sheet initially; later reports appeared from parallel seats. No product edits made.

## 10:24–10:27 — source/contract research
- Read `package.json`/lock pins, `README.md` (107 lines), `docs/PLAN-v3.md` key sections (:13, :66, :126, :132, :148, :158, :215, :227, :251, :259, :277, :299, :310).
- Read `src/server/config.ts`, `llm/client.ts`, `db/database.ts`, `app.ts`, `runs/{manager,budget,snapshot}.ts`, `security/keys.ts`, `learning/sealed-pool.ts`, `shared/features.ts`.
- Read `web/src/{api,api-types}.ts`, `pages/{AgentsPage,SettingsPage,LearningPage}.tsx`, `components/RunComposer.tsx`, `hooks/useApi.ts`, `playwright.config.ts`, `e2e/app.spec.ts`, `scripts/{live-smoke,learn}.ts`.
- Fetched primary sources:
  - `https://api-docs.deepseek.com/quick_start/pricing` — models, 1M context, 384K max output, prices, peak hours, Chinese holidays off-peak.
  - `https://api-docs.deepseek.com/api/create-chat-completion` — `thinking`, `reasoning_effort`, `response_format`, `stream_options`, `max_tokens`, `user_id`, usage, finish reasons.
  - `https://nodejs.org/docs/latest-v26.x/api/sqlite.html` — `Database`; `DatabaseSync` deprecated alias; synchronous API.
  - `https://fastify.dev/docs/latest/Reference/Reply/` — v5.12.8, `reply.hijack()`.
  - `https://playwright.dev/docs/browsers` — branded Chrome channel `chrome`.

## 10:27 — independent test count
- `npm.cmd test` in HiveRouter: **26 files / 201 tests passed**; duration 31.82s.
- This contradicts README:68/90 (“182 tests”) and the wave-sheet checkpoint (182); current tree has added tests (`pipeline-qa`, `scripts-agents`, `logic-core`, `learning-cli`, etc.). Numeric-claim finding S9/S6.

## 10:29 — live surface probes (GET only, no key)
- `/api/health`: ok, phase B2, key configured source `environment`, fingerprint only.
- `/api/meta`: B2, routing/learning true, model deepseek-flash.
- `/api/learning/overview`: `enabled:true`, `reason:"E_LEARNING_POOL_EXHAUSTED"`, sealedBlocks 0, consents 0, promotions 0 → honest P7 refusal.
- `/api/agents` first item (router): missing `role`, `objective`, `prompt`, `rules`, `pathGlobs`, `maxOutputTokens`, `staticPrior`, `priorVersion`, `schemaId` → S2.
- `/openapi.json`: `openapi=[]`, `paths=0`; `app.ts` has 0 route `schema:` options → S1.
- `assert-stage --stage=p7 --json`: pass; fallback false for a/p6a/p7; 125 files, 45 tables, 46 routes, 22 scripts; violations [].
- `stub-sweep --json`: 77 scanned, 0 hits. `check-secrets --json`: 119 scanned, 0 hits; 2 allowed synthetic fixtures.
- `preflight -- --port 0 --json`: **FAIL** `E_RESOURCE_INSUFFICIENT`; Node v26.7.0, npm 11.19.0, disk 5.28/4.5, Chrome found, port free, **RAM 1.44/1.50**. Not product code; current environment gate red.

## 10:31 — hashes/versions/exact pins
- `package-lock.json` SHA256 exactly matches wave sheet; `PLAN-v3.md` matches.
- `npm.cmd ls --depth=0 --json`: every installed top-level version matches package.json pins; no invalid peers; Node v26.7.0, npm 11.19.0.
- `npm.cmd run typecheck`: pass.
- `config/releases/{a,p6a,p7}.json` now all present; README:58 (“A/P6a allowlists are not present”) is stale.
- `LangGraph` packages installed but zero imports in `src/`; README:12 claim is doc-only.

## Findings synthesized
- **P1:** S1 empty OpenAPI; S2 `/api/agents` violates `AgentView`; S3 `maxCostUsd` ignored; S4 P7 approval/promotion/rollback hardcoded; S5 feature flags/stage gating absent; S6 documented key-import CLI absent.
- **P2:** S7 holiday pricing; S8 deprecated `DatabaseSync`; S9 stale README 182/manifests; S10 unused LangGraph; S11 scripts dry-run mismatch; S12 no scripts UI; S13 badge overclaim; S14 `adhoc` preset outside enum; S15 live-smoke flags/micro-call only; S16 orphan routes; S17 P7 docs overstate wiring.
- **PASS:** DeepSeek params/usage/pricing arithmetic; Node sqlite behavior (with deprecation note); Fastify v5.12.8/hijack; Playwright channel; exact pins; 37 agents; 65/50/390 code; caps; P7 overview/CLI refusal; stage manifests/assert p7; typecheck/tests/stub/secret/live micro-smoke.
- **BLOCKED/UNVERIFIED:** current preflight RAM floor; current E2E not rerun; full verify not run; `HIVE_PHASE=A/B1` runtime not exercised; 3-file live micro-suite not evidenced; P7 promotion with a real pool not tested.

## Missed / limits
- No server restart, no install, no git write, no key read; only GET probes and CLI gates.
- E2E not rerun (wave sheet 3 passed; current static 3 tests, `channel:'chrome'`).
- `preflight` red is environmental, not a code defect; Lead must rerun on a quiet tree.
- Some routes may be intended for CLI/internal use; S16 lists them as orphaned UI surfaces, not proven dead code.
- The tree moved during the audit (other QA seats added tests/manifests); counts are timestamped 10:27–10:31.

## Files changed
- `docs/QA-WAVE-1/08-systems-validator.md` (created, 21,670 bytes)
- `logs/qa-systems.md` (this journal)

**STATUS: DONE.**
