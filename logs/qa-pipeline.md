# qa-pipeline — Seat 2 journal

HEAD: QA-WAVE-1 checkpoint `2026-11-03T10:22:05-06:00`
Scope: `src/server/pipeline/**`, `src/server/llm/**`, `src/server/verify/**`, `test/unit/llm*`, new pipeline tests
STATUS: DONE (4 fixed; 6 open findings)

## 10:22 — research / read
Read wave sheet, AGENTS.md, plan v3 §0–§7, `run.ts` (869 lines), `agent-runner.ts`, `client.ts`, `verifier.ts`, `syntax.ts`, `stub-scan.ts`, `secret-scan.ts`, recorder/bridge/migrations. No live call, no key access, no server restart.
Contract in my terms: every accepted byte must have a matching hash; no secret may cross a child-process boundary; warning-only gates must be represented consistently; every generated test must be planned and finalized; the LLM client must fail typed on truncation/blank JSON and never retry 400/401/402.

## 10:24 — RED probes
- Wrote `test/pipeline-qa.test.ts` with 3 invariants: stripped revision hash, warning-only completion status, Python child env excludes provider secrets.
- `npm.cmd test -- --run test/pipeline-qa.test.ts` → 3 failed: `applyRevisions is not a function`, `completionStatus is not a function`, `syntaxChildEnv is not a function`.
- Added the fourth invariant (test files outside `tests/`). RED → 1 failed: `plannedTestFiles is not a function`; other 3 passed after first fixes.

## 10:26 — fixes (minimal)
1. `run.ts` `applyRevisions`: strip once, write stripped content, hash/bytes the stripped content.
2. `syntax.ts`: added allow-listed `syntaxChildEnv`; Python AST spawn now uses it (`PATH`, `SystemRoot`, `TEMP`, etc.; no `PYTHONPATH`, no provider tokens).
3. `run.ts` `completionStatus`; `finalize` uses one `finalStatus` for report/manifest/run/event.
4. `run.ts` `plannedTestFiles`; `executeRun` tracks actual `tests.files` paths and finalizes `allPlanned` instead of only top-level `staging/tests`.

## 10:29 — GREEN
- `npm.cmd test -- --run test/unit/llm.client.test.ts test/pipeline-qa.test.ts` → **15 passed (2 files)**.
- `npm.cmd run typecheck` → exit 0, no output.
- `npm.cmd test -- --run test/pipeline-qa.test.ts` → 4 passed.
No full `npm run verify` (wave sheet forbids fixer full verify). No server restart, no git, no key, no paid call.

## Open findings recorded (not fixed; READ/INFERRED)
PIPE-05 trace cache/reasoning hardcoded 0 (`run.ts:53-55`); PIPE-06 RVS plan computed but unused (`run.ts:641-649`); PIPE-07 ad-hoc `tests` branch uses FileEmissionSchema/target (`run.ts:304-313`); PIPE-08 finalize overwrites generated `manifest.json`/`RUN_REPORT.md` (`run.ts:852-853`); PIPE-09 live badges minted for any run (`run.ts:34-40`); PIPE-10 empty ad-hoc input returns wrong `E_PROMPT_TOO_LARGE` (`run.ts:296-297`).

## Missed / limits
No full pipeline integration run; no DB trace test; no RVS/ad-hoc/manifest-collision runtime proof. No live provider call. `git`/server not touched.

## Files changed
- `src/server/pipeline/run.ts`
- `src/server/verify/syntax.ts`
- `test/pipeline-qa.test.ts` (new)

## STATUS: DONE
