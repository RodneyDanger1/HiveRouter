# BUGFIX WAVE 2 — receipt

**Scope:** HiveRouter backend, agent runtime, routing, budget/usage accounting, artifact attribution, revision boundary, route disclosure, UI contract, integrations, and regression gates.
**Tree:** working tree after TestDrive/Trace waves; no git commit. Server restarted on the final tree.

## Claims / evidence

| # | Claim | Evidence | Status |
|---|---|---|---|
| 1 | User `thinking`/`effort` now reaches the provider | `agent-runtime.test` captures `chatJson` options; 3/3 GREEN; `agent-runner.ts` `runtimeFor` | **VERIFIED** |
| 2 | Routed model/thinking/effort now reaches generation | `run.ts` `RouteRuntime` map + generation options; unit test model flash→pro; live run route events | **VERIFIED (unit + live route fields)** |
| 3 | Router uses the per-run cap | `runBudgetUsd` test; live `run_9c…` max $0.03 → `/routing reserveUsd=0.006` | **VERIFIED** |
| 4 | Failed JSON-repair attempt usage is counted | `agent-runtime.test` two `onAttemptEnd` usages → `[0.003,0.004]`, total 0.007; `agent-runner` merge | **VERIFIED (unit)** |
| 5 | Artifacts record the actual writer | `artifactAgentId` test; live `tests/…` artifact `gatekeeper`, code `python-engine` | **VERIFIED** |
| 6 | Out-of-plan revisions fail closed | new `pipeline-qa` test expects `E_AGENT_OUTPUT_MISMATCH` | **VERIFIED** |
| 7 | `/routing` discloses per-run reserve + model/thinking | API test; live `reserve=0.006`, decisions `deepseek-flash/disabled` | **VERIFIED** |
| 8 | Invalid cost/target inputs fail before create | API test: string `maxCostUsd` → 422 `E_BUDGET_INVALID_LIMIT`, no run; target path validated at the same boundary | **VERIFIED (cost test; target code inspected)** |
| 9 | No regression | `typecheck` PASS; **226 tests / 30 files**; **26/26 E2E**; build PASS | **VERIFIED** |
| 10 | Stage/preflight/live | strict stage **135 files / 45 tables / 47 routes / 23 scripts**; preflight PASS; live smoke PASS `$0.00001605` | **VERIFIED** |
| 11 | No secrets/stubs | `secret-scan` clean (133 files); `stub-sweep` clean (80 files) | **VERIFIED** |
| 12 | Internal HTTP retries share one reservation | code inspection `#requestWithRetry` + `callAgentJson`; no failing live reproduction | **READ / UNVERIFIED** |
| 13 | DP cap > $1 unreachable under current max | `ccr.ts` `MAX_DP_CAPACITY` vs `config.limits.maxRunCostUsd` 0.5 | **READ** |
| 14 | Whole-tree finalize atomicity | `finalize` per-file writes; unchanged | **READ / UNVERIFIED** |

## Live verification

- Run `run_9c1e2390e875e16eb3` — full-build, max $0.03, completed, cost **$0.00367362**; route reserve $0.006; 2 artifacts; 5 checks pass.
- Run `run_066581ff6b793a7aa9` — full-build, max $0.03, completed, cost **$0.002487852**; `/routing` decisions disclose `deepseek-flash`, `disabled`; artifacts `src/hello_w2.py:python-engine`, `tests/test_hello_w2.py:gatekeeper`.
- Active run after: none. Key fingerprint only; no key value printed.
- Server was restarted by Lead before these runs; final process health B2.

## Files changed

`src/server/pipeline/agent-runner.ts`, `src/server/pipeline/run.ts`, `src/server/runs/budget.ts`, `src/server/app.ts`; tests `test/unit/agent-runtime.test.ts` (new), `test/unit/logic-core.test.ts`, `test/pipeline-qa.test.ts`, `test/unit/trace-fixes.test.ts`.

## Not done / accepted

- Internal HTTP retry reservations remain a bounded risk; fixing correctly needs per-HTTP-request reservation hooks. Not claimed fixed.
- `MAX_DP_CAPACITY` ($1) remains; current `maxRunCostUsd` 0.5 makes it unreachable. No algorithm rewrite without a reproducing input.
- Whole-tree atomic finalize and P7 live learning remain out of this wave (no sealed pool/consent).
- `applyRevisions` now fails closed; this may reject runs where an agent hallucinates an extra path. That is intentional, but the live frequency is unmeasured.
- No full 37-agent live matrix; no paid stress; no UI redesign.

## Unverified

| Item | What would prove it |
|---|---|
| Real provider respects the routed `thinking/effort` exactly | Capture the actual request body for a routed run; current evidence is option capture + live route fields, not a provider wire capture. |
| Failed-attempt usage in a real JSON-repair run | Run a deliberate invalid-JSON repair against the provider and inspect `usage` rows; unit proves the hook path only. |
| Internal HTTP retry overcommit | A fault-injected 5xx/retry test with per-request reservation accounting. |
| Every route candidate’s model/thinking | `route_candidates` schema lacks those columns; only the chosen decision is disclosed. |
| All 36 trace-UNVERIFIED controls | Safe staging/doubles for paid/destructive controls. |
