# 01 Runtime — src/server + entry points

Generated from the tracked tree and `CODE-INDEX.json`. Every row was read at least at head/target depth; full source path, imports, exports and role evidence are recorded.

## Subsystem map

| Subsystem | Files | Responsibility and key boundaries |
|---|---:|---|
| `agents/` | 5 | Registry (37 personas), prompt contract, hashes, stored prompt overrides, path→engine sources |
| `analysis/` | 3 | Pure static dominators/scorecards plus bounded API adapter; no file read/model call |
| `app.ts` | 1 | Fastify composition root: 57 route registrations, validation/refusals, SSE, static UI |
| `chat/` | 4 | Durable threads/jobs/events, leased worker, one provider call per job, SSE projections |
| `config.ts`, `env.ts`, `index.ts` | 3 | Environment/config, required phase, process startup/shutdown |
| `context/` | 2 | CPO packer and conversational compaction module (compaction not wired to product) |
| `db/` | 2 | `node:sqlite` WAL setup, 51 app tables + FTS5, migrations, reconciliation |
| `git/` | 1 | Metadata-only isolation branches for failed patch/gate work (not wired into run pipeline) |
| `learning/` | 16 | Sealed pool/candidates/consent/approval/promotion/monitor/repair-memory/guard; evaluator absent |
| `llm/` | 2 | Direct DeepSeek Chat Completions, timeout/refusal mapping, usage hooks; rejects tool calls |
| `logic/` | 4 | Pure run status/phase matrix, gate-decision precedence, repair planning, budget policy |
| `observability/` | 1 | Redacted structured error log |
| `pipeline/` | 4 | Staged run executor, agent runner/provider boundary, server-side patch module (not wired) |
| `prompt/` | 1 | Prompt analyst response contract |
| `quality/` | 3 | RVS verifier scheduler, confidence/CCA, critical-review semantics |
| `repair/` | 1 | Failure triage and bounded repair planning |
| `retry/` | 1 | Retry allocator/CRA static policies |
| `routing/` | 1 | CCR deterministic DAG/budget router |
| `runs/` | 6 | Run manager, recorder, budget, snapshot, atomic publish, terminal trace |
| `search/` | 1 | Derived FTS5 index over one terminal run workspace |
| `security/` | 3 | Path safety, secret redaction, app-secret/key ingress |
| `verify/` | 5 | Static verifier, syntax checks, secret/stub scan, OpenAPI schema parity |

| File | Lines | Role / first evidence | Imports (selected) |
|---|---:|---|---|
| `src/server/agents/hash.ts` | 101 | * Hash a UTF-8 string with SHA-256 and return lowercase hex (64 chars). |  |
| `src/server/agents/overrides.ts` | 41 | (no extractable prose in first 64 KiB) | ../db/database.js |
| `src/server/agents/prompts.ts` | 163 | Fixed boundary; buildSystemPrompt is idempotent around this token. | ../../shared/types.js, ./hash.js |
| `src/server/agents/registry.ts` | 888 | .py', '* | ../../shared/algorithms.js, ../../shared/types.js, ../config.js, ./hash.js |
| `src/server/agents/sources.ts` | 60 | (no extractable prose in first 64 KiB) | ../../shared/types |
| `src/server/analysis/api.ts` | 94 | (no extractable prose in first 64 KiB) | ./dominators.js, ./scorecards.js |
| `src/server/analysis/dominators.ts` | 258 | The depending file. |  |
| `src/server/analysis/scorecards.ts` | 164 | Integer 1..5. |  |
| `src/server/app.ts` | 1424 | (no extractable prose in first 64 KiB) | ../shared/features.js, ../shared/refusals.js, ../shared/types.js, ./agents/overrides.js |
| `src/server/chat/events.ts` | 84 | Insert one durable projection event inside an existing transaction. | ../../shared/chat.js, ../db/database.js, ../security/redact.js, node:crypto |
| `src/server/chat/generate.ts` | 145 | * One real provider call for a durable chat job. Budget reservations are scoped * to the cycle ledger and settled on every HTTP attempt; a failed provider call * never leaves a reservation held. | ../agents/prompts.js, ../agents/registry.js, ../config.js, ../db/database.js |
| `src/server/chat/store.ts` | 827 | Events are replayed newest-window-first only when the cursor exceeds the window. | ../../shared/chat.js, ../agents/registry.js, ../config.js, ../db/database.js |
| `src/server/chat/worker.ts` | 174 | Start the one in-process worker. Startup reaps expired leases first. | ../../shared/chat.js, ../config.js, ./generate.js, ./store.js |
| `src/server/config.ts` | 98 | (no extractable prose in first 64 KiB) | ../shared/features.js, node:fs, node:path |
| `src/server/context/compaction.ts` | 417 | Maximum successful output length in characters. Default 32,000. | ../../shared/algorithms |
| `src/server/context/packer.ts` | 262 | (no extractable prose in first 64 KiB) | ../../shared/algorithms |
| `src/server/db/database.ts` | 156 | (no extractable prose in first 64 KiB) | ../../shared/features.js, ../config.js, ./migrations.js, node:fs |
| `src/server/db/migrations.ts` | 695 | (no extractable prose in first 64 KiB) |  |
| `src/server/env.ts` | 13 | (no extractable prose in first 64 KiB) | node:fs, node:path |
| `src/server/git/branches.ts` | 293 | Optional failed-patch commit. Must already exist in the run workspace. | ../../shared/types.js, node:child_process, node:fs, node:path |
| `src/server/index.ts` | 77 | (no extractable prose in first 64 KiB) | ../shared/features.js, ./app.js, ./chat/worker.js, ./config.js |
| `src/server/learning/approval.ts` | 225 | (no extractable prose in first 64 KiB) | ../config.js, ../db/database.js, ../security/redact.js, ./errors.js |
| `src/server/learning/candidates.ts` | 307 | (no extractable prose in first 64 KiB) | ../db/database.js, ../security/redact.js, ./contracts.js, ./errors.js |
| `src/server/learning/consent.ts` | 129 | (no extractable prose in first 64 KiB) | ../db/database.js, ./contracts.js, ./errors.js, node:crypto |
| `src/server/learning/contracts.ts` | 141 | (no extractable prose in first 64 KiB) | ../../shared/types.js, zod |
| `src/server/learning/errors.ts` | 27 | (no extractable prose in first 64 KiB) | ../../shared/refusals.js |
| `src/server/learning/guard.ts` | 84 | (no extractable prose in first 64 KiB) | ../../shared/refusals.js, zod |
| `src/server/learning/index.ts` | 16 | (no extractable prose in first 64 KiB) | ./approval.js, ./candidates.js, ./consent.js, ./contracts.js |
| `src/server/learning/metric.ts` | 50 | * The only P7 primary metric. Gate pass is deterministic: * all mandatory checks pass, no critical safety finding, every planned file exists, * and syntax explicitly passed. No LLM judge, no inference from prose. | ../../shared/types.js |
| `src/server/learning/mining.ts` | 129 | (no extractable prose in first 64 KiB) | ./contracts.js, ./signatures.js, ./trace-store.js, node:sqlite |
| `src/server/learning/overview.ts` | 99 | * The UI must not treat an incomplete block, a revoked consent, or an * unrelated consent scope as readiness. This is derived from the same * complete-block/active-consent rules the evaluation services enforce. | ./consent.js, ./contracts.js, node:sqlite |
| `src/server/learning/promotion.ts` | 836 | (no extractable prose in first 64 KiB) | ../../shared/refusals.js, ../db/database.js, ../security/redact.js, ./approval.js |
| `src/server/learning/repair-memory.ts` | 183 | (no extractable prose in first 64 KiB) | ../db/database.js, ../security/redact.js, ./errors.js, node:crypto |
| `src/server/learning/sealed-pool.ts` | 524 | (no extractable prose in first 64 KiB) | ../config.js, ../db/database.js, ../security/redact.js, ./consent.js |
| `src/server/learning/signatures.ts` | 80 | (no extractable prose in first 64 KiB) | node:crypto |
| `src/server/learning/stats.ts` | 151 | Two-sided exact McNemar p-value on the discordant counts. | ./contracts.js |
| `src/server/learning/trace-store.ts` | 334 | (no extractable prose in first 64 KiB) | ../../shared/types.js, ../config.js, ../db/database.js, ../security/redact.js |
| `src/server/llm/client.ts` | 1023 | Backwards-compatible name used by the first scaffold. | ../../shared/types.js, ../config.js, ../security/keys.js, ../security/redact.js |
| `src/server/llm/index.ts` | 8 | * Filename: src/server/llm/index.ts * Dependencies: ./client.js * Run: imported by server modules | ./client.js |
| `src/server/logic/budget-policy.ts` | 253 | * Commit a reservation. `actualMicroUsd === null` means the provider did not * report usage: hold the reserved amount and mark it unknown, not zero. | ../../shared/refusals, zod |
| `src/server/logic/gate-decision.ts` | 371 | * Compute one gate decision. Input is parsed by Zod at the boundary; every * branch is deterministic and total for valid inputs. | ../../shared/refusals, ../../shared/types, node:crypto, zod |
| `src/server/logic/repair-plan.ts` | 251 | Lexical only: no filesystem access, no symlink check. | ../../shared/refusals, node:crypto, zod |
| `src/server/logic/run-state.ts` | 215 | A same-value transition is the idempotent no-op; terminal states may not move elsewhere. | ../../shared/refusals, ../../shared/types, zod |
| `src/server/observability/error-log.ts` | 85 | Append one redacted structured error record to the durable error log. | ../config.js, ../security/redact.js, node:fs, node:path |
| `src/server/pipeline/agent-runner.ts` | 232 | (no extractable prose in first 64 KiB) | ../../shared/types.js, ../agents/prompts.js, ../agents/registry.js, ../llm/client.js |
| `src/server/pipeline/features.ts` | 56 | P6a: CCR/route_decisions/route_candidates. | ../../shared/features.js |
| `src/server/pipeline/patch.ts` | 284 | Approximate changed-node count by comparing leaf/leaf-token nodes in AST order. | node:crypto, node:fs, node:path, typescript |
| `src/server/pipeline/run.ts` | 1276 | * Preserve what the user paid for when a run does not publish. These rows are * explicitly `staged`, live under workspace/staged, and are never presented as * accepted artifacts. | ../../shared/algorithms.js, ../../shared/refusals.js, ../../shared/types.js, ../agents/prompts.js |
| `src/server/prompt/analyst.ts` | 107 | (no extractable prose in first 64 KiB) | ../../shared/prompt-analysis.js, ../../shared/types.js, ../llm/client.js |
| `src/server/quality/confidence.ts` | 99 | (no extractable prose in first 64 KiB) | ../../shared/algorithms |
| `src/server/quality/rvs.ts` | 208 | (no extractable prose in first 64 KiB) | ../../shared/algorithms |
| `src/server/quality/scheduler.ts` | 15 | * RVS module alias. * * The algorithm is implemented in ./rvs.ts; this file keeps the conventional * verify/scheduler import name available without creating a second behavior. | ./rvs |
| `src/server/repair/triage.ts` | 256 | (no extractable prose in first 64 KiB) | ../../shared/algorithms |
| `src/server/retry/allocator.ts` | 225 | (no extractable prose in first 64 KiB) | ../../shared/algorithms |
| `src/server/routing/ccr.ts` | 602 | (no extractable prose in first 64 KiB) | ../../shared/algorithms |
| `src/server/runs/budget.ts` | 144 | * The effective per-run budget in USD. Routing must use this, not the global * MAX_RUN_COST_USD, or it can allocate a plan the run cannot afford before the * first provider call. | ../config.js, ../db/database.js |
| `src/server/runs/manager.ts` | 312 | (no extractable prose in first 64 KiB) | ../../shared/refusals.js, ../../shared/types.js, ../agents/registry.js, ../config.js |
| `src/server/runs/publish.ts` | 86 | Undo a published tree after a post-publish DB/vault failure. | node:fs, node:path |
| `src/server/runs/recorder.ts` | 499 | Number of this run's events after the cursor (the run's own rows, not the global seq space). | ../../shared/types.js, ../config.js, ../db/database.js, ../logic/run-state.js |
| `src/server/runs/snapshot.ts` | 99 | (no extractable prose in first 64 KiB) | ../../shared/types.js, ../agents/overrides.js, ../agents/prompts.js, ../agents/registry.js |
| `src/server/runs/terminal-trace.ts` | 54 | (no extractable prose in first 64 KiB) | ../../shared/features.js, ../config.js, ../db/database.js, ../learning/trace-store.js |
| `src/server/search/run-search.ts` | 225 | (no extractable prose in first 64 KiB) | ../db/database.js, ../security/paths.js, node:crypto, node:fs |
| `src/server/security/keys.ts` | 106 | (no extractable prose in first 64 KiB) | ../config.js, ./redact.js, node:crypto, node:fs |
| `src/server/security/paths.ts` | 112 | (no extractable prose in first 64 KiB) | node:crypto, node:fs, node:path |
| `src/server/security/redact.ts` | 61 | (no extractable prose in first 64 KiB) | node:crypto |
| `src/server/verify/openapi-schema.ts` | 164 | Binary/text routes are not JSON; they still get a typed response schema. |  |
| `src/server/verify/secret-scan.ts` | 21 | (no extractable prose in first 64 KiB) | ../security/redact.js |
| `src/server/verify/stub-scan.ts` | 72 | (no extractable prose in first 64 KiB) | ../security/paths.js, node:fs, node:path |
| `src/server/verify/syntax.ts` | 257 | * Minimal environment for the Python AST checker. Never forward provider * credentials (DEEPSEEK_API_KEY, OPENROUTER_API_KEY, AWS/GitHub tokens) or * arbitrary PYTHONPATH injection into a child process. | ../security/paths.js, node:child_process, node:fs, node:path |
| `src/server/verify/verifier.ts` | 161 | (no extractable prose in first 64 KiB) | ../../shared/types.js, ../security/paths.js, ./secret-scan.js, ./stub-scan.js |