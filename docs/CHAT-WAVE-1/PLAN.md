# CHAT-WAVE-1 — live-chat projection, durable agent jobs, residual fields

**Status:** implemented; verification in progress.
**Repo:** `C:\Users\Riley\Desktop\HiveRouter` (B2).
**Scope decision:** this is new additive B2 feature work. There was no live-chat or
`AgentJob` contract in the HiveRouter tree; the earlier “live-chat” language in another
repository was explicitly discarded after the owner corrected the target.

## 1. Problem framing

The requested work has three separable claims:

1. **Live-chat projection** — one owner-facing conversation that can show answers from
   multiple registered agents while each answer remains a durable unit of work. The UI
   must show queued/running/succeeded/failed state and must never present an empty
   pending answer as completed.
2. **Agent job worker/reaper** — a real background consumer for durable chat jobs, with
   an atomic claim, a time-bounded lease, bounded attempts, retry/backoff, cancellation,
   stale-completion rejection, and a reaper for expired leases.
3. **Residual projection fields** — the fields the first projection threw away:
   per-message error, the job/message edge, status/attempt/max-attempt, lease expiry,
   availability, last error, measured cost/tokens, timestamps, and thread-level
   last-job/pending/failed counts.

**What was verified before coding (VERIFIED / READ):**

- `src/server/app.ts` has no chat routes; `src/server/db/migrations.ts` has no chat tables.
- `src/server/runs/manager.ts` is the existing run lifecycle; it is not a chat transport.
- `src/server/llm/client.ts` is the only provider client and emits structured `LlmError`.
- `src/server/runs/budget.ts` has a transactional reservation ledger; `scopeCap('cycle')`
  is the only scope that aggregates independent work without inventing a run.
- The UI shell has `/`, `/agents`, `/runs`, `/vault`, `/learning`, `/settings`; there is no
  composer or SSE code for chat.
- `docs/PLAN-v3.md` is the contract; B2 is the current stage. There is no prior chat plan
  to preserve. This plan is the new source of truth for the additive surface.

**Unknowns closed before implementation:** no external provider docs were needed for the
feature contract; the local client and refusal registry define the provider seam. The
remaining provider behavior (real completion) was proven with one controlled live call,
not assumed.

## 2. Invariants

1. **One user message → N assistant placeholders → N jobs**, atomically. A partial write is
   impossible; a replay with the same idempotency key creates nothing new.
2. **A job has exactly one owning lease at a time.** Claim increments attempts before work;
   a completion only applies if `status='running' AND lease_owner=workerId`.
3. **A terminal job cannot be overwritten** by a stale worker; the result is rejected with
   `E_CHAT_JOB_LEASE_LOST`.
4. **Every terminal path sets a truthful message state**: `complete` only with text,
   `failed` with a named error, `cancelled` with `E_CHAT_JOB_CANCELLED`.
5. **The reaper is idempotent**: an expired lease goes to `queued` while attempts remain,
   or to `failed` with `E_CHAT_JOB_EXHAUSTED` at the ceiling. A cancellation request on an
   expired lease goes to `cancelled`, never back to a retry.
6. **Cost is measured, not guessed.** A succeeded job receives the provider usage value;
   a cancelled job that never reached the provider stays `NULL`, not `0`.
7. **The SSE stream is a projection of durable events**, not an in-memory-only story;
   a fresh subscriber receives the replay window, and a reconnect uses `Last-Event-ID`.
8. **No provider key reaches the browser.** All generation runs in the server worker.
9. **No code execution** and no claim that a chat answer ran tests or wrote files.

## 3. State machine

```
chat_job:
  queued --claim--> running --success--> succeeded (terminal)
    |                  |--deterministic failure--> failed (terminal)
    |                  |--retryable & attempts<max--> queued (available_at backoff)
    |                  |--retryable & attempts=max--> failed E_CHAT_JOB_EXHAUSTED
    |                  |--cancel requested--> cancelled (terminal)
    |                  |--lease expired--> queued | failed/cancelled by reaper
    |--cancel--> cancelled
  succeeded/failed/cancelled: terminal, immutable
chat_message:
  pending --job success--> complete
  pending --job failure/exhaustion--> failed
  pending --job cancel--> failed E_CHAT_JOB_CANCELLED
```

Worker timeout is `min(lease - 5s, lease - 1s floor)`; the reaper cannot legitimately
execute a handler that is still inside its lease-safe window.

## 4. Seats and tools

| Seat | Application |
|---|---|
| **scientific-thinking** | framed claims, separated VERIFIED/READ/INFERRED/UNVERIFIED, chose the simplest honest topology before coding |
| **research** | read local contracts, app routes, DB migration style, LLM/budget seams; no speculative API |
| **logic-debugger** | transition matrix, lease-owner CAS, retry/exhaustion/cancellation reaper edges |
| **integration-logic** | UI → API → store → worker → provider → SSE → UI chain |
| **capability-auditor** | agent registry is the only authority for selectable agent IDs; no fake chat-only agent |
| **trace** | UI control inventory and live render-back proof; no untested “live” claim |
| **truthseeker** | null-vs-zero cost/token audit on the live DB; budget reconciliation |
| **agent-experience** | queued/running/failed states visible, cancel controls, bounded job detail fields, no dead send button |
| **forge** | minimal boundary implementation; no stubs; one writer |
| **auditor** | final full-suite/E2E/stage/live verification on the quiet tree |

**Tool selection:** local code and SQLite are primary. No web research was needed because
the contracts are internal. One provider call was used only after the UI/API path was
proven; no generated-code execution and no shell tool were introduced.

## 5. API and UI surface

- `GET /api/chat/threads` — owner thread list with persisted projection fields.
- `POST /api/chat/threads` — create a thread for a registered agent.
- `GET /api/chat/threads/:id` — thread + messages + jobs + last event sequence.
- `POST /api/chat/threads/:id/messages` — idempotent, atomic fan-out to 1–3 agents.
- `GET /api/chat/threads/:id/events` — bounded persisted event projection.
- `GET /api/chat/threads/:id/stream` — SSE replay/live projection with heartbeat.
- `POST /api/chat/jobs/:id/cancel` — queued terminal or running cancellation request.
- UI `/chat` — thread list, agent selector, composer, live status, pending/failed states,
  cancel control, and a `Job fields` disclosure containing the residual fields.

## 6. Acceptance

- Unit: atomic fan-out/idempotency, claim/CAS, measured success, retry/exhaustion,
  cancellation, reaper requeue/exhaustion/cancellation, projection fields.
- E2E: `/chat` creates a durable thread and renders the projected empty state without
  fabricating a message.
- Live: create thread → send message → worker claim → provider answer → projected
  complete message/job; SSE replay contains the ordered event types; cancel a queued job.
- Gates: typecheck, full unit suite, build, E2E, strict stage, preflight, stub/secret scans.
- Audit: independent read of final diff/tests, no test weakening, no mock in product paths.

## 7. Explicit non-goals / remaining boundary

- No child **threads** and no merged-thread delegation; that would require a separate
  parent/child transport and approval model. This feature models multiple agent answers in
  one thread as independent jobs instead.
- No multi-process worker deployment; HiveRouter is a single-owner local process. The
  worker lease/reaper is real and restart-safe, but it is not a distributed queue claim.
- No P7 learning promotion or generated-code execution.
