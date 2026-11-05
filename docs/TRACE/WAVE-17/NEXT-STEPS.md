# HiveRouter next steps — after Wave 17 audit

Date: 2026-11-05
Current base: Wave 17 final (474 tests / 74 files · 44/44 E2E · stage 209 · verify exit 0 · preflight PASS)
Current plan: `docs/PLAN-v3.md`, `docs/AGENT-OPERATING-PLAN.md`, `docs/BACKLOG.md`.

## Why these two areas first

The product is already strong at bounded generation, static verification, staged artifacts, run/chat ledgers, refusals, key ingress, retry idempotency, and UI truth. The remaining risk is not another screen: it is **whether state recorded by the system is always the state that happened**, and **whether every rendered control is actually wired to that state**. Wave 17 assigns those two areas to independent seats before adding new capabilities.

## Wave 17 (wave 1 complete; wave 2 in flight)

1. **Seat A — UI/API control truth** (`web/**`, `e2e/**`; skills `weaver` + `agent-experience` + `trace`): D1 desktop dead toggle, D2 chat registry failure render-back, D3 resume idempotency; 3/3 E2E pins. Wave 2 independently re-verifies and audits adjacent actions.
2. **Seat B — ledger/state truth** (`src/server/**`, `test/unit/**`; skills `truthseeker` + `logic-debugger` + `auditor`): D-B1 terminal-phase guard and D-B2 stats unknown spend; 15 unit tests. Wave 2 independently re-verifies and audits review/idempotency.
3. **Wave 2** repeats the same seats with fresh execution contexts: independent re-verification plus one adjacent high-traffic surface.
4. **Lead** folds only after targeted + full gates, updates the claim register and current docs, and commits.

## Priority after Wave 17

Wave 17 closed **P0-1** (production writer matrix + terminal guard) and **P0-5** (historical NULL/unknown spend through stats and projections), plus eight confirmed defects. The next work is capability, in this order:

| Order | Item | Why | Dependency / acceptance |
|---|---|---|---|
| 1 | **P1-2** read-only repo tools | Agents cannot inspect source today | Bounded `list/read/stat/search`, path safety, named refusals, no writes |
| 2 | **P1-1** external read-only repo index | Run search only sees one published workspace | Allowlisted roots, path-safe walk, FTS/symbols, `complete`/`missingRoots`, no write APIs |
| 3 | **P1-3** DeepSeek tool-call loop | 37 personas are one-shot; tools make them capable | Depends on P1-2; allowlist, turn budget, usage/trace, replay-safe cancel, no execution |
| 4 | **P1-5** approval / `needs_review` | Status exists without a producer or decision API | Exact transition table, approve/deny, idempotency, UI, terminal truth |
| 5 | **P1-8** wire patch/compaction/branch modules | Three tested mechanisms are not shipped | Repair uses patch; chat/history uses compaction; failed patch uses branch; API/UI where needed |
| 6 | **P1-6** full checkpoints | Staged resume is not mid-run resume | Checkpoint rows/dirs per phase, resume from last durable phase, no duplicate calls |
| 7 | **P1-7** bounded parallel generation | Sequential generation is a latency ceiling | DAG batching, bounded concurrency, deterministic artifact order, budget-safe |
| 8 | **P1-9** weighted CPM / context projection | Binary critical path and incomplete provenance | Latency-weighted CPM; exact criticality; agentId/maxTokens/expected prefix hash |
| 9 | **P1-4** analysis preset / debate | Analysis API/UI only; not routed | Planner roles, evidence scorecards, bounded debate, no verdict claim |
| 10 | **P2-6 / P2-7 / P2-5 / P2-2** | CI, license, retention, multi-process chat | Operational maturity; CI first, then public-release decisions |

## Non-goals

- Generated-code execution, shell tool, auto-promotion, auto-apply, native `.exe`, multi-user/cloud.
- Paid live test unless an operator explicitly authorizes spend; no fabricated metrics.
- P7 promotion without sealed pool/consent/evaluator.

## Definition of done for each item

Recon with `path:line`; decision-complete plan; logic-gatekeeper Phase 1; deterministic RED; minimal fix; targeted GREEN; full gate; claim-register update; current docs updated; commit/push. A passing test on another path is not evidence.
