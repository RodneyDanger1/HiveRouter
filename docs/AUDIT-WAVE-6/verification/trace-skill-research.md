# TRACE skill research note — Wave 6 evidence

## Questions

1. Which audit claims were wrong, stale, or unverified?
2. Which trace hops did the first three seats miss?
3. What rules would have caught the real defects earlier and prevented the false claims?
4. What must the trace skill require after a control appears to work?

## Confirmed findings (local evidence)

- Weaver audited **398 control instances** on 9 surfaces and **34 control families** with 11-hop traces; it confirmed **13 defects**, including the 5-event SSE subscription gap and failed-run spend. It correctly classified `run_abf5` as a **stale mid-run capture**, not terminal-convergence failure.
- Logic produced **16 findings** and a throwaway-DB probe with **6/15 RED**. It proved provider-code loss, failed-run spend NULL, dead state machine, SSE type drift, false `/events` truncation, silent startup interrupt, and gate failure diagnostics.
- Forge independently corroborated cost/event/truncation defects and refuted R-1/R-2/R-3, but its `P-4` recipe (`getEvents(id, after, window+1)` then slice) was **not implementable** for the newest window; the gate rejected it. Its P-1…P-7 files did exist; the directive's claim they were missing was **wrong**.
- Capability audit found **38 SUPPORTED**, **3 REFUTED**, **5 UNVERIFIED**; it corrected the cost-cap provenance (`runBudgetUsd(id)`, not the global `run_snapshots.limits`) and found `AgentPlanSchema` had zero production callers. It approved **11 fixes**.
- Logic gate re-read source, rejected no AF, imposed **10 sets of conditions**, and caught the input-integrity error. It rejected the full state guard as unsafe because the declared phase matrix contradicts four real edges and an executor catch throw could become unhandled rejection.
- ForgeWright implemented all 11 AFs: **50 test files / 312 tests**, typecheck/build clean, stage unchanged at **48 routes / 45 tables / 24 scripts**, **26/26 E2E**, preflight pass after server stop. Historical NULL-cost rows stayed NULL; no P7 data.

## Remaining unknowns / unverified

- Live→terminal Events-tab transition was not exercised (no non-terminal paid run; duplication forbidden); unit truth table + fresh terminal load only.
- Provider-failure runtime specimen for `run.ts` agent-step mapping was not exercised (paid).
- `>500` event replay boundary was unavailable; tested with a window of 3.
- 410 SSE reconnect loop client half remains unproven.
- Preflight initially failed on free RAM (1.08 GB < 1.5 GB) during the writer run, then passed after the server stopped; environment, not code.

## Design implications for the trace skill

1. **Trace events as a first-class surface**, not just controls: server emitter → persisted row → SSE frame → registered client listener → UI consumer → payload shape.
2. **Named events do not reach `onmessage`.** A missing `addEventListener` is a dropped event, not a cosmetic omission.
3. **Live vs persisted must be one shape.** Unwrap the SSE envelope and compare against `payload` from `/events`; a live row and a reload row must mean the same thing.
4. **Terminal state has multiple independent truths**: run row, event payload, snapshot, live buffer, persisted ledger, header/actions. Compare all; a screenshot without its timestamp is not evidence.
5. **Failed terminal records must aggregate measured usage**; NULL means unknown, not zero. A trace must compare `runs.cost_usd` with `usage` and `traces`.
6. **Derived UI values need provenance**: cap from per-run `runBudgetUsd`, never a same-key global snapshot value.
7. **Dead state machines are a defect only when wiring is safe.** Trace the phase/status edges and reject a guard whose phase matrix contradicts real writers.
8. **Verify peer file claims**: the directive said forge files were missing while they existed. Never reconstruct evidence from prose when the files can be listed/hashed.
9. **A recipe can be structurally wrong.** Validate `LIMIT` direction/order against the acceptance case before approving it.
10. **Keep the audit process read-only; one product writer; gate every AF; preserve pinned tests and P7 honesty.**

## Claim strength

- VERIFIED: test counts, stage, E2E, preflight, API/DOM checks, source hashes.
- READ: audit reports, gate records, forgewright receipt, source call sites.
- INFERRED: the full 398-control matrix is taken from the weaver’s machine-readable artifact; its individual rows were not re-driven by the Lead.
- UNVERIFIED: live→terminal transition, provider-failure runtime, >500 events, 410 client loop, P7 live.
