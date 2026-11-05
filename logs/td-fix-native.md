# td-fix-native — journal

Phase: FIX1 · Workspace: `C:\Users\Riley\Desktop\HiveRouter`
Scope: `src/server/app.ts`, `src/server/routes/**`, `src/server/verify/**`, `src/shared/**`, `scripts/**`, `config/releases/**`, `e2e/api-contract.spec.ts`
Forbidden: web/**, runs/db/security/logic/pipeline/llm, package/lock, .env, key, restart/install/git.
Status: PARTIAL (3 fixes green; typecheck blocked out-of-scope).

## Phase 1 (logic-gatekeeper, before edits)
```json
{"phase1":{"architecture":"Fastify app.ts handles route wiring/limits; verify/openapi-schema.ts decorates the OpenAPI document; config/releases is the stage allowlist; e2e/api-contract is the external pin.","dataFlow":"HTTP query/route -> handler -> recorder/OpenAPI decorator -> JSON/OpenAPI; assert-stage scans route strings and tables against manifests.","edgeCases":["limit=abc becomes NaN LIMIT -> 500","Fastify default 2xx has description only; decorator skipped it -> assert throws after restart","checks route absent from app and manifests"],"rootCause":"Three envelope edges were unenforced: numeric list limits were passed raw to SQLite, OpenAPI decoration skipped existing response codes lacking content, and the planned checks subresource was not wired into app or the stage allowlist."}}
```

## 15:04 — research
- Read testdrive skill, wave sheet, TEST-CARDS, AGENTS.
- Current live 8787: health B2, key fingerprint c30cfdbc (never printed), agents array count 37, OpenAPI path-only responses on the running pre-fix process.
- `assert-stage --stage=p7` already hard-passing at 46 routes; typecheck at 15:05 passed.
- Probes: `/api/runs?limit=abc` → **500**; `limit=-5` unbounded; `/api/runs/run_nope/checks` → **404**; `/openapi.json` 200 responses had only descriptions.

## 15:06 — edits (one defect at a time)
1. `src/server/verify/openapi-schema.ts:87-137` — fill content on existing 2xx/4xx responses; add missing codes; text/zip/SSE content types. (Previously existing codes were skipped.)
2. `src/server/app.ts:515-519` — normalize `limit` (finite, positive, floor, clamp 1..100, invalid→50).
3. `src/server/app.ts:354-359` — add `/api/runs/:id/checks` returning persisted checks, 404 `E_RUN_NOT_FOUND`.
4. `config/releases/p6a.json`, `p7.json` — add `/api/runs/:id/checks`; p7 route count 47.
5. `e2e/api-contract.spec.ts` — pins: typed OpenAPI 2xx/4xx, 37-array agents, invalid limits, checks subresource, existing blocker regressions.
6. Removed unused `src/shared/api-schemas.ts` created during exploration.

## 15:08 — verification (isolated 8788; shared 8787 untouched)
- `npm.cmd run typecheck` after app changes: no errors in owned files; later red only at `e2e/ui-audit.spec.ts:321-322` (out of scope).
- `assert-stage --stage=p7 --json` → `ok:true`, `fallback:false`, `routes:47`, `warnings:[]`, `violations:[]`.
- 8788 `/openapi.json` → 200, paths 41, `/api/health` 200 `content=application/json`.
- 8788 `/api/runs?limit=abc` → 200; checks missing → 404.
- `E2E_BASE_URL=http://127.0.0.1:8788 playwright test e2e/api-contract.spec.ts` → **8 passed**, exit 0.
- Temp server stopped. No paid calls/key read.

## Typecheck blocker (out of scope)
`e2e/ui-audit.spec.ts(321,20)` and `(322,20)`: `Property 'input'/'targetPath' does not exist on type 'never'`.
That file is owned by `td-fix-experience` and was not edited. Full typecheck remains red until that seat fixes it. Owned files produced no tsc errors.

## Residuals
- `/api/runs/:id/integrity` and `/replay-check` still absent (plan §6.9) — no safe source path; not fabricated.
- OpenAPI content typed generically (`additionalProperties:true`), not field-level.
- Shared 8787 pre-fix; Lead must restart before DRIVE.

## Files changed
`src/server/app.ts`; `src/server/verify/openapi-schema.ts`; `config/releases/p6a.json`; `config/releases/p7.json`; `e2e/api-contract.spec.ts`; removed unused `src/shared/api-schemas.ts`; reports above.

## STATUS: PARTIAL
