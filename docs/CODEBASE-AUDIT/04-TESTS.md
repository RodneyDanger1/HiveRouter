# 04 Tests — unit, integration, E2E

Generated from the tracked tree and `CODE-INDEX.json`. Every row was read at least at head/target depth; full source path, imports, exports and role evidence are recorded.

## Coverage map

- **Unit/integration (72 files):** registry/schemas/hashes, run transitions and writers, terminal usage/historical NULL, routing/context/quality/retry/repair, verification syntax/secret/stub/OpenAPI, publish/resume, search, chat store/worker/usage, learning approval/pool/promotion/consent, API/list/snapshot truth.
- **Root integration (2):** pipeline QA, scripts contract.
- **E2E (8 specs):** app shell/navigation, API contract, chat, mobile/keyboard, UI audit, trace fixes, Wave 17 controls, Wave 17 actions.
- **Known gaps:** no paid live path, no native CUA, no full mid-run checkpoint, no generated-code execution. Test doubles are confined to tests/E2E and classified in reports.

| File | Lines | Role / first evidence | Imports (selected) |
|---|---:|---|---|
| `e2e/api-contract.spec.ts` | 121 | (no extractable prose in first 64 KiB) | @playwright/test |
| `e2e/app.spec.ts` | 68 | (no extractable prose in first 64 KiB) | @playwright/test |
| `e2e/chat.spec.ts` | 24 | (no extractable prose in first 64 KiB) | @playwright/test |
| `e2e/mobile-keyboard.spec.ts` | 90 | (no extractable prose in first 64 KiB) | @playwright/test, node:fs, node:path |
| `e2e/trace-fixes.spec.ts` | 40 | (no extractable prose in first 64 KiB) | @playwright/test |
| `e2e/ui-audit.spec.ts` | 564 | (no extractable prose in first 64 KiB) | @playwright/test, node:fs, node:path |
| `e2e/wave17-actions.spec.ts` | 191 | (no extractable prose in first 64 KiB) | @playwright/test |
| `e2e/wave17-controls.spec.ts` | 158 | * Wave 17 regression pins for the three confirmed control/wiring defects. * Each test fails on the pre-fix tree and passes on the repaired tree. | @playwright/test |
| `test/fixtures/agents/fixtures.ts` | 137 | * Schema fixtures for the agent registry. Kept separate from the tests so the * same valid/invalid cases can be reused by future adapter tests. |  |
| `test/pipeline-qa.test.ts` | 131 | (no extractable prose in first 64 KiB) | ../src/server/pipeline/run.js, ../src/server/security/paths.js, ../src/server/verify/syntax.js, ../src/server/verify/verifier.js |
| `test/scripts.test.ts` | 254 | (no extractable prose in first 64 KiB) | ../scripts/preflight, node:child_process, node:fs, node:os |
| `test/unit/agent-plan-contract.test.ts` | 60 | (no extractable prose in first 64 KiB) | ../../src/server/agents/registry.js, ../fixtures/agents/fixtures.js, node:fs, node:path |
| `test/unit/agent-prompt-override.test.ts` | 84 | (no extractable prose in first 64 KiB) | ../../src/server/app.js, ../../src/server/config.js, ../../src/server/db/database.js, vitest |
| `test/unit/agent-runtime.test.ts` | 197 | (no extractable prose in first 64 KiB) | ../../src/server/pipeline/agent-runner, ../../src/shared/types.js, vitest, zod |
| `test/unit/agents.engine.test.ts` | 108 | (no extractable prose in first 64 KiB) | ../../src/server/agents/registry.js, vitest |
| `test/unit/agents.hash.test.ts` | 32 | (no extractable prose in first 64 KiB) | ../../src/server/agents/hash.js, ../../src/server/agents/prompts.js, ../../src/server/agents/registry.js, vitest |
| `test/unit/agents.registry.test.ts` | 139 | (no extractable prose in first 64 KiB) | ../../src/server/agents/prompts.js, ../../src/server/agents/registry.js, ../../src/shared/types.js, vitest |
| `test/unit/agents.schemas.test.ts` | 108 | (no extractable prose in first 64 KiB) | ../../src/server/agents/registry.js, ../../src/server/config.js, ../fixtures/agents/fixtures.js, vitest |
| `test/unit/analysis-api.test.ts` | 93 | (no extractable prose in first 64 KiB) | ../../src/server/app.js, ../../src/server/config.js, ../../src/server/db/database.js, vitest |
| `test/unit/branches.test.ts` | 187 | (no extractable prose in first 64 KiB) | ../../src/server/git/branches.js, node:child_process, node:fs, node:os |
| `test/unit/chat-store.test.ts` | 210 | (no extractable prose in first 64 KiB) | ../../src/server/chat/store.js, ../../src/server/db/database.js, vitest |
| `test/unit/chat-usage.test.ts` | 26 | (no extractable prose in first 64 KiB) | ../../src/shared/chat.js, vitest |
| `test/unit/chat-worker.test.ts` | 85 | (no extractable prose in first 64 KiB) | ../../src/server/chat/store.js, ../../src/server/chat/worker.js, ../../src/server/db/database.js, ../../src/server/llm/client.js |
| `test/unit/checks-identity.test.ts` | 86 | (no extractable prose in first 64 KiB) | ../../src/server/app.js, ../../src/server/config.js, ../../src/server/db/database.js, ../../src/server/runs/recorder.js |
| `test/unit/compaction.test.ts` | 216 | (no extractable prose in first 64 KiB) | ../../src/server/context/compaction, vitest |
| `test/unit/context-excluded.test.ts` | 128 | (no extractable prose in first 64 KiB) | ../../src/server/app.js, ../../src/server/config.js, ../../src/server/db/database.js, ../../src/server/runs/recorder.js |
| `test/unit/context.test.ts` | 178 | (no extractable prose in first 64 KiB) | ../../src/server/context/packer, ../../src/shared/algorithms, vitest |
| `test/unit/dominators.test.ts` | 150 | (no extractable prose in first 64 KiB) | ../../src/server/analysis/dominators, vitest |
| `test/unit/error-code.test.ts` | 56 | (no extractable prose in first 64 KiB) | ../../src/server/llm/client.js, ../../src/shared/refusals.js, vitest |
| `test/unit/error-log.test.ts` | 55 | (no extractable prose in first 64 KiB) | ../../src/server/observability/error-log.js, node:fs, node:os, node:path |
| `test/unit/event-contract.test.ts` | 235 | (no extractable prose in first 64 KiB) | ../../src/shared/run-events.js, @shared/run-events, node:fs, node:path |
| `test/unit/events-window.test.ts` | 135 | (no extractable prose in first 64 KiB) | ../../src/server/app.js, ../../src/server/config.js, ../../src/server/db/database.js, ../../src/server/runs/recorder.js |
| `test/unit/historical-usage.test.ts` | 394 | Simulate a terminal row written before the terminal-usage fix: terminal, spend still NULL. | ../../src/server/app.js, ../../src/server/config.js, ../../src/server/db/database.js, ../../src/server/pipeline/run.js |
| `test/unit/http-attempt-hooks.test.ts` | 56 | (no extractable prose in first 64 KiB) | ../../src/server/llm/client, vitest |
| `test/unit/key-ingress.test.ts` | 62 | (no extractable prose in first 64 KiB) | ../../src/server/config.js, ../../src/server/security/keys.js, node:fs, node:os |
| `test/unit/learning-approval.test.ts` | 106 | (no extractable prose in first 64 KiB) | ../../src/server/db/database.js, ../../src/server/learning/index.js, vitest |
| `test/unit/learning-candidates.test.ts` | 140 | (no extractable prose in first 64 KiB) | ../../src/server/db/database.js, ../../src/server/learning/index.js, vitest |
| `test/unit/learning-cli.test.ts` | 61 | (no extractable prose in first 64 KiB) | ../../src/server/db/database.js, node:child_process, node:fs, node:os |
| `test/unit/learning-consent-trace.test.ts` | 175 | (no extractable prose in first 64 KiB) | ../../src/server/db/database.js, ../../src/server/learning/index.js, node:fs, node:os |
| `test/unit/learning-mining-repair-guard.test.ts` | 165 | (no extractable prose in first 64 KiB) | ../../src/server/db/database.js, ../../src/server/learning/index.js, vitest |
| `test/unit/learning-overview.test.ts` | 52 | (no extractable prose in first 64 KiB) | ../../src/server/db/database.js, ../../src/server/learning/consent.js, ../../src/server/learning/overview.js, vitest |
| `test/unit/learning-pool.test.ts` | 117 | (no extractable prose in first 64 KiB) | ../../src/server/db/database.js, ../../src/server/learning/index.js, node:fs, node:os |
| `test/unit/learning-promotion.test.ts` | 229 | (no extractable prose in first 64 KiB) | ../../src/server/db/database.js, ../../src/server/learning/index.js, node:fs, node:os |
| `test/unit/learning-stats.test.ts` | 201 | (no extractable prose in first 64 KiB) | ../../src/server/learning/contracts.js, ../../src/server/learning/index.js, ../../src/shared/types.js, vitest |
| `test/unit/llm-budget-repair.test.ts` | 54 | (no extractable prose in first 64 KiB) | ../../src/server/llm/client, vitest, zod |
| `test/unit/llm.client.test.ts` | 412 | (no extractable prose in first 64 KiB) | ../../src/server/llm/client.js, node:http, node:net, vitest |
| `test/unit/logic-budget-policy.test.ts` | 101 | (no extractable prose in first 64 KiB) | ../../src/server/logic/budget-policy, vitest |
| `test/unit/logic-core.test.ts` | 233 | (no extractable prose in first 64 KiB) | ../../src/server/config, ../../src/server/db/database, ../../src/server/logic/run-state, ../../src/server/runs/budget |
| `test/unit/logic-gate-decision.test.ts` | 173 | (no extractable prose in first 64 KiB) | ../../src/server/logic/gate-decision, vitest |
| `test/unit/logic-repair-plan.test.ts` | 151 | (no extractable prose in first 64 KiB) | ../../src/server/logic/repair-plan, vitest |
| `test/unit/logic-run-state.test.ts` | 137 | (no extractable prose in first 64 KiB) | ../../src/server/logic/run-state, ../../src/shared/types, vitest |
| `test/unit/openapi-schema.test.ts` | 55 | (no extractable prose in first 64 KiB) | ../../src/server/app, ../../src/server/config, ../../src/server/verify/openapi-schema, vitest |
| `test/unit/p0-truth.test.ts` | 176 | (no extractable prose in first 64 KiB) | ../../src/server/db/database.js, ../../src/server/pipeline/run.js, ../../src/server/runs/manager.js, ../../src/server/runs/recorder.js |
| `test/unit/patch.test.ts` | 142 | (no extractable prose in first 64 KiB) | ../../src/server/pipeline/patch.js, node:crypto, node:fs, node:os |
| `test/unit/prompt-analysis.test.ts` | 91 | (no extractable prose in first 64 KiB) | ../../src/shared/prompt-analysis.js, vitest |
| `test/unit/prompt-envelope.test.ts` | 40 | (no extractable prose in first 64 KiB) | ../../src/server/agents/prompts.js, ../../src/server/agents/registry.js, vitest |
| `test/unit/publish.test.ts` | 77 | (no extractable prose in first 64 KiB) | ../../src/server/runs/publish.js, node:fs, node:os, node:path |
| `test/unit/quality.test.ts` | 150 | (no extractable prose in first 64 KiB) | ../../src/server/quality/confidence, ../../src/server/quality/rvs, ../../src/shared/algorithms, vitest |
| `test/unit/repair.test.ts` | 106 | (no extractable prose in first 64 KiB) | ../../src/server/repair/triage, ../../src/shared/algorithms, vitest |
| `test/unit/resume-run.test.ts` | 126 | (no extractable prose in first 64 KiB) | ../../src/server/app.js, ../../src/server/config.js, ../../src/server/db/database.js, ../../src/server/pipeline/run.js |
| `test/unit/retry.test.ts` | 130 | (no extractable prose in first 64 KiB) | ../../src/server/retry/allocator, ../../src/shared/algorithms, vitest |
| `test/unit/review-coverage.test.ts` | 135 | (no extractable prose in first 64 KiB) | ../../src/server/db/database.js, ../../src/server/pipeline/run.js, ../../src/server/runs/recorder.js, ../../src/shared/types.js |
| `test/unit/route-candidate-backfill.test.ts` | 52 | (no extractable prose in first 64 KiB) | ../../src/server/db/database.js, ../../src/server/runs/recorder.js, vitest |
| `test/unit/routing-reason.test.ts` | 112 | (no extractable prose in first 64 KiB) | ../../src/server/app.js, ../../src/server/config.js, ../../src/server/db/database.js, ../../src/server/runs/recorder.js |
| `test/unit/routing.test.ts` | 306 | (no extractable prose in first 64 KiB) | ../../src/server/agents/registry, ../../src/server/routing/ccr, ../../src/shared/algorithms, vitest |
| `test/unit/run-events-selection.test.ts` | 55 | (no extractable prose in first 64 KiB) | ../../src/shared/run-events.js, vitest |
| `test/unit/run-search.test.ts` | 87 | (no extractable prose in first 64 KiB) | ../../src/server/db/database.js, ../../src/server/search/run-search.js, node:fs, node:os |
| `test/unit/run-timeout.test.ts` | 47 | (no extractable prose in first 64 KiB) | ../../src/server/config.js, ../../src/server/db/database.js, ../../src/server/runs/manager.js, ../../src/server/runs/recorder.js |
| `test/unit/run-transition-guard.test.ts` | 72 | (no extractable prose in first 64 KiB) | ../../src/server/db/database.js, ../../src/server/runs/recorder.js, vitest |
| `test/unit/runs-list-api.test.ts` | 36 | (no extractable prose in first 64 KiB) | ../../src/server/app.js, ../../src/server/config.js, ../../src/server/db/database.js, vitest |
| `test/unit/scorecards.test.ts` | 142 | (no extractable prose in first 64 KiB) | ../../src/server/analysis/scorecards, vitest |
| `test/unit/scripts-agents.test.ts` | 52 | (no extractable prose in first 64 KiB) | node:child_process, node:fs, node:os, node:path |
| `test/unit/scripts-api.test.ts` | 84 | (no extractable prose in first 64 KiB) | ../../src/server/app.js, ../../src/server/config.js, ../../src/server/db/database.js, vitest |
| `test/unit/snapshot-limits.test.ts` | 96 | (no extractable prose in first 64 KiB) | ../../src/server/app.js, ../../src/server/config.js, ../../src/server/db/database.js, ../../src/server/runs/recorder.js |
| `test/unit/sql-static.test.ts` | 54 | (no extractable prose in first 64 KiB) | ../../src/server/verify/syntax.js, vitest |
| `test/unit/startup-interrupt.test.ts` | 115 | (no extractable prose in first 64 KiB) | ../../src/server/config.js, ../../src/server/db/database.js, ../../src/server/runs/budget.js, ../../src/server/runs/manager.js |
| `test/unit/stats-truth.test.ts` | 60 | (no extractable prose in first 64 KiB) | ../../src/server/app.js, ../../src/server/config.js, ../../src/server/db/database.js, ../../src/server/runs/recorder.js |
| `test/unit/stub-scan.test.ts` | 32 | (no extractable prose in first 64 KiB) | ../../src/server/verify/stub-scan.js, vitest |
| `test/unit/terminal-error-code.test.ts` | 64 | (no extractable prose in first 64 KiB) | ../../src/server/config.js, ../../src/server/db/database.js, ../../src/server/llm/client.js, ../../src/server/runs/manager.js |
| `test/unit/terminal-usage.test.ts` | 212 | (no extractable prose in first 64 KiB) | ../../src/server/app.js, ../../src/server/config.js, ../../src/server/db/database.js, ../../src/server/pipeline/run.js |
| `test/unit/terminal-writers.test.ts` | 199 | (no extractable prose in first 64 KiB) | ../../src/server/app.js, ../../src/server/config.js, ../../src/server/db/database.js, ../../src/server/learning/trace-store.js |
| `test/unit/trace-fixes.test.ts` | 169 | (no extractable prose in first 64 KiB) | ../../src/server/app.js, ../../src/server/config.js, ../../src/server/db/database.js, ../../src/server/pipeline/run.js |
| `test/unit/writer-matrix.test.ts` | 546 | Every captured persisted edge must be legal; a terminal write must close at phase done. | ../../src/server/config.js, ../../src/server/db/database.js, ../../src/server/logic/run-state.js, ../../src/server/pipeline/run.js |