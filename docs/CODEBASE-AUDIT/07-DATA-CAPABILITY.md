# 07 — Data, routes, capabilities, and truth boundaries

Generated from source and read-only live `data/hive.db` at the time of the audit. No database write was made.

## Count reconciliation

| Item | Count | Meaning |
|---|---:|---|
| Tracked files | 1,367 | `git ls-files`; manifest row count matches |
| App table declarations | 51 | `CREATE TABLE` in `src/server/db/migrations.ts`; stage allowlist 51 |
| Live SQLite tables | 57 | 51 app tables + 6 FTS5 shadow tables for `run_search_fts` |
| Route handler registrations | 57 | `app.get/post/put/patch/delete` in `src/server/app.ts` |
| Unique API path strings | 53 | 57 registrations collapse to 53 paths (4 paths have two methods) |
| SPA paths | 9 | `/agents`, `/chat`, `/runs`, `/runs/:runId`, `/analysis`, `/scripts`, `/vault`, `/settings`, `/learning` |
| Stage route strings | 62 | 53 unique API paths + 9 SPA paths |
| UI routes | 10 | 9 SPA paths + `/` |
| Agent registry | 37 | 28 `files`, 4 `plan`, 3 `review`, 1 `tests`, 1 `text` |
| Scripts | 16 tracked | `scripts/`; 20 package scripts |
| Tests | 75 tracked | 72 unit + 2 root integration + 1 fixture |
| E2E | 8 specs | Playwright; 44 tests at Wave 17 checkpoint |

The stage route count is **not** a count of HTTP handlers. It is the unique route-string census from the stage scanner: 53 API paths + 9 SPA paths. The 57 handler registrations include four paths with two methods each.

## Application tables (51 declared)

**Core A (16):** `schema_migrations`, `runs`, `steps`, `events`, `artifacts`, `reviews`, `checks`, `usage`, `settings`, `run_snapshots`, `prompt_versions`, `policy_versions`, `budget_reservations`, `gate_decisions`, `idempotency_keys`, `agent_evidence`.

**B1 routing/context/quality (11):** `route_decisions`, `route_candidates`, `agent_stats`, `context_packs`, `context_manifests`, `failure_signatures`, `failure_occurrences`, `verification_plans`, `confidence_records`, `retry_attempts`, `script_runs`.

**B2 learning (18):** `consent_records`, `traces`, `repair_memory`, `variants`, `sealed_pool_blocks`, `sealed_pool`, `eval_suites`, `eval_cases`, `suite_uses`, `eval_runs`, `eval_results`, `approval_tokens`, `promotions`, `post_promotion_monitor`, `learning_jobs`, `learning_audit`, `feedback`, `user_edits`.

**Chat (4):** `chat_threads`, `chat_messages`, `chat_jobs`, `chat_events`.

**Search (2):** `run_search_docs`, `run_search_index`; `run_search_fts` is the FTS5 virtual table and creates six shadow tables.

Foreign-key truth: `runs.parent_run_id` references `runs.id`; child run/step/event/artifact/check/usage/review/chat rows cascade from their owners. Search index rows are derived and deliberately do not cascade from `runs` (cleanup remains a documented P2-5 item).

## Live read-only census

| Table / fact | Count |
|---|---:|
| `runs` | 30 |
| `steps` | 248 |
| `events` | 1,394 |
| `artifacts` | 132 |
| `usage` rows | 239 |
| `run_snapshots` | 30 |
| `idempotency_keys` | 30 |
| `route_decisions` / `route_candidates` | 162 / 440 |
| `context_packs` | 147 |
| `confidence_records` | 13 |
| `traces` | 21 |
| `prompt_versions` / `policy_versions` | 74 / 10 |
| `chat_threads` / `chat_messages` / `chat_jobs` / `chat_events` | 45 / 16 / 10 / 106 |
| Terminal runs with NULL spend | 8 |
| `eval_runs` / `eval_results` / `promotions` / `approval_tokens` | 0 / 0 / 0 / 0 |

The 8 terminal NULL-spend rows are historical truth, not errors to backfill. Seven have measured `usage` rows; one completed run (`run_3a4578fa7b6ffebae1`) has no usage rows and therefore remains genuinely unknown. `runs` counts include 23 completed, 4 budget-exceeded, 3 failed.

## Capability truth matrix

| Capability | State | Evidence |
|---|---|---|
| Bounded file generation | Works | pipeline + registry; 37 personas; no tools |
| Deterministic routing | Works/partial | CCR DP and route rows; binary critical path/weighted CPM remain partial |
| Context packing | Works/partial | CPO 1-token units, 200-iteration PageRank; full projection provenance partial |
| Static verification | Works/partial | RVS, TS/JS transpile, Python AST, JSON/YAML/HTML, SQL shape checks; no execution |
| Review gate | Works | critical findings fail; `reviewedFiles` coverage; review rows |
| Staged failure retention | Works | `artifacts.status='staged'`, staging/publish boundary |
| Atomic publish | Works | publish/rollback path, DB/vault failure handling |
| Staged-file resume | Works | no provider call; no full mid-run checkpoints |
| Run ledger/events/SSE | Works | run/steps/events/snapshots; persisted replay |
| FTS5 run search | Works | terminal workspace only; derived index; no path supplied |
| Chat jobs/leases/SSE | Works | durable tables, worker, retries, cancellation, fan-out cap 3 |
| Analysis API/UI | Works as pure static tools | dominators/scorecards; no file read, no model |
| Scripts catalog/dry-run | Works read-only | 6 read-only dry-runs; paid/write entries disabled |
| Vault | Works | tree/file preview, path-safe |
| Local key ingress | Works | env/app-secret only; no HTTP key route; DSH not read |
| Repository read/search tools | **Absent** | no tool registry; agents cannot read source |
| Autonomous tool loop | **Absent** | `llm/client.ts` rejects tool calls; one-shot prompts |
| Execute generated code/tests | **Absent** | explicit non-goal; static only |
| Approval / `needs_review` producer | **Absent** | status exists; no producer/decision flow |
| Full checkpoints | **Absent** | staged resume only |
| Parallel generation | **Absent** | one active run |
| Patch/compaction/branch wiring | **Module only** | modules/tests exist; not wired into product routes/UI |
| Weighted CPM/full context projection | **Partial** | binary criticality; incomplete provenance |
| P7 evaluator/promotion | **Unreachable** | no evaluator; no pool/consent; promotion refused |
| Native GUI/CUA | **Absent** | no browser driver; CUA is external test tooling, not app capability |
| MCP/tool runtime | **Absent** | no MCP client/server |
| Multi-user/cloud | **Absent** | local single-user process |

## Data lineage and invariants

1. **Run truth:** browser → `POST /api/runs` → idempotency row → run row/snapshot → manager/pipeline → steps/events/artifacts/checks/usage → terminal status + `runs` aggregate → snapshot/list/stats → UI.
2. **Terminal truth:** terminal status and phase `done` are one close; unknown spend stays NULL; measured usage is the per-call ledger; `/api/stats` distinguishes unaccounted run/chat spend and returns NULL totals while measured sums remain visible.
3. **Artifact truth:** accepted artifacts only after atomic publish; failed/staged work is retained under `staged/` and is never presented as accepted.
4. **Idempotency truth:** paid/destructive requests require a key; same key + same body replays; different body refuses. Thread creation remains non-idempotent (documented residual).
5. **Derived data:** FTS5 search index, agent badges, and stats projections are derived; they never become the source of truth for run/publication.
6. **Learning truth:** evaluator absent; promotion structurally unreachable; no live promotion claim.
7. **Secrets truth:** provider key is server-side only; UI displays configured/fingerprint, never key material; DSH is not read at runtime.

## Open capability/data gaps

- P1-2 repository tools and P1-1 external index remain absent.
- P1-3 tool loop, P1-5 approval, P1-6 checkpoints, P1-7 parallel generation, P1-8 module wiring, P1-9 weighted CPM remain open.
- No paid live provider call; no generated-code execution; no native CUA.
