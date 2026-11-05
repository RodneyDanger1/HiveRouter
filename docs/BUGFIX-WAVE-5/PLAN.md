# BUGFIX WAVE 5 — plan

## Goal

Add a truthful chat-intent analyst using the same DeepSeek API, fix the run/learning defects that explain the reported failures, and keep every claim evidence-bound.

## Design

1. Server-only prompt analysis with strict schema; `user` claims require exact prompt quotes; one repair; named refusal.
2. Composer integration with explicit inferred/unknown labels and acceptance proof; no browser key.
3. Stub-scan narrows to executable sentinel constructs/comments, not capability prose.
4. Reservation settlement clears the id before commit; requestChars includes repair messages.
5. Learning overview derives complete blocks and active scopes; HTTP approval/promotion routes call services; admin CLI supplies real data.
6. One transient network retry in `useApiResource`.

## Files

- `src/shared/prompt-analysis.ts`, `src/server/prompt/analyst.ts`
- `src/server/app.ts` (`POST /api/prompt/analyze`, learning routes)
- `web/src/components/PromptAnalysisCard.tsx`, `RunComposer.tsx`, `api.ts`, `api-types.ts`
- `src/server/verify/stub-scan.ts`
- `src/server/pipeline/agent-runner.ts`, `src/server/llm/client.ts`
- `src/server/learning/overview.ts`, `scripts/learning-admin.ts`
- `web/src/hooks/useApi.ts`, `config/releases/p7.json`, tests and E2E.

## Verification

Unit (schema/refusal/repair, learning truth, stub scan, double settlement), full suite, typecheck, build, E2E, live prompt analysis, live learning refusals, live full run, strict stage, preflight, sweeps.

## Rollback

Revert new files/routes and restore prior scanner/learning-stub behavior; no destructive migration. Prompt analysis route and education admin are additive; removing them does not affect runs.

## Blockers

P7 live promotion requires a human-supplied pool, consent, candidate and paired evaluation. The code now accepts them; this workspace has none. No synthetic data.
