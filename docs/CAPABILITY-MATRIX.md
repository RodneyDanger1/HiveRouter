# HiveRouter capability matrix

Status is deliberately blunt. “Partial” means the path exists but a material limitation remains; “absent” means there is no product path.

| Capability | Current | Evidence / limitation |
|---|---|---|
| Plan a bounded file matrix | Works | Architect schema + max 24 files |
| Route files to personas | Partial | CCR DP exists; constant cost/latency normalizers and auth risk now apply; critical path is still binary and full weighted CPM is not implemented |
| Context packing | Partial | CPO uses 1-token units, CJK-aware estimates, and 200-iteration PageRank; full projection provenance (agentId/maxTokens/expected prefix hash) is still not persisted |
| Generate whole files | Works | One DeepSeek JSON call per file/persona |
| Repository read/search tools | **Absent** | Agents receive a prompt; no tool registry or repo tools |
| Autonomous tool loop | **Absent** | `llm/client.ts` rejects `tool_calls`; agents are one-shot |
| Review findings gate completion | **Now works** | Critical findings fail the gate; non-critical ungrounded findings are warned as `REVIEW_UNGROUNDED_WARNING`; rows written to `reviews` |
| Repair loop | Partial | Bounded static re-verification; not a runtime test loop |
| Test generation | Works (files only) | Gatekeeper writes tests; tests are **not executed** |
| Static syntax verification | Partial | TS/JS transpile, Python AST, JSON/YAML/HTML; SQL is non-executing and often unverified |
| Execute generated code/tests | **Absent** | Explicit non-goal; no sandbox |
| Retain failed-run work | **Now works** | Staged artifacts under `staged/`, marked `staged`; accepted only after publish |
| Accurate run spend/usage | **Improved** | Unknown usage is NULL/partial; stats includes measured chat; legacy rows not backfilled |
| Step/tool trace | Partial | One trace row per terminal run; no tool calls, no per-step trace |
| Resume a run | **Partial** | Re-verifies/publishes retained `staged` files as a child resume run with no provider call; no mid-run checkpoint table or parallel branch |
| Parallel file generation | **Absent** | Sequential; one active run |
| P7 evaluation | **Absent** | No `eval_runs`/`eval_results` producer; promotion unreachable |
| P7 promotion/rollback | Code exists, unreachable | Sealed pool/consent + evaluation absent |
| Chat | Works (B2) | Durable jobs, leases, retries, SSE, cancellation |
| Multi-user/cloud | **Absent** | Local single-user process |
| Native `.exe` | **Absent** | Chrome app-window launcher only |
| Browser/computer use | **Absent** | No browser driver or desktop actuator |
| MCP/tool runtime | **Absent** | No MCP client/server |
| Skills registry | **Absent** | Prompts live in the registry |
| FTS5 run-workspace search | **Works** | `POST /api/runs/:id/search` + run-detail Search tab; disposable trigram index over published files only; no path input, no staged files; workspace signature detects edits and rebuilds before serving |
| Git checkpoints | **Absent** | No product Git integration |
| Static analysis API and page | **Works** | `/analysis` UI drives `GET /api/analysis`, `POST /api/analysis/dominators`, `POST /api/analysis/scorecards`; bounded, named 422, no file access |
| Scripts catalog and UI | **Works (read-only)** | `/scripts` lists `GET /api/scripts`; dry-run returns a local command string only, never executes; paid scripts are labeled and refused with `E_SCRIPT_DRY_RUN_UNSUPPORTED` |
| Dependency dominator risk | **API + UI** | Static file-level heuristic exposed; not wired into the run pipeline |
| Scorecard variance debate | **API + UI** | Four-opinion variance/debate hint; not a verdict and not wired into an analysis preset |
| Exact patch/AST tightening | **Not shipped** | Standalone module + tests; no run/API integration |
| Tag-preserving compaction | **Not shipped** | Standalone module + tests; no context/chat integration |
| Isolation branches | **Not shipped** | Standalone module + tests; no failure path integration |

## Good at

- Deterministic, bounded scaffold generation.
- Refusal-first error taxonomy and path safety.
- Micro-USD reservation/commit/release mechanics.
- Static secret/stub/syntax checks (with explicit unverified states).
- Durable event/chat ledgers and SSE replay.

## Not good at

- Repository-aware generation.
- Runtime proof that generated code works.
- Agentic tool use.
- Learning/evaluation.
- Parallelism and full mid-run checkpointing (staged-file resume is partial).
- Honest aggregate truth before the current P0 work; some legacy rows remain unbackfilled.
