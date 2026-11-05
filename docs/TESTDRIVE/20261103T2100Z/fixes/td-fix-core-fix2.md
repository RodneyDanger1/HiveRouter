# td-fix-core — FIX2 CD1-D10

**Status: DONE** — per-attempt budget hooks implemented; repair storm can no longer overcommit one reservation. No server restart, key, paid call, or out-of-scope edit.

## Defect
**TD1-D10 (P2)** — `chatJson` could make up to `1 + maxJsonRepairs` provider calls on **one** row from the agent's single `reserveLlmCall`, then commit the summed actual cost. If the sum exceeded that one reservation, `commitLlmCall` raised `E_BUDGET_OVERCOMMIT` after the spend.

## RED
Deterministic old-path probe: one `$0.02`-cap reservation of 16,768 µUSD, two attempts costing 4,802 µUSD each (cumulative 9,604):
- The pre-fix path used one reservation and committed cumulative actual; a larger synthetic cumulative 19,200 µUSD against the 16,768 µUSD reservation produced `OLD_RED E_BUDGET_OVERCOMMIT`.
- This is the exact commit/overcommit boundary; the new path commits each attempt separately.

## Fix (minimal, owned)
- `src/server/llm/client.ts:113-115,137-138,574-620,951-952`: `structured()` now calls optional `onAttemptStart(attempt)` before each provider request and `onAttemptEnd(attempt, usage, error)` once after each attempt (success, JSON-invalid, schema-invalid, or thrown). The start hook may return the budget-fitted `max_tokens` used for that attempt.
- `src/server/pipeline/agent-runner.ts:41-94`: `callAgentJson` keeps a per-attempt reservation; `onAttemptStart` fits/reserves, `onAttemptEnd` commits that attempt's actual and clears it. The final aggregate `commitLlmCall` is removed.
- Safety: each attempt is reserved before spend and committed with its own actual; no reservation spans a repair. The fitted `maxTokens` is passed to the provider, so worst-case cost stays under the per-attempt reservation.

## GREEN
End-to-end deterministic probe (fake fetch, no paid call; first response invalid JSON, second valid; completion 8,000 tokens each):
```
REPAIR_GREEN_2 {"calls":2,"ok":true,"reservationRows":[
  {"state":"committed","amount_micro_usd":16768,"committed_micro_usd":4802},
  {"state":"committed","amount_micro_usd":12621,"committed_micro_usd":4802}
]}
OLD_RED E_BUDGET_OVERCOMMIT
```
Two independent reservations, both committed; no outstanding reservation; no overcommit.

Regression test: `test/unit/llm-budget-repair.test.ts` asserts `onAttemptStart`/`onAttemptEnd` fire once per attempt, the fitted `max_tokens` is sent, and both attempts commit usage.

## Commands / evidence
- `vitest run test/unit/llm-budget-repair.test.ts test/unit/llm.client.test.ts test/unit/logic-core.test.ts test/pipeline-qa.test.ts` → **4 files / 29 tests passed**.
- `npm.cmd run typecheck` → **exit 0**.
- `/api/runs/active` was `null` at FIX1; no server restart was performed, so the running process still predates this source. Live cards are Lead-owned and remain unverified for this change.

## Residuals
- Internal HTTP retries inside one provider attempt (`#requestWithRetry`) still share that attempt's reservation; a 5xx retry storm can exceed it. Not TD1-D10 (JSON-repair) and not exercised.
- `onAttemptEnd` commits the reserved amount when an attempt fails before usage is available; conservative, not zero.
- No out-of-scope files touched; only `client.ts`, `agent-runner.ts`, the new regression test, and this report.
