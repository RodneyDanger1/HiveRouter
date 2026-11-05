# HiveRouter QA Wave 1 — Wave Sheet

**Checkpoint:** 2026-11-03T10:22:05-06:00 · 114 source/test files · package-lock SHA256 `ADD08FE57ECD2353ECB99B5AD3DCE231AEBC5B9D2E3C87ECAA2FEBFFC53E7AFF` · plan SHA256 `698C1B89613FDA0ECC56AF90C21521705C33BC5CAEC3EA8BD88838C64B0927C7`.
**Start gates (already green before this wave):** `npm.cmd run verify` (typecheck, 182 tests, build, stub/secret sweeps), `npm.cmd run e2e` (3 passed, system Chrome), `assert-stage --stage=p7`, `preflight --port 0`, live smoke PASS.
**Mode:** execute mode. Fixers may edit only their listed scope. Auditors are read-only. No installs, no server restarts, no git writes, no key access, no paid API calls, no test weakening, no mocks in product paths.

## Seats and exclusive scopes

| Seat | Teammate | Owns (write) | Must not touch | Report |
|---|---|---|---|---|
| 1 `qa-core` | logic-scripts | `src/server/runs/**`, `src/server/db/**`, `src/server/security/**`, `src/server/logic/**`, `scripts/preflight.ts`, `scripts/assert-stage.mjs`, `scripts/stub-sweep.mjs`, `scripts/check-secrets.mjs`, `test/unit/logic-*`, `test/scripts.test.ts` | everything else | `docs/QA-WAVE-1/01-core.md` |
| 2 `qa-pipeline` | deepseek-mechanisms | `src/server/pipeline/**`, `src/server/llm/**`, `src/server/verify/**`, `test/unit/llm*`, new pipeline tests | everything else | `docs/QA-WAVE-1/02-pipeline.md` |
| 3 `qa-api` | integration-architect | `src/server/app.ts`, `src/server/routes/**`, `e2e/**`, `playwright.config.ts`, `config/releases/**` | server core/runs/db/security, web UI | `docs/QA-WAVE-1/03-api.md` |
| 4 `qa-ui` | agent-native-ux | `web/**` | server/** | `docs/QA-WAVE-1/04-ui.md` |
| 5 `qa-agents` | algorithm-forge | `src/server/agents/**`, `src/server/routing/**`, `src/server/context/**`, `src/server/quality/**`, `src/server/retry/**`, `src/server/repair/**`, `src/shared/algorithms.ts`, `scripts/bench-suite.ts`, `scripts/replay-run.ts`, `scripts/build-repo-map.ts`, `scripts/context-pack-report.ts`, `scripts/integrity-check.ts` | everything else | `docs/QA-WAVE-1/05-agents.md` |
| 6 `qa-learning` | learning-loop | `src/server/learning/**`, `scripts/learn.ts`, `scripts/eval-router.ts`, `scripts/live-smoke.ts`, new learning tests | everything else | `docs/QA-WAVE-1/06-learning.md` |
| 7 `qa-auditor` | watchdog | `docs/QA-WAVE-1/07-auditor.md`, `logs/qa-auditor.md` only | all product code | `docs/QA-WAVE-1/07-auditor.md` |
| 8 `qa-systems` | plan-audit-core | `docs/QA-WAVE-1/08-systems-validator.md`, `logs/qa-systems.md` only | all product code | `docs/QA-WAVE-1/08-systems-validator.md` |

## Required skills (all seats)

Apply the full stack to your area: **logic-debugger, forge, smartfix, capability-auditor, auditor, systems-validator**. For every finding: exact file:line, contract/invariant, RED command/output or a contradiction, minimal fix, GREEN evidence. No prose-only claims. Label VERIFIED / READ / INFERRED / UNVERIFIED.

## Focus by seat

- **qa-core:** state transitions, snapshot immutability, idempotency, budget ledger/reservations, lease/reaper, repair staging atomicity, DB migrations/null-not-zero, SSE ordering/replay bounds, crash recovery, refusal taxonomy. Reproduce the `budget_exceeded`/failed paths; check one-active-run and lost-response idempotency. Verify `assert-stage`/preflight/stub/secret scripts.
- **qa-pipeline:** DeepSeek wire body (`thinking`, `response_format`, `stream_options`, `max_tokens`, `user_id`), finish reasons, usage/cost, retries, abort; CPO/RVS/CCA/repair wiring; finalize artifacts/manifest/duplicate paths; trace ingestion; ad-hoc/revise/audit branches. Run a **live** small full build? Do not spend without Lead approval: use mock HTTP test doubles/unit tests; if a real call is essential, stop and report.
- **qa-api:** every UI `api.ts` call has a route; route order/params; Host/Origin/content-type; errors 4xx named; idempotency; SSE snapshot/stream; file/download/open-folder; learning refusal shape; stage manifest truth; Playwright E2E against the running server (no restart).
- **qa-ui:** every control wired; dead controls; loading/empty/refused/insufficient states; live SSE fallback; stats/agent badges; run detail tabs; accessibility/focus; no secret in bundle; build + Playwright.
- **qa-agents:** 37 registry census/prompt/schema/engine map; capability filters; CCR deterministic same-policy across run IDs; DP budget/required closure; CPO PageRank/units/prefix; RVS syntax-all-code; CCA mandatory caps; FSN/CRA; scripts exit codes; no double counting.
- **qa-learning:** consent, trace store/redaction, sealed pool/6 blocks/65-case split, single-use atomic claim, 50-pair gate, approval token, promotion/rollback/monitor, repair memory/guard, `learn` refusal, no mock/synthetic promotion, P7 stage manifest. Do not fake a promotion.
- **qa-auditor:** independently re-verify all fixer claims on a quiescent tree; run typecheck/full tests/build/E2E/stage/preflight yourself; review the full diff; write PASS/PASS-WITH-NOTES/FAIL verdict; no product edits.
- **qa-systems:** doc-to-code contract diff (DeepSeek official docs, Fastify/Node/sqlite versions, Playwright), incompleteness census (`TODO|FIXME|NotImplemented|pass`), dead routes/controls, numeric claims (37 agents, 182 tests, 65/50, 390 pool, $ caps), evidence citations; no product edits.

## Gates / budget

- Each fixer: RED → minimal fix → targeted test(s) → `npm.cmd run typecheck` → report. Only qa-api/qa-ui may run `npm.cmd run e2e` (server is running; do not restart).
- No full `npm run verify` by fixers; Lead runs the final gate on the quiet tree.
- Work window: 12 minutes; check window: 4 minutes. Auditor/systems: 20 minutes after reports appear.
- Stop/rollback rather than ship a broken edit; record `BLOCKED`/`PARTIAL`.

## Acceptance

A seat is DONE only when its journal + report exist, every adopted fix has RED/GREEN, and no out-of-scope edit exists. The Lead creates the final DONE only after the final gates pass on a quiet tree.
