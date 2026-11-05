# Wave 14 — per-file review coverage evidence

Date: 2026-11-05
Baseline: `2de4ea1` (447 tests / 70 files; 34/34 E2E; 202 stage files / 51 tables)
Final: **451 tests / 70 files**, **34/34 E2E**, stage **202 files / 51 tables / 62 routes / 24 scripts**, `verify` exit 0, preflight PASS (free RAM 1.67 GB, disk 9.04 GB).

## Defect

`ReviewSchema` and `reviewGateChecks` had no coverage channel. A reviewer could return `verdict: pass` with no findings and the gate emitted one `pass` check even if some planned files were never inspected. The run could be marked `completed` while those files were unreviewed.

## Change

- `ReviewResult.reviewedFiles?: string[]`; `ReviewSchema` defaults it to `[]`.
- `reviewPrompt` now asks the reviewer to return the exact input paths it inspected.
- `reviewGateChecks`:
  - normalizes and filters declared paths against the allowed plan;
  - computes `unreviewed = allowed - declared`;
  - appends one non-mandatory `review.<kind>.coverage` warning with code `REVIEW_UNREVIEWED` and the sorted missing paths;
  - keeps the existing critical/changes-required/pass check first.
- Full coverage returns exactly the original primary check; missing coverage makes `completionStatus` return `completed_with_warnings`.

## RED evidence

Restored the pre-Wave-14 `pipeline/run.ts`, kept the new review-contract tests:

```
Tests  2 failed | 8 passed (10)
AssertionError: expected undefined to be 'warn'
AssertionError: expected false to be true
```

The missing-coverage and critical+missing-coverage tests failed. Restored the coverage gate:

```
Tests  10 passed (10)
```

## Claim/evidence

| Claim | Evidence | Status |
|---|---|---|
| Fully covered clean review remains one pass | `run_review_covered`, checks length 1 | VERIFIED |
| Missing file named | `REVIEW_UNREVIEWED`, detail contains `src/b.ts` | VERIFIED |
| Out-of-plan declaration ignored | `../outside.ts` absent from detail | VERIFIED |
| Critical fail preserved | first check fail/mandatory; coverage appended | VERIFIED |
| Missing coverage changes run status | `completionStatus` → `completed_with_warnings` | VERIFIED |
| Schema default | `ReviewSchema` empty array | VERIFIED |
| Full suite | `npm.cmd test` → 451 / 70 | VERIFIED |
| E2E | `npm.cmd run e2e` → 34/34 | VERIFIED |
| Stage | 202 files / 51 tables / 62 routes / 24 scripts, violations [] | VERIFIED |
| Preflight | PASS, RAM 1.67 GB, disk 9.04 GB | VERIFIED |
| Live provider returns `reviewedFiles` | no paid call; prompt only | UNVERIFIED |

## Residual

- Coverage is self-declared by the reviewer. A dishonest declaration cannot be mechanically distinguished from a truthful one; the gate only proves declared-vs-allowed, not actual reading.
- Existing providers that omit `reviewedFiles` now produce a coverage warning on every review. This is intentional and visible; it is not a silent pass.
- No per-file separate review calls; one review call may still inspect many files.
- No paid provider call; no API/UI shape change.
