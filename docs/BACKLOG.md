# HiveRouter — Remaining Engineering Backlog

This is the honest work queue for the next waves. It is ordered by user impact and risk, not by how easy it is to demo. Every item includes an acceptance gate that would prove it rather than assert it.

## Already delivered in the current showcase checkpoint

- Truth-first run states, staged failed artifacts, terminal usage accounting, atomic publish, event/ledger parity.
- Deterministic CCR routing, CPO context packing, static verification, critical review gate, bounded repair.
- Idempotent chat fan-out with leases, retries, cancellation, SSE projection, and newest-context history.
- 37 role prompts with anti-fabrication doctrine.
- Read-only dominator/scorecard API and `/analysis` page.
- FTS5 search over one terminal run’s published workspace, with workspace-change detection and rebuild.
- Staged-file resume without a provider call.
- 474 unit/integration tests, 44 Playwright tests, stage/OpenAPI/secret/stub gates.

## P0 — correctness before capability

| # | Item | Why it matters | Acceptance |
|---|---|---|---|
| P0-1 | Review every writer against the phase/status matrix — **delivered Wave 17** | A guard that rejects a legal writer is as bad as a missing guard | `writer-matrix` SQLite trigger captures every persisted status/phase edge across all presets/terminal writers; exhaustive 10×10 status / 11×11 phase pairs; static writer inventory; the dead terminal-phase guard was hardened for every terminal status |
| P0-2 | Per-file review coverage — **delivered Wave 14** | A review that only sees some files is not a review | `reviewedFiles` contract; `REVIEW_UNREVIEWED` warning names every allowed file not declared; clean partial coverage becomes `completed_with_warnings` |
| P0-3 | Schema-level file-size bound — **delivered Wave 12** | Byte limits must be enforced before persistence, not only after | File/test/review content is UTF-8-byte bounded in Zod; `E_FILE_TOO_LARGE` survives the provider boundary; no repair call; `writeStaged` remains defense in depth |
| P0-4 | Full writer tests for failed/cancelled/budget/interrupted paths — **delivered Wave 13** | Terminal truth is not one code path | Four terminal integration tests; open steps settle on every terminal write; manager paths record trace and `trace_complete`; budget event path remains pipeline-owned |
| P0-5 | Historical NULL handling audit — **delivered Wave 17** | Unknown spend must stay unknown forever | Spend-column UPDATE trigger, DB reopen, list/detail/snapshot, and stats tests prove no historical NULL becomes zero; unaccounted run/chat spend forces `partial`/NULL totals while measured sums remain visible |

## P1 — finish the router

| # | Item | Why it matters | Acceptance |
|---|---|---|---|
| P1-1 | External read-only repo index | Current search only sees one published run | Allowlisted roots, path-safe walk, FTS5/symbols, partial-scan `complete`/`missingRoots`, no write APIs |
| P1-2 | Read-only repo tools | Agents cannot inspect source today | `list/read/stat/search` tools with bounds, egress policy, and named refusals |
| P1-3 | DeepSeek tool-call loop | The 37 personas are one-shot prompts | Allowlisted tools, turn budget, usage accounting, trace, no execution, replay-safe cancellation |
| P1-4 | Analysis preset / four-way debate | Dominators and scorecards are API-only | Planner routes to four roles, evidence-backed scorecards, bounded debate trigger, no verdict claim |
| P1-5 | Approval / `needs_review` | The status exists but has no producer or decision API | Exact transition table, approve/deny endpoints, UI, idempotency, terminal truth |
| P1-6 | Full checkpoints | Staged-file resume is not mid-run resume | Checkpoint rows/dirs per phase; resume from the last durable phase; no duplicate provider calls |
| P1-7 | Bounded parallel generation | Sequential generation is a latency ceiling | DAG-level batching, bounded concurrency, deterministic artifact order, budget-safe reservations |
| P1-8 | Wire patch/compaction/branch modules | Three tested mechanisms are not shipped | Patch path integrated into repair, compaction into bounded chat/history, isolation branch on failed patch/gate, API/UI where needed |
| P1-9 | Weighted CPM and full context projection | Critical path is still binary; projection fields are incomplete | Latency-weighted CPM, exact criticality, persisted agentId/maxTokens/expected prefix hash |
| P1-10 | Scripts UI/schema — **delivered Wave 8** | CLI scripts are not agent-discoverable | `/scripts` page + `GET /api/scripts` catalog + command-hint dry-run; paid refusals tested; no execution |

## P2 — evidence and operations

| # | Item | Why it matters | Acceptance |
|---|---|---|---|
| P2-1 | P7 evaluator | No sealed pool, no consent, no promotion | Schema/loader/worker, exact 65-case suite use, statistics, approval token, promotion/rollback; still refuses without consent |
| P2-2 | Multi-process chat worker | One in-process worker is a single-owner design | DB lease claim across two processes; kill/restart reaper exercise |
| P2-3 | Search index freshness — **delivered Wave 10** | Published files can be edited manually | Workspace signature (path/size/mtime) detects edits; rebuilds before serving; `indexState` built/reused/rebuilt; tests pin edit/delete/missing paths |
| P2-4 | Mobile and keyboard-only UI pass — **delivered Wave 11** | Desktop E2E is not the whole operator surface | 390×844 Analysis/Search overflow tests, keyboard tab selection/focus, mobile nav focus ownership; 34/34 E2E |
| P2-5 | Retained-run cleanup | Staged/evidence growth is unbounded | Retention policy with dry-run, explicit delete, and audit row |
| P2-6 | CI workflow | Gates are local commands | GitHub Actions: `npm ci`, typecheck, test, build, E2E (mock), stage assert, sweeps |
| P2-7 | License and contribution policy | A public showcase needs a reuse decision | Choose license, add LICENSE, document contribution/security reporting |
| P2-8 | Dependency audit — **partial Wave 15** | Pinned stack changes over time | `npm audit` triage with accepted-risk records; no silent upgrades |

## Test matrix to add

- **State machine:** every status edge × every production writer; illegal edges named.
- **Persistence:** failed/cancelled/budget/interrupted terminal rows + snapshot + event + usage + trace in one fixture.
- **Resume:** successful publish, no staged files, partial staged tree, verify failure, duplicate resume requests.
- **Search:** empty index, short query, 2,000-file cap, 256 KB skip, stale index, concurrent first search.
- **Analysis:** oversized graph, unknown specialist, duplicate specialist, iteration cap.
- **Chat:** history budget with current turn, huge single turn, fan-out pairing, retry/replay, cancellation/reaper.
- **Agent prompts:** every prompt has one role/objective, anti-fabrication doctrine, no forbidden format tokens.
- **UI:** mobile, keyboard, refusal rendering, no false success after a failed mutation.

## Verification gates for the next wave

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run e2e
npm.cmd run assert-stage -- --stage=p7 --json
npm.cmd run preflight -- --port 0 --json
npm.cmd run stub-sweep
npm.cmd run secret-scan
```

A wave is not done until all of these pass on a quiet tree, the new failure path has been exercised, and the capability matrix is updated with **works / partial / absent** rather than aspirational wording.
