# Backend fixer — seat BE-2 report (Lead-completed)

**Scope:** pipeline/LLM/agents/learning/shared.

**Fixed**
- P6a pipeline now has a `pipelineCapabilities()` feature map (`src/server/pipeline/features.ts`) and skips P6a/P7 writes with named `E_ROUTING_DISABLED`/`E_LEARNING_DISABLED` when features are off. B2 behavior unchanged.
- RVS `availableChecks` now includes `syntax.tsx` and `syntax.jsx`; valid TSX runs pass, skipped checks remain mandatory-unverified and fail closed.
- Ad-hoc `tests` agents use `TestsSchema` and write multiple test files; target path is required only for `files` agents.
- Trace ingestion records cache hit/miss/reasoning tokens; L4 guard is called in finalize with a learning-audit row and warning check.

**Evidence**
- `npm.cmd run typecheck` PASS.
- `npm.cmd test` → 213/213.
- Live TSX build `run_b8a8e239a57052f146` completed `$0.00422067`, `src/App.tsx` + `tests/test_app.test.tsx`, `syntax.all: pass`, `verification.plan: pass`.
- `npm.cmd run e2e` → 17/17.

**Residual:** P7 live promotion requires a sealed 390-case pool + consent + paired live evaluation; no promotion is claimed. Whole-tree atomic finalize remains an accepted testing-stage risk.
