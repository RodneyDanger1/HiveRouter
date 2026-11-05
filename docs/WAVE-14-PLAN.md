# Wave 14 decision plan — per-file review coverage

Date: 2026-11-05
Owner: HiveRouter lead
Baseline: `2de4ea1` (447 tests / 70 files; 34/34 E2E; 202 stage files / 51 tables / 62 routes / 24 scripts)
Scope item: `docs/BACKLOG.md` P0-2 — per-file review coverage.

## Execution status

Implemented and verified. `ReviewResult.reviewedFiles` and the review schema now carry coverage; `reviewGateChecks` names every allowed file not declared with `REVIEW_UNREVIEWED` and appends a warning without suppressing the primary verdict. RED: missing-coverage and critical+missing tests failed on the pre-fix gate (2/10). GREEN: 10/10; full **451 tests / 70 files**, E2E **34/34**, stage **202**, preflight PASS. Evidence: `docs/TRACE/WAVE-14/TRACE-SUMMARY.md`.

## 1. Outcome

A clean reviewer verdict cannot silently pass files the reviewer never inspected. The reviewer declares `reviewedFiles`; `reviewGateChecks` names every allowed file that is absent from that declaration as `REVIEW_UNREVIEWED`, and the run is `completed_with_warnings` instead of `completed`. A fully covered clean review remains a single passing check.

## 2. Current behavior (evidence)

- `ReviewSchema` (`src/server/agents/registry.ts:841`) has verdict, summary, findings, files, execution; no coverage field.
- `reviewGateChecks` (`src/server/pipeline/run.ts:256`) only checks findings; a clean review returns one `pass` check regardless of which files the reviewer inspected.
- `reviewPrompt` (`run.ts:1056`) sends every generated file but never asks the reviewer to report coverage.
- Existing tests pin critical, ungrounded, changes-required, and clean reviews, but not coverage.

## 3. Decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Add `reviewedFiles: string[]` to the review contract with default `[]` | Infer coverage from findings only | A clean file has no finding; findings cannot prove inspection |
| Treat only allowed plan paths as valid coverage | Accept any declared path | An ungrounded declaration would be a false coverage claim |
| Emit one `REVIEW_UNREVIEWED` **warning** listing sorted missing paths | Fail every run that omits the new field | Existing/live reviews would all fail until the provider starts returning the field; a warning is truthful and non-silent |
| Keep the existing critical/changes-required check first | Replace it with coverage | Coverage must not hide a critical finding |
| A fully covered clean review remains one `pass` check | Always add a coverage check | No warning or extra status when coverage is complete |
| Prompt the reviewer to list every inspected input path | Derive it from the prompt text | The reviewer is the only source of what it actually inspected |
| No schema default of all allowed paths | Treat absent field as full coverage | That would recreate the silent-pass defect |

## 4. File-by-file change

### `src/shared/types.ts`

Add `reviewedFiles?: string[]` to `ReviewResult`.

### `src/server/agents/registry.ts`

Add `reviewedFiles: z.array(z.string()).default([])` to `ReviewSchema`. Paths are not yet normalized; the gate does that.

### `src/server/pipeline/run.ts`

- `reviewPrompt`: append an instruction:
  `Return reviewedFiles as the exact list of input file paths you inspected. Do not list a path you did not receive; do not omit a file you reviewed.`
- `reviewGateChecks`:
  - Build `allowed`.
  - Normalize each declared path once with `normalizeRel`; ignore invalid/out-of-plan paths.
  - `unreviewed = allowedPaths.filter(path => !declared.has(path)).sort()`.
  - `coverageCheck`: if unreviewed non-empty, `{ id: 'review.<kind>.coverage', status: 'warn', detail: 'unreviewed: a, b', code: 'REVIEW_UNREVIEWED', mandatory: false }`.
  - Append the coverage check to every primary result (critical fail, changes-required/ungrounded warn, clean pass) without changing the primary.
  - If no missing files, return exactly the primary result (existing clean behavior).
- Ensure `insertReview` still records the review before checks.

### Tests

`test/unit/p0-truth.test.ts`:
- Full coverage: `reviewedFiles: ['src/a.ts']`, allowed `['src/a.ts']`, clean → one pass, no `REVIEW_UNREVIEWED`.
- Missing coverage: `reviewedFiles: ['src/a.ts']`, allowed `['src/a.ts','src/b.ts']`, clean → pass + warning `REVIEW_UNREVIEWED`, detail includes `src/b.ts`; `completionStatus` is `completed_with_warnings`.
- Leave existing critical/changes tests unchanged; add assertion that coverage warning is appended rather than replacing the fail.
- Ungrounded declared path: `reviewedFiles:['../secret.ts']` is ignored and the allowed file is reported unreviewed.

`test/unit/agents.schemas.test.ts`:
- `ReviewSchema` accepts `reviewedFiles` and defaults to `[]` when absent.

### Docs/census

- `docs/TRACE/WAVE-14/TRACE-SUMMARY.md`, `docs/PLAN-v3.md` §33, `docs/BACKLOG.md` P0-2, capability matrix review row, README counts if tests change.

## 5. Failure modes

| Failure | Behavior |
|---|---|
| Clean review, all files declared | Single pass, no warning |
| Clean review, missing file | Pass + `REVIEW_UNREVIEWED` warn; completed_with_warnings |
| Critical finding + missing coverage | Critical fail remains first; coverage warn appended |
| Declared path outside plan | Ignored; affected allowed files named unreviewed |
| Empty allowed file list | No coverage check |
| Duplicate declared paths | Set semantics; no duplicate warning |
| Traversal path in declaration | `normalizeRel` rejects/ignores |
| Existing provider omits field | Coverage warning, no false clean completion |

## 6. Tests and commands

```powershell
npm.cmd test -- --run test/unit/p0-truth.test.ts test/unit/agents.schemas.test.ts
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run e2e
npm.cmd run assert-stage -- --stage=p7 --json
npm.cmd run preflight -- --port 0 --json
```

Acceptance: missing-coverage test fails on the pre-fix gate; full coverage passes with no warning; critical fail still wins; full gates remain green.

## 7. Rollback

- Remove `reviewedFiles` from the type/schema and the coverage branch/prompt instruction. No DB migration, no API route change.

## 8. Out of scope

- P0-1 writer matrix, P0-5 historical NULL audit.
- Per-file review **calls** (splitting one review into N calls), approval, repo tools/tool loop, P7 evaluation.
- No paid provider call; no UI change; no generated-code execution.
