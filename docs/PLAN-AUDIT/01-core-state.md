# 01 — Core State, Lifecycle, Snapshots, Budget, SSE, Persistence

**Wave:** PLAN-AUDIT-1 · **Seat:** 1 `plan-audit-core` · **Target:** `docs/PLAN-v2.md` (454 lines, mtime 2026-11-03 09:24) · **Audit clock:** 2026-11-03 09:28:52–09:30 -06:00
**Scope:** §0, §3, §4 (W01–W19), §8, §9, §10, §14, §15, §17. The wave sheet also names §21; **v2 has no §21** (its last section is §17). The traceability matrix is v2 §15 and sources are §17, so those were audited in place of §21. This is itself a finding (D1/D14).
**Claim strength:** **READ / INFERRED** for all defects. No product code exists; no runtime probe, install, API call, or key access was performed. RED probes below are executable test designs or textual contradictions, not executed runs.
**Verdict:** **NOT EXECUTABLE AS WRITTEN.** 4 × P0, 9 × P1, 3 × P2. D1–D4 must be fixed before P0 code; the remaining P1s before their phase gates.

---

## 1. Defect summary

| ID | Sev | Plan section | Defect | Lens |
|---|---|---|---|---|
| D1 | **P0** | §0, §1, §5, §8, §17 | Canonical plan is not self-contained: v2 says v1 §§1–19 remain in force, but `docs/PLAN-v1.md` is absent; §19/§21 references do not exist; two DoD/assumption section numbers resolve differently | research / forgewright-lead |
| D2 | **P0** | §3, §4 W01/W02, §6.9, §10 | Release A core tables (`run_snapshots`, `budget_reservations`, `gate_decisions`, `idempotency_keys`) are listed under P6a while Release A forbids P6/P7 tables | forge / integration-logic |
| D3 | **P0** | §4 W07, §8 graph | Repair writes the accepted project tree before the gate rerun; a failed repair leaves partial/rejected files, contradicting “no partial writes” | smartfix / logic-debugger |
| D4 | **P0** | §4 W02, §6.9, §14 | Core run creation has no idempotency; a retry hits `E_ACTIVE_RUN_EXISTS`; `idempotency_keys` is P6a; “concurrent-run race” contradicts one active run | integration-logic / logic-debugger |
| D5 | P1 | §4 W02, §6.7 LG4, §14 | “Global” budget ledger has no global cap, no integer money rule at the service boundary, no crash recovery for reservations, and no exact missing-usage commit rule | logic-debugger / smartfix |
| D6 | P1 | §4 W07, §6.7 LG2, §8 | Run/phase enums and phase attempts are undefined; a failed phase is terminal, so the repair loop cannot legally rerun; `REPAIR_STALLED` has no status home | logic-debugger / integration-logic |
| D7 | P1 | §4 W07, §6.7 LG1, §6.3 FSN | Gate precedence `budget > failed` can report `budget_exceeded` while a hard check failed; LG1 and FSN signatures are both called “the” failure signature for stall detection | logic-debugger / logic-gatekeeper |
| D8 | P1 | §4 W06, §10, §14 | SSE replay/live ordering is unspecified (lost/duplicate events); a reconnect older than the 500-event window or 90-day retention is silently incomplete; slow clients are unbounded | integration-logic / smartfix |
| D9 | P1 | §4 W14, §10 | Migration/checksum/rollback, single-instance lock, crash-after-file-before-artifact-row reconciliation, partial manifest, and 7 GB disk thresholds are underspecified | smartfix / logic-debugger |
| D10 | P1 | §6.1, §14, §15 | Refusal taxonomy is inconsistent (`NO_CAPABLE_AGENT` vs `E_*`, `REPAIR_STALLED` vs `E_REPAIR_STALLED`, `FORBIDDEN_*` without `E_`), so the “refusal matrix” is not enforceable | capability-auditor / integration-logic |
| D11 | P1 | §3, §7, §9 | A 50-case sealed pool cannot supply a fresh single-use 50-case suite for five candidate evaluations (≥250 cases needed); the P7 gate requires 50 pairs even though `refused`/`no_promotion` is a valid outcome | capability-auditor / research |
| D12 | P1 | §4 W01, §7.6 | `RunSnapshot` stores prompt versions/hashes, but nodes need the materialized prompt/contract content; without an append-only content store a mid-run edit or delete breaks immutability | integration-logic / logic-gatekeeper |
| D13 | P1 | §8, §9 | “Release A graph unchanged” relies on v1, which is absent; v2 gives no preset→phase matrix, so blueprint/audit/revision can run `generate`/`verify` on zero files and fail or dead-end | forge / integration-logic |
| D14 | P2 | §0, §5, §15 | Traceability matrix is not a count of record: the INFRA row lumps five artifacts, LG1 has two phases, and A tables are uncounted | auditor / capability-auditor |
| D15 | P2 | §14 | New surfaces use `hive.api.v1`, existing routes keep the v1 envelope; core refusals (active run, invalid parent, prompt size, DSH consent) therefore have two client contracts | auditor / integration-logic |
| D16 | P2 | §17 | Sources are a prose list without URL/date/claim rows; the plan’s verified corrections cannot be traced per claim | research / capability-auditor |

---

## 2. Detailed defects

### D1 — P0 — The canonical plan is not self-contained

**Evidence (READ):**
- `docs/PLAN-v2.md:30`: “**v1 §§1–19 remain in force** except as amended here.”
- v2 contains only §§0–17 (headings verified); `docs/PLAN-v1.md` is absent (`Test-Path` false); the Wave Sheet says the repo is empty except the audit workspace.
- `docs/PLAN-v2.md:24` and `:114` say the traceability matrix is **§21**; there is no §21.
- `docs/PLAN-v2.md:23` says team write scopes are in **§19**; there is no §19.
- `docs/PLAN-v2.md:266` and `:268` say “§17 DoD” and “§18 Assumptions”, but v2’s DoD is §11 and its assumptions are §12; v1’s §17/§18 are not in v2.

**Why it bites in code:** Release A’s graph, preset conditions, layout, API, security, tests, phases, and DoD live in v1. An implementer holding only v2 cannot implement the exact Release A contract; two readers can resolve “§17” to different sections. The build cannot be reproduced or verified against a single source.

**RED probe (READ/INFERRED):** a plan-lint command that resolves every `§N` reference against the canonical corpus must fail today:
- expected: `docs/PLAN-v1.md` exists and every referenced heading resolves;
- observed by inspection: v1 missing, §19/§21 unresolved, §17/§18 ambiguously defined.

**Exact patch:**
```diff
  INSERT after the status/watchdog block (after current line 7):

+ **Canonical corpus.** This file is an amendment, not a standalone plan. The canonical corpus is
+ `docs/PLAN.md` (index) + `docs/PLAN-v1.md` (base, §§1–19) + `docs/PLAN-v2.md` (this amendment,
+ §§0–17). If `docs/PLAN-v1.md` is absent, STOP: the plan is incomplete and no phase may start.

  REPLACE line 30:
- v1 §§1–19 remain in force except as amended here. The amendments are:
+ v1 §§1–19 remain in force except as amended here. The canonical v1 text is `docs/PLAN-v1.md`;
+ it is part of this plan. The amendments are:

  REPLACE §0 item 9: "disjoint write scopes in §19" -> "disjoint write scopes in §9"
  REPLACE §0 item 10 and §5 line 114: "§21" -> "§15"
  REPLACE §8 line 266: "§17 DoD" -> "v2 §11 DoD"
  REPLACE §8 line 268: "§18 Assumptions" -> "v2 §12 Assumptions"

  ADD `scripts/plan-lint.mjs` and `npm run plan:lint`:
- assert `docs/PLAN-v1.md` exists and is indexed by `docs/PLAN.md`;
- extract every `§N(.N)?` reference from both files and assert a matching heading exists;
- assert no duplicate top-level section number is defined by both files with different content.
```
Also add the v1 plan text to the repo exactly as approved; if it cannot be recovered, v2 must be expanded to a standalone plan before P0.

**GREEN verification (test design):** `npm run plan:lint` exits 0; `docs/PLAN.md` lists both files; a deliberately broken `§99` reference makes it exit non-zero; a fresh reader can implement Release A using only the three files.

**Lens:** research (source corpus) + forgewright-lead (canonical authority) + capability-auditor (claim provenance).

---

### D2 — P0 — Release A core tables are staged as P6a artifacts

**Evidence (READ):**
- `docs/PLAN-v2.md:17`: “Release A = P0–P5 only. It contains **zero** P6/P7 tables, routes, pages, or scripts.”
- `:65` (Release A row) explicitly includes “snapshots, budget ledger, bounded SSE”.
- `:77` W01 requires a `RunSnapshot`; `:78` W02 requires a transaction ledger; `:81` W06 requires an event store.
- `:186` under “**P6a DB/API/UI**” lists: `run_snapshots` (**A**), `gate_decisions`, `budget_reservations` (**A**), `idempotency_keys`.
- `:89` W14 says additive migrations/crash consistency, but no A migration list exists.

**Why it bites in code:** Release A’s pipeline must read/write snapshots, reservations, gate decisions, and idempotency keys. If A references tables created only in P6a, every A run fails with “no such table”. If A creates them and P6a’s migration also creates them, the P6a migration fails or silently duplicates schema. The Release A “zero P6 tables” gate is also contradictory.

**RED probe (READ/INFERRED):** an A-phase migration test that opens a fresh DB and asserts `run_snapshots`, `budget_reservations`, `gate_decisions`, `idempotency_keys` exist after `001_core.sql` will fail today because the plan does not put them in an A migration; the P6a schema test then asserts the same tables, creating a duplicate-owner ambiguity.

**Exact patch:**
```diff
  REPLACE line 186:
- New tables: `run_snapshots` (A), `route_decisions`, ..., `gate_decisions`, `budget_reservations` (A),
- `script_runs`, `idempotency_keys`.
+ Consumes Release A tables: `run_snapshots`, `budget_reservations`, `gate_decisions`,
+ `idempotency_keys`, `events`, `runs`, `steps`, `artifacts`, `checks`, `usage`.
+ New P6a tables: `route_decisions`, `route_candidates`, `agent_stats` (observability only),
+ `context_packs`, `context_manifests`, `failure_signatures`, `failure_occurrences`,
+ `verification_plans`, `confidence_records`, `retry_attempts`, `script_runs`.

  INSERT in §3 Release A row:
+ A migration `001_core.sql` creates: `schema_migrations`, `settings`, `prompt_versions`, `runs`,
+ `steps`, `events`, `artifacts`, `reviews`, `checks`, `usage`, `run_snapshots`,
+ `budget_reservations`, `gate_decisions`, `idempotency_keys`.

  ADD to §9 P0–P5 gate:
+ assert the A schema contains exactly the A tables above and zero P6a/P7 tables.
```
P6a’s migration must be idempotent: `CREATE TABLE IF NOT EXISTS` is not sufficient for a schema contract; P6a should assert the A tables exist and only add its own.

**GREEN verification (test design):** A migration test passes; P6a migration test passes on top of A without recreating A tables; a schema-ownership test fails if a P6a migration mentions an A table.

**Lens:** forge (phase staging/build order) + integration-logic (DB seam) + smartfix (one-boundary fix).

---

### D3 — P0 — “No partial writes” is contradicted by the repair node

**Evidence (READ):**
- `docs/PLAN-v2.md:82` W07: “Repair max 2; repeated failure signature ⇒ `REPAIR_STALLED`; full gate rerun after every repair; **no partial writes**”.
- `:252` §8: “`intake → plan → generate → clean → harden → test → verify → (repair → verify)* → finalize`”.
- `:397–399` diagram: `V -->|repair| R["Repair"] --> V`.

**Why it bites in code:** The repair node must produce revised files before the gate can rerun. If it writes directly into the accepted run tree, a failed repair leaves rejected code in the project (a partial write). The next repair then builds on rejected code, and the “last accepted” state is lost. The plan has no staging/rollback object, so the invariant is unimplementable as written.

**RED probe (test design, INFERRED):**
1. Start a run with a generated file whose accepted hash is `H0`.
2. Inject a mock Watchman repair that writes a file containing a syntax error.
3. Run verification; it fails.
4. Assert the accepted project file still hashes to `H0` and the rejected attempt is stored separately.
The current plan has no staging path, so step 4 cannot be satisfied.

**Exact patch:**
```diff
  REPLACE line 82 (W07) with:
+ | W07 | Repair max 2; repeated failure signature ⇒ `REPAIR_STALLED`; full gate rerun after every
+ repair; repairs are staged in `workspace/runs/<runId>/.staging/repair-<round>/`, verified against
+ that staged snapshot, and atomically promoted only on pass; a failed attempt is retained under
+ `workspace/runs/<runId>/attempts/repair-<round>/` and the last accepted snapshot remains
+ authoritative (`acceptedRevision`). No repair writes the accepted project tree directly |
+ Oscillation, no-progress, budget-exhaustion, and rejected-repair-preserves-accepted-tree tests |

  INSERT in §8 after line 252:
+ The `repair` node writes only to `.staging/repair-<round>/`; `verify` runs against that staged
+ snapshot; on pass, promote atomically (rename or accepted-pointer swap); on fail, keep the accepted
+ snapshot and record the rejected attempt under `attempts/repair-<round>/`.
```
The same staging rule must apply to the initial generation if “no partial writes” is meant globally; otherwise clarify that W07’s rule is repair-only.

**GREEN verification (test design):** the rejected-repair test above passes; the accepted-file hash is unchanged; the rejected attempt is visible in the Repairs tab but not in the project tree; a passing repair swaps `acceptedRevision` exactly once.

**Lens:** smartfix (reproduce RED, boundary fix) + logic-debugger (state/recovery truth).

---

### D4 — P0 — Core run creation is not idempotent, and the concurrency model contradicts itself

**Evidence (READ):**
- `docs/PLAN-v2.md:87` W12: “active run 409”.
- `:352` §14: `E_ACTIVE_RUN_EXISTS`.
- `:78` W02 verification: “**Concurrent-run race test**”.
- `:186` `idempotency_keys` is listed under P6a DB/API/UI.
- `:350` §14: idempotency/`Idempotency-Key` is specified for “new P6a/P7 surfaces” and mutations.

**Why it bites in code:** A user clicks “Start”, the server starts the run, and the response is lost. The client retries the same `POST /api/runs`. There is no core idempotency record, so the second request is refused with `E_ACTIVE_RUN_EXISTS` even though the user’s run is healthy; worse, if the active-run check is removed to allow concurrency, the retry creates a second run and a second budget reservation. The plan cannot both have one active run and a meaningful concurrent-run race test without defining which runs are concurrent.

**RED probe (test design, INFERRED):**
1. `POST /api/runs` with `Idempotency-Key: k1`; receive `202 {runId}` (drop the response).
2. Repeat the exact request with `k1`.
3. Expected: same `runId`, one `runs` row, one budget reservation, `meta.replayed:true`.
4. Current plan: no core key store; second request is `409 E_ACTIVE_RUN_EXISTS` (or a duplicate if concurrency is allowed).

**Exact patch:**
```diff
  INSERT after W02 (line 78):
+ **A concurrency and idempotency (normative).** At most one factory/revision/audit run is active.
+ Ad hoc agent runs are limited to 2 and share the global ledger. `POST /api/runs`, `/revise`, and
+ `/cancel` require an `Idempotency-Key`. Idempotency lookup runs before `E_ACTIVE_RUN_EXISTS`:
+ same key + same payload returns the original response with `meta.replayed:true`; same key +
+ different payload returns 409 `E_IDEMPOTENCY_CONFLICT`; keys are A-table rows with a 24h TTL.
+ A retry after a lost response must never create a second run or reservation.

  MOVE `idempotency_keys` from the P6a table list to the A migration list (see D2).
  ADD to §14 named refusals: `E_IDEMPOTENCY_CONFLICT`.
```
If the intended model is truly one run total, delete the “concurrent-run race test” language and replace it with an ad hoc-run race test; do not leave both.

**GREEN verification (test design):** duplicate POST returns the same run and one reservation; different payload with the same key returns 409; two ad hoc runs reserve concurrently without exceeding the ledger; factory run blocks a second factory run with `E_ACTIVE_RUN_EXISTS` only after the idempotency check.

**Lens:** integration-logic (request/DB seam) + logic-debugger (retry/idempotency semantics).

---

### D5 — P1 — “Global” budget ledger lacks a global cap, integer money rule, and crash recovery

**Evidence (READ):**
- `docs/PLAN-v2.md:78` W02: “Global budget ledger ... atomic reserve/commit/release; user runs priority; 20% repair reserve; per-run $0.50; eval $3.00; cycle $4.50”.
- `:178` LG4: “Pure micro-USD accounting decisions: ... null = unknown, never zero”.
- No `global cap` amount, no service-boundary integer rule, no reservation recovery algorithm, no exact missing-usage commit in the plan.
- `:186` `budget_reservations` is a P6a table (see D2).

**Why it bites in code:** “Global” is false if only per-scope caps exist; two ad hoc runs plus a P7 eval can each spend their cap with no global refusal. Dollar floats can lose fractions and disagree with the pure micro-USD policy. A crash after `reserve` but before `commit/release` leaks reservations; the next run sees phantom spend. Missing provider usage can be treated as zero, silently under-counting cost.

**RED probe (test design, INFERRED):**
- reserve two ad hoc calls concurrently against a ledger whose global cap is lower than the sum; expected the second to refuse; current plan has no global cap to test.
- crash after `reserve`; restart; expected startup recovery releases/marks the orphan; current plan has no recovery rule.
- provider returns no usage; expected commit the full reservation and `usage_source:"reserved_conservative"`; current plan says “conservative” but not how.

**Exact patch:**
```diff
  REPLACE line 78 (W02) with:
+ | W02 | Global budget ledger (A): all amounts integer micro-USD; buckets global =
+ min(5.00, balance_at_start - 0.50), per-run 0.50 (20% repair-only), eval 3.00, cycle 4.50;
+ `budget_reservations` A table; `BEGIN IMMEDIATE` reserve/commit/release; reserve before every call;
+ commit actual provider usage, or the full reservation with `usage_source:"reserved_conservative"`
+ when usage is missing; startup recovery releases `reserved` rows for runs not `running` and records
+ audit; factory runs reserve before eval; 402 / `E_BUDGET_EXCEEDED` | Concurrent-ad-hoc race test;
+ crash-after-reserve; missing-usage; global-cap; balance check |

  ADD to §10: `budget_reservations(id, scope, run_id, bucket, reserved_micro, committed_micro,
  status, created_at, expires_at)`; `status ∈ reserved|committed|released|orphaned`;
  `SUM(committed_micro) + SUM(reserved_micro) ≤ global_cap_micro` is checked inside the same
  transaction as each reservation.
```
The 20% repair bucket must be a reservation partition, not a hope: generation calls may draw only from the 80% bucket; repair calls draw from the repair bucket; unused repair budget returns to the global pool at finalization (recorded).

**GREEN verification (test design):** property test with concurrent reserves never exceeds the global cap; crash injection releases orphans; missing usage commits the reservation; a repair call cannot consume generation’s 80% bucket; ledger sum equals `SUM(usage.cost_micro)` ± released amount after a completed run.

**Lens:** logic-debugger (crash/retry/ledger invariants) + smartfix (one boundary).

---

### D6 — P1 — Run/phase state machine has no enums or phase attempts; repair cannot legally rerun

**Evidence (READ):**
- `docs/PLAN-v2.md:176` LG2: “Separate RunStatus/RunPhase; `transitionRun`, `transitionPhase`, `isTerminal`, `nextPhase`; illegal transition throws ... terminal has no outgoing”.
- `:82` W07: repair max 2; `:252` graph: `verify → repair → verify`.
- `:352` `E_REPAIR_STALLED`; `:362` L2 loops; `:223` L4 `needs_review`.
- No enum values, no phase attempt identity, no mapping from a failed phase to a retry.

**Why it bites in code:** If `verify` transitions to a terminal `failed`, `transitionPhase` rejects the retry to `running`; the repair loop is illegal. If the implementer allows `failed → running`, the “terminal has no outgoing” rule is false, and cancel/idempotency semantics become ambiguous. `REPAIR_STALLED` has no status/phase home; `needs_review` and `budget_exceeded` are not in any enum.

**RED probe (test design, INFERRED):** exhaustive transition test: `verify` attempt 1 → `failed`; repair node asks for attempt 2; current contract has no attempt identity and the only legal terminal rule is “no outgoing”, so the expected transition is either illegal or violates the terminal invariant.

**Exact patch:**
```diff
  REPLACE line 176 (LG2) with:
+ | LG2 | `run-state.ts` | `RunStatus = queued|running|completed|completed_with_warnings|failed|
+ cancelled|budget_exceeded|interrupted|needs_review`; `RunPhase = intake|plan|route|generate|clean|
+ harden|test|verify|repair|finalize`; `PhaseStatus = pending|running|completed|failed|skipped|
+ cancelled`; `transitionRun`, `transitionPhase`, `isTerminal`, `nextPhase`; a failed phase is terminal
+ for that attempt; a repair creates a new phase attempt (`attempt+1`, `pending`) rather than
+ transitioning a terminal phase back to running; `E_REPAIR_STALLED` is a gate reason and run
+ `failed`; `needs_review` is terminal only for P7 L4; restart→`interrupted`; terminal has no outgoing |
+ Exhaustive legal/illegal matrix, repair attempt matrix, cancel from every non-terminal,
+ idempotency, restart→interrupted |
```
Add a `phase_attempts` (or `steps.attempt`) column so `verify` attempt 1 and attempt 2 are distinct persisted rows.

**GREEN verification (test design):** exhaustive matrix rejects illegal edges; `verify` failed → attempt 2 is a new row, not an illegal transition; terminal rows have zero outgoing; cancel from each non-terminal succeeds once; `REPAIR_STALLED` maps to `failed` + `E_REPAIR_STALLED`.

**Lens:** logic-debugger (transition-matrix proof) + integration-logic (phase/DB seam).

---

### D7 — P1 — Gate precedence can hide hard failures; two different signatures are called “the” failure signature

**Evidence (READ):**
- `docs/PLAN-v2.md:175` LG1: “Precedence cancelled > budget > failed > warnings > pass. Signature = SHA-256 of sorted `id:status:code`; no details/paths.”
- `:82` W07: “repeated failure signature ⇒ `REPAIR_STALLED`”.
- `:157` FSN: “SHA-256-16 signature” from normalized error text; “if a cluster’s repair failed ≥2 times ⇒ suppress/`REPAIR_STALLED`”.
- No truth table for “hard check failed AND budget exhausted”.

**Why it bites in code:** A run with a critical secret finding and a budget overrun returns `budget_exceeded` because budget outranks failed; the hard failure is hidden in the top-level status (a lying status even if reasons are stored). Separately, W07 says “repeated failure signature” without saying whether it is the LG1 (id/status/code) or FSN (normalized error) signature; the two can disagree, so stall detection fires on different conditions than the gate receipt.

**RED probe (test design, INFERRED):** LG1 truth table case `{hardFail:true, budgetExceeded:true}`; expected `failed` (hard failure dominates), current precedence returns `budget`; and a case where two different errors share `id:status:code` but differ in FSN text; expected no stall on the second? The plan does not decide.

**Exact patch:**
```diff
  REPLACE line 175 (LG1) precedence:
+ Precedence: `cancelled > failed > budget > warnings > pass`; the gate MUST retain every reason
+ in `reasons[]`; a hard failure forces `failed` even when the budget is exhausted; `budget` is used
+ only when no hard failure exists. The LG1 signature is for the gate receipt only. Repair-stall
+ detection uses the FSN failure signature (normalized category + message), never the LG1 signature.
```
Add the exact truth table to LG1’s test fixture (3 policies × 4 states × the hard-fail+budget case).

**GREEN verification (test design):** hard fail + budget ⇒ `failed` with both reasons; no hard fail + budget ⇒ `budget`; FSN identical error with different line numbers ⇒ same signature/stall; LG1 signature stable for the same checks but not used for stalling.

**Lens:** logic-debugger (branch order/truth) + logic-gatekeeper (gate decision).

---

### D8 — P1 — SSE replay/live ordering, truncation, retention, and slow clients are unspecified

**Evidence (READ):**
- `docs/PLAN-v2.md:81` W06: “Bounded SSE: summaries only ≤8 KB; 500-event replay window; snapshot endpoint; 90-day retention”.
- `:254` §10: “retention (events 90d, ...)”.
- `:288` test: “SSE 10k replay”.
- No subscribe-vs-query order, no gap/truncation event, no slow-client policy, no active-run retention exclusion.

**Why it bites in code:** If the server queries the DB first and then subscribes, events emitted between the query and subscribe are lost. If it subscribes first and then queries, the same events are delivered twice. A client reconnecting after more than 500 events, or after 90 days, receives a partial stream with no signal that it is incomplete. A slow client can buffer unbounded summaries in memory.

**RED probe (test design, INFERRED):**
1. Connect SSE, disconnect after event N.
2. While disconnected, emit events N+1..N+M.
3. Reconnect with `Last-Event-ID: N`; assert exactly N+1..N+M once, in order.
4. Reconnect with an ID older than `minRetainedSeq`; assert a named `replay_truncated`/`E_REPLAY_EXPIRED` with `snapshotRequired:true`, not a silent partial stream.
The current plan has no algorithm or refusal for step 4.

**Exact patch:**
```diff
  REPLACE line 81 (W06) with:
+ | W06 | Bounded SSE: summaries only ≤8 KB, truncated with `truncated:true` + `artifactId` when
+ larger; 500-event replay window; snapshot endpoint; 90-day retention; reconnect algorithm:
+ register a per-client buffer → query events `run_id=? AND seq>? ORDER BY seq` → send → flush
+ buffer where `seq>lastSent` → dedupe by seq; if `cursor < minRetainedSeq` or the buffer overflows,
+ send `replay_truncated` with `snapshotRequired:true` and close; per-client queue 256 events/1 MB,
+ disconnect a slow client; retention excludes non-terminal runs | 10k-event reconnect, ordering/
+ dedupe, truncation/expiry refusal, slow-client test |

  ADD to §14 named refusals: `E_REPLAY_TRUNCATED`, `E_REPLAY_EXPIRED`.
```
Use a global `events.seq AUTOINCREMENT`; `minRetainedSeq = MIN(events.seq)`; the snapshot endpoint returns the run + steps + accepted artifact hashes so the client can resync without replay.

**GREEN verification (test design):** property test with random connect/disconnect/emit; no gaps/dups; old cursor returns `E_REPLAY_TRUNCATED`; expired run returns `E_REPLAY_EXPIRED`; slow client is disconnected before memory exceeds the cap.

**Lens:** integration-logic (SSE/DB seam) + smartfix (bounded payload/queue).

---

### D9 — P1 — Migration, single-instance, crash reconciliation, partial manifest, and disk guard are underspecified

**Evidence (READ):**
- `docs/PLAN-v2.md:89` W14: “Additive migrations, crash-consistency, retention/prune; 7 GB disk guard”.
- `:254` §10: “additive migrations; ... WAL; retention ...; no destructive migration”.
- `:288` test: “old-DB migration”; no algorithm for a crash after a file write but before the artifact row, no lock, no threshold, no migration checksum/backup.

**Why it bites in code:** A migration can half-apply and leave an unusable DB; two server processes can both migrate/recover and race; a crash between `writeFile(artifact)` and `insert(artifact)` leaves an orphan file that the manifest omits; a crash during manifest write leaves a partial JSON file; the 7 GB guard has no threshold or behavior, so a full disk turns into an unhandled write error mid-run.

**RED probe (test design, INFERRED):**
1. Kill the process after the artifact file rename but before the DB insert; restart; expected the reconciler to find the orphan, record it, and mark the run `interrupted`; current plan has no reconciler.
2. Start two server processes on the same `data/`; expected one refuses with `E_WORKSPACE_LOCKED`; current plan has no lock.
3. Fill the disk below 2 GB; expected `E_DISK_LOW` before a new run; current plan has no threshold.

**Exact patch:**
```diff
  REPLACE line 89 (W14) with:
+ | W14 | Additive migrations: `schema_migrations(version, checksum, applied_at)`; DDL in one
+ transaction; backup before migration; startup fails closed on migration error; single-instance lock
+ file with PID/heartbeat (`E_WORKSPACE_LOCKED`); startup reconciliation: `running`→`interrupted`,
+ `running` steps→`interrupted`, release orphan reservations, scan the run workspace for files without
+ artifact rows and record them as `orphan`; manifest written temp+rename; finalize idempotent by
+ `runId+revision`; disk guard: <2 GB free refuses new runs (`E_DISK_LOW`), <1 GB read-only; WAL
+ checkpoint after prune | old-DB fixture; crash-after-write-before-artifact; double-start;
+ disk-guard; partial-manifest |
```
`finalize` must be a state, not a blind write: if a previous finalize wrote a manifest, a retry validates the hash and reuses it; it must not overwrite a completed run’s manifest with a failed one.

**GREEN verification (test design):** crash/reconcile test; double-start refusal; disk-guard refusal; a manifest temp file is never served; a second finalize is idempotent.

**Lens:** smartfix (bounded resources) + logic-debugger (crash/recovery).

---

### D10 — P1 — Refusal taxonomy is inconsistent and unenforceable

**Evidence (READ):**
- `docs/PLAN-v2.md:143` §6.1: `NO_CAPABLE_AGENT`, `BUDGET_INFEASIBLE`, `CONTEXT_INFEASIBLE`, `POLICY_BLOCKED`, `ALL_CANDIDATES_DISABLED`, `DAG_CYCLE_DETECTED`, `RISK_UNVERIFIABLE` (no `E_` prefix).
- `:352` §14 named refusals: `E_ACTIVE_RUN_EXISTS`, `E_BUDGET_EXCEEDED`, `E_REPAIR_STALLED`, etc.; `FORBIDDEN_PROVIDER_KEY_ACCESS`, `FORBIDDEN_SHELL`, `FORBIDDEN_AUTO_PROMOTION` (no `E_`).
- `:363` §15 R1 refusal: “`NO_CAPABLE_AGENT` etc.”; `:365` A2: `REPAIR_STALLED` (not `E_REPAIR_STALLED`).
- `:82` W07 uses `REPAIR_STALLED`; §14 uses `E_REPAIR_STALLED`.

**Why it bites in code:** Clients cannot have one error enum; tests that assert the “refusal matrix” will either miss codes or assert aliases; logs and UI can show different codes for the same condition. The traceability matrix cannot reference a single refusal ID per artifact.

**RED probe (READ/INFERRED):** extract all backticked refusal-like tokens from §6, §14, §15; diff against the §14 list; expected zero unknown tokens, current shows at least 7 CCR codes and 3 `FORBIDDEN_*` codes missing/differing.

**Exact patch:**
```diff
  CREATE `src/shared/refusals.ts` as the single source:
+ export const Refusals = { E_NO_CAPABLE_AGENT: 'E_NO_CAPABLE_AGENT', ... } as const;
+ export type RefusalCode = keyof typeof Refusals;
+ export const ALIASES: Record<string, RefusalCode> = {
+   NO_CAPABLE_AGENT: 'E_NO_CAPABLE_AGENT', BUDGET_INFEASIBLE: 'E_BUDGET_INFEASIBLE',
+   CONTEXT_INFEASIBLE: 'E_CONTEXT_INFEASIBLE', POLICY_BLOCKED: 'E_POLICY_BLOCKED',
+   ALL_CANDIDATES_DISABLED: 'E_ALL_CANDIDATES_DISABLED', DAG_CYCLE_DETECTED: 'E_DAG_CYCLE_DETECTED',
+   RISK_UNVERIFIABLE: 'E_RISK_UNVERIFIABLE', REPAIR_STALLED: 'E_REPAIR_STALLED',
+   FORBIDDEN_PROVIDER_KEY_ACCESS: 'E_FORBIDDEN_PROVIDER_KEY_ACCESS',
+   FORBIDDEN_SHELL: 'E_FORBIDDEN_SHELL', FORBIDDEN_AUTO_PROMOTION: 'E_FORBIDDEN_AUTO_PROMOTION',
+ };

  REPLACE §6.1 codes with the E_ forms; REPLACE §15 R1/A2 with the E_ forms;
  ADD all codes to the §14 canonical list; add a test that every emitted code is in `Refusals`.
```
Do not keep both forms as public codes; aliases are transitional only.

**GREEN verification (test design):** a grep/test finds no refusal token outside `Refusals`; every §15 artifact’s refusal is in the enum; the UI/CLI map through one function; a deliberately emitted alias fails the test.

**Lens:** capability-auditor (claims ↔ evidence) + integration-logic (client contract).

---

### D11 — P1 — The sealed 50-case pool cannot support the plan’s own evaluation count

**Evidence (READ):**
- `docs/PLAN-v2.md:67` B2: “single-use suites; 50-case sealed pool”.
- `:209` §7.1: “each suite version is single-use for exactly one candidate evaluation; re-freeze from a sealed pre-approved pool after every evaluation (promotion or no-promotion)”.
- `:213` test: “five synthetic no-effect candidates cannot reuse a suite”.
- `:278` P7 gate: “50 paired cases”.
- `:302` DoD: “`refused`/`no_promotion` recorded” is a valid outcome.

**Why it bites in code:** A pool of 50 cases can supply at most one 50-case suite. Five candidate evaluations require five fresh 50-case suites (≥250 cases, more with dev/holdout and no reuse). Either the pool is exhausted after one candidate, or the “single-use” test is impossible. Separately, the P7 gate requires 50 pairs even though the plan says a `refused`/`no_promotion` outcome is successful; a run that correctly refuses has no way to pass the gate.

**RED probe (test design, INFERRED):** suite allocator with a 50-case sealed pool and 5 candidate evaluations; expected 5 disjoint suites; actual allocation must reuse or refuse on candidate 2. A second probe: P7 gate evaluator on a `refused` outcome; expected pass (honest refusal), current gate expects 50 pairs.

**Exact patch:**
```diff
  REPLACE §3 B2 "50-case sealed pool" with:
+ sealed pre-approved pool of **250 cases (5 disjoint 50-case suites) or larger**; max 5 candidate
+ evaluations per pool generation; every suite is single-use; no case may appear in two suites for
+ the same candidate family; if a fresh 50-case suite cannot be allocated, P7 records `refused` and
+ stops.

  REPLACE §9 P7 gate "50 paired cases + screening gate ..." with:
+ P6a gate + **either** (a) a valid 50-pair evaluation that meets the screening gate, **or** (b) a
+ recorded `refused`/`no_promotion` with suite/provenance evidence and no reused case;
+ + approval/rollback + no auto-apply.
```
Document the pool budget and provenance in §7; do not silently shrink to 30 cases.

**GREEN verification (test design):** 5 candidates allocate 5 disjoint suites; the 6th is `E_LEARNING_SUITE_ALREADY_USED`/`refused`; a refused outcome passes the P7 gate; the pool manifest hash is unchanged after allocation.

**Lens:** capability-auditor (claim/evidence math) + research (evaluation design).

---

### D12 — P1 — `RunSnapshot` has hashes but not the materialized prompt/contracts

**Evidence (READ):**
- `docs/PLAN-v2.md:77` W01: “Immutable `RunSnapshot` at intake: prompt versions/hashes, policy version, model/thinking, limits, pricing table, engine map, preset. Nodes read only the snapshot; later edits apply to future runs”.
- `:238` §7.6 lists `prompt_versions`; no append-only rule, no content-addressed blob, no “snapshot stores prompt text”.

**Why it bites in code:** If the snapshot holds only a version/hash and nodes read the current prompt row, editing the prompt mid-run changes the run’s behavior and violates W01. If the prompt row is updated in place, the old hash no longer matches the content. The test “mutate prompt mid-run, assert old hash used” cannot pass without the old content being available.

**RED probe (test design, INFERRED):** start a run; edit the agent prompt override; let the run reach generation; assert the system message hash equals the hash recorded at intake. Current plan gives no guarantee that the old body is retrievable.

**Exact patch:**
```diff
  REPLACE line 77 (W01) with:
+ | W01 | Immutable `RunSnapshot` at intake: materialized prompt body + runtime contract
+ (content-addressed by SHA-256), prompt version IDs, policy version, model/thinking, limits, pricing
+ table, engine map, preset. `prompt_versions` is append-only: edits create a new version; update/
+ delete of an existing version is forbidden. Nodes read only the snapshot blobs; later edits apply
+ to future runs | Test: start run, edit prompt mid-run, assert old body/hash used; next run uses new;
+ delete/update of a referenced version is refused |

  ADD to §10: `prompt_blobs(hash TEXT PRIMARY KEY, body TEXT NOT NULL, created_at)`; the snapshot
  references a hash, and the blob is never deleted while any run or artifact references it.
```
Do not store the key or any secret in the blob; prompt bodies are product text.

**GREEN verification (test design):** mid-run edit does not change the run’s system message hash; the snapshot’s blob hash equals the recorded prompt hash; deleting a referenced blob is refused; a new run sees the new prompt.

**Lens:** integration-logic (data flow) + logic-gatekeeper (boundary).

---

### D13 — P1 — Release A preset→phase behavior is delegated to a missing v1

**Evidence (READ):**
- `docs/PLAN-v2.md:252` §8: “**Release A graph unchanged.** P6a: `intake → plan → route → generate → ...`”.
- v1 is absent (D1). v2 gives no Release A preset matrix; it mentions `audit` (W13) and revision (v1 §13/§14) but not the phase skips.
- `:88` W13: “Audit preset has real endpoint + refusal + tests”; no graph behavior.
- `:65` Release A includes “full build, revision/audit”.

**Why it bites in code:** A linear `intake→plan→generate→clean→harden→test→verify→finalize` graph runs `generate` with zero tasks for a blueprint, `verify` on an empty project, and `clean/harden/test` for an audit of existing files. The gate then fails “no files” or never loads the parent snapshot. The audit/revision presets become dead controls, which W13 forbids.

**RED probe (test design, INFERRED):** start a `blueprint` run; expected finalize with a plan and no generated files and `completed`; current linear graph would reach `verify` with zero files and fail. Start an `audit` run of a parent; expected load parent + review without generation; current graph has no parent-load step.

**Exact patch:**
```diff
  INSERT in §8 after line 252:
+ **Release A preset matrix (normative):**
+ | preset | phases | skips |
+ | full-build | intake→plan→generate→clean→harden→test→verify→(repair→verify)*→finalize | none |
+ | blueprint | intake→plan→finalize | generate/clean/harden/test/verify |
+ | audit | intake→load-parent→clean→harden→test→verify→(repair→verify)*→finalize | plan/generate |
+ | revise | intake→load-parent→select→plan(revision)→generate→clean→harden→test→verify→(repair→verify)*→finalize | full plan |
+ | ui-build | intake→plan→generate→clean→harden→verify→finalize | test unless requested |
+ | docs | intake→plan→generate→finalize | clean/harden/test/verify |
+ A phase with zero tasks is `skipped`, not run. A route refusal in P6a goes to finalize `failed`
+ without generation.
```
Implement the skip as a conditional edge, not as a no-op node that writes an empty artifact.

**GREEN verification (test design):** each preset runs with a mock provider and ends in the expected status with the expected phase rows; blueprint has zero generated files and passes; audit loads the parent; revise changes only selected files.

**Lens:** forge (build integration) + integration-logic (preset/API seam).

---

### D14 — P2 — The traceability matrix is not a count of record

**Evidence (READ):**
- `docs/PLAN-v2.md:24`: “one artifact = one primary type ... The matrix in §21 is the count of record.”
- `:380` §15: a single INFRA row for “budget-ledger service, L3 ranker, revision/feedback, vault, SSE” with no IDs.
- `:369` LG1 phase “P1/P6a” (two primary phases).
- A tables (`run_snapshots`, `budget_reservations`, `gate_decisions`, `idempotency_keys`) are absent from the matrix.

**Why it bites in code:** The matrix cannot be used to prove coverage: five INFRA artifacts share one row/one test column; LG1 has no single phase; core infrastructure has no refusal/test mapping. A “one artifact = one primary type” audit will find duplicate/missing counts.

**RED probe (READ/INFERRED):** matrix lint: every artifact has exactly one ID, one kind, one primary phase, one path, one refusal/test; current INFRA row fails (5 artifacts, no IDs) and LG1 fails (2 phases).

**Exact patch:**
```diff
  REPLACE the INFRA row with:
+ | INFRA | I1 | Run snapshots | `src/server/runs/snapshot.ts` | `E_SNAPSHOT_INVALID` | `snapshot.test.ts` | A |
+ | INFRA | I2 | Budget ledger | `src/server/budget/ledger.ts` | `E_BUDGET_*` | `ledger.test.ts` | A |
+ | INFRA | I3 | Idempotency + event store | `src/server/runs/store.ts` | `E_IDEMPOTENCY_*`, `E_REPLAY_*` | `store.test.ts` | A |
+ | INFRA | I4 | Manifest + vault | `src/server/runs/manifest.ts`, `src/server/vault/*` | `E_INTEGRITY_*` | `manifest.test.ts` | A |
+ | INFRA | I5 | SSE | `src/server/runs/sse.ts` | `E_REPLAY_*` | `sse.test.ts` | A |

  REPLACE LG1 phase "P1/P6a" with "P1".
  ADD `npm run plan:lint` matrix check: each ID occurs once; one primary phase; one primary test.
```
The matrix must remain the count of record; if v1 artifacts remain, list them too or explicitly scope the matrix to v2 additions.

**GREEN verification (test design):** matrix lint passes; no artifact has two primary phases; A tables are counted; the §15 total matches the §5 inventory.

**Lens:** auditor (independent coverage) + capability-auditor (count/claim).

---

### D15 — P2 — Two error envelopes for core refusals

**Evidence (READ):**
- `docs/PLAN-v2.md:341` §14: new P6a/P7 surfaces use `hive.api.v1`.
- `:256` §8: “existing routes keep the v1 error envelope until a later refactor.”
- `:87` W12 core refusals (`active run 409`, `invalid parent 409`, `oversized prompt 422`, `unsupported agent 404/422`, `unsafe zip/open-folder 422`, `DSH denial 403`) are on existing routes.

**Why it bites in code:** The UI and CLI must parse two different error shapes for the same class of refusal. Tests for the refusal matrix may assert the new envelope on a core route and fail, or the UI may render “unknown error” for core refusals.

**RED probe (test design, INFERRED):** call a core route that refuses (e.g., second active run); assert `hive.api.v1` shape; current plan says v1 envelope. The client contract is not one thing.

**Exact patch:**
```diff
  REPLACE §14 line 256/341 policy with:
+ **One envelope for new and core refusals.** `hive.api.v1` is used by every new P6a/P7 route and by
+ the W12 core refusals from Release A. The legacy v1 envelope is accepted on read for old runs only
+ (`legacy:true`), never emitted by a new refusal. Add a mapping table:
+ `{E_ACTIVE_RUN_EXISTS:409, E_INVALID_PARENT:409, E_PROMPT_TOO_LARGE:422, E_UNSUPPORTED_AGENT:404,
+ E_UNSAFE_PATH:422, E_ZIP_PATH:422, E_DSH_CONSENT_REQUIRED:403}`.
```
Keep HTTP status mapping in one function; no route hand-builds an error body.

**GREEN verification (test design):** every W12 refusal asserts one envelope + one status; the UI error parser handles only `hive.api.v1` for new routes; a legacy run read still works.

**Lens:** auditor (contract consistency) + integration-logic (API seam).

---

### D16 — P2 — Sources are not traceable per claim

**Evidence (READ):**
- `docs/PLAN-v2.md:448`: a prose list (“DeepSeek official docs: models/pricing, Chat Completions, ...”; “LangGraph JS Graph API”, etc.).
- No URL, read date, or claim mapping; `:450` lists unverified experiments but not source rows.

**Why it bites in code:** The “verified corrections” in §2 cannot be re-checked; a future implementer cannot confirm the 1M context/393K output/pricing/`thinking` fields against a versioned source. The research lens’s contract is claim → source → date → scope.

**RED probe (READ/INFERRED):** a source-lint that requires every row in §2 to map to a URL + read date + exact claim will fail today (zero rows).

**Exact patch:**
```diff
  REPLACE §17 with a table:
+ | Claim | Source URL | Read date | Scope/notes |
+ | models/pricing/context/max output | https://api-docs.deepseek.com/quick_start/pricing | 2026-11-03 | live `/models` also checked |
+ | thinking/JSON/stream usage | https://api-docs.deepseek.com/api/create-chat-completion | 2026-11-03 | `thinking`, `response_format`, `stream_options` |
+ | LangGraph API | https://reference.langchain.com/javascript/langchain-langgraph | 2026-11-03 | package 1.6.0 types |
+ | ... | ... | ... | ... |
```
No source without a URL; local `node:sqlite` verification records the command and Node version.

**GREEN verification (test design):** source-lint passes; every §2 correction has a row; a broken URL/date fails the audit; the unverified list in §17 remains separate.

**Lens:** research (source discipline) + capability-auditor (claim strength).

---

## 3. Cross-section contradictions (cannot be fixed inside seat 1 alone)

| # | Contradiction | Sections | Owner |
|---|---|---|---|
| X1 | v2 is canonical but says v1 §§1–19 remain in force; v1 is absent | §0, §1, §8 | Lead |
| X2 | Release A must contain snapshots/budget/gate/idempotency, but §6.9 puts their tables in P6a | §3, §4, §6.9 | Lead |
| X3 | One active run (`E_ACTIVE_RUN_EXISTS`) vs “concurrent-run race test” and “user runs priority” | §4 W02, §14 | Lead + seat 2 |
| X4 | `budget > failed` gate precedence can hide hard failures | §6.7 LG1, §4 W07 | Lead + seat 5 |
| X5 | Two failure signatures (LG1 vs FSN) both drive `REPAIR_STALLED` | §4 W07, §6.3, §6.7 | seat 5 |
| X6 | 50-case pool vs 5 single-use suites vs P7 gate | §3, §7, §9, §11 | seat 4 + seat 5 |
| X7 | Refusal code families (`NO_*` vs `E_*` vs `FORBIDDEN_*`) | §6.1, §14, §15 | seat 2 + seat 5 |
| X8 | Release A preset behavior delegated to missing v1 | §8, §9, §14 | Lead + seat 2 |
| X9 | Traceability matrix counts P6a/P7 but not A infra; INFRA row has no IDs | §15 | Lead + seat 6 |
| X10 | Wave sheet names §21, v2 ends at §17 | Wave Sheet, §0, §5 | Lead |
| X11 | P7 gate requires 50 pairs; DoD accepts `refused`/`no_promotion` | §9, §11 | seat 4 |

---

## 4. What I checked and found clean (with evidence)

| Check | Evidence |
|---|---|
| Snapshot concept (immutability intent) | W01 `:77` is the right direction; only materialization/append-only is missing (D12) |
| Approval tokens are out-of-band; runs never wait on approval | W05 `:80`, §7.1 `:211`; no run-graph dependency on approval |
| No auto-promotion / no auto-apply | W05 `:80`, §0.6 `:20`, §11.3 `:302`; consistent |
| Bounded event summaries (intent) | W06 `:81` sets ≤8 KB and 90 d; algorithm is missing (D8) |
| Repair max 2 / no third blind attempt | W07 `:82`, FSN `:157`; concept is consistent (state mechanics D6) |
| Provider wire-body contract tests | W09 `:84` names `thinking`, `response_format`, `stream_options`, `max_tokens`, `user_id` |
| Prompt transform fixtures | W10 `:85`; 37-agent fixtures planned |
| Finish reasons enumerated | W19 `:94` covers `insufficient_system_resource`, `aborted`, `content_filter` |
| Null-not-zero budget policy | LG4 `:178`; correct at the pure-policy layer |
| CLI envelope/exit codes/dry-run/no key route | §14 `:341–350`; one envelope issue remains (D15) |
| Traceability no-double-count intent | §15 `:382` states the rule; matrix execution is incomplete (D14) |
| Sources’ unverified list is honest | §17 `:450` lists cache rates, seed, 50-case feasibility, generalization, repair-memory, fingerprint stability |
| P7 conditional stop is explicit | §3 `:69`, §17 approval condition `:454`; gate wording conflicts (X11) |

No product code, tests, or runtime were available; this is a document audit.

---

## 5. Claim strength

- **READ:** every defect cites v2 line numbers or a missing-file check; `docs/PLAN-v2.md` was read in full (454 lines); `docs/PLAN-v1.md` was checked and is absent.
- **INFERRED:** the defects describe behavior when the plan is enacted; no product code exists.
- **UNVERIFIED:** (a) v1’s content can be recovered from the Lead conversation; (b) a 250-case sealed pool is feasible; (c) the 50-pair eval fits $3.00 at the current price/usage; (d) `node:sqlite` supports the proposed `BEGIN IMMEDIATE` transaction pattern as used; (e) `system_fingerprint` stability; (f) the DSH balance supports P7. None was tested (no API calls/key access).
- **No VERIFIED runtime claims.**

---

## 6. Skills applied

| Skill / lens | Finding(s) produced |
|---|---|
| **smartfix** | D3 (repair staging, RED/GREEN), D5 (bounded ledger), D9 (crash/disk bounds), D8 (slow client) |
| **logic-debugger** | D3 (partial writes), D4 (idempotency/retry), D6 (transition matrix), D7 (truth precedence), D9 (recovery), D5 (ledger invariants) |
| **integration-logic** | D2 (A/P6a DB seam), D4 (request/idempotency), D8 (SSE/DB), D10 (client refusals), D12 (snapshot flow), D15 (envelope) |
| **logic-gatekeeper** | Phase 1 JSON gates for every mutation (Appendix A); D7 gate decision; D12 boundary |
| **research** | D1 (canonical corpus), D11 (evaluation design), D16 (source traceability) |
| **capability-auditor** | D10 (refusal taxonomy), D11 (pool/gate claim), D14 (matrix count) |
| **auditor** | Cross-section contradictions X1–X11; D14 coverage; clean-list independence |
| **forge** | D2 (phase staging/build order), D13 (preset/phase graph) |
| **forgewright-lead** | D1 (canonical authority), §0/§19/§21 references, X10 scope note |

---

## 7. Files read / sources

| Path / source | What was read |
|---|---|
| `docs/PLAN-AUDIT/WAVE-SHEET.md` (41 lines) | seat scope, forbidden actions, report format, gate |
| `docs/PLAN-v2.md` (454 lines) | full read; headings enumerated; line references above |
| `docs/PLAN-v1.md` | **absent** (`Test-Path` false); v1 is only in the Lead conversation (D1) |
| `C:\Users\Riley\.dsh\skills\smartfix\SKILL.md` | loaded via skill tool: RED→GREEN, one boundary, stop/rollback |
| `...\forgewright-logic-gatekeeper\SKILL.md` | loaded: Phase 1 JSON, entry checks |
| `...\logic-debugger\SKILL.md` | loaded: transition matrix, retry/replay, crash recovery |
| Local commands | `Get-ChildItem`, `Get-Content` heading extraction, `Test-Path`, `Get-Date` (timestamps) |
| No product code | No API calls, installs, key access, or writes outside this report + journal |

---

## Appendix A — Logic-gatekeeper Phase 1 JSON per proposed mutation

Each object is the gate required before the Lead applies the corresponding patch. `edgeCases` are non-empty and `rootCause` is a full sentence by construction.

```json
{"id":"D1","phase1":{"architecture":"canonical plan corpus (v1 base + v2 amendment) and section references","dataFlow":"implementer reads v2 §0/§8/§17, follows §19/§21/§17 references","edgeCases":["v1 file absent: implementer cannot resolve Release A graph","§21 has no heading: traceability and DoD pointers dangle"],"rootCause":"v2 declares v1 §§1–19 in force and points to §19/§21, but neither v1 nor those sections exist, so the plan is not executable from the repository corpus."}}
{"id":"D2","phase1":{"architecture":"Release A migration and P6a migration share one SQLite schema","dataFlow":"A pipeline opens run_snapshots/budget_reservations/gate_decisions/idempotency_keys","edgeCases":["A starts before P6a: tables missing","P6a rerun: duplicate table/owner"],"rootCause":"Release A depends on core tables that the plan assigns to P6a, so A cannot run and P6a conflicts with A."}}
{"id":"D3","phase1":{"architecture":"repair node, accepted run tree, verification node","dataFlow":"Watchman writes revised files, then verify reads them","edgeCases":["Repair writes a syntax error; verify fails; rejected file remains in accepted tree"],"rootCause":"The repair node writes the accepted tree before the gate rerun, so a failed repair leaves a partial write despite W07 forbidding it."}}
{"id":"D4","phase1":{"architecture":"run creation route, idempotency store, active-run guard, budget ledger","dataFlow":"client POST /api/runs -> active-run check -> run insert -> reservation","edgeCases":["Response lost; client retries same key; expected same run, current 409"],"rootCause":"Core run creation has no idempotency record and the active-run guard is checked first, so a retry cannot replay the original response and can either be falsely refused or duplicate the run."}}
{"id":"D5","phase1":{"architecture":"budget-policy pure logic + budget_reservations transactional service + global ledger","dataFlow":"reserve before call -> commit provider usage -> release remainder","edgeCases":["Crash after reserve; restart; orphan reservation","Provider returns no usage; commit zero would undercount"],"rootCause":"The ledger has no global cap, integer money rule at the service boundary, or crash recovery, so spend can exceed the advertised global budget or leak reservations."}}
{"id":"D6","phase1":{"architecture":"run/phase state machine and phase attempt rows","dataFlow":"verify fails -> repair -> verify rerun","edgeCases":["verify is terminal failed; repair cannot transition it to running"],"rootCause":"Phase attempts are not modeled, so a failed phase is terminal and the planned repair rerun is an illegal transition or violates the terminal invariant."}}
{"id":"D7","phase1":{"architecture":"gate-decision LG1 and failure signature FSN","dataFlow":"checks+policy -> gate status; failure cluster -> repair stall","edgeCases":["hard fail + budget exhausted; precedence returns budget, hiding failed"],"rootCause":"Budget outranks failed in the gate precedence and the plan uses two different signatures for stall detection, so status and repair decisions can disagree with the real failure."}}
{"id":"D8","phase1":{"architecture":"event store + SSE replay + live subscription","dataFlow":"client reconnects with Last-Event-ID -> query events -> subscribe","edgeCases":["event emitted between query and subscribe is lost","cursor older than 500 events is silently truncated"],"rootCause":"The replay/live handoff order and the truncation/retention refusals are unspecified, so reconnects can lose or duplicate events or silently present an incomplete stream."}}
{"id":"D9","phase1":{"architecture":"migrations, startup recovery, single-instance lock, manifest finalization, disk guard","dataFlow":"startup -> migrate -> reconcile workspace -> serve; finalize -> write manifest","edgeCases":["crash after file rename before artifact row","two servers migrate same DB"],"rootCause":"Migration, lock, reconciliation, atomic manifest, and disk-threshold behavior are unspecified, so crashes and double starts can leave an unusable or inconsistent workspace."}}
{"id":"D10","phase1":{"architecture":"shared refusal enum + API/CLI error envelopes","dataFlow":"agent/pipeline emits a refusal -> API/CLI serializes it","edgeCases":["CCR emits NO_CAPABLE_AGENT while §14 lists only E_*"],"rootCause":"Refusal codes are written in three incompatible families, so clients and the refusal-matrix tests cannot enforce one contract."}}
{"id":"D11","phase1":{"architecture":"sealed evaluation pool, suite allocator, P7 promotion gate","dataFlow":"candidate evaluation -> allocate a fresh 50-case suite -> evaluate","edgeCases":["5 candidates demand 5 disjoint suites; 50-case pool supplies one"],"rootCause":"The sealed pool is smaller than the number of single-use suites the plan requires, and the P7 gate does not accept the honest refused outcome."}}
{"id":"D12","phase1":{"architecture":"RunSnapshot, prompt_versions, content-addressed blobs","dataFlow":"intake -> snapshot -> generation node reads prompt","edgeCases":["prompt edited mid-run; snapshot has only a hash; node reads current row"],"rootCause":"The snapshot references prompt hashes but the plan does not guarantee the old prompt body is retrievable and append-only, so mid-run edits can change the run."}}
{"id":"D13","phase1":{"architecture":"Release A graph and preset router","dataFlow":"preset -> phase edges -> verify gate","edgeCases":["blueprint has zero files; linear graph reaches verify and fails"],"rootCause":"Release A preset phase behavior is delegated to an absent v1, so a linear v2 implementation runs generate/verify on zero-file presets and dead-ends audit/revision."}}
{"id":"D14","phase1":{"architecture":"traceability matrix as count of record","dataFlow":"artifact -> ID/kind/phase/path/refusal/test","edgeCases":["INFRA row has five artifacts and no IDs; LG1 has two phases"],"rootCause":"The matrix does not assign one ID and one primary phase per artifact, so it cannot prove coverage or count."}}
{"id":"D15","phase1":{"architecture":"API error envelope for core and P6a/P7 routes","dataFlow":"core refusal -> route -> UI/CLI parser","edgeCases":["core active-run 409 returns v1 envelope; new route returns hive.api.v1"],"rootCause":"Core and new routes use two different error envelopes, so clients cannot parse refusals with one contract."}}
{"id":"D16","phase1":{"architecture":"sources/claims table in §17","dataFlow":"§2 correction -> URL/date/claim -> implementation","edgeCases":["pricing/context claim has no URL/date; cannot be re-checked"],"rootCause":"Sources are a prose list without per-claim URL/date mapping, so the plan's verified corrections are not traceable."}}
```

---

## Appendix B — Scope note on §21

The wave sheet assigns §21 to this seat, but v2 ends at §17 (`## 17. Sources`). The Lead’s correction says v2 contains §0–§17 and that traceability is §15. Therefore:
- §21 was audited as **§15 (traceability)** and **§17 (sources)**;
- §21 itself is a stale reference in §0/§5 and is reported as part of **D1/D14/X10**;
- no finding is claimed against a nonexistent §21.

**End of report.**
