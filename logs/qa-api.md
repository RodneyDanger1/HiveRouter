# qa-api — journal

HEAD: checkpoint `docs/QA-WAVE-1/WAVE-SHEET.md` 2026-11-03T10:22:05-06:00
Scope: `src/server/app.ts`, `src/server/routes/**`, `e2e/**`, `playwright.config.ts`, `config/releases/**`
Budget: 12 min work + 4 min check. Started 10:22; report 10:37. Status: DONE.
No installs, no server restart (shared 8787), no git, no key access, no paid calls.

## Phase 1 (logic-gatekeeper, before product edits)
```json
{"phase1":{"architecture":"Fastify app.ts owns route registration, guards, SSE, static fallback, OpenAPI; web/src/api.ts owns client contracts; config/releases owns stage allowlists; Playwright owns browser verification.","dataFlow":"UI control -> api.ts fetch/EventSource -> Fastify onRequest guard -> route handler -> recorder/SQLite or static zip -> JSON/SSE -> React render.","edgeCases":["bodyless DELETE prompt has no content-type","GET /openapi.json hits SPA fallback","events/stream reconnect beyond 500 rows","learning overview enabled with zero sealed blocks"],"rootCause":"The route surface is broad but several boundary contracts were unenforced: content-type required on bodyless DELETE, no JSON OpenAPI route, soft stage manifests, a learning-enabled flag that ignored pool/consent, and event windows that reported false completeness."}}
```

## 10:22 — baseline
- Read WAVE-SHEET and AGENTS.md; inspected `app.ts`, `web/src/api.ts`, `e2e`, `playwright.config.ts`, `refusals.ts`, `assert-stage.mjs`, `p7.json`.
- `npm.cmd run typecheck` → exit 0.
- `npm.cmd run e2e` (8787) → 2 passed, 1 failed with `browserContext.close ENOENT` on trace artifact (not a product assertion); rerun single test with `--trace off` passed.
- HTTP probes on 8787:
  - `DELETE /api/agents/__missing_agent__/prompt` + Idempotency-Key → **415**.
  - `GET /openapi.json` → **200 text/html** SPA.
  - `GET /api/learning/overview` → **enabled:true**, sealedBlocks 0, consents 0.
  - `assert-stage --stage=p7` → **fallback:true**, `STAGE_ROUTE_CHECK_SOFT` 8 routes.
  - `Host: evil` → 403; cross-origin POST → 403; `/api/runs/active` → `{activeRunId:null}`.

## 10:26 — RED (before edits)
- F1: 415 on bodyless DELETE (control cannot work).
- F2: OpenAPI HTML.
- F3: stage gate soft pass.
- F4: learning enabled true with no pool/consent.
- F5 (temp DB): 600 events → `events=500 truncated=False last=500`; SSE no header emitted 600 IDs.
- F6: E2E artifact ENOENT.

## 10:28–10:35 — one fix at a time
1. `app.ts:46` add `/openapi.json` → `app.swagger()`.
2. `app.ts:61-65` content-type: require JSON unless bodyless DELETE.
3. `app.ts:319-341` learning `enabled = blocks >= 6 && consents > 0`; reason code.
4. `app.ts:396` download 409 `E_RUN_NOT_TERMINAL` for queued/running.
5. `app.ts:469-482` snapshot artifacts slice 200, truthful `truncated`.
6. `app.ts:484-496` events latest window, truthful truncation/lastEventId.
7. `app.ts:502-520` SSE defaults to `current-window`.
8. `config/releases/a.json`, `p6a.json`; `p7.json` routes +9 (incl. `/openapi.json`, `/api/ops/system`, `/api/settings/key`, UI strings).
9. `playwright.config.ts`: unique `.qa-api-results`, `E2E_BASE_URL`, trace/screenshot off for this wave.
10. `e2e/api-contract.spec.ts`: OpenAPI JSON, bodyless DELETE, learning refusal, provider-key refusal.

## 10:30 — GREEN (isolated 8788; shared 8787 untouched)
- `npm.cmd run typecheck` → exit 0.
- `assert-stage --stage=p7 --json` → `ok:true`, `fallback:false`, `routes:46`, `warnings:[]`, `violations:[]`.
- 8788 `GET /openapi.json` → 200 `application/json`; `GET /api/learning/overview` → `enabled:false`, reason `E_LEARNING_POOL_EXHAUSTED`.
- E2E against 8788 → **7 passed**, `PLAYWRIGHT_EXIT=0` (after disabling trace/screenshot artifacts that collided with shared `test-results`).
- Temp DB 8789 seeded `run_qa_probe` (running; 201 artifacts; 600 events):
  - download → 409 `E_RUN_NOT_TERMINAL`
  - snapshot → 200 artifacts, `truncated:true`, `lastEventId:600`
  - events → 500, `truncated:true`, `last:600`; `after=550` → 50, `truncated:false`
  - SSE no header → 500 IDs, `101…600`
- Temp servers stopped; shared 8787 still running old code.

## Check window
- Re-read report; all claims map to command output; no product code outside scope; secret scan of owned files clean; no key output.
- `git status` unavailable (repo not initialized); changed-file list verified by metadata.

## Missed / limits
- Shared 8787 not restarted: final live E2E must run after Lead restart.
- OpenAPI has paths but no `components.schemas` (R1).
- `/api/scripts`, `/api/ops/*`, `/api/stats/router` have no UI caller (R2).
- Running-download path verified on temp DB, not a paid live run.
- E2E artifacts disabled → auditor cannot inspect traces; action recorded.

## Files changed
`src/server/app.ts`; `config/releases/{a,p6a,p7}.json`; `e2e/api-contract.spec.ts`; `playwright.config.ts`; this journal; `docs/QA-WAVE-1/03-api.md`.

## STATUS: DONE
