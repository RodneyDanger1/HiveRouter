# HiveRouter stop-work defects and current fixes

This is the honest release register. A defect is only “fixed” when the named tests pass and the product path uses it.

## P0 — release blocking

| ID | Defect | Status | Evidence |
|---|---|---|---|
| P0-1 | Verifier executed generated SQL | **Fixed** | `verify/syntax.ts` no longer imports `DatabaseSync`; `test/unit/sql-static.test.ts` covers DDL/DML/ATTACH/multi-statement behavior |
| P0-2 | Reviewer verdicts did not gate | **Fixed** | Critical findings (including ungrounded critical findings) become `review.<kind>` fail checks; non-critical ungrounded findings are `REVIEW_UNGROUNDED_WARNING`; `reviews` rows written; `test/unit/p0-truth.test.ts` |
| P0-3 | Failed runs discarded paid artifacts | **Fixed** | `persistStagedArtifacts` copies to `staged/`, records `status='staged'`; UI labels staged; `test/unit/p0-truth.test.ts` |
| P0-4 | Spend/stats could lie | **Fixed for new runs** | Unknown usage commits reservation with `null`; `/api/stats` returns measured/partial/unknown and chat cost; `test/unit/stats-truth.test.ts`; legacy rows are not backfilled |
| P0-5 | `trace_complete` and trace producer mismatch | **Fixed for new terminal runs** | `recordRunTrace` uses `trace-store`, flag set from returned evidence; DB open reconciles historical flags; `test/unit/p0-truth.test.ts` |
| P0-6 | P7 described as implemented/unreachable | **Docs corrected** | README/ARCHITECTURE/CAPABILITY now state no production evaluator; promotion not claimed |
| P0-7 | Phase matrix dead/wrong | **Fixed** | `intake→cleaning/generating/finalizing` added; `updateRun` validates non-terminal phase writes; tests |
| P0-8 | Prompt envelope injection | **Fixed** | `buildUserPrompt`/`reviewPrompt` escape untrusted text and attrs; `test/unit/prompt-envelope.test.ts` |
| P0-9 | Stage lock failed open | **Fixed** | `HIVE_PHASE` is required at module load; vitest sets B2 explicitly |
| P0-10 | `/chat` deep link 404 | **Fixed** | SPA known route includes `/chat`; E2E asserts response 200 |
| P0-11 | Capability labels overclaimed tests/tools | **Partially fixed** | Test badge now says “writes test files (not executed)”; README says no tools; deeper agent evidence labels still need UI cleanup |

## P1 — correctness/quality

| ID | Defect | Status |
|---|---|---|
| P1-1 | Fitted max tokens not sent | **Fixed** in `callAgentJson` via `onAttemptStart`; test |
| P1-2 | Settlement failure killed a run | **Fixed**; logged, reservation not double-settled; test |
| P1-3 | Context projection hardcoded | **Partial**: excluded `path`/`tokens` now projected and `cacheable` is no longer claimed true; real `agentId`/`maxTokens`/expected-prefix provenance remains open |
| P1-4 | Routing persistence hardcoded | **Partial**: real rank index and rejection JSON now persisted; fallbacks/skipped-task provenance remains open |
| P1-5/6 | Router objective/PageRank/CPO math gaps | **Partial**: constant cost/latency normalizers and auth-path risk now apply; PageRank iterations raised to 200 and uniform `importance:1` removed; CPO uses 1-token units and CJK-aware estimates. Binary critical path and full weighted CPM remain open |
| P1-7 | Scripts API advertises unsupported dry-runs | **Fixed**: paid scripts report `dryRun:false`; handler allowlist is read-only. Separate `/api/scripts/:id/schema` UI remains absent |
| P1-8 | Open-folder spawn could crash | **Fixed** with `spawn`/`error` promise + refusal |
| P1-9 | `needs_review` has no writer | Open; approval gate not implemented |
| P1-10 | Review coverage/line grounding | **Fixed for declared coverage**: `reviewedFiles` and `REVIEW_UNREVIEWED`; line grounding still partial |
| P1-11 | `maxFileBytes` not enforced at write | **Fixed** in `writeStaged` and at the schema boundary with `E_FILE_TOO_LARGE` |
| P1-12 | Artifact mime absent | **Fixed** for new rows; staged/failed UI shows status |
| P1-13 | Chat idempotency scope/body | **Fixed**; thread-scoped key + request hash; cross-thread/body reuse refuses `E_IDEMPOTENCY_KEY_REUSED` |
| P1-14 | Stats/trace labels | **Partially fixed**; UI now says measured/unknown and “No trace row” |
| P1-15 | Dead learning tables/producers | Open |
| P1-16 | CSRF `Sec-Fetch-Site` | **Partial**: cross-site `Sec-Fetch-Site` is rejected when present; an absent `Origin` on a non-GET is still accepted because tests/clients may omit it |
| P1-17 | Key-ingress copy named a nonexistent `hive` command and no `--from-env` | **Fixed**: real `npm.cmd run key:import -- --from-env`; regular non-symlink ≤64 KiB inputs |
| P1-18 | Settings claimed a DSH consent-gated read | **Fixed**: runtime never reads DSH; UI/PLAN corrected; dead `E_DSH_*`/`dshCredentialsPath` removed |
| P1-19 | Paid retry paths discarded their idempotency key; chat UI hid fan-out and exceeded the server cap | **Fixed**: stable keys for composer/chat/agent/revision/audit; multi-select capped by `/api/meta.chatMaxAgents`; browser proof |
| P2-8 | Unused dependency baggage | **Partial**: removed unused `@langchain/core`/`@langchain/langgraph`; `@fastify/static` upgraded to 10.1.10; `npm audit --omit=dev` now 0 vulnerabilities |

## Known non-goals

- Generated-code execution/sandbox.
- Native `.exe`.
- Computer use, TTS/video, browser automation.
- Multi-user/cloud.
- Full P7 evaluator without operator data.
- Learned routing/promotion without an evaluation producer.
