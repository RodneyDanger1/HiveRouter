# Wave 13 decision plan — terminal truth across runs, steps, events, snapshots, usage, and traces

Date: 2026-11-05
Owner: HiveRouter lead
Baseline: `ef8a838` (443 tests / 69 files; 34/34 E2E; 200 stage files / 51 tables / 62 routes / 24 scripts)
Scope item: `docs/BACKLOG.md` P0-4 — full writer tests for failed/cancelled/budget/interrupted paths.

## Execution status

Implemented and verified. Terminal `updateRun` settles open steps; startup interrupt settles explicitly; manager-owned paths and `markTerminal` record the shared trace and set `trace_complete`. RED: all four new terminal tests failed on the pre-fix tree (open steps/trace missing). GREEN: 4/4; full **447 tests / 70 files**, E2E **34/34**, stage **202 files / 51 tables / 62 routes / 24 scripts**, preflight PASS. Evidence: `docs/TRACE/WAVE-13/TRACE-SUMMARY.md`.

## 1. Outcome

Every terminal status has one coherent truth across six stores: the `runs` row, every `steps` row, the terminal `events` row, the snapshot endpoint, the `usage` aggregation, and the P7 `traces` row plus `trace_complete`. A terminal write never leaves an open `started` step. Manager-owned terminal paths record a trace instead of relying on the pipeline catch.

## 2. Current behavior (evidence)

- `updateRun` validates terminal transitions and CAS-writes the run row, but does not settle `steps`; an open step remains `started` when a terminal write happens outside `agentStep`'s catch (`src/server/runs/recorder.ts:134-205`).
- `markStartupInterrupted` uses raw guarded SQL and updates the run, emits `run.interrupted`, logs, and releases budget, but never settles steps or records a trace (`src/server/runs/manager.ts:207-236`).
- `cancelRun` for a `needs_review`/`queued`/`paused` run updates the run and emits `run.cancelled` but does not settle steps or record a trace (`manager.ts:185-202`).
- The manager executor catch updates the run and emits `run.failed` but does not settle steps or record a trace (`manager.ts:156-181`).
- `recordRunTrace` lives in `src/server/pipeline/run.ts:111-146`; manager cannot import it without a cycle.
- Existing tests cover interrupted budget release, terminal usage, and event/message truth, but no single fixture asserts all six stores for all four terminal statuses.

## 3. Decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Settle open steps inside `updateRun` when `patch.status` is terminal | Patch each caller separately | Centralizes the invariant so future writers cannot forget |
| Explicitly settle steps in `markStartupInterrupted` | Route startup through `updateRun` | The guarded raw SQL is deliberate; keep its CAS semantics and add the step settle after the successful change |
| Step status mapping: `failed` for failed/budget/interrupted; `cancelled` for cancelled | Use `failed` for all | A cancelled run should not claim an execution failure |
| Move terminal trace recording to `src/server/runs/terminal-trace.ts` | Duplicate the trace body in manager | Avoids a manager↔pipeline cycle; one producer |
| Manager catch/no-controller cancel/interrupt record trace and set `trace_complete` from its result | Leave P7 traces to the pipeline catch | These are terminal paths that currently never reach the pipeline catch |
| Keep `recordRunTrace` exported from `pipeline/run.ts` as a wrapper | Remove the export and update all imports | Preserve the existing pipeline API while sharing the implementation |
| Keep the startup interrupt event type `run.interrupted` and code `E_RUN_INTERRUPTED` | Reuse `run.failed` | The status and event already have a distinct honest name |

## 4. File-by-file change

### `src/server/runs/recorder.ts`

- Add:
  ```ts
  export function settleOpenSteps(
    runId: string,
    status: 'failed' | 'cancelled',
    error?: { code?: string; message?: string },
  ): number
  ```
  Update only `steps.status = 'started'` for the run; set `finished_at`, `error_code`, `error_message`, return changes.
- In `updateRun`, after a successful CAS, when `patch.status` is terminal:
  - `settleOpenSteps(runId, patch.status === 'cancelled' ? 'cancelled' : 'failed', { code: patch.error_code ?? undefined, message: patch.error_message ?? undefined })`.
  - Same-status idempotent writes still call the settle (it is a no-op if no open steps).

### `src/server/runs/terminal-trace.ts` (new)

- Move the body of `pipeline/run.ts`'s `recordRunTrace` here as `recordRunTerminalTrace`, with the same P7 gate, usage, checks, error logging, and `false` on skip/failure.
- No new behavior in the move.

### `src/server/pipeline/run.ts`

- Import `recordRunTerminalTrace` and keep:
  ```ts
  export function recordRunTrace(runId, outcome): boolean {
    return recordRunTerminalTrace(runId, outcome);
  }
  ```
- Remove the duplicated body/imports that become unused.

### `src/server/runs/manager.ts`

- Import `recordRunTerminalTrace` and `settleOpenSteps`/`setTraceComplete`.
- Executor catch: after the run update and event, `setTraceComplete(id, recordRunTerminalTrace(id, 'failure'))`.
- No-controller cancel: after update/event, `setTraceComplete(runId, recordRunTerminalTrace(runId, 'cancelled'))`.
- `markStartupInterrupted`: after the guarded update/event/log/budget release, `settleOpenSteps(row.id, 'failed', { code: 'E_RUN_INTERRUPTED', message })` and `setTraceComplete(row.id, recordRunTerminalTrace(row.id, 'failure'))`.
- `markTerminal`: after update, `setTraceComplete(runId, recordRunTerminalTrace(runId, status === 'cancelled' ? 'cancelled' : status === 'budget_exceeded' ? 'budget_exceeded' : 'failure'))`. Only terminal statuses call it.

### Tests — `test/unit/terminal-writers.test.ts`

Setup: temp data dir + in-memory DB (`initDb(':memory:','B2')`), `createRunRow`, `startStep`, `insertUsage`, `getEvents`, `getRun`, `getSteps`, `getTraceByRunId`, `buildApp` for snapshot.

For each status:

1. **failed** — executor rejection path via `setExecutor(() => Promise.reject(new Error('E_PROVIDER_EMPTY')))` and `createRun`; wait for terminal; assert run `failed`, no `started` step, step `failed`/`E_PROVIDER_EMPTY`, one `run.failed`, usage null/unknown, trace row/complete, snapshot run status + closed step.
2. **cancelled** — create paused run + started step + no controller; `cancelRun`; assert run `cancelled`, step `cancelled`/`E_CANCELLED`, one `run.cancelled`, trace `cancelled`/complete, snapshot.
3. **budget_exceeded** — create running run + started step + usage; call `markTerminal(runId,'budget_exceeded','done',{code:'E_BUDGET_EXCEEDED',...})`; assert run/step/trace/snapshot/usage. Event truth is the pipeline's catch path; this test names that the `markTerminal` path does not emit an event (or asserts existing event if the gate path emits one).
4. **interrupted** — create running run + started step + usage; `markStartupInterrupted`; assert run/step `failed`/`E_RUN_INTERRUPTED`, one `run.interrupted`, usage, trace/complete, snapshot.

Every assertion is a single helper or explicit test; no test may pass with an open step.

## 5. Failure modes

| Failure | Expected |
|---|---|
| Terminal run with open step | Test fails on `getSteps(...).status === 'started'` |
| Missing step settlement in startup raw SQL | Interrupted test fails |
| Missing trace for manager paths | Trace test fails |
| Step status wrong for cancel | Cancel test fails |
| Double trace on pipeline path | Existing trace uniqueness/upsert test + pipeline tests |
| P7 disabled | Trace helper returns false; no fabricated row; existing A/B tests |
| CAS race | Existing `updateRun` compare-and-set prevents overwrite; step settle runs only after successful CAS |
| Event/run code disagreement | Assert event code/message equal run code/message |

## 6. Tests and commands

```powershell
npm.cmd test -- --run test/unit/terminal-writers.test.ts test/unit/terminal-usage.test.ts test/unit/startup-interrupt.test.ts
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run e2e
npm.cmd run assert-stage -- --stage=p7 --json
npm.cmd run preflight -- --port 0 --json
```

Acceptance: one test per terminal status with run/step/event/snapshot/usage/trace assertions; RED evidence on the pre-fix tree for the open-step/trace gaps; GREEN after; full gates unchanged.

## 7. Rollback

- Remove the recorder settlement call and the manager trace calls; restore the pipeline-local `recordRunTrace`; delete `terminal-trace.ts` and the new test. No DB migration, no API shape change.

## 8. Out of scope

- P0-1 writer matrix, P0-2 per-file review coverage, P0-5 historical NULL audit.
- Approval `needs_review`, repo tools/tool loop, P7 evaluator, checkpoints, parallel generation.
- No paid provider call; no UI change; no generated-code execution.
