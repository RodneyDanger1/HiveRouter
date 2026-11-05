# HiveRouter

**HiveRouter is a local, standalone AI agent coding router.** It turns a project brief into a routed build: an architect plans the file matrix, a capability-constrained router picks the right specialist for every file, code engines generate the implementation, cleaner/sentinel/watchman review and repair it, the gatekeeper writes tests, and a deterministic verifier gates the result. The whole run streams to a React UI with artifacts, checks, routing decisions, context packs, confidence, cost, and a manifest.

It is **not** built on DeepSeek Desktop Harness. HiveRouter is its own TypeScript/Node application and calls the DeepSeek Chat Completions API directly. DSH is only the development environment and the original source of the key; the app has no DSH runtime dependency.

## Stack

- Node.js **26.7.0**, TypeScript **5.9.3**
- Fastify **5.12.8** + `node:sqlite` (WAL) backend
- React **19.3.1**, Vite **8.3.5**, Tailwind CSS **4.3.4**
- LangGraph.js **1.6.0** packages installed for future graph work; the live pipeline is a handwritten staged orchestrator
- Direct `fetch` DeepSeek client (no OpenAI SDK)
- 37-agent registry, P6a deterministic decision intelligence, P7 learning modules

## Quickstart

```cmd
cd /d C:\Users\Riley\Desktop\HiveRouter
npm.cmd ci
:: put DEEPSEEK_API_KEY=sk-... in .env.local (never commit it)
:: or import it once into the app-secret store:
:: npm.cmd run key:import -- --file C:\path\to\key.txt
npm.cmd run build
npm.cmd start
```

Open **http://127.0.0.1:8787**.

**Desktop app window:** double-click **`HiveRouter.lnk` on the Desktop**. It starts the server if it is not already healthy, then opens a dedicated Chrome app window (no browser tabs/address bar) sized to the primary screen. The profile is `data/browser-profile`, so window sizing and the composer draft persist across launches. The SQLite database (`data/hive.db`), run workspaces (`workspace/runs/`) and vault (`vault/`) also persist across restarts; startup marks interrupted runs and releases their budget leases.

The server binds loopback only. `npm.cmd run dev` runs Vite on 5173 and Fastify on 8787 with an API proxy.

## Key handling

The app resolves the DeepSeek key from, in order:

1. `DEEPSEEK_API_KEY` in the process environment (including `.env.local`, loaded at boot)
2. `data/secrets/deepseek.json` written by the local import path (0600)

No HTTP route accepts or returns a provider key. The UI only shows `configured`, `source`, and a SHA-256 fingerprint prefix. DSH is **not** read at runtime.

## What works

- **Full build**: plan → route → generate → clean → harden → test → verify → finalize.
- **Blueprint**: architecture document only.
- **Revision**: child run from accepted files with human feedback; parent is immutable.
- **Audit**: cleaner/sentinel/gatekeeper review of accepted files; no regeneration of the original brief.
- **Ad-hoc agent run**: a single selected agent can run live against an explicit target (live-only; mock mode refuses by name).
- **Truthful terminal/event telemetry**: terminal runs aggregate measured usage (failed/budget/cancelled/interrupted), the live event vocabulary matches the server, terminal Events tabs use the persisted ledger, run caps come from the per-run limit, context exclusions are surfaced, check rows have stable identities, and provider error identity is preserved.
- **Guarded run persistence**: status writes use a compare-and-swap transition guard; terminal runs cannot be downgraded by a stale writer, while legal lifecycle transitions and idempotent same-status writes remain valid. Runs filtering is server-side, including queued/paused/interrupted, and Settings renders the real nested runtime limits.
- **Prompt analyst (chat intent gate)**: a server-side DeepSeek call parses the brief before a run. It separates exact user statements from inferred/unknown details, proposes observable acceptance proof, and refuses an analysis whose "user-stated" quotes are not exact prompt substrings. The UI exposes it in the composer; it never runs code or claims tests passed.
- **Static verification**: path safety, plan coverage, secret scan, stub scan, and language syntax (Python AST, TS/JS/JSX transpile diagnostics, JSON, YAML, SQLite SQL, HTML). Unsupported languages are labeled unverified, never passed.
- **CCR routing**: capability filters, static priors, cost/latency/risk utility, micro-USD DP budget allocation, fallback/refusal, seeded deterministic ties.
- **CPO context packs**: PageRank over the file graph, mandatory/optional token-budgeted packing, stable prefix hashes.
- **RVS / CCA**: verification plan persisted, conservative confidence/abstention record; mandatory failures can never be accepted.
- **Repair loop**: Watchman attempts a bounded repair (max 2) with full re-verification and signature-stall detection.
- **Vault**: Obsidian-compatible markdown logs, blueprints, manifests, `.SYSTEM_INDEX.md`.
- **Events/SSE**: replayable event IDs, snapshot fallback, heartbeat, bounded replay window.
- **UI**: Overview, Agents (37), Runs, Run detail (Overview/Files/Checks/Routing/Context/Repairs/Confidence/Events), Vault, Settings, Learning.

## Honest limitations

- **Static verification only.** Generated code and generated tests are **not executed** by the product. No arbitrary shell, no generated-code execution.
- **P7 learning is implemented but currently refused.** The loop, single-use 65-case suites, sealed pool, statistics, approval tokens, promotion/rollback, repair memory, and guard are implemented and unit-tested. This run has **0 complete sealed 65-case blocks and no active case-to-provider consent**, so `/api/learning/overview` reports `E_LEARNING_POOL_EXHAUSTED`, `npm.cmd run learn` exits 6, and the learning HTTP mutation routes refuse from the same state. No promotion is claimed.
- **P7 data is operator-supplied, never seeded.** Use `npm.cmd run learning:admin -- consent status|grant|revoke <scope>` and `npm.cmd run learning:admin -- import-block <blockId> <cases.json>` with a real 65-case block and explicit consent. The server will still require a paired evaluation, a candidate, and a human approval token before promotion.
- **Release stage manifests exist and are strict.** `config/releases/{a,p6a,p7}.json` allowlists are present; `assert-stage --stage=p7` passes with `fallback:false`. The current tree is B2; A/B1 runtime starts were not exercised.
- **Finalize is a whole-tree directory swap with startup recovery.** Files are built in a sibling publish tree, then the old workspace is renamed aside and the complete tree is renamed into place; post-publish DB/vault/status failures restore the prior tree. The swap is not a database transaction, but interrupted renames are recovered at startup.
- **P7 HTTP approval/promotion/rollback** are wired to the approval-token and promotion services; with no sealed pool/paired evaluation they refuse by name. They are not a live promotion service until real data and a human token exist.
- **Wave 6 did not backfill historical rows.** The seven pre-fix failed/budget runs still have NULL cost/tokens; only runs created after the terminal-usage fix aggregate their usage. No paid live run was made during the Wave 6 batch.
- **Desktop launcher is a Chrome app window, not a frameless native executable.** `HiveRouter.lnk` starts the server and opens Chrome with `--app`; it has no tabs or address bar and is sized to the screen, but Windows/Chrome still own the title-bar minimize/maximize/close controls. The layout is verified from 390×844 to 1920×1080 with no page-level horizontal overflow.
- **Preflight port check** uses `--port 0` while the live server is running; the default 8787 check applies when starting a new instance.
- The Vite bundle is a single ~650 KB chunk; functional, not code-split.
- Rust/C++/PowerShell/CMD/Bash/Tailwind/Three.js/HTML are static-only or unverified where no parser is available; the UI says so.
- The DeepSeek API is the only provider; no cloud DB, no multi-user auth, no MCP server, no fine-tuning.

## TestDrive

A live GUI+backend test drive is recorded in `docs/TESTDRIVE/`. The durable skill is:

- `C:\Users\Riley\.agents\skills\testdrive\SKILL.md`
- `C:\Users\Riley\.dsh\skills\testdrive\SKILL.md` (byte-identical)

TestDrive uses four skill-specific fixer seats, a CUA driver, a UI watchdog, a backend watchdog, a matcher, and a respawned fix wave. The completed 2026-11-03 run executed 8 cards: TD-02..TD-07 passed; TD-01 was UNVERIFIED on route-title evidence; TD-08 persistence was partially verified and the Lead restart proved all 15 runs persisted. Product fixes: unknown HTML routes now return 404, terminal run detail shows **Complete · snapshot** with no SSE, and JSON-repair attempts reserve per attempt. See `docs/TESTDRIVE/20261103T2100Z/SUMMARY.md`.

## Trace

The durable full-stack control tracer is `C:\Users\Riley\.agents\skills\trace\SKILL.md` (mirror `.dsh`, v1.1.0). It inventories every tab/control, follows render → handler → API → route → service → SQLite/vault/LLM → response → rendered state, and hands the exact broken hop to forge/forgewright. The 2026-11-03 campaign recorded in `docs/TRACE/20261103T2200Z/` covered 299 controls and fixed six defects: detail/list evidence drift, hardcoded routing candidates, ignored revision file scope, missing schema-valid evidence, unvalidated run enums, and the terminal Events tab hiding persisted events.

## Verification commands

```cmd
npm.cmd run typecheck
npm.cmd test                  :: 317 tests / 51 files
npm.cmd run build
npm.cmd run e2e               :: 26 live Playwright tests, system Chrome
npm.cmd run verify            :: typecheck + tests + build + stub/secret sweeps
npm.cmd run assert-stage -- --stage=p7 --json
npm.cmd run preflight -- --port 0 --json
npm.cmd run bench -- --json
npm.cmd run integrity -- --run <runId> --json
npm.cmd run replay -- --run <runId> --json
npm.cmd run key:import -- --status
npm.cmd run test:live -- --yes
npm.cmd run learn -- --json  :: expected exit 6: E_LEARNING_POOL_EXHAUSTED
npm.cmd run learning:admin -- consent status
npm.cmd run learning:admin -- consent grant case_to_provider_eval
npm.cmd run learning:admin -- import-block <blockId> <cases.json>
```

Evidence is under `docs/verification/` (live smoke JSON, UI screenshots), `docs/UI-WAVE-1/` (live UI/visual audit, 40+ screenshots, findings and backend receipts), `docs/QA-WAVE-1/` (independent 8-seat QA wave, six fixer receipts, auditor NO-GO notes and systems-validator matrix), and `docs/PLAN-AUDIT/` (the plan audit reports that produced `docs/PLAN-v3.md`).

## Repository map

```
src/shared/            contracts, refusals, feature phase
src/server/            Fastify app, DB, LLM client, agents, pipeline, routing, context, quality, retry, repair, learning, security, vault, verify, runs
web/                   React UI (built to web/dist)
scripts/               CLI gates, bench, replay, integrity, repo map, learning report
test/                  unit/integration tests (317)
e2e/                   live Playwright UI tests
config/releases/       stage allowlists
docs/PLAN-v3.md        authoritative build plan
docs/PLAN-AUDIT/       independent plan audit reports
```

## Error and crash logs

Server failures are written to `data/logs/errors.jsonl` as redacted `hive.error.v1` records (source, code, message, runId, route, stack, context). Fatal crash text is also appended to `data/logs/crash.log`. Logging is best-effort: an unavailable log directory never fails a request or run. Runs are bounded by `RUN_TIMEOUT_MS` (default 30 minutes, 1s–24h); timeout records `E_RUN_TIMEOUT` with status `failed`.

## Security

- Loopback-only server; Host/Origin allowlists; JSON content type on mutations; restrictive CSP; no cookies.
- No provider-key HTTP route; key never sent to the browser; redaction at logs, events, artifacts, vault, zips, and CLI envelopes.
- Workspace sandbox: canonical paths, reserved-name/ADS/symlink checks, atomic writes, no writes outside `workspace/` and `vault/`.
- Budget ledger with reservations, per-run/eval/cycle caps, 20% repair reserve; no unbounded spend.
- No arbitrary shell; no generated-code execution; no auto-promotion.

## Cost

Default per-run cap **$0.50**; evaluator cap **$3.00**; learning cycle cap **$4.50**. The live runs recorded in `docs/verification/` cost a few cents each. Prices are estimated from the official DeepSeek price table and the current UTC peak/off-peak window; usage fields are provider-reported where present.
