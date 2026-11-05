# BUGFIX WAVE 4 — plan

## Outcome

Close the four documented residuals at the code/test level: per-HTTP-attempt reservations, router DP above $1, per-candidate route disclosure, and whole-tree directory-swap finalization.

## Current behavior / defects

- `#requestWithRetry` had no per-request budget hooks; one structured attempt covered internal retries.
- `selectExact` rejected any capacity above `MAX_DP_CAPACITY` ($1).
- `TaskRoute` exposed only the chosen candidate; `route_candidates` had no model/thinking/effort/chosen columns and stored only one candidate.
- `finalize` wrote files individually into the live workspace; a crash could leave a partial tree.

## Decisions

1. Add HTTP-attempt hooks and settle a reservation per actual HTTP request; failed attempts commit 0 rather than holding the reserved amount.
2. Keep exact DP below $1; above it, quantize capacity/cost upward and retain the post-DP actual-cost assertion.
3. Add candidate arrays to `TaskRoute`, additive DB columns, insert every candidate, and expose all fields through `/routing`.
4. Build a sibling publish tree, rename old root aside, rename publish into place, restore on failure, recover interrupted renames at startup.

## File-by-file change

- `src/server/llm/client.ts` — HTTP hooks, per-attempt retry settlement, compatibility-wrapper passthrough.
- `src/server/pipeline/agent-runner.ts` — per-HTTP reservation lifecycle.
- `src/server/routing/ccr.ts` — DP quantization + candidate arrays.
- `src/shared/algorithms.ts` — `TaskRoute.candidates`.
- `src/server/db/database.ts`, `migrations.ts` — candidate columns for fresh/existing DBs.
- `src/server/pipeline/run.ts` — all-candidate inserts; atomic publish.
- `src/server/runs/publish.ts` — directory swap + startup recovery.
- `src/server/app.ts` — candidate model/thinking/effort/chosen disclosure.
- Tests: `http-attempt-hooks`, `routing` (budget >1), `publish`, `trace-fixes`, `agent-runtime`.

## Failure modes

- HTTP retry: each attempt reserved/ended; a reservation is released/committed even on 5xx/timeout.
- DP >$1: conservative rounding; post-DP actual check prevents over-budget publication.
- Candidate insert: additive migration; old rows remain null; new runs complete.
- Publish: root-aside/publish-in; failed second rename restores; startup recovery handles crash between renames.
- P7: no sealed pool/consent → `P7_REFUSED`; no synthetic promotion.

## Tests / gates

Typecheck, unit, build, E2E, verify, stage, preflight, live smoke, secret/stub scans; live low-cap run verifies usage rows, candidate disclosure, and workspace cleanliness.

## Rollback

Revert the listed files; additive DB columns are harmless and can remain. No destructive migration. Remove `publish.ts`; old finalize behavior returns.

## Out of scope / blockers

P7 live promotion requires a user-authored 390-case sealed pool + case-to-provider consent and a real paired evaluation. That external prerequisite is absent; `P7_REFUSED` remains valid.
