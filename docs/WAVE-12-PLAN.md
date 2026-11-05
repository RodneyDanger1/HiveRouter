# Wave 12 decision plan — per-file byte bound at the schema boundary

Date: 2026-11-05
Owner: HiveRouter lead
Baseline: `195874c` (440 tests / 69 files; 34/34 E2E; 200 stage files / 51 tables / 62 routes / 24 scripts)
Scope item: `docs/BACKLOG.md` P0-3 — schema-level file-size bound.

## Execution status

Implemented and verified. File/test/review content is UTF-8-byte bounded in Zod; `E_FILE_TOO_LARGE` survives the provider boundary with no repair request; `writeStaged` remains defense in depth. RED: old schemas accepted oversized content (2 schema tests failed). GREEN: focused 20/20, full **443 tests / 69 files**, E2E **34/34**, stage **200 files / 51 tables / 62 routes / 24 scripts**, preflight PASS. Evidence: `docs/TRACE/WAVE-12/TRACE-SUMMARY.md`.

## 1. Outcome

An agent that returns file content larger than `config.limits.maxFileBytes` is refused at the output-schema boundary with a typed `E_FILE_TOO_LARGE`, before any file is written or artifact row is persisted, and without spending JSON-repair calls on a deterministic size violation. The existing `writeStaged` byte guard remains as defense in depth.

## 2. Current behavior (evidence)

- `src/server/agents/registry.ts:813-820` defines `FileEmissionSchema.content` as an unbounded `z.string().min(1)`; `TestsSchema.files[].content` and `ReviewSchema.files[].content` are similarly unbounded.
- `src/server/pipeline/run.ts:215-219` `writeStaged` checks bytes **after** the model output has been accepted and before the write; this is the only current bound.
- `src/server/llm/client.ts:637-646` maps every schema failure to `E_LLM_SCHEMA_INVALID` and triggers up to two JSON-repair requests; an oversized output is deterministic and repair cannot fix it.
- `src/shared/refusals.ts` has no `E_FILE_TOO_LARGE` definition.
- Tests: `test/unit/agents.schemas.test.ts` only verifies empty content rejection; `test/unit/llm.client.test.ts` has schema-repair tests but no size-code/identity test.

## 3. Decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Enforce a byte bound in the Zod schemas with a custom issue message carrying `E_FILE_TOO_LARGE` | Rely only on `writeStaged` | P0-3 requires the rejection at the schema boundary; the write guard remains a second barrier. |
| Use `Buffer.byteLength(content, 'utf8')`, not `content.length` | Character count | The limit is bytes; Unicode content must be measured correctly. |
| Apply the bound to file emission, generated tests, and review revisions | File emission only | All three can write content; leaving two unbounded keeps the same class of defect. |
| Preserve the schema’s `E_*` message in `DeepSeekClient.structured` and stop repairs for that code | Generic `E_LLM_SCHEMA_INVALID` and two repairs | A deterministic size refusal is not a JSON syntax problem; repair costs time and provider spend. |
| Add `E_FILE_TOO_LARGE` to `REFUSALS` | Use `E_LLM_SCHEMA_INVALID` | The refusal must be bounded and typed, with a stable name for the ledger/UI. |
| Keep exact-limit content valid | Use `<` instead of `<=` | A file exactly at the configured byte limit is allowed; limit+1 is refused. |

## 4. File-by-file change

### `src/server/agents/registry.ts`

- Import `config`.
- Add a small factory:
  ```ts
  function boundedFileContent(min = 1) {
    return z.string().min(min).superRefine((value, ctx) => {
      const bytes = Buffer.byteLength(value, 'utf8');
      if (bytes > config.limits.maxFileBytes) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [],
          message: `E_FILE_TOO_LARGE: file content is ${bytes} bytes; limit is ${config.limits.maxFileBytes}.`,
        });
      }
    });
  }
  ```
- Use it for `FileEmissionSchema.content`, `TestsSchema.files[].content`, and `ReviewSchema.files[].content` (review allows empty revisions).
- Keep all other schema semantics unchanged.

### `src/shared/refusals.ts`

Add:
```ts
E_FILE_TOO_LARGE: { http: 413, exit: 2, retryable: false, message: 'Generated file exceeds the byte limit.' },
```

### `src/server/llm/client.ts`

In `structured()` after `schema.safeParse` fails, before setting `E_LLM_SCHEMA_INVALID` and repairing:
- Find the first issue whose message begins with `E_` and a colon.
- If found, call `request.onAttemptEnd?.(attempt, result.usage, null)` and throw `new LlmError(code, detail, 200, false)`.
- No repair loop for that refusal.
- Other schema failures keep the existing `E_LLM_SCHEMA_INVALID` repair behavior.

### Tests

`test/unit/agents.schemas.test.ts`:
- Build a content string of exactly `config.limits.maxFileBytes` ASCII bytes → `FileEmissionSchema.safeParse` succeeds.
- One byte over → fails; `issues[0].message` starts with `E_FILE_TOO_LARGE`.
- Same bound for a `TestsSchema.files[].content` and a `ReviewSchema.files[].content`.
- Unicode boundary: multi-byte content at limit+1 fails on bytes, not characters.

`test/unit/llm.client.test.ts`:
- Queue one completion whose JSON contains a too-large field for a test schema with the same `E_FILE_TOO_LARGE` issue.
- Assert rejection `{ code: 'E_FILE_TOO_LARGE', status: 200, retryable: false }`.
- Assert exactly **one** HTTP request, proving no repair call.

### Docs/census

- `docs/TRACE/WAVE-12/TRACE-SUMMARY.md` with RED/GREEN, exact outputs.
- `docs/PLAN-v3.md` §31.
- `docs/BACKLOG.md` P0-3 delivered.
- `docs/CAPABILITY-MATRIX.md` generation row says bounded at schema boundary.
- README test/count updates only if tests/files change (expected +2 tests, file count unchanged).

## 5. Failure modes

| Failure | Behavior |
|---|---|
| Content exactly at limit | Accepted by schema; `writeStaged` also allows |
| Content one byte over | `E_FILE_TOO_LARGE` at schema; no write/artifact |
| Multi-byte UTF-8 | Measured in bytes; correct rejection |
| Empty content | Existing `min(1)` failure, not size code |
| Review revision empty | Allowed by `min(0)`; oversized still refused |
| Non-size schema error | Existing `E_LLM_SCHEMA_INVALID` + repair |
| Size refusal | No repair request; one provider attempt max |
| Existing override/compat clients | Schema shape unchanged; only content bounded |

## 6. Tests and commands

```powershell
npm.cmd test -- --run test/unit/agents.schemas.test.ts test/unit/llm.client.test.ts
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run e2e
npm.cmd run assert-stage -- --stage=p7 --json
npm.cmd run preflight -- --port 0 --json
```

Acceptance: schema boundary tests fail on old code and pass with the bound; provider test proves one request and `E_FILE_TOO_LARGE`; full suite/E2E/stage/preflight stay green.

## 7. Rollback

- Remove the bounded-content factory and restore plain `z.string()` content fields; remove the client issue-code special case and `REFUSALS` entry.
- No DB migration, no artifact/workspace change. `writeStaged` continues to protect writes during rollback.

## 8. Out of scope

- P0-1 writer matrix, P0-2 review coverage, P0-4 terminal writer fixtures, P0-5 historical NULL audit.
- Max-plan file count, context-budget, and provider output-token caps.
- Any UI/API route change; no live provider call; no generated-code execution.
