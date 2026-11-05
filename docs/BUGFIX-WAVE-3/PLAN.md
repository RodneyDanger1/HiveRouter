# BUGFIX WAVE 3 — error paths, timeout, and crash observability

## Outcome

HiveRouter now enforces the configured wall-clock run budget, classifies timeout separately from cancellation, and has a durable redacted error/crash log for startup failures, HTTP 500s, executor failures, run failures, and shutdowns. Operators can inspect `data/logs/errors.jsonl` and `data/logs/crash.log` instead of relying only on stdout/console capture.

## Current behavior — evidence

- `src/server/index.ts` previously only `console.error`ed startup failures; no `uncaughtException`/`unhandledRejection` handler and no durable log.
- `src/server/runs/manager.ts` created an `AbortController` but never armed `config.limits.runTimeoutMs`; the setting was declared but unused.
- `src/server/app.ts` logged request errors through Fastify but wrote nothing durable.
- `src/server/pipeline/run.ts` updated the run row on failure but wrote no error record.
- A timeout would have been observed as `E_CANCELLED` because `AbortSignal.aborted` was the only classification signal.

## Decisions

1. Add `src/server/observability/error-log.ts` with redacted JSONL + human crash log; best-effort, never throws.
2. Arm one timer per run with `config.limits.runTimeoutMs`; abort with an `E_RUN_TIMEOUT` reason; clear on settle.
3. Classify timeout before cancellation in `executeRun`; record `E_RUN_TIMEOUT`, status `failed`.
4. Record HTTP 500s, executor failures, run failures, startup failures, and shutdowns.
5. Add `RUN_TIMEOUT_MS` env support (1s–24h) for test/ops control.
6. Keep all existing behavior and tests; no new dependency.

## File-by-file change

- `src/server/observability/error-log.ts` — new redacting structured logger.
- `src/server/index.ts` — crash/rejection handlers, startup/shutdown logging.
- `src/server/runs/manager.ts` — timeout timer, timeout error code, executor error log.
- `src/server/pipeline/run.ts` — timeout classification and run error log.
- `src/server/app.ts` — HTTP 500 structured log.
- `src/server/config.ts` — `RUN_TIMEOUT_MS` override.
- `test/unit/error-log.test.ts` — redaction and crash-record tests.
- `test/unit/run-timeout.test.ts` — non-settling executor aborts and records `E_RUN_TIMEOUT`.

## Failure modes

- Log directory unavailable → logger silently degrades; request/run unaffected.
- Timer fires after normal completion → cleared in `.finally`; no late abort.
- User cancel → no timeout reason, still `cancelled`.
- Timeout during provider call → abort signal propagates; `E_RUN_TIMEOUT` recorded; run failed.
- Crash log write fails → structured record still attempted; process exits.
- Secret in error message/context → redacted before write.

## Tests / gates

`npm.cmd run typecheck`; `npm.cmd test -- --run`; `npm.cmd run build`; `npm.cmd run e2e`; `verify`; stage; preflight; live smoke; secret/stub scans.

## Rollback

Remove the new logger and handler edits; remove timeout timer. No schema migration. The run row behavior without timeout returns to the prior state.

## Out of scope

- Per-HTTP-attempt budget reservations (still documented bounded risk).
- Real crash-triggered process test (would terminate the live server); `recordCrash` is unit-tested.
- Log search UI; files are the operator surface.
