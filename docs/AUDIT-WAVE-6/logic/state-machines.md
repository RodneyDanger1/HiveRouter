# W6-AUD-02 — State machines, legal transitions, and what actually writes them

Sources: `src/shared/types.ts`, `src/server/logic/run-state.ts`, `src/server/runs/{recorder,manager,budget,snapshot,publish}.ts`, `src/server/pipeline/{run,agent-runner}.ts`, `src/server/learning/*.ts`, `src/server/runs/recorder.ts` (steps), `src/server/app.ts` (SSE).

Legend: **reachable** = a production writer exists today; **rejected** = a guard/constraint refuses it; **silent** = the state can be entered with no named code/event/log.

---

## 1. Run status machine

Declared matrix (`src/server/logic/run-state.ts:27-54`):

```
queued               -> running | failed | budget_exceeded | cancelled | interrupted
running              -> paused | needs_review | completed | completed_with_warnings
                        | failed | cancelled | budget_exceeded | interrupted
paused               -> running | needs_review | cancelled | interrupted
needs_review         -> running | completed | completed_with_warnings | failed | cancelled | interrupted
completed            -> (terminal)
completed_with_warnings -> (terminal)
failed               -> (terminal)
cancelled            -> (terminal)
budget_exceeded      -> (terminal)
interrupted          -> (terminal)
```

| State | Reachable? | Production writer(s) | Evidence |
|---|---|---|---|
| `queued` | yes | `createRunRow` inserts `status='queued'` (`recorder.ts:89-103`) | 25/25 runs created queued |
| `running` | yes | `markRunning` (`manager.ts:246-248`) called at `run.ts:450` | 25 `run.started` events |
| `completed` | yes | `finalize` `updateRun` (`run.ts:1075-1084`) | 18 runs |
| `completed_with_warnings` | yes | `completionStatus` when a check is `warn`/`unverified` (`run.ts:914-918`) | reachable in code; 0 rows (all completed runs were clean) |
| `failed` | yes | gate `markTerminal` (`run.ts:341,432,857`), pipeline catch (`run.ts:884`), executor catch (`manager.ts:150-156`) | 3 rows + 4 budget rows |
| `budget_exceeded` | yes | pipeline catch mapping `E_BUDGET_EXCEEDED` (`run.ts:876-882`) | 4 rows |
| `cancelled` | yes | pipeline catch on abort (`run.ts:876-879`), `cancelRun` no-controller branch (`manager.ts:177-188`) | 0 rows + 0 events (path unexercised in this DB) |
| `interrupted` | yes | `markStartupInterrupted` (`manager.ts:192-204`, called `index.ts:43`) | 0 rows now; 15 `E_RUN_TIMEOUT` executor logs show the similar startup/crash family occurred |
| `paused` | **no** | only read by `getActiveRunId`, `cancelRun`, `markStartupInterrupted` | no status writer anywhere in `src/` |
| `needs_review` | **no** (as a run status) | `confidence.ts` returns the string `needs_review` as a *decision*, never persisted on `runs` | grep `updateRun.*needs_review` = 0 |

**Enforcement:** none in production. `assertStatusTransition`/`transitionRun` have zero non-test call sites; all writes use `updateRun` (`recorder.ts:107-126`), which builds `UPDATE runs SET …` from arbitrary keys. There is no `CHECK` on `runs.status` (`migrations.ts:7-34`). Probe 3 in `red-probes.md` persists `completed → running` and the pure guard rejects the same edge, proving the guard exists but is bypassed.

**Terminal behaviour:** `TERMINAL_STATUSES` (`types.ts:15-22`) decides the UI's terminal mode. Terminal → the run page stops the stream and loads the persisted ledger (`RunDetailPage.tsx:127-139`). Terminal rows can still be rewritten by `updateRun` (no guard), and the `cancel` route can return `cancelled:true` in the completion window (W6-L-11).

**Rejected edges (by the pure module only):** terminal→anything; `queued → completed`; `paused → completed`; `running → queued`, etc. `E_ILLEGAL_RUN_TRANSITION` is registered (`refusals.ts:90`) but **unreachable** in production.

**Silent transitions:**

- `queued|running|paused|needs_review → interrupted`: no code, no message, no event, no log (W6-L-06).
- Gate failure: code `GATE_FAILED` (unregistered), no log (W6-L-07).
- Any provider failure: code `E_INTERNAL` (W6-L-01).

## 2. Run phase machine

Declared matrix (`run-state.ts:56-68`):

```
intake -> planning
planning -> routing | generating | finalizing
routing -> generating | finalizing
generating -> cleaning | hardening | testing | verifying | finalizing
cleaning -> hardening | testing | verifying | finalizing
hardening -> testing | verifying | finalizing
testing -> verifying | finalizing
verifying -> repairing | finalizing
repairing -> verifying | finalizing
finalizing -> done
done -> (terminal)
```

Production writers versus the matrix — **four reachable edges are not in the matrix**:

| Writer | Edge written | In matrix? |
|---|---|---|
| `markRunning` (`manager.ts:247`) | `(initial) → intake` | n/a (initial) |
| full-build `run.ts:463` | intake → planning | yes |
| full-build `run.ts:500` | planning → routing | yes |
| full-build `run.ts:607` | planning → generating (routing disabled) | yes |
| **revise/audit `run.ts:292` (`executeReviewRun`)** | **intake → cleaning** | **no** |
| **adhoc `run.ts:366` (`executeAdhocRun`)** | **intake → generating** | **no** |
| **pipeline catch `run.ts:884`** | **any → done** (e.g. generating → done) | **no** (`done` only from finalizing) |
| **`markStartupInterrupted` (`manager.ts:198`)** | **any → done** | **no** |
| repair loop `run.ts:824,832` | verifying ↔ repairing | yes |
| `finalize` `run.ts:977` | verifying → finalizing | yes |
| `finalize` `run.ts:1076-1077` | finalizing → done (with completed) | yes |

So the declared LG2 phase contract does not describe the product: if the guard were wired today, every `revise`/`audit` run, every `adhoc` run, every interrupted run and every failed run would be rejected at its first or last write. This is the strongest argument that W6-L-03 is a real logic defect (contract vs producer divergence), not just a cosmetic unwired module.

**Note:** `phase` is display/telemetry only; no branch reads it to decide anything except the UI badge. The risk is a persistent wrong phase (e.g. `done` while actually generating) and the false assurance of a guard.

## 3. Step machine

Declared statuses (`types.ts:288`): `started | succeeded | failed | skipped | cancelled`.

```
started -> succeeded | failed | cancelled | skipped
```

| Transition | Writer | Reachable? |
|---|---|---|
| (create) → started | `startStep` (`recorder.ts:165-191`) | yes (171 rows) |
| started → succeeded | `finishStep(...,'succeeded')` in `agentStep` (`run.ts:227`) | yes (166 rows) |
| started → failed | `finishStep(...,'failed')` (`run.ts:233`) | yes (5 rows, all `E_BUDGET_*`) |
| started → cancelled | `finishStep(..., signal.aborted ? 'cancelled' : 'failed')` (`run.ts:233`) | code-reachable; 0 rows (no cancelled run in DB) |
| started → skipped | never written (`'skipped'` literal only in the type) | **no** — dead state |

**Guarantee:** `finishStep` does not assert the row is still `started`; a duplicate finish would overwrite silently. No production path calls it twice (each step has one `agentStep` invocation), so this is **unverified risk**, not a confirmed defect.

**Truth note:** a step error code suffers W6-L-01 (provider errors recorded as `E_INTERNAL`).

## 4. Agent invocation lifecycle (event-only, no table)

There is no `agents` state table. The durable record is a `steps` row plus three events:

```
agent.started (stepId, agentId, phase)
  ├─ agent.completed (stepId, agentId, phase, usage{…})   -> step succeeded
  └─ agent.failed    (stepId, agentId, phase, code, message) -> step failed|cancelled, error rethrown
```

- `agent.started`/`agent.completed` counts match 1:1 except run_1e5a etc.: 171 started / 166 completed / 5 failed = 171, consistent.
- `agent.failed` is **not subscribed** by the client (W6-L-04), and it carries the same lost code as W6-L-01.
- A failure inside an agent step is followed by the run-level terminal event on the same code path (`run.failed`), so terminal convergence does not depend on `agent.failed`.

## 5. SSE connection machine

Client states (`web/src/hooks/useApi.ts:70`): `connecting | live | reconnecting | closed`.

```
mount (runId non-null, run non-terminal) -> connecting
  onopen            -> live
  onerror           -> reconnecting        (browser retries automatically)
  unmount/runId=null -> closed
  terminal run      -> closed (never opened)
```

Server edges (`app.ts:835-865`):

```
GET /api/runs/:id/stream
  ├─ run unknown        -> 404 E_RUN_NOT_FOUND
  ├─ lastId stale >500  -> 410 E_REPLAY_WINDOW_EXCEEDED (JSON; client cannot read it)
  └─ else               -> 200 text/event-stream
         replay getEvents(id, lastId)  [replay:true]
         subscribe(id)                 [live]
         `: ping` every 15 s           [comment; never dispatches]
```

Findings:

- The `reconnecting → live` recovery edge after a 410 does not exist: the browser retries with the same `Last-Event-ID` and the same 410 forever (W6-L-10). Status convergence still comes from the 5 s poll, so the run badge stays correct while the stream stays dead.
- The stream is never closed by the server at terminal; the client closes it when its fetched run becomes terminal (`RunDetailPage.tsx:135`). A raw client that ignores the run record keeps an idle connection and a 15 s ping.
- The replay write happens **before** `subscribe`, both synchronously in one tick, so no event can interleave between replay and live (no lost-event race). Verified by reading; no await between `app.ts:856` and `:859`.
- `meta.replay` distinguishes replayed frames (`app.ts:854,857`) but the client ignores `meta` entirely.

## 6. Cancel / timeout / retry / repair

**Cancel** (`manager.ts:167-190`):

```
cancel(run)
  ├─ controller exists  -> controller.abort(); return true   (status not persisted here)
  ├─ status in {queued, paused, needs_review} and no controller
  │                     -> releaseReservationsForRun, status=cancelled, code E_CANCELLED, emit run.cancelled
  └─ else               -> return false -> 409 E_RUN_NOT_CANCELLABLE
```

The with-controller path depends on the executor reaching a `checkAbort` (`run.ts:142-144` throws `E_CANCELLED`; called at phase boundaries and `finalize` entry) or on the provider fetch rejecting on abort. Between checks the abort is inert. `cancelRun` reports success before the terminal status exists (W6-L-11).

**Timeout** (`manager.ts:136-141`): a 30-min (config default) `setTimeout` aborts the controller with `E_RUN_TIMEOUT: …`. The pipeline catch maps it to `failed` + `error_code=E_RUN_TIMEOUT` (`run.ts:871-882`). The 15 `E_RUN_TIMEOUT` entries in `data/logs/errors.jsonl` are attributed to `source:"executor"` (the manager catch), not `source:"run"` (the pipeline catch), i.e. those timeouts surfaced through the *executor* rejection path. The exact reason is **unverified** (the runs no longer exist in the DB; see "Not audited").

**Provider retry** (`llm/client.ts:740-787`): up to 3 attempts; retryable HTTP statuses 408/429/5xx; per-attempt budget reservation is taken at `onHttpAttemptStart` **outside** the retry `try`, so an `E_BUDGET_EXCEEDED` from `maxAffordableOutputTokens` is not retried (correct); each attempt settles exactly once (double-settle → `E_BUDGET_UNKNOWN_RESERVATION`, probe green). A failed attempt commits cost 0 — no lease leak.

**Repair loop** (`run.ts:813-852`): max 2 attempts; a repeated failure signature emits `repair.stalled` and breaks; budget exhaustion emits `repair.stalled {reason}`. Both `repair.stalled` events are invisible to the live client (W6-L-04). A repair that succeeds after an earlier stall still ends in `completed*`; the stall is not surfaced in the run record, only in the event ledger.

## 7. Learning machines

### 7.1 Consent (`learning/consent.ts`, `contracts.ts:4-10`)

```
(no record) --grant--> active(v1) --revoke--> revoked(v1)
                         |                        |
                         +--grant--> active(vn+1) <+
```

- Authority: highest `version` per scope (`consent.ts:39-52`). Active = latest row with `revoked_at IS NULL`.
- `requireConsent` refuses `E_LEARNING_CONSENT_REQUIRED` for missing/revoked (`consent.ts:102-108`).
- Revoking `case_to_provider_eval` tombstones unclaimed suites' cases and leaves claimed suites auditable (`consent.ts:86-97`).
- Rejected: no transition from revoked directly to active without a new version (a new grant always creates version+1).
- Production state: `consent_records` = 0 rows; overview reports `E_LEARNING_POOL_EXHAUSTED` first (`overview.ts:64-70`) — consistent with the Wave-5 receipt.

### 7.2 Sealed block (`learning/sealed-pool.ts`)

```
ready --claim(suite)--> used(used_by_suite_id=suite)
      \--claim loses race--> E_LEARNING_SUITE_ALREADY_USED
```

`UPDATE sealed_pool_blocks SET status='used' … WHERE used_by_suite_id IS NULL` + `changes!==1` refusal (`sealed-pool.ts:419-426`) is atomic. No path returns `used` to `ready` (no refund). `'ready'` is the only status written on insert (`:219`).

### 7.3 Suite use (`sealed-pool.ts:479-514`)

```
(none) --claimSuite--> claimed
claimed --claimSuite--> E_LEARNING_SUITE_ALREADY_USED (pre-check + UNIQUE(suite_id))
```

The `suite_uses.status` column is written only as `'claimed'`; no other status writer exists. `suite_uses` is used as a tombstone set by consent revocation (`consent.ts:94`).

### 7.4 Variant (`learning/candidates.ts`, `promotion.ts`)

```
draft --promote--> promoted
draft --?--> evaluating        (declared, never written)
draft --?--> rejected          (declared, never written)
```

`setVariantStatus(db, id, status: string)` performs an unvalidated `UPDATE … SET status = ?` (`candidates.ts:291-297`), no existence check, no audit row. The only caller sets `'promoted'` (`promotion.ts:583`, inside the promotion transaction). `'evaluating'` is *read* by the family cap (`candidates.ts:232-241`) but never persisted, so a rejected candidate can never free a family slot (`E_LEARNING_CANDIDATE_INVALID` at 3). This mirrors W6-L-03 at a smaller scale.

### 7.5 Promotion / rollback / monitor (`promotion.ts`)

```
gate.decision != promote_eligible
   --recordGateDecision--> promotions(decision = gate.decision | 'no_promotion')  [refusal row]
gate.decision == promote_eligible + valid single-use token
   --tx--> variant=promoted, version created, active_version=new, promotions(decision='promote'),
           post_promotion_monitor(status='monitoring', window_runs=20, window_days=14)
monitoring --20 runs/14 days without regression--> completed
monitoring --2 consecutive failures--> paused_review(trigger='two_consecutive_failures')
monitoring --cost >25%--> paused_review(trigger='cost_over_25pct')
promote --rollback(token)--> promotions(decision='rollback', rollback_of=promotion.id),
          active_version=last_known_good, monitor(status='rolled_back')
```

- Baseline drift is checked **inside** the promote transaction before `setActiveVersion` (`promotion.ts:574-586`) → `E_LEARNING_VERSION_DRIFT`.
- Approval token: single-use, HMAC + row hash + binding check, concurrency refusal (`approval.ts:158-220`); reuse → `E_LEARNING_APPROVAL_EXPIRED`.
- `rollback` requires an existing `decision='promote'` row (`promotion.ts:749-753`); `autoRollback` bypasses the token by design (monitor actor).
- The `promotions` table mixes gate refusals and real promotions in one `decision` column (W6-L-12 for learning).
- **Reachability:** no production code inserts an `eval_runs` row (grep: only tests do), so `loadGateEvidence` can only refuse `E_LEARNING_NO_BASELINE`. The whole promote/rollback/monitor machine is **declared and read but not producible in this build** — consistent with "P7 live promotion not available" (Wave-5 receipt). Live promotion remains unverified.

### 7.6 Trace (`run.ts:108-140`, `learning/trace-store.ts`)

```
(none) --recordRunTrace(outcome)--> traces(run_id UNIQUE, complete=1)
```

`ON CONFLICT(run_id) DO UPDATE` is valid because `traces.run_id` is `UNIQUE` (`migrations.ts:352-354`). The insert is swallowed on failure and `runs.trace_complete` is set regardless (W6-L-08).

---

## 8. Reachable / rejected / silent — one table

| Invariant | Reachable | Rejected by | Silent |
|---|---|---|---|
| run terminal → never changes | yes (unguarded `updateRun`) | pure module only (unwired) | no |
| run failure → named code | yes | — | provider → `E_INTERNAL`; interrupt → no code |
| gate failure → code + message + log | yes | — | unregistered code, no log, no event message |
| step terminal | yes | — | `skipped` dead; duplicate finish unguarded |
| agent failure visible live | no | client subscription | `agent.failed` dropped |
| SSE replay complete | ≤500 events | 410 above window | client cannot recover |
| budget settle once | yes | `E_BUDGET_UNKNOWN_RESERVATION` | `release()` after commit is a no-op |
| idempotent create | yes | `E_IDEMPOTENCY_KEY_REUSED` | — |
| variant status | draft → promoted | — (arbitrary strings accepted) | evaluating/rejected dead |
| consent truth | grant/revoke | `E_LEARNING_CONSENT_REQUIRED` | — |
| promotion | not producible (no eval rows) | `E_LEARNING_NO_BASELINE` etc. | monitor transitions unexercised |
| trace completeness | flag only | — | insert failure swallowed |

## Not audited

- The `E_RUN_TIMEOUT` executor-attribution anomaly (15 log rows) cannot be tied to runs any more: those run ids have no rows in the current DB (DB replacement during the wave). The mapping itself is proven (code reads `controller.signal.reason`), the historical path is not.
- Multi-process concurrency on one SQLite file (two servers) was not exercised; the active-run guard has no DB-level uniqueness.
- `paused` / `needs_review` run statuses have no production writer in this build; whether they should be wired (confidence `needs_review` → run pause) or removed is a product decision.
