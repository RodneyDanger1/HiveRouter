# td-fix-ui — TestDrive FIX1

**Status: DONE.** Scope: `web/src/pages/OverviewPage.tsx`, `SettingsPage.tsx`, `VaultPage.tsx`, `web/src/components/RunComposer.tsx`, `AppShell.tsx`, `web/src/styles.css`. No server restart, installs, git writes, key reads, or paid runs. Live app `http://127.0.0.1:8787`, Chrome, 1440×780 / 1024 / 390.

## Findings and fixes

**TDFUI-01 — P2 — mobile navigation cannot be dismissed with Escape.**
- RED: `MOBILE_ESCAPE_NAV_STILL_OPEN 1` after opening the 390 nav and pressing Escape.
- File: `web/src/components/AppShell.tsx:33–46`, `:62`, `:96`.
- Fix: Escape-key listener while open; close on route change; `aria-controls="primary-navigation"` / `id="primary-navigation"`.
- GREEN: `MOBILE_ESCAPE_NAV_STILL_OPEN 0`.

**TDFUI-02 — P2 — Overview and Settings said “Learning: enabled” while `/api/learning/overview` reports `enabled:false, reason:E_LEARNING_POOL_EXHAUSTED`.**
- RED: `OVERVIEW_LEARNING_COPY Learning: enabled`; API body shows `enabled:false` and pool refusal.
- Files: `OverviewPage.tsx:148–152`; `SettingsPage.tsx:84–88`.
- Fix: label as **Learning feature** (release flag) and state that availability depends on consent/sealed pool and is reported on the Learning page.
- GREEN: `OVERVIEW_LEARNING_COPY feature label`; `SETTINGS_LEARNING_COPY true`.

**TDFUI-03 — P3 — Settings rendered “Checked —” when the API omits `checkedAt`.**
- RED: live `/api/settings/key-status` has no `checkedAt`; UI rendered an em dash.
- File: `web/src/pages/SettingsPage.tsx:50`.
- Fix: explicit “Not reported” (unknown is not a date/zero).
- GREEN: `CHECKED_NOT_REPORTED true`; `CHECKED_EM_DASH false`; `LEARNING_FEATURE_LABEL true`.

No startup blocker found. Composer already persists a draft (`hive.composer.v1`); no UI change needed.

## Checks clean (evidence)

- Composer: `EMPTY_START_DISABLED true`; `SHORT_START_DISABLED true`; with brief + max cost `0`: `ZERO_BUDGET_VALIDATION Max cost must be a positive number.`, `ZERO_BUDGET_NO_NAV true`, `ZERO_BUDGET_POST_COUNT 0`; draft survives reload.
- Layout: 1440×780 `scrollWidth=1440,width=1440`, `startVisible=true`; 390 and 1024 no page overflow; Settings/Vault 390 no overflow; Vault file renders.
- 37 agent cards, seven routes, learning refusal/tabs, key status (configured/source/fingerprint only) render; no page errors.
- Bundle/body scan for DeepSeek/Gemini/OpenRouter key patterns: **no key-like strings**.
- `npm.cmd run typecheck` → PASS (no output).
- `npm.cmd run build` → PASS (2328 modules, 1.82 s).
- `npx playwright test e2e/ui-audit.spec.ts` → **12/12 passed**.
- `npx playwright test e2e/app.spec.ts --grep=.` → **3/3 passed**.

## Residual

- At 390, the Overview recent-runs table needs horizontal scrolling inside its wrapper; `RunTable.tsx` is outside this seat’s owned paths (`td-fix-experience` if a card layout is desired). No page-level overflow.
- Start run sits below the fold at 390 (normal scroll; not hidden/dead).
- Did not execute live run/revise/audit/ad-hoc-live (paid or side-effect boundary); owned controls were inspected, validation paths exercised.

**Files changed:** `web/src/components/AppShell.tsx`, `web/src/pages/OverviewPage.tsx`, `web/src/pages/SettingsPage.tsx`.
