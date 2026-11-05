# 02 — Pipeline, LLM, and Verify QA (Seat 2)

**Checkpoint:** `2026-11-03T10:22:05-06:00` · `package-lock` and plan hashes from `docs/QA-WAVE-1/WAVE-SHEET.md`.
**Scope:** `src/server/pipeline/**`, `src/server/llm/**`, `src/server/verify/**`, `test/unit/llm*`, new pipeline tests.
**Mode:** execute; no live spend, no install, no server restart, no git write, no key access.
**Verdict:** **PASS WITH FIXES** — 4 defects fixed with RED/GREEN; 6 additional findings recorded as open (READ/INFERRED, no runtime proof).

## Fixed defects (RED → GREEN)

### PIPE-01 — Revision hash was computed from the fenced payload, not the accepted bytes (P1)
**File:** `src/server/pipeline/run.ts` (old `applyRevisions`; now `run.ts:765`).
**Contract:** finalize/manifest hash must equal the bytes written to `staging` and later accepted.
**Defect:** `writeStaged` wrote `stripOuterFence(revision.content)`, but the in-memory `GeneratedFile` was updated with `contentHash(revision.content)` and `Buffer.byteLength(revision.content)`. Any fenced revision produced a hash/byte count that did not match disk.
**RED:** `test/pipeline-qa.test.ts` → `TypeError: applyRevisions is not a function`; after exporting the unchanged body, the test's `current[0].sha256 === contentHash(onDisk)` would fail because the fenced string hashes differently.
**Fix:** `const content = stripOuterFence(revision.content); writeStaged(...content); current[index] = {... content, sha256: contentHash(content), bytes: Buffer.byteLength(content)}`.
**GREEN:** `npm.cmd test -- --run test/pipeline-qa.test.ts` → 4 passed; the test asserts disk content `const a = 2;`, matching hash, and matching bytes.

### PIPE-02 — Python syntax checker inherited the full process environment, including provider secrets (P1)
**File:** `src/server/verify/syntax.ts:45,77-81`.
**Contract:** no provider key or unrelated secret may reach a child process; verification is static.
**Defect:** `env: { ...process.env, ... }` forwarded `DEEPSEEK_API_KEY`, `OPENROUTER_API_KEY`, `AWS_*`, `GITHUB_TOKEN`, and arbitrary variables to `python -B -c ...`.
**RED:** `test/pipeline-qa.test.ts` → `TypeError: syntaxChildEnv is not a function`; the new test supplies those names and asserts they are absent.
**Fix:** added `syntaxChildEnv()` with an explicit allow-list (`PATH`, `SystemRoot`, `TEMP`, etc.; no `PYTHONPATH`) and changed the spawn to `env: { ...syntaxChildEnv(), PYTHONDONTWRITEBYTECODE: '1' }`.
**GREEN:** same test file → 4 passed; the test confirms `PATH`/`SystemRoot`/`TEMP` survive and the four secret names plus an unrelated variable are dropped.

### PIPE-03 — `run.completed` and finalize status could say `completed` for a warning-only gate (P2)
**File:** `src/server/pipeline/run.ts:851,881` (old `finalize`).
**Contract:** `completed_with_warnings` must be reflected consistently in the run row, manifest, report, and `run.completed` event.
**Defect:** report/manifest/run status used a warning ternary, but the `run.completed` event hardcoded `status: 'completed'`; a `warn`/`unverified`-only run would emit a contradictory event.
**RED:** `test/pipeline-qa.test.ts` → `TypeError: completionStatus is not a function`; the test expects `completed_with_warnings` for a pass+unverified gate.
**Fix:** exported `completionStatus(checks)`; `finalize` computes `finalStatus` once and uses it for report, manifest, `updateRun`, and the `run.completed` event.
**GREEN:** same test → 4 passed.

### PIPE-04 — Gatekeeper test files outside `staging/tests/` were written but not verified/finalized (P1)
**File:** `src/server/pipeline/run.ts:620-635,720` (old `testFiles` readdir).
**Contract:** every generated test file must be in `allPlanned`, verified, and copied into the accepted tree/manifest.
**Defect:** the loop wrote `tests.files[*].path` (which may be `test/foo.test.ts`, `tests/unit/a.ts`, etc.), but finalization collected only top-level `staging/tests/*` via `readdirSync`. A `test/` or nested test file was silently omitted from `allPlanned` and `finalize`.
**RED:** `test/pipeline-qa.test.ts` → `TypeError: plannedTestFiles is not a function`; the test passes `test/foo.test.ts`, `tests/unit/a.test.ts`, and a duplicate, expecting two unique paths.
**Fix:** added `plannedTestFiles(tests)`; `executeRun` tracks `testPaths` from the actual `tests.files` and uses `allPlanned = unique([...plannedPaths, ...testPaths])` for verification, repair, and finalize.
**GREEN:** same test → 4 passed.

## Open findings (not fixed in this seat; no invented evidence)

| ID | Severity | File:line | Finding | Evidence / required fix |
|---|---|---|---|---|
| PIPE-05 | P1 | `run.ts:53-55` | Trace ingestion hardcodes `cache_hit_tokens`, `cache_miss_tokens`, and `reasoning_tokens` to `0`; trace cost is correct but cache/reasoning telemetry is false. | READ: SQL values `0, 0, 0`; `usageTotals` only returns cost/prompt/completion. Fix: sum `usage` cache/reasoning columns or extend `usageTotals`; add DB trace test. |
| PIPE-06 | P1 | `run.ts:641-649` | RVS is computed and persisted (`verification_plans`) but `verifyStaged` ignores `verifyPlan`; all checks run regardless of risk tier/budget, so RVS is dead wiring. | READ: `verifyPlan` assigned then only inserted; `verifyStaged(staging, allPlanned)` uses no plan. Fix: drive checks from `verifyPlan` or explicitly document/verify the superset. |
| PIPE-07 | P1 | `run.ts:304-313` | Ad-hoc `tests` agents take the `files` branch: require a single `targetPath`, call `FileEmissionSchema`, and can never use `TestsSchema`/multiple test files. | READ: condition includes `outputKind === 'tests'`; `TestsSchema` is unreachable for that kind. Fix: separate tests branch, write `tests.files`, no single-target requirement. |
| PIPE-08 | P2 | `run.ts:852-853` | `finalize` overwrites generated project files named `manifest.json` or `RUN_REPORT.md` with factory metadata/report; planned path collision is unbounded. | INFERRED from direct `fs.writeFileSync` after copying planned paths; no test. Fix: reserve these names or place factory manifest under `.hive/`. |
| PIPE-09 | P2 | `run.ts:34-40` | `recordAgentEvidence` writes `representative-live`/`provenance:'live'` for every run; a mock/ad-hoc or synthetic run can mint a live badge. | READ: no run provenance check. Fix: require live provenance and a live consent/run metadata check. |
| PIPE-10 | P2 | `run.ts:296-297` | Empty ad-hoc input returns `E_PROMPT_TOO_LARGE`; the name is false and hides the real cause. | READ: `if (!input) throw new Error('E_PROMPT_TOO_LARGE')`. Fix: use an input-required code or a named refusal; add branch test. |

## Checked clean (READ/VERIFIED)

- **Wire body:** `test/unit/llm.client.test.ts` (11 passed) asserts `thinking`, `temperature` omitted in thinking mode, `reasoning_effort`, `response_format`, `max_tokens`, `user_id`, and `Authorization`; no `stream_options` because this client is non-streaming (not applicable).
- **Finish reasons:** `length` is a typed `E_LLM_TRUNCATED` (no success); `content_filter`, `insufficient_system_resource`, `aborted`, `tool_calls`, unknown are typed failures; 429 retries, 401 does not; blank JSON repairs twice then fails typed; usage cache/reasoning and peak/off-peak cost; abort.
- **Verify:** `verifyStaged` checks path safety, secret scan, stub scan, syntax; `gateStatus` fails mandatory failed/unverified; no generated-code execution (Python AST, TS transpile, YAML/HTML/SQLite parsers only).
- **Staging/repair:** repair max 2, repeated signature stalls, revisions only for allowed paths, finalize only after a non-fail gate; no partial accepted tree observed in code path.
- **Path safety:** `safePath`, `normalizeRel`, `assertAllowedExtension` on plan/revision/test writes; `verifyStaged` rechecks paths.
- **LLM client:** no key in errors; no logged request headers; `LlmError` shape `{code,message,status,retryable}`.

## Claim strength

- **VERIFIED:** `npm.cmd test -- --run test/unit/llm.client.test.ts test/pipeline-qa.test.ts` → **15 passed (2 files)**; `npm.cmd run typecheck` → exit 0 with no output.
- **READ:** open findings PIPE-05…10 with file:line above.
- **INFERRED:** exploit impact of PIPE-08; no runtime test.
- **UNVERIFIED:** full pipeline integration with real/mock run graph; trace DB fix; RVS/ad-hoc fixes; no live provider call or paid spend.

## Skills applied

- **logic-debugger:** PIPE-01 hash/state mismatch; PIPE-03 status contradiction; PIPE-04 planned-set omission.
- **forge:** root cause at the write/hash boundary and finalize status source; minimal edits.
- **smartfix:** RED test first, minimal fix, GREEN; no test weakening.
- **capability-auditor:** PIPE-07 ad-hoc tests capability; PIPE-09 false live badge; PIPE-06 dead RVS wiring.
- **auditor:** claims separated VERIFIED/READ/INFERRED/UNVERIFIED; no live spend; no fabricated GREEN.
- **systems-validator:** DeepSeek wire-body contract, finish-reason/usage fields, Python child-env secret boundary; static-only verification confirmed.

## Files read / sources

`docs/QA-WAVE-1/WAVE-SHEET.md`; `AGENTS.md`; `docs/PLAN-v3.md` §0–§7; `src/server/pipeline/run.ts`; `src/server/pipeline/agent-runner.ts`; `src/server/llm/client.ts`; `src/server/llm/index.ts`; `src/server/verify/{verifier,syntax,stub-scan,secret-scan}.ts`; `src/server/runs/recorder.ts`; `src/server/vault/bridge.ts`; `src/server/db/migrations.ts`; `test/unit/llm.client.test.ts`. No web source was needed for these code-level findings.

## Files changed

- `src/server/pipeline/run.ts` (PIPE-01/03/04)
- `src/server/verify/syntax.ts` (PIPE-02)
- `test/pipeline-qa.test.ts` (new RED/GREEN coverage)
