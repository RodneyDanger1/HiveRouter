# BUGFIX WAVE 5 — chat intent, learning truth, run false-positive closure

## Outcome

Added a server-side **Prompt Analyst** integrated into the composer, fixed a real **stub-scan false positive** that failed a legitimate generated run, fixed a **double-settlement budget bug** (`E_BUDGET_UNKNOWN_RESERVATION`), corrected the **learning overview** truth model, and wired the learning approval/promotion/rollback HTTP routes to their real services. P7 live promotion is still unavailable because this workspace has no sealed pool or consent; that is reported rather than fabricated.

## 1. Prompt analyst (chat intent gate)

- `src/shared/prompt-analysis.ts`: strict schema with `user|inferred|unknown` source labels, exact `evidenceQuote`, acceptance proof/status, ambiguities, non-goals, limitations.
- `src/server/prompt/analyst.ts`: DeepSeek Flash call (same API/key, server-side only), one repair attempt when an evidence quote is invalid, then named refusal.
- `src/server/app.ts`: `POST /api/prompt/analyze`; prompt 8–8000 chars; secret-pattern refusal; no key in browser.
- `web/src/components/PromptAnalysisCard.tsx` + `RunComposer`: “Analyze prompt” and “Use analyzed brief”; shows exact quotes, inferred/unknown labels, acceptance proof, limitations.
- **Live:** blue-chicken prompt returned **HTTP 200** with separate chicken/blue requirements, exact quotes, and proof checks; a long 347-char audit prompt also returned 200 after one repair. UI screenshot: `docs/verification/prompt-analyst-2026-11-04.png`.
- **Anti-fabrication guard:** a `source=user` requirement whose quote is not an exact prompt substring fails validation; the analyst searches once for a corrected answer and otherwise returns `E_PROMPT_ANALYSIS_INVALID` instead of saving an invented claim.

## 2. Run false positive fixed

- `run_abf5…` failed because the stub scanner flagged legitimate prose: `"not implemented"` in a docstring/list and `"NotImplementedError"` in a diagnostic tuple.
- `src/server/verify/stub-scan.ts` now flags only explicit sentinel comments, `raise/throw/return NotImplemented(Error)`, and real placeholder comments; capability prose is not a defect.
- **Proof:** re-scanning the failed run’s staging tree returned **0 findings**. A full rerun with the same brief completed: `run_95c11797b4923b4277`, **20 artifacts**, **$0.250781772**, completed.

## 3. Budget reservation double-settlement fixed

- A real run failed with `E_BUDGET_UNKNOWN_RESERVATION` at `commitLlmCall` after a repair request.
- `callAgentJson`/`callAgentText` now clear the reservation id **before** committing; an over-commit throw can no longer cause the client’s second end-hook to settle the same row again.
- Per-HTTP reservation also uses the **serialized request body size**, so JSON-repair messages increase the reservation estimate instead of under-reserving.
- `agent-runtime.test` covers the double-end/over-commit path: one commit, no release, surfaced `E_BUDGET_OVERCOMMIT` rather than an unknown reservation.

## 4. Learning truth and services

- `buildLearningOverview` now derives `completeSealedBlocks` (status ready and exactly 65 cases), checks each consent scope separately, and requires ≥3 traces. Previously any block count/any consent row could mark learning enabled.
- HTTP `/api/learning/approvals`, `/promotions`, `/rollback` now call the real approval/promotion/rollback services instead of unconditional stubs. With no data they return `E_LEARNING_DATASET_EMPTY` / `E_LEARNING_APPROVAL_REQUIRED`, not a fake sample. Live checks: approvals **422 E_LEARNING_DATASET_EMPTY**, promotions **403 E_LEARNING_APPROVAL_REQUIRED**.
- `scripts/learning-admin.ts` + `learning:admin` script provides the only supported way to supply the two external prerequisites: `consent status|grant|revoke` and `import-block` with a real 65-case file. No synthetic pool is seeded.
- Live overview: `E_LEARNING_POOL_EXHAUSTED`, `sealedBlocks:0`, `completeSealedBlocks:0`, consent inactive, `traces:12`.

## 5. Settings `E_NETWORK` triage

- Reproduced context: the two GETs failed while the server was restarting; current `/api/settings` and `/api/settings/key-status` return **200**.
- Added one automatic retry (650 ms) in `useApiResource` for a transient `E_NETWORK` before surfacing the error. A real outage still reports `E_NETWORK`; it is not hidden.
- No provider-key route or key material was added.

## 6. Runs audited

- 25 runs at close; non-completed: one budget cap (`E_BUDGET_EXCEEDED` at .05/.2), one gate failure (stub false positive now fixed), and historical failed/budget runs. No run was marked completed without checks.
- The false-positive run is now reproducible as a completed run with adequate budget (.50).

## Gates

- typecheck PASS
- **38 files / 249 tests PASS**
- build PASS
- **26/26 E2E PASS**
- `verify` PASS
- strict stage **150 files / 45 tables / 48 routes / 24 scripts**
- preflight PASS
- live smoke PASS `$0.0000321`
- stub-sweep clean (86 files); secret-scan clean (148 files)

## Not done / unverified

- **P7 live promotion**: no real 390-case sealed pool, no active consent, no paired evaluation/candidate; no promotion claimed.
- **Prompt analyst cost is not written to the run ledger** (it is a pre-run read-only analysis); the API has a bounded token request but no reservation entry.
- **Settings E_NETWORK** was not reproducible as a steady-state code defect; the 200 responses and automatic retry are the evidence available.
- **Real 5xx/restart mid-analysis** and **learning promotion with real data** remain unexercised.
