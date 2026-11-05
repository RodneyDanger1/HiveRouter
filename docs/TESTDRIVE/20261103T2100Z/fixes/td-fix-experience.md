# td-fix-experience — TestDrive FIX1

Seat: `td-fix-experience` · Primary: agent-experience · Also: forge, capability-auditor, research
Owned: `web/src/pages/{AgentsPage,RunDetailPage,LearningPage}.tsx`, `web/src/api.ts`, `web/src/api-types.ts`, `e2e/{app,ui-audit}.spec.ts`.
Status: **DONE** — 2 real agent-facing blockers fixed RED→GREEN; R2-01 was already present.

## Fixes

### TDX-EXP-01 (P1) — ad-hoc `tests` agents were blocked by a target path the server does not require
**File:** `web/src/pages/AgentsPage.tsx:232,287,456-463,477`.
**Finding:** The drawer gated target-path validation on `data.canWrite`, but `gatekeeper` (`outputKind: tests`) has `canWrite: true`; the server accepts multiple test files with no `targetPath`. A user could fill Input, press Run, and get `E_AGENT_TARGET_REQUIRED` without any request. Label also said “Target path (required)”.
**RED:** `npx playwright test e2e/ui-audit.spec.ts --grep 'agent-facing blockers'` → 1st test failed: `page.waitForRequest: Timeout 5000ms exceeded` for `POST /api/agents/gatekeeper/run`; no request was made (test uses a route intercept, so no spend).
**Fix:** `needsTarget = data?.outputKind === 'files'`; validate only `files`; target input disabled and labeled optional for `tests`/review/text; placeholder `tests/... (not required)`; helper copy follows `needsTarget`.
**GREEN:** Same command → 2 passed (including the no-target gatekeeper request with `targetPath` omitted).

### TDX-EXP-02 (P1) — terminal runs with no artifacts offered Audit, which the API refuses
**File:** `web/src/pages/RunDetailPage.tsx:180,213,265,352-357`.
**Finding:** `canRevise`/`downloadable` required artifacts, but the Audit buttons rendered for any terminal run. The audit pipeline needs parent artifacts; a failed/budget-exceeded run with zero artifacts displayed two Audit buttons and could only fail after click.
**RED:** `npx playwright test e2e/ui-audit.spec.ts --grep 'agent-facing blockers'` → 2nd test failed: expected 0 Audit buttons, received **2** on a real terminal run with zero artifacts.
**Fix:** `canAudit = terminal && artifacts.length > 0`; both Audit buttons render only when `canAudit`; action card shows `Audit requires stored artifacts.` otherwise; `startAudit` fail-closed guard.
**GREEN:** Same command → 2 passed; both Audit controls gone, explanatory text present.

## R2-01 note
`availableChecks` already contains `syntax.tsx` and `syntax.jsx` at `src/server/pipeline/run.ts:688`; file SHA-256 `F215026631E46F05F5722A611F1E10060830EA0F06EEF114935719B90F00E333`. `npm.cmd test -- --run test/pipeline-qa.test.ts` → **6 passed (6)**. No edit was needed.

## Gates
- `npm.cmd run typecheck` → exit 0, no output.
- `npm.cmd run build` → exit 0; Vite built 2,328 modules (`web/dist` updated, no server restart).
- `npx playwright test e2e/app.spec.ts e2e/ui-audit.spec.ts` → **15 passed (15)**; no page errors; no secret rendered.
- No paid provider call, no key read, no install, no git, no server restart.

## Residuals / not in scope
- Revision/audit **budget control** is not exposed in these pages; `/revise` also does not accept `maxCostUsd` (server-owned). Default cap remains; TD-06 cost cap is not user-adjustable from UI.
- Run-detail cost cap is missing from the snapshot payload (server-owned); the CostMeter therefore has no cap.
- Learning refusal and API normalization were covered by the existing 10 audit cases (all passed); no additional defect found there. No live TD-03/04/05/06 run was performed.
