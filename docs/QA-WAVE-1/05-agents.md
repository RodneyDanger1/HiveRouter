# QA Wave 1 — Seat 5 `qa-agents` report

**Scope:** `src/server/agents/**`, `src/server/routing/**`, `src/server/context/**`, `src/server/quality/**`, `src/server/retry/**`, `src/server/repair/**`, `src/shared/algorithms.ts`, five P6a scripts, matching tests.
**Checkpoint:** 2026-11-03T10:22:05-06:00. **Work:** 10:22–10:31. **Verdict:** **GO-WITH-FIXES** — 4 defects fixed (3 P1, 1 P2), 2 P1 findings left open and explicitly unverified.
**No installs, server restarts, git writes, key access, or paid API calls.**

## Defects fixed

| ID | Sev | File:line | Defect | RED evidence | Minimal fix | GREEN evidence |
|---|---|---|---|---|---|---|
| D1 | P1 | `src/server/routing/ccr.ts:89-99` (old), `src/shared/algorithms.ts:123-140` | `**/*.ext` capability globs required a slash, so root-level files (`main.py`) were rejected as `E_NO_CAPABLE_AGENT` even with a capable agent. | `routing.test.ts` new root-level case: `expected false to be true` (RED run 10:25). | Shared `pathGlobToRegExp`/`matchesAnyPathGlob`; `**/` now matches zero or more directories; CCR delegates to it. | `routing.test.ts` 17/17 pass; root-level routes to `python-engine`. |
| D2 | P1 | `src/server/agents/registry.ts:562-569` | `capableFor` ignored `AgentCapability.pathGlobs`; duty `janitor vacuum` selected `db-janitor-engine` for `src/random.sql`, which is outside its `**/*janitor*.sql|maintenance|prune` globs. | `agents.engine.test.ts` new case: `expected 'db-janitor-engine' to be 'sql-engine'` (RED run 10:25). | Added `matchesAnyPathGlob` guard in `capableFor`; path globs are now a real capability constraint. | `agents.engine.test.ts` 14/14 pass; case falls through to `sql-engine`. |
| D3 | P1 | `scripts/build-repo-map.ts:13`, `scripts/context-pack-report.ts:13`, `scripts/integrity-check.ts:14` | When `--run` was absent, `args[-1 + 1]` read `--json` as the run id, so usage errors exited **3** (`not found`) instead of **2** (`usage`). `--run` with no value had the same bug. | New `scripts-agents.test.ts`: three RED failures `expected 3 to be 2` (10:25). | Parse `--run` with an explicit index and require `runId && !runId.startsWith('--')`; applied the same guard to `replay-run.ts`. | `scripts-agents.test.ts` 7/7 pass; all absent/valueless `--run` cases exit 2. |
| D4 | P2 | `scripts/bench-suite.ts:40-41` (old line 42) | Missing key exited **3**, but `E_KEY_NOT_CONFIGURED` is defined as exit **7** (`src/shared/refusals.ts:27`). | Contract contradiction: `refusals.ts:27` (`exit: 7`) vs old `process.exit(3)`. Test added for expected 7; RED is **READ/INFERRED**, not re-executed against the old line. | `process.exit(7)`; test runs with a temp cwd and no key. | `scripts-agents.test.ts` passes the no-key case; exit 7. |

## Defects found, not fixed (OPEN / UNVERIFIED)

| ID | Sev | File:line | Defect | Contract | Requested patch |
|---|---|---|---|---|---|
| O1 | P1 | `scripts/build-repo-map.ts:47-60` | Walks every file with no 2,000-file/10 MB cap and skips only `.staging`/`node_modules`; reads binaries as UTF-8. | Plan §6.8: caps 2,000 files/10 MB; exclude `.env`, `data/`, `node_modules/`, `.git/`, binaries. | Add stats/counter guards, extension/binary and directory exclusions, and a `truncated` flag; test a 2,001-file temp run. |
| O2 | P1 | `scripts/integrity-check.ts:29-37` | Recomputes only artifact hashes; does not compare the manifest or vault parity it is named for. | Plan §6.8: integrity-check recomputes hashes/counts/manifest/vault parity. | Add manifest hash/count comparison and vault index/file parity; refuse with 4/5 on mismatch. |
| O3 | P2 | `scripts/replay-run.ts:31-40`, `integrity-check.ts:29-34` | Artifact paths from the DB are joined to the run workspace and read without a canonical containment check. | Path safety contract; DB is trusted, but a poisoned/legacy row can read outside the run. | Resolve + verify `startsWith(workspaceRoot + sep)` before reading; return integrity failure. |

## What I checked and found clean

- **37-agent census:** `REGISTRY` = 37, unique IDs = 37, `AGENT_IDS` parity; `bench-suite --json` reports 37/37/37 and passes.
- **Prompt/schema/engine map parity:** 37 `PROMPTS`, 37 `PROMPT_HASHES`, 37 `PROMPT_SOURCE_MAP`, 37 `ENGINE_MAP`; every `schemaId` in the allowed set; prompt `[ROLE]`/`[OBJECTIVE]` exactly once; no `[RESPONSE FORMAT]`; buildSystemPrompt idempotent. (`agents.registry.test.ts`, `agents.schemas.test.ts`, `agents.hash.test.ts`.)
- **Capability filters:** D1/D2 fixed; no capable → `E_NO_CAPABLE_AGENT`; all-disabled → `E_ALL_CANDIDATES_DISABLED`; root-level and nested paths covered.
- **CCR determinism/DP/refusals:** same policy across different run IDs yields identical routes; `runId` is not the seed; reserve and allocatable cost invariants hold over 40 deterministic policy variants; required-closure and optional-skip dependency refusal covered; cycle/missing-dep/unsafe-path/context-risk refusals covered.
- **CPO:** PageRank convergence/degraded path, dangling/cyclic graph, mandatory vs optional token budget, stable prefix hash, secret/duplicate/over-budget exclusions covered; no overflow in 30 deterministic budgets.
- **RVS:** syntax mandatory for Python/TS/JS/JSON code at T2, `markdown.structure` for docs, over-budget runs all mandatory and skips only optional, unavailable mandatory tool → `unverified` + refusal.
- **CCA:** half-open boundaries at .75/.45/.25; mandatory-failed caps at retry; mandatory-unverified abstains; missing component is provisional and capped at needs_review; renormalization verified.
- **FSN/CRA:** stable cluster IDs under input shuffles, exact signature reuse, blast-radius targets, 200-cluster refusal, recurrence suppression; CRA no-retry auth, rate-limit backoff, content-filter abort, null budget, max attempts, length switch, verification switch, capability-filtered candidates.
- **No double counting:** 37 agents, 5 P6a algorithms, 5 owned P6a scripts, one primary output per agent; no duplicate IDs or duplicate script artifact. The registry test asserts exact canonical order.
- **Scripts:** bench-suite mock exits 0 with `{schema:'hive.cli.v1',command:'hive.bench',ok:true,agents:37}`; the three usage probes now exit 2.

## Claim strength

| Claim | Strength |
|---|---|
| D1/D2/D3 RED and GREEN | **VERIFIED** (commands and outputs captured) |
| D4 contract contradiction and test | **READ** for the old line; **VERIFIED** for the new exit 7 test |
| O1/O2/O3 contract mismatch | **READ** (code vs plan/refusals); no fixed behavior claimed |
| Full 37-agent live capability | **UNVERIFIED** — mock/registry only; no live calls |
| `npm.cmd run typecheck` | **VERIFIED** — exit 0 |
| Targeted tests 89 + scripts 7 | **VERIFIED** — 96 passing |

## Skills applied

- **logic-debugger:** path/run-id parsing and capability-boundary defects (D1–D3).
- **forge:** minimal RED→fix→GREEN edits; no unrelated changes.
- **smartfix:** one defect per cycle, file:line receipts, no test weakening.
- **capability-auditor:** 37-agent census, pathGlobs as real capability, `registry.capableFor` (D2).
- **auditor:** contract-vs-code claims; D4 exit-code and O1/O2 discrepancies marked READ/UNVERIFIED.
- **systems-validator:** plan §6.8 script caps/manifest/vault parity (O1/O2) and CLI exit-code contract (D3/D4).

## Files read / sources

- `docs/QA-WAVE-1/WAVE-SHEET.md` (44 lines), `AGENTS.md` (13 lines), `docs/PLAN-v3.md` §6/§7/§6.8.
- `src/server/agents/registry.ts`, `src/server/agents/prompts.ts`, `src/shared/algorithms.ts`, `src/server/routing/ccr.ts`, `src/server/context/packer.ts`, `src/server/repair/triage.ts`, `src/server/quality/{rvs,confidence}.ts`, `src/server/retry/allocator.ts`, all five owned scripts, matching tests.
- `src/shared/refusals.ts:27` for `E_KEY_NOT_CONFIGURED` exit 7.
- No external web fetch; no DeepSeek API call; no key read.

## Files changed

`src/shared/algorithms.ts`, `src/server/agents/registry.ts`, `src/server/routing/ccr.ts`, `scripts/build-repo-map.ts`, `scripts/context-pack-report.ts`, `scripts/integrity-check.ts`, `scripts/replay-run.ts`, `scripts/bench-suite.ts`, `test/unit/routing.test.ts`, `test/unit/agents.engine.test.ts`, `test/unit/scripts-agents.test.ts`; reports/logs only.

**Status:** DONE-WITH-OPEN-FINDINGS.
