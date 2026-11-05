# td-fix-native — FIX2 report

**Defect:** TD1-D01 (P3) — unknown HTML route `/missing-td` returned **200** SPA fallback; TD-01 expects **404**.
**Status: DONE.** Only `src/server/app.ts` + `e2e/api-contract.spec.ts` changed.

## RED (live 8787, pre-fix)
- `curl -s -o NUL -w "%{http_code} %{content_type}" http://127.0.0.1:8787/missing-td` → **200 text/html; charset=utf-8**
- New E2E pin `unknown HTML routes return 404 while known SPA routes stay 200` → **failed** `Expected: 404, Received: 200`.

## Fix — `src/server/app.ts:735-756` (`setNotFoundHandler`)
- Parse `request.url` pathname; strip trailing slashes.
- Keep known SPA routes 200 via `index.html`: `/`, `/agents`, `/runs`, `/vault`, `/settings`, `/learning`, `/runs/:id` (one dynamic segment).
- Unknown route + `Accept: text/html` → `404` + `index.html` (React NotFoundPage renders, HTTP status is 404).
- Unknown non-HTML route → `404 text/plain`.
- `/api/*` branch unchanged: existing JSON `404 E_RUN_NOT_FOUND`.

## GREEN (isolated 8788; shared 8787 untouched)
- `/missing-td` → **404 text/html**, body contains `id="root"`.
- `/`, `/agents`, `/runs`, `/vault`, `/settings`, `/learning`, `/runs/run_test` → **200 text/html**.
- `/agents/extra` → **404**; `/api/nope` → **404 application/json**, `E_RUN_NOT_FOUND` unchanged.
- `E2E_BASE_URL=http://127.0.0.1:8788 playwright test e2e/api-contract.spec.ts` → **9 passed**, exit 0.
- `npm.cmd run typecheck` → **exit 0**.
- `assert-stage --stage=p7 --json` → `ok:true`, fallback false, routes 47, no warnings/violations.

## Residual
- Shared 8787 still serves the pre-fix process; Lead restart required for the live card to see 404.
- No other app routes or product files changed. No server restart, installs, key access, paid calls, or git writes.
