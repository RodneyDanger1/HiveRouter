# QA WAVE 1 — `qa-learning` journal

**Seat:** 6 · `qa-learning` · owner of `src/server/learning/**`, `scripts/learn.ts`, `scripts/eval-router.ts`, `scripts/live-smoke.ts`, new learning tests.
**Window:** 2026-11-03T10:22:37–10:29:00 -06:00.
**Mode:** execute; no server restart, install, git write, key access, or paid call.
**Wave:** `docs/QA-WAVE-1/WAVE-SHEET.md`; contract `docs/PLAN-v3.md` §9; `AGENTS.md`.

## Read

- `docs/QA-WAVE-1/WAVE-SHEET.md` (full)
- `AGENTS.md` (full)
- `docs/PLAN-v3.md` §9 (learning system)
- `scripts/learn.ts`, `scripts/eval-router.ts`, `scripts/live-smoke.ts`
- `src/server/learning/**` (15 files), `src/server/db/migrations.ts` P7 SQL, `src/server/security/redact.ts`
- Learning tests under `test/unit/learning*.test.ts`

## Baseline (before edits)

- `npm.cmd run typecheck` → clean.
- `npx vitest run learning` → 42 passed / 7 files.
- `npm run learn -- --json` → exit 6, `E_LEARNING_POOL_EXHAUSTED`, counts all 0 (honest refusal).
- `npm run eval:router -- --json` → exit 0, 7 decisions.
- `npm run assert-stage -- --stage=p7 --json` → `ok:true`, `violations:[]`, 45 tables, 46 routes, 22 scripts.
- `npm run preflight -- --port 0 --json` → exit 7, RAM 0.83 < 1.5 (out-of-scope environment blocker; start gate had been green).

## RED

1. `npx vitest run test/unit/learning-cli.test.ts` → failed:
   `expected 'E_LEARNING_INSUFFICIENT_SAMPLE' to be 'E_LEARNING_POOL_EXHAUSTED'`
   Six empty `sealed_pool_blocks` rows made `learn` treat the pool as present; the real defect is an incomplete pool.
2. `npx vitest run test/unit/learning-approval.test.ts` → failed:
   `expected [Function] to throw an error` for `expires_at='not-a-date'`.
   `Date.parse('not-a-date')` is `NaN`; `NaN <= now` is false, so the token was consumed.

## Fixes (minimal)

- `scripts/learn.ts:11,37-63` — count only ready blocks with exactly 65 `sealed_pool` cases; check active `case_to_provider_eval` consent; report `completeBlocks`/`caseConsent`; refusal order pool → consent → traces. Added nothing outside learning scope.
- `src/server/learning/approval.ts:199-205` — `const expiresAt = Date.parse(row.expires_at); if (!Number.isFinite(expiresAt)) refuse(...)`; then normal expiry check.
- Added tests: `test/unit/learning-cli.test.ts` (new), `test/unit/learning-approval.test.ts` (one new case).
- `scripts/eval-router.ts` and `scripts/live-smoke.ts` were read/probed but not edited.

## GREEN

- `npx vitest run test/unit/learning-cli.test.ts test/unit/learning-approval.test.ts` → 6 passed.
- `npx vitest run learning` → **44 passed / 8 files**.
- `npm.cmd run typecheck` → clean.
- `npm run learn -- --json` → exit 6, `refused.code = E_LEARNING_POOL_EXHAUSTED`, `counts.completeBlocks = 0`, `caseConsent = false`.
- `npm run learn -- --apply` → exit 3, `LEARN_APPLY_FORBIDDEN`; no candidate applied.
- `npm run test:live` (no `--yes`) → exit 2; no call.
- `npm run assert-stage -- --stage=p7 --json` → `ok:true`, `violations:[]`, `fallback:false`, 45 tables, 46 routes, 22 scripts.
- `npm run secret-scan` → clean (122 files); `npm run stub-sweep` → clean (77 files).

## Notes / blockers

- **No live learning promotion:** no sealed 390-case pool / consent in this build; accepted outcome is `E_LEARNING_POOL_EXHAUSTED`/refused. No mock/synthetic promotion performed.
- **Preflight RAM:** exit 7, 0.83 GB free vs 1.5 GB required. Out of learning scope; re-run on a quiet host before final gate.
- **No out-of-scope edits:** only `scripts/learn.ts`, `src/server/learning/approval.ts`, the two test files above.
- **UNVERIFIED:** actual live 50-pair evaluation/promotion; requires pool + consent + a Lead-approved paid run.
