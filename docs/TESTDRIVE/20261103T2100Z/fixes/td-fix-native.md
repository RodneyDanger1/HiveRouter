# td-fix-native — FIX1 report

**Status: PARTIAL (3 real fixes GREEN; typecheck blocked by out-of-scope `e2e/ui-audit.spec.ts`)**
Scope: app.ts, routes/**, verify/**, shared/**, scripts/**, config/releases/**, e2e/api-contract.spec.ts. No server restart, installs, git, key access, paid calls.

## Fixed defects (RED → GREEN)

| ID | Sev | Finding | RED evidence | Fix | GREEN evidence |
|---|---|---|---|---|---|
| N1 | P1 | OpenAPI decorator skipped existing Fastify default 2xx/4xx responses that lacked `content`, so the new `assertOpenApiResponses` would throw after restart and `/openapi.json` would 500 | Running 8787 document: `/api/health` 200 had only `{"description":"Default Response"}`; `components.schemas` 3 but no response content; `openApiResponseViolations` would flag every operation | `src/server/verify/openapi-schema.ts:87-137`: fill existing 2xx/4xx responses with content; add missing codes; text/zip/SSE content types | Isolated 8788: `openapi paths=41`, `/api/health` 200 `content=application/json`; api-contract test **every OpenAPI operation has typed 2xx and 4xx** passed |
| N2 | P1 | `GET /api/runs?limit=abc` passed `NaN` into SQLite `LIMIT` → 500; negative limits were unbounded | `GET http://127.0.0.1:8787/api/runs?limit=abc` → **500**; `limit=-5` returned every run | `src/server/app.ts:515-519`: finite, positive, floored, clamped 1..100; invalid → 50 | 8788 test: `abc,-5,0,1.9,1000` all **200**, `runs` array length ≤100 |
| N3 | P1 | Planned `/api/runs/:id/checks` subresource absent from app and stage allowlists | `GET /api/runs/run_nope/checks` → **404** untyped fallback; route not in p6a/p7 manifests | `src/server/app.ts:354-359` added `{checks:getChecks(id)}` with `E_RUN_NOT_FOUND`; added to `config/releases/p6a.json`, `p7.json` | 8788: missing run → 404 `E_RUN_NOT_FOUND`; existing run → 200 `{checks:[...]}`; `assert-stage` **47 routes, fallback:false, warnings:[], violations:[]** |

## Test-start blockers swept (no edit needed)

- Bodyless `DELETE /api/agents/:id/prompt` → 404 `E_UNSUPPORTED_AGENT` (content-type guard already permits bodyless DELETE); pinned in `e2e/api-contract.spec.ts`.
- Agent list shape → JSON array, **37** items; pinned.
- Learning overview → `enabled:false`, `E_LEARNING_POOL_EXHAUSTED`; pinned.
- Provider-key route → 403 `FORBIDDEN_PROVIDER_KEY_ACCESS`; pinned.
- Stage script → `assert-stage --stage=p7` hard pass, 47 routes, no fallback.
- `GET /api/runs/active`, `/api/meta`, `/api/health` → 200; agent/run route order intact.

## Residual / blockers

1. **Typecheck is red outside my scope:** `e2e/ui-audit.spec.ts(321,20)` and `(322,20)`: `Property 'input'/'targetPath' does not exist on type 'never'`. That file is owned by `td-fix-experience`; I did not edit it. `tsc` reported no errors in my owned files.
2. **Shared 8787 still runs the pre-fix process.** Fixes were verified on isolated 8788 with the same data; Lead must restart 8787 before DRIVE.
3. `/api/runs/:id/integrity` and `/replay-check` remain absent from app.ts though listed in plan §6.9; no safe implementation exists in the current source, so not invented.
4. OpenAPI content is typed but generic (`additionalProperties:true`); field-level schemas remain future work.

## Verification commands

- `npm.cmd run typecheck` → exit **2**, only the two out-of-scope ui-audit lines.
- `npm.cmd run assert-stage -- --stage=p7 --json` → `ok:true`, `fallback:false`, `routes:47`, no warnings/violations.
- `E2E_BASE_URL=http://127.0.0.1:8788 playwright test e2e/api-contract.spec.ts` → **8 passed**.
- No paid provider calls; no key read; no server restart; no out-of-scope edits.
