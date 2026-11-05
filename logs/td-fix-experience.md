# td-fix-experience — journal

Workspace: C:\Users\Riley\Desktop\HiveRouter
Phase: FIX1 · Mode: execute · No server restart/install/git/key/paid call
Owned files only; no other seat touched.

## 15:04 — read
Read testdrive SKILL.md, WAVE-SHEET.md, TEST-CARDS.md, AGENTS.md, api.ts, api-types.ts, AgentsPage.tsx, RunDetailPage.tsx, LearningPage.tsx, e2e/app.spec.ts, e2e/ui-audit.spec.ts, relevant server routes.
Baseline live: health B2; 37 agents; /learning enabled=false E_LEARNING_POOL_EXHAUSTED; 3 app E2E pass; 10 ui-audit E2E pass.

## 15:08 — sweep
- Agent drawer/ad-hoc: gatekeeper `canWrite=true`, `outputKind=tests`; UI used `canWrite` to require target, but server `tests` branch uses TestsSchema and no target. Real blocker.
- Run detail: Audit buttons gated only on `terminal`; failed/budget-exceeded runs with zero artifacts showed two Audit actions the API cannot satisfy. Real blocker.
- Learning refusal: 200 `enabled:false`, disabled tabs, code E_LEARNING_POOL_EXHAUSTED; existing E2E passes.
- API normalization: snapshot/agents/learning/vault/errors normalized by existing tests; no defect reproduced.
- R2-01: `availableChecks` already has `syntax.tsx`/`syntax.jsx` at run.ts:688; `test/pipeline-qa.test.ts` 6/6 pass; no edit.

## 15:10 — RED
Added two E2E cases to `e2e/ui-audit.spec.ts` (`@ui-audit agent-facing blockers`).
`playwright test e2e/ui-audit.spec.ts --grep 'agent-facing blockers'` → **2 failed**: ad-hoc request timeout (no POST), Audit button count 2 instead of 0.

## 15:12 — fixes
- `AgentsPage.tsx`: `needsTarget = outputKind === 'files'`; validate files only; tests target optional/disabled; label/copy/placeholder corrected.
- `RunDetailPage.tsx`: `canAudit = terminal && artifacts.length > 0`; hide both Audit controls; show “Audit requires stored artifacts.”; `startAudit` guard.

## 15:14 — GREEN
`npm.cmd run typecheck` → exit 0.
`npm.cmd run build` → exit 0; Vite 2,328 modules; `web/dist` updated; no restart.
`playwright test e2e/app.spec.ts e2e/ui-audit.spec.ts` → **15 passed (15)**.
Targeted agent-facing blockers → 2 passed.
No page errors; no `sk-` body match; no spend.

## Residuals
Revision/audit max-cost control absent (server `/revise` does not accept it; out of owned scope). Snapshot has no limits field, so CostMeter cap absent (server-owned). No live TD-03/04/05/06 run. No server restart.

## STATUS: DONE
