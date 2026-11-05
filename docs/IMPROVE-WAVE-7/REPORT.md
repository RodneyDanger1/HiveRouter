# IMPROVE-WAVE-7 — logical hardening after Wave 6

## Selected improvements

Wave 6 left these unsafe/deferred items. Wave 7 closes the two safe, high-value ones and fixes a related UI/data seam:

1. **Run-status guard was dead code.** `updateRun` accepted any status, including `completed -> running`; the pure `transitionRun` matrix had zero production callers.
2. **Runs status filtering was client-side over a fixed 100-row payload** and omitted `queued`, `paused`, and `interrupted`; a filtered view could never see beyond the first 100 rows.
3. **Settings hid the server's nested `limits` object**, so the real run/event caps were not shown on the Settings page.

## Root causes and fixes

### 1. Status-transition guard (logic-debugger + forge)

**RED (before edit):**

```text
npm.cmd test -- --run test/unit/run-transition-guard.test.ts
Tests  2 failed | 1 passed (3)
- completed -> running did not throw
- queued -> completed did not throw
```

**Boundary:** `src/server/runs/recorder.ts:updateRun`.

**Fix:** before a status write, read the current status, call
`assertStatusTransition(current, next, runId)`, and perform the UPDATE as a
compare-and-swap (`WHERE id = ? AND status = ?`). Same-status writes remain
idempotent; a concurrent status change makes the CAS fail closed with
`RunTransitionError` / `E_ILLEGAL_RUN_TRANSITION`, so a stale writer cannot
downgrade a terminal run.

**Deliberately not wired:** the full `PHASE_TRANSITIONS` graph. The Wave 6 gate proved its
declared phase matrix contradicts real review/adhoc/catch/startup edges. This change
guards **status edges plus terminal-phase immutability** (`completed`/`completed_with_warnings`
must be `done`, and a terminal run cannot change phase); it does not enforce the full phase graph.

**GREEN:** `test/unit/run-transition-guard.test.ts` **5/5**, full suite
**51 files / 317 tests passed**.

### 2. Server-side Runs filter (integration-logic + trace)

**Root cause:** `RunsPage.tsx` fetched `listRuns(100)` and filtered in memory;
`/api/runs` already supported a `status` query but `listRuns` never sent it.
The filter list omitted `queued`, `paused`, and `interrupted`, and a status
outside the fetched 100 rows was silently invisible.

**Fix:** `listRuns(limit, signal, status)` sends a URL-encoded `status` query;
`useApiResource` reloads on status change; the page renders the API-filtered
rows and a server-filtered count. Added the missing status options.

**Live evidence:** Playwright observed requests
`/api/runs?limit=100` then `/api/runs?limit=100&status=failed`; the failed view
showed 3 rows, and the screenshot is `docs/IMPROVE-WAVE-7/runs-filtered-failed.png`.

### 3. Settings limits visibility (integration-logic + trace)

**Root cause:** `/api/settings` returns `limits` nested, but `SettingsView`
filtered out all objects; only top-level scalars were shown.

**Fix:** flatten the real `limits` and `features` objects (two levels) into
safe scalar rows, never rendering objects/arrays or key material. The live
Settings page now displays `LIMITS.MAXRUNCOSTUSD = 0.5`,
`LIMITS.EVENTREPLAYWINDOW = 500`, and all other scalar limits; screenshot
`docs/IMPROVE-WAVE-7/settings-limits.png`.

**E2E:** added assertions for `limits.maxRunCostUsd` and
`limits.eventReplayWindow`; `26/26` E2E passed.

## Verification

| Gate | Result |
|---|---|
| RED status guard | 2 failed before the fix |
| Targeted GREEN | `run-transition-guard` 5/5 |
| Full unit | **51 files / 317 tests passed** |
| Typecheck | PASS |
| Build | PASS |
| E2E | **26/26 passed** after restart |
| Strict stage | **163 files / 45 tables / 48 routes / 24 scripts**, violations [] |
| Live Runs filter | `status=failed` request observed; 3 failed rows |
| Live Settings | nested limits rendered |
| Backward compatibility | same-status updates, legal queued->running, terminal guard, existing run lifecycle tests all pass |
| Data/history | no historical backfill; no P7 data/paid calls |

## Skills applied

- **research:** read Wave 6 gate/report/source and current callers before choosing scope.
- **logic-debugger:** invariant (`terminal states cannot move`), RED, transition matrix, CAS fail-closed.
- **integration-logic:** call-chain from RunsPage → api.ts → route `?status` → listRuns; Settings payload → flatten.
- **systems-validator:** diffed declared matrix vs production writers; intentionally left unsafe phase matrix unwired; checked stage/route counts.
- **auditor:** independent verification requested after implementation (see `docs/IMPROVE-WAVE-7/audit/` when complete).
- **capability-auditor:** confirmed the Wave 6 plan-contract fix remains the right agent-boundary change; no new agent tools/capabilities added by Wave 7.
- **forge:** minimal boundary change in one persistence writer; no symptom patches.
- **trace:** live browser proof of Runs filter and Settings values, plus existing run-detail regression.

## Not done / deferred

- Full phase-transition guard remains deferred: the phase matrix is unsafe to wire until it is reconciled with every real writer.
- No historical backfill; no paid `test:live` in this batch.
- The status guard is unit-tested for illegal transitions and terminal-phase invariants; the public API does not expose a raw status-mutation route, so no live illegal-transition endpoint probe exists. The phase matrix itself remains intentionally unwired.
- `trace_complete` invariant and other Wave 6 deferred items remain deferred.

## Independent audit result

Independent read-only `auditor` on the frozen snapshot: **PASS-WITH-NOTES** (no product-behaviour blocker).

- Targeted guard **5/5**; full **51 files / 317 tests passed**; E2E **26/26**; stage **163 files / 45 tables / 48 routes / 24 scripts**, violations []; typecheck PASS.
- 38-case transition probe: 5 illegal edges throw `E_ILLEGAL_RUN_TRANSITION` with rows unchanged; legal/same-status paths pass; 3 injected CAS races fail closed; `markRunning`/`markTerminal`/`cancelRun` pass.
- Live Runs filter: `status=failed` 3 rows, `status=queued` 0; all 10 statuses; **Settings** shows 18 `limits.*` scalars and no object/key leak.
- First attempted audit was discarded as mixed-version because product/test files moved mid-audit; the final snapshot was re-audited frozen. Evidence: `docs/IMPROVE-WAVE-7/audit/AUDIT.md`, `claims.json`.

**Auditor notes/residual:** F2 count is returned-row count, not a total (100-row display cap remains); F3 phase-only CAS error carries `to=undefined` (fail-closed but imprecise); F4 missing-run status patch is a silent no-op and invalid status is a pre-existing ZodError. These are documented, not claimed fixed.
