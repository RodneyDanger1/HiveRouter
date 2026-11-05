# BUGFIX WAVE 2 — skill application matrix

Every skill was applied at least three times to different parts of the backend/UI/integration stack.

| Skill | Applications |
|---|---|
| **research** | (1) trace provider runtime from `snapshot.thinking` to `ChatRequest`; (2) trace per-run `maxCostUsd` from `createRun` to `scopeCap`/router; (3) trace failed JSON-repair usage through `structured`/`onAttemptEnd` to run totals; (4) trace artifact agent identity from generation to `insertArtifact`; (5) trace revision scope from API metadata to `executeReviewRun`; (6) inspect registry/vault/SSE/learning boundaries. |
| **capability-auditor** | (1) 37-agent census (plan 4, text 1, files 28, review 3, tests 1; 32 writers, 12 unverified/20 syntax/5 static-only); (2) route capability vs actual dispatch; (3) ad-hoc agent model/thinking capability; (4) artifact attribution vs actual writer; (5) report-only route disposition. |
| **logic-debugger** | (1) thinking transition: user setting vs agent runtime; (2) budget invariant: allocatable router budget ≤ per-run cap; (3) usage accounting across failed/successful attempts; (4) revision boundary: no silent drop outside the plan; (5) artifact identity invariant: recorded agent equals writer; (6) route disclosure invariant. |
| **smartfix** | (1) B1 runtime/model precedence; (2) B2 router budget bound; (3) B3 failed-attempt usage; (4) B4 artifact attribution; (5) B5 revision fail-closed; (6) B6 routing disclosure. Each with RED then GREEN. |
| **auditor** | (1) independent targeted tests; (2) full 225-test suite; (3) full 26 E2E; (4) strict stage/preflight/live gates; (5) additive-test/no-weakening check; (6) key/secret scan. |
| **agent-experience** | (1) Thinking control was not reaching agents; (2) router tab model/thinking was null and reserve was global; (3) max-cost expectations for low-cap runs; (4) agent drawer/run detail route evidence; (5) honest refusal/empty state check. |
| **agent-native-design** | (1) explicit `AgentCallOptions` model/thinking/effort contract; (2) route→agent runtime handoff; (3) structured output/usage semantics; (4) named refusal boundaries for revision/output; (5) capability self-description in route API. |
| **forge** | (1) root cause of hardcoded runtime; (2) root cause of route field loss; (3) root cause of global router budget; (4) root cause of failed-attempt usage omission; (5) root cause of path-derived artifact attribution; (6) root cause of silent revision skip. |
| **forgewright-plan** | (1) outcome/current/decisions; (2) file-by-file change and failure modes; (3) tests/rollback/out-of-scope; (4) acceptance and residual labels. |
| **forgewright-lead** | (1) integrated the seven edits and tests; (2) restarted the tree and ran full gates; (3) independent evidence-check and claim table; (4) recorded unverified residuals rather than claiming them. |

## Defect ledger

| ID | Severity | Defect | Fix | Evidence |
|---|---|---|---|---|
| W2-01 | P1 | User thinking/effort and routed model/thinking/effort were ignored; `runtimeFor` hardcoded | `agent-runner` options + `runtimeFor` precedence; route fields passed in `run.ts` | RED `agent-runtime.test` model flash; GREEN 3/3; live run route model/thinking |
| W2-02 | P1 | Router allocated against global $0.50, not per-run cap | `runBudgetUsd` + `run.ts` policy budget | targeted test; live $0.03 run reserve $0.006, completed $0.00249 |
| W2-03 | P2 | Failed JSON-repair attempt usage missing from run totals | aggregate every `onAttemptEnd` usage once | RED no calls; GREEN two usage calls, 0.007 total |
| W2-04 | P2 | Finalized artifact agent was path-derived, not actual writer | `artifactAgentId` + map in finalize | unit routed polyglot test; live test artifact gatekeeper |
| W2-05 | P2 | `applyRevisions` silently ignored out-of-plan revisions | fail closed `E_AGENT_OUTPUT_MISMATCH` | new pipeline test |
| W2-06 | P2 | `/routing` reported global reserve and null model/thinking | store features + `runBudgetUsd` reserve | API test; live `reserve=0.006`, model/thinking disclosed |
| W2-07 | P2 | `maxCostUsd` string/NaN silently fell back to global cap; unsafe ad-hoc `targetPath` queued then failed later | validate both at HTTP boundary; reject 422 before create | new API test; live code path |
| W2-08 | READ | Internal HTTP retry per-request reservation remains bounded risk | not changed | recorded in plan/receipt |
| W2-09 | READ | DP cap > $1 unreachable under current max cap | not changed | recorded; no reproduction |
