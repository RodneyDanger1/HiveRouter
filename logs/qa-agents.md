# qa-agents — QA Wave 1 seat 5 journal

HEAD: no git repo; checkpoint 2026-11-03T10:22:05-06:00 · Scope: agents/routing/context/quality/retry/repair + shared algorithms + five P6a scripts + matching tests · Budget: 12+4 min
STATUS: DONE-WITH-OPEN-FINDINGS

## 10:22 — research
Read `docs/QA-WAVE-1/WAVE-SHEET.md`, `AGENTS.md`, plan §6/§7/§6.8. Listed owned files; typecheck baseline passed (0 errors); targeted baseline 7 files / 70 tests passed. Registry has 37 agents; no report file existed.

## 10:23 — probes / hypotheses
H1: CCR capability globs reject root-level files (`**/*.py` requires a slash).
H2: registry `capableFor` ignores `pathGlobs`, so duty rules can pick a non-matching agent.
H3: scripts read `args[indexOf('--run')+1]`, so `--json` becomes a run id and usage exits 3.
H4: `bench-suite` missing key exits 3 while `refusals.ts` says 7.
H5: `build-repo-map` has no file/size cap and no `.env`/`data`/binary exclusion; `integrity-check` checks only artifacts, not manifest/vault.

## 10:24 — RED (before fixes)
command: `npx vitest run test/unit/routing.test.ts test/unit/agents.engine.test.ts test/unit/scripts-agents.test.ts`
observed:
- CCR root-level: `expected false to be true` (capability glob).
- registry: `expected 'db-janitor-engine' to be 'sql-engine'`.
- scripts × 3: `expected 3 to be 2` (usage exit).
Bench no-key RED was contract-read (`refusals.ts:27` exit 7 vs old `exit(3)`), not re-executed against the old line.

## 10:25–10:27 — fixes
- `src/shared/algorithms.ts:123-140`: added `pathGlobToRegExp` with `**/` matching zero dirs and `matchesAnyPathGlob`.
- `src/server/routing/ccr.ts:90-91`: delegated `pathMatches` to the shared matcher.
- `src/server/agents/registry.ts:568`: added path-glob guard in `capableFor`.
- `scripts/{build-repo-map,context-pack-report,integrity-check}.ts`: explicit `--run` index; reject absent/`--` value with exit 2.
- `scripts/replay-run.ts`: reject `--run --json` as usage.
- `scripts/bench-suite.ts:41`: missing key exit 3 → 7.
- Added `test/unit/scripts-agents.test.ts` for script usage and no-key exit; added root-glob and path-glob cases to existing tests.

## 10:28 — GREEN
command: `npx vitest run test/unit/routing.test.ts test/unit/agents.engine.test.ts test/unit/scripts-agents.test.ts test/unit/context.test.ts test/unit/repair.test.ts test/unit/quality.test.ts test/unit/retry.test.ts test/unit/agents.registry.test.ts test/unit/agents.schemas.test.ts test/unit/agents.hash.test.ts`
observed: **10 files, 89 tests passed**.
command: `npm.cmd run typecheck`
observed: exit 0, no output.

## 10:29 — script/mock evidence
command: `npx vitest run test/unit/scripts-agents.test.ts` → 7/7 pass.
command: `npx tsx scripts/bench-suite.ts --json` → `ok: true`, `agents: 37`, `registry-count/unique-ids/prompt-nonempty` all true.

## 10:30 — open findings
O1 `scripts/build-repo-map.ts:47-60`: no 2,000-file/10MB cap, no `.env`/`data`/`.git`/binary exclusion (plan §6.8).
O2 `scripts/integrity-check.ts:29-37`: only artifact hashes; no manifest/vault parity (plan §6.8).
O3 `scripts/replay-run.ts:31-40` / `integrity-check.ts:29-34`: DB artifact paths joined without canonical containment check.
These are READ/UNVERIFIED; no fix claimed.

## Missed / limits
- No live agent invocation; no provider key access; no server restart.
- `ENGINE_MAP` is identity (37 entries) and was not semantically redefined; count parity is tested, semantic engine-map behavior is not established.
- O1/O2/O3 not fixed in this window; they need a follow-up with temp-run fixtures.

## Files changed
- `src/shared/algorithms.ts`, `src/server/agents/registry.ts`, `src/server/routing/ccr.ts`
- `scripts/build-repo-map.ts`, `scripts/context-pack-report.ts`, `scripts/integrity-check.ts`, `scripts/replay-run.ts`, `scripts/bench-suite.ts`
- `test/unit/routing.test.ts`, `test/unit/agents.engine.test.ts`, `test/unit/scripts-agents.test.ts`
- `docs/QA-WAVE-1/05-agents.md`, `logs/qa-agents.md`

STATUS: DONE-WITH-OPEN-FINDINGS
