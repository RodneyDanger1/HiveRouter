# Wave 12 — per-file byte bound evidence

Date: 2026-11-05
Baseline: `195874c` (440 tests / 69 files; 34/34 E2E; 200 stage files / 51 tables)
Final: **443 tests / 69 files**, **34/34 E2E**, stage **200 files / 51 tables / 62 routes / 24 scripts**, `verify` exit 0, preflight PASS (free RAM 1.77 GB, disk 9.05 GB).

## Defect

`FileEmissionSchema.content`, `TestsSchema.files[].content`, and `ReviewSchema.files[].content` were unbounded strings. Oversized generated content passed schema validation, spent JSON-repair attempts, and was rejected only later by `writeStaged`. The error was not guaranteed to stay typed through the provider boundary.

## Change

- `src/server/agents/registry.ts`: `boundedFileContent()` validates UTF-8 bytes against `config.limits.maxFileBytes`; exact limit passes, limit+1 fails with a schema issue whose message starts `E_FILE_TOO_LARGE:`.
- Applies to file emission (`min 1`), generated tests (`min 1`), and review file revisions (`min 0`).
- `src/shared/refusals.ts`: `E_FILE_TOO_LARGE` → HTTP 413, non-retryable.
- `src/server/llm/client.ts`: a schema issue with an `E_*:` prefix is rethrown as that typed `LlmError` immediately; no JSON repair request.
- `writeStaged` remains the last-defense byte guard.

## RED evidence

Restored the pre-Wave-12 `registry.ts`, kept the new schema tests:

```
Test Files  1 failed (1)
Tests  2 failed | 6 passed (8)
AssertionError: expected true to be false
```

The two failures were the file-content byte bound and the test/review byte bound. Restored the Wave 12 file:

```
Tests  8 passed (8)
```

The provider identity test (`llm.client.test.ts`) proves the schema-issued code is preserved and only one HTTP request is made.

## Claim/evidence

| Claim | Evidence | Status |
|---|---|---|
| Exact byte limit passes | schema test with `'a'.repeat(limit)` | VERIFIED |
| Limit+1 fails with typed code | schema issue begins `E_FILE_TOO_LARGE:` | VERIFIED |
| UTF-8 bytes, not chars | multi-byte test fails | VERIFIED |
| Tests/review content bounded | schema tests | VERIFIED |
| Provider preserves code and skips repair | `structured` test rejects `E_FILE_TOO_LARGE`, `requests.length === 1` | VERIFIED |
| Full suite | `npm.cmd test` → 443 / 69 | VERIFIED |
| Full E2E | `npm.cmd run e2e` → 34/34 | VERIFIED |
| Stage | 200 files / 51 tables / 62 routes / 24 scripts, violations [] | VERIFIED |
| Preflight | PASS, RAM 1.77 GB, disk 9.05 GB | VERIFIED |
| No file written before refusal | schema rejects before pipeline write; static chain | VERIFIED by code path, not a live oversized run |
| Live oversized provider response | no paid call was made | UNVERIFIED |

## Residual

- The bound applies to generated file, test, and review content; plan/text outputs have separate limits.
- No paid live call was made; the provider test uses a local mock HTTP server only.
- `writeStaged` remains intentionally redundant defense.
