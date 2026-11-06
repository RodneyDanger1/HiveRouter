# HiveRouter architecture

## What it is

HiveRouter is a single-user, local TypeScript/Node application that turns a bounded project brief into a file tree, then statically verifies that tree. It is **not** a general agent runtime, code executor, browser controller, or native application packager.

The central design choice is deterministic control: the pipeline, router, gate, budget ledger, and terminal state machine are explicit code. Model calls are treated as untrusted proposal generators.

## Process and trust boundaries

```
Browser (React 19, served by Fastify)
  │  same-origin HTTP + SSE; no provider key
  ▼
Fastify app / API routes
  │  validation, refusals, CSRF/origin, path safety
  ▼
Run manager ── snapshot / run row / budget reservations
  │
  ▼
Staged pipeline
  plan → route → context → generate → clean → harden → test
       → verify → repair (bounded) → finalize
  │
  ├── DeepSeek Chat Completions (server-side key)
  ├── node:sqlite WAL (runs, steps, events, artifacts, checks, usage, P7 tables, chat)
  ├── run workspace (staging + published tree)
  └── vault (markdown reports/logs)
```

Trust boundaries:

- Browser input is untrusted; provider credentials never reach it.
- Generated files are untrusted data; static checkers inspect them without executing them.
- Reviewer findings are untrusted until their file path is grounded in the planned set.
- Provider usage is measured; unknown usage is NULL, never zero.
- The only file system roots are the run workspace, vault, and configured data directory; path resolution rejects traversal, symlinks/junctions, reserved names, and unsupported extensions.

## Run lifecycle

1. `POST /api/runs` validates the idempotency key, preset/model/thinking/effort, budget cap, and (for audit/revise) a terminal parent with accepted artifacts.
2. `createRun` writes a run row and snapshot, and enforces one active run.
3. The executor starts the staged pipeline under a wall-clock abort signal.
4. `finalize` builds a complete publish tree beside the live workspace and swaps directories atomically. A post-publish DB/vault failure rolls the tree back.
5. Terminal status is written with a CAS status guard. Terminal runs cannot be downgraded by a stale writer.

### Phase/status truth

`docs/PLAN-v3` and `src/server/logic/run-state.ts` are the state-machine source of truth. The wrapper `updateRun` validates non-terminal phase writes against the matrix; terminal writes are allowed to close from any phase. The real writer shapes include `intake→planning` (full build), `intake→cleaning` (review/revise), `intake→generating` (adhoc), and `planning→finalizing` (blueprint).

## Agent model

There are 37 registry entries. Each is a prompt persona with:

- a stable id and group;
- `outputKind` (`plan`, `files`, `review`, `tests`, `text`);
- write/review/test flags used by the pipeline;
- language and path globs used by routing;
- a static prior.

An agent call is one DeepSeek request. There is **no tool registry, no tool loop, no file-reading tool, no shell, and no memory** inside the generation path. The router chooses a persona; it does not grant capabilities.

## Router and context

- CCR builds a task DAG, filters candidates by language/path/risk/capability, scores cost/latency/quality/risk, and selects a budget-feasible combination with a deterministic DP.
- CPO packs mandatory context and optional graph-ranked material under a token budget.
- Current caveats: critical path is still binary; the context packer uses 1-token units/CJK-aware estimates but does not yet implement weighted CPM; some budget/projection fields remain approximate. These are tracked in `docs/STOP-WORK-FLAWS.md`.

## Verification and the review gate

Static checks: planned-path coverage, path safety, secret scan, stub scan, Python AST, TypeScript/JavaScript transpile diagnostics, JSON, YAML, HTML parse, and **non-executing SQL shape checks**.

SQL is never run by the verifier. SELECT/EXPLAIN/VALUES are a static shape check; WITH/DDL/DML/multi-statement scripts are reported `unverified`; ATTACH/DETACH/PRAGMA/load_extension are refused.

Cleaner/sentinel reviews are persisted in `reviews`. A critical finding that resolves to a planned path fails the gate with `REVIEW_CRITICAL`/`REVIEW_UNGROUNDED`; non-critical changes-required findings remain warnings. The existing repair loop re-runs verification after bounded repair.

## Artifacts and failure retention

- Accepted artifacts are written after a successful whole-tree publish.
- A failed/cancelled/timed-out run copies its staged tree under `workspace/runs/<id>/staged/` and records `artifacts.status='staged'`. These are retained evidence, not accepted output.
- Downloading a failed run includes staged files; revision/audit requires accepted artifacts only.

## Spend, usage, and traces

- Per-HTTP attempt reservations are opened/committed/released in micro-USD.
- Unknown provider usage commits the reservation and is recorded as `source='unknown'`; run totals are NULL when any unknown row exists.
- `GET /api/stats` exposes measured and unknown portions separately, and includes measured chat cost. It never presents unknown usage as zero.
- On a terminal run, a trace row is written through `trace-store`; `trace_complete` is set only when that row exists. Database open reconciles historical flags to physical trace evidence.

## Chat

B2 chat uses durable `chat_threads`, `chat_messages`, `chat_jobs`, and `chat_events`. A leased in-process worker claims jobs, retries with bounded attempts, reaps expired leases, and streams persisted events over SSE. Chat cost is measured separately from run usage. Chat agents are still prompt personas; no tools or code execution.

## P7 learning

The sealed-pool, candidate, approval, promotion, monitor, repair-memory, and guard modules exist. There is **no production evaluator** that writes `eval_runs`/`eval_results`; therefore candidate promotion is structurally unreachable even with data. The honest state is a refusal until operator data and a real evaluator are added.

## Static analysis API

`GET /api/analysis` is a self-description endpoint. `POST /api/analysis/dominators` and `POST /api/analysis/scorecards` are bounded, read-only JSON operations over caller-supplied graphs/scorecards. They do not read files, call a model, execute code, or persist rows. Dominators are a static file-level heuristic, not a CFG; scorecards are opinions and `needsDebate` is a scheduler hint, not a verdict. The routes are also driven by the `/analysis` page in the B2 UI; the page labels the operations as static heuristics/opinions.

## Run workspace search

`POST /api/runs/:id/search` and the run-detail Search tab build a disposable FTS5 trigram index (`run_search_docs` + `run_search_fts`) over the published workspace of one terminal run. The caller never supplies a path. Only known text extensions are indexed; staged files, `RUN_REPORT.md`, `manifest.json`, symlinks, binary files and files over 256 KB are skipped. Queries shorter than a trigram use a bounded `LIKE` fallback. The index is derived data and can be deleted without changing a run; it is not a source-of-truth store.

## Staged-file resume

`POST /api/runs/:id/resume` creates a child run with `runKind='resume'` from a terminal failed/budget-exceeded/cancelled/interrupted parent. The pipeline copies only the parent's retained `staged/` text files, runs the same static verifier, and either publishes the verified tree or retains the child's own staged copy. It makes no provider call and does not mutate the parent. This is **not** a full checkpoint system: there is no mid-run resume from an arbitrary phase.

## Security posture

- Loopback-only default binding.
- No provider key route; key from env/.env.local or `data/secrets`.
- Generated code is never executed.
- Markdown rendering has raw HTML disabled.
- File reads are `text/plain` + `nosniff`; path safety rejects symlinks.
- Scripts API is read-only/dry-run only; it does not execute scripts.
- The desktop launcher is a Chrome app window, not a native executable.

## Known architectural gaps

See `docs/STOP-WORK-FLAWS.md` for the current defect register and status. The largest gaps are no tool loop, no production P7 evaluator, router/context projection truth, and a small set of dead/documented surfaces. Chat idempotency keys are now thread-scoped and body-bound; the remaining chat gap is single-process worker ownership.

## Codebase maps (Wave 18)

- Master map and 11 domain diagrams: `docs/diagrams/index.html`; sources are `.mmd` files in the same folder.
- Exhaustive file manifest: `docs/CODEBASE-AUDIT/FILE-MANIFEST.json`; route/table/capability reconciliation: `docs/CODEBASE-AUDIT/07-DATA-CAPABILITY.md`.
- Live proof and limits: `docs/TRACE/WAVE-18/TRACE-SUMMARY.md`.
- Count reconciliation: 51 app tables + six FTS5 shadow tables = 57 live SQLite tables; 57 route registrations = 53 unique API paths + 9 SPA paths = 62 stage route strings.