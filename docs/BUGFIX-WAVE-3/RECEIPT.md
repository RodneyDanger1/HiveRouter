# BUGFIX WAVE 3 — receipt

## Fixes

| ID | Defect | Fix | Evidence |
|---|---|---|---|
| W3-01 | `runTimeoutMs` declared but never armed; runs could hang indefinitely | one timer per run, `E_RUN_TIMEOUT` reason, cleared on settle | `run-timeout.test` PASS; `errors.jsonl` E_RUN_TIMEOUT records |
| W3-02 | Timeout would be classified as cancellation | `signal.reason` checked before `aborted`; status `failed`, code `E_RUN_TIMEOUT` | test asserts failed/code; error log records |
| W3-03 | No durable error/crash log | redacted `errors.jsonl` + `crash.log`; HTTP/run/executor/startup/shutdown sources | `error-log.test` 2/2; `data/logs/errors.jsonl` exists with 3 timeout records |
| W3-04 | HTTP 500 and pipeline failures were console/request-log only | `recordError` wired into Fastify error handler and pipeline catch | code + log test; no secret pattern in log |

## Verification

- `npm.cmd run typecheck` PASS
- `npm.cmd test -- --run`: **32 files / 229 tests PASS**
- `npm.cmd run build` PASS
- `npm.cmd run e2e`: **26/26 PASS**
- `npm.cmd run verify` PASS
- strict stage: **138 files / 45 tables / 47 routes / 23 scripts**
- preflight PASS
- live smoke PASS `$0.0000321`
- stub-sweep clean (81 files); secret-scan clean (136 files)
- error log sample contains only redacted structured records; no key pattern

## Skills applied

- `research` — traced timeout/crash/error paths and Node process behavior.
- `capability-auditor` — mapped app/run/executor error surfaces and durable log capabilities.
- `logic-debugger` — timeout→failed transition, cancellation separation, no lost run state.
- `smartfix` — four RED/GREEN fixes.
- `auditor` — independent tests, full gates, no test weakening, secret scan.
- `agent-experience` — failed runs now have a durable code/message surface; UI already renders run error.
- `agent-native-design` — stable `hive.error.v1` fields for machine use, human `crash.log`.
- `forge` — root-cause localization for unused timeout and missing durable logs.

## Residual / unverified

- Real process crash was not triggered in the live server; `recordCrash` is unit-tested. A live crash test would terminate the session.
- HTTP 500 error-log path is wired and unit-covered indirectly, not forced through a live 500.
- Log rotation >5 MB is implemented but not exercised with a 5 MB file.
- Per-HTTP-attempt reservation and DP-cap residuals remain unchanged and documented.
