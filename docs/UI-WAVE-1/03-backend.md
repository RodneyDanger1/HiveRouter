# UI / Visual Wave 1 — backend receipts (Lead-completed dropped seats)

## UI-001 / UI-006 — `/api/agents` serialization + OpenAPI schemas

**Root cause (observed):** `app.addHook('onRoute', decorateRouteResponses)` installed a Fastify **response serializer schema** `{ type:'object' }` on every route. Fastify's serializer turned the `/api/agents` array into `{"0":{...},"1":{...}}`; `listAgents()` returned `[]` (UI showed "No agents registered", `button.agent-card` = 0).

**Fix:** removed the `onRoute` mutation; added `decorateOpenApiDocument(doc)` in `src/server/verify/openapi-schema.ts`, called only from `/openapi.json`. Runtime response shapes are untouched.

**Evidence:**
- Before: `GET /api/agents` raw body began `{"0":{"id":"router"...`; browser CARDS `0`; body "No agents registered".
- After: `GET /api/agents` is `Object[]` count **37**; browser CARDS **37**; E2E agents test green.
- OpenAPI: 43 operations, **43 with response content schemas**; `assertOpenApiResponses` passes.

## UI-007 — RVS TSX/JSX availability

**Root cause:** `availableChecks` in `pipeline/run.ts` omitted `syntax.tsx`/`syntax.jsx`; RVS marked them unverified and the fail-closed verifier made `syntax.all` unverified, so valid TSX could not pass.

**Fix:** added `syntax.tsx` and `syntax.jsx`; verifier's plan-filtering remains fail-closed.

**Evidence:** `npm.cmd test -- --run test/pipeline-qa.test.ts` → 6 passed (valid TSX in plan does not fail; skipped syntax yields mandatory unverified + gate fail). Live `ui-build` `run_b8a8e239a57052f146` completed at `$0.00422067`, files `src/App.tsx`, `tests/test_app.test.tsx`; checks `syntax.all: pass`, `verification.plan: pass`.

## UI-008 — stage-gate BOM

**Root cause:** package.json had a UTF-8 BOM; `JSON.parse` threw; `readPackageScripts` swallowed it and returned `[]`, so the stage script check evaluated nothing (`scripts:0`).

**Fix:** package.json rewritten without BOM; `assert-stage.mjs` strips BOM from `readText` and **fails closed** on package parse errors.

**Evidence:** `npm.cmd run assert-stage -- --stage=p7 --json` → `ok:true`, `fallback:false`, `files:125`, `tables:45`, `routes:46`, `scripts:23`, `violations:[]`.

## UI-002 — agent mode accessibility

**Root cause:** the wrapping label's accessible name included both select options, so exact `Mode` lookup failed. **Fix:** explicit `id`/`htmlFor` + `aria-label="Mode"`. **Evidence:** UI audit 9/9 after the change.

## Residual

- `schema-valid` has no evidence producer (honest: not shown).
- `Learning enabled` is a phase-capability label; the Learning page is refused while the sealed pool is empty.
- 390px Recent runs horizontally scrolls rather than reflowing.
