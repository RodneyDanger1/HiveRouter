# qa-ui — Red/GREEN journal

**Seat:** qa-ui · **Scope:** `web/**` only · **Server:** already running at 127.0.0.1:8787; not restarted.
**Window:** 2026-11-03 10:22–10:36 -06:00. **STATUS: DONE (UI); full E2E has out-of-scope @qa-api contract failures.**

## 10:22 — research
- Read `docs/QA-WAVE-1/WAVE-SHEET.md`, `AGENTS.md`, `playwright.config.ts`, `e2e/app.spec.ts`, `src/server/app.ts` routes, live API responses.
- Applied skills: logic-debugger, forge, smartfix, capability-auditor, auditor, systems-validator.

## 10:26 — RED probes
Command: `node web/qa-audit.mjs` against the live server + built UI.
Observed:
- `LEARNING_REASON_VISIBLE false` — API `enabled:true, reason:E_LEARNING_POOL_EXHAUSTED, consentRequired:true` was not surfaced.
- `AGENT_NO_ROLE_COPY true` — agent cards claimed no role because list payload is a summary.
- `ADHOC_MOCK_OPTION_PROP false` / option enabled — mock execution is always refused by the server.
- Context headers: `["Path","Kind","Chars","Reason","Included"]` — API supplies `tokens`/`mandatory`, UI dropped them.
- P6a tabs and SSE pass: `STREAM_STATUS LIVE STREAM`; `PAGE_ERRORS []`.

Additional RED:
- `run_9c4659ee2d4fbb40bf`: status `failed`, artifacts `0`; download was unconditional on terminal.
- `/api/runs/run_9c…/confidence`: `decision:"none_measured", score:null, provisional:true`; prior UI tone was “Needs review”.
- Empty-metrics evaluation fixture: prior UI fabricated `Metric 1` row.
- Dataset fixture without `frozen`: prior badge said “Not frozen”.

## 10:28 — fix (minimal, web only)
1. `LearningPage.tsx:109–126` — pool-exhausted + consent banners; inspect-only language.
2. `AgentsPage.tsx:446` — mock option disabled with reason; live remains default.
3. `RunDetailPage.tsx:789` — Tokens + Mandatory columns; taskId in pack title.
4. `AgentsPage.tsx:165` — honest agent-card fallback copy.
5. `LearningPage.tsx:398–432` — no fabricated metric row.
6. `LearningPage.tsx:301–310` — freeze unknown state.
7. `RunDetailPage.tsx:180, 265–282` — download only with terminal + artifacts.
8. `RunDetailPage.tsx:887–917` — `none_measured`/`insufficient_sample`/`refused`/`forbidden`/accept mapping.

## 10:33 — GREEN probes
Command: `node web/qa-audit.mjs`.
Observed:
- `LEARNING_REASON_VISIBLE true`, `LEARNING_CONSENT_VISIBLE true`
- `AGENT_NO_ROLE_COPY false`
- `ADHOC_DEFAULT_MODE live`; `ADHOC_MOCK_OPTION_PROP true`; HTML `disabled=""`
- Context headers contain `Tokens`, `Mandatory`
- `STREAM_STATUS LIVE STREAM`; `PAGE_ERRORS []`
- `EMPTY_METRICS_HONEST true`
- `LEARNING_DISABLED_HONEST true`; `LEARNING_DISABLED_TABS_ALL_DISABLED true`
- `MODAL_FOCUS_INSIDE true`; `UNNAMED_BUTTONS 0`
- `NO_ARTIFACT_DOWNLOAD_LINKS 0`; `NO_ARTIFACT_DOWNLOAD_BUTTON_DISABLED true`
- `NONE_MEASURED_LABEL true`; `NO_GREEN_ACCEPT true`

Dataset fixture:
- `DATASET_FREEZE_UNKNOWN_HONEST true`.

Secret scan:
- `NO KEY-LIKE STRINGS FOUND` in `web/dist/assets/*.js`.

## 10:34 — gates
- `npm.cmd run typecheck` → **PASS** (server-side error from the concurrent API edit resolved before final run).
- `tsc -p web/tsconfig.json --noEmit` → PASS (no output).
- `npm.cmd run build` → **PASS** (2328 modules, 1.43s).
- `npm.cmd run e2e` → 4 passed / 3 failed; all 3 failures are `@qa-api` `e2e/api-contract.spec.ts` (openapi content-type HTML; bodyless DELETE 415; learning overview enabled true).
- `playwright test e2e/app.spec.ts --grep=.` → **3/3 PASS**.

## Files changed
`web/src/api-types.ts`, `web/src/pages/LearningPage.tsx`, `web/src/pages/AgentsPage.tsx`, `web/src/pages/RunDetailPage.tsx`.
Temporary `web/qa-audit.mjs`/`web/qa-dataset.mjs` removed. No product mocks; test doubles only in transient Playwright route interception.

## Missed / limits
- Did not click Revise/Audit/ad-hoc live (would create a paid run); UI seams verified by presence/handlers, behavior UNVERIFIED.
- P7 promotion/rollback not executable (no candidate/sealed pool); refusal state verified.
- Full gate remains blocked by server/qa-api files; no out-of-scope edits made.
