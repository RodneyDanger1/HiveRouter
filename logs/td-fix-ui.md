# td-fix-ui — TestDrive FIX1 journal

**Seat:** td-fix-ui · **Phase:** FIX1 · **Workspace:** `C:\Users\Riley\Desktop\HiveRouter`
**Window:** 2026-11-03 15:04–15:16 -06:00 · **Status: DONE.**
**Rules:** no server restart, installs, git writes, key reads, paid runs; owned paths only.

## 15:04 — read contract
- Read `testdrive` SKILL, `docs/TESTDRIVE/20261103T2100Z/WAVE-SHEET.md`, `TEST-CARDS.md`, `AGENTS.md`.
- Skills: smartfix (RED→fix→GREEN), forge (minimal seam), capability-auditor (controls/statuses), research (live API/route shapes).

## 15:07 — RED probes (live build, Chrome)
Command: `node docs/TESTDRIVE/20261103T2100Z/fixes/probe.mjs` (temp).
- `LAYOUT overview-1440x780 {"scrollWidth":1440,"width":1440,"scrollHeight":1707,"height":780,"startVisible":true}`
- `EMPTY_START_DISABLED true`; `SHORT_START_DISABLED true`
- `ZERO_BUDGET_VALIDATION Max cost must be a positive number.`; `ZERO_BUDGET_NO_NAV true`; `ZERO_BUDGET_POST_COUNT 0`
- `DRAFT_AFTER_RELOAD "Persist this testdrive draft across a reload."` (already implemented; no edit needed)
- `LAYOUT overview-390 {"scrollWidth":390,"width":390}`; `OVERVIEW_LEARNING_COPY Learning: enabled` while API says `enabled:false, reason:E_LEARNING_POOL_EXHAUSTED`.

Command: `node docs/TESTDRIVE/20261103T2100Z/fixes/probe2.mjs` (temp).
- `MOBILE_ESCAPE_NAV_STILL_OPEN 1` (390 nav stays open after Escape).
- `SETTINGS_LAYOUT {"sw":390,"w":390}`; `VAULT_LAYOUT {"sw":390,"w":390}`; `VAULT_FILE_RENDERED true`; `OVERVIEW_1024_LAYOUT {"sw":1024,"w":1024}`; `PAGE_ERRORS []`.

## 15:10 — fixes
1. `web/src/components/AppShell.tsx:33–46,62,96` — Escape closes mobile nav; route change closes it; `aria-controls`/`id` linked. Minimal effect/handler.
2. `web/src/pages/OverviewPage.tsx:148–152` — “Learning: enabled” → “Learning feature: enabled” + availability note (consent/sealed pool; actual state on Learning).
3. `web/src/pages/SettingsPage.tsx:50,84–88` — `Checked` shows “Not reported” when API omits `checkedAt`; “Learning feature” + availability clarification.
- No edit to `RunComposer`/`VaultPage`/`styles.css` needed; draft persistence and 390 layouts already correct.

## 15:13 — GREEN probes
- `OVERVIEW_LEARNING_COPY feature label`; `SETTINGS_LEARNING_COPY true`
- `MOBILE_ESCAPE_NAV_STILL_OPEN 0`
- `CHECKED_NOT_REPORTED true`; `CHECKED_EM_DASH false`; `LEARNING_FEATURE_LABEL true`
- `VAULT_FILE_RENDERED true`; `PAGE_ERRORS []`
- Build/UI: `npm.cmd run typecheck` PASS; `npm.cmd run build` PASS (2328 modules, 1.82 s).
- `node docs/.../probe.mjs` recheck: layouts 1440x780/390 no page overflow; composer validation still enforces; draft survives reload.
- Bundle/body secret scan: no key-like strings.

## 15:15 — gates
- `npx playwright test e2e/ui-audit.spec.ts` → **12/12 passed**.
- `npx playwright test e2e/app.spec.ts --grep=.` → **3/3 passed**.
- No server restart, no paid run, no key read. Root typecheck/build PASS.

## Files changed
`web/src/components/AppShell.tsx`, `web/src/pages/OverviewPage.tsx`, `web/src/pages/SettingsPage.tsx`.
Temp probe scripts/screenshots removed; only `fixes/td-fix-ui.md` remains under this seat’s output path.

## Residual / limits
- 390 recent-runs table uses horizontal scroll; `RunTable.tsx` is outside owned paths (owner: td-fix-experience if a mobile card layout is required). No page overflow.
- Start run below fold at 390 is normal document scroll.
- Live run/revise/audit/ad-hoc-live not executed (paid/side-effect boundary); owned controls and validation paths exercised; remaining behavior belongs to testdrive cards.
