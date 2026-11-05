# Wave 11 — mobile and keyboard-only evidence

Date: 2026-11-05
Baseline: `a37615a` (440 tests / 69 files; 30/30 E2E; 199 stage files / 51 tables)
Final: **440 tests / 69 files**, **34/34 E2E**, stage **200 files / 51 tables / 62 routes / 24 scripts**, `verify` exit 0, preflight PASS (free RAM 2.31 GB, disk 9.07 GB).

## Trials

| Trial | Viewport | Result |
|---|---|---|
| Analysis form + dominator result | 390×844 | PASS; no document horizontal overflow |
| Terminal run Search | 390×844 | PASS; results render; no document overflow |
| Run-detail tabs keyboard | 1440×1000 | PASS; ArrowRight selects/focuses Files, ArrowLeft returns Overview |
| Closed mobile navigation | 390×844 | **FAILED before fix**; hidden sidebar link received focus. PASS after fix |

Command: `npx playwright test e2e/mobile-keyboard.spec.ts` → 3 passed / 1 failed before; 4/4 after `npm.cmd run build` + server restart.

## Confirmed defect

- **Symptom:** At 390px, with the menu closed, pressing Tab from the brand link moved focus into `#primary-navigation`.
- **Root cause:** `web/src/styles.css` hides the sidebar with `transform: translateX(-105%)` at `max-width: 1000px`; transform does not remove descendants from the tab order.
- **Fix:** `web/src/components/AppShell.tsx` now tracks the mobile media query, applies `inert` and `aria-hidden` to the closed mobile sidebar, focuses the first nav link on open, and returns focus to the menu button on close. Desktop behavior is unchanged.
- **RED evidence:** test 4 failed with `Expected false, Received true` inside `#primary-navigation`.
- **GREEN evidence:** 4/4 Playwright trials passed after rebuilding and restarting the server.

## Claim/evidence table

| Claim | Evidence | Status |
|---|---|---|
| Analysis usable at 390 | Playwright trial 1 | VERIFIED |
| Search usable at 390 | Playwright trial 2 | VERIFIED |
| Tabs keyboard select + focus | Playwright trial 3 | VERIFIED |
| Hidden mobile nav not tabbable | Playwright trial 4 | VERIFIED |
| Full E2E | `npm.cmd run e2e` → 34 passed | VERIFIED |
| Unit suite | `npm.cmd test` → 440 / 69 | VERIFIED |
| Stage census | 200 files / 51 tables / 62 routes / 24 scripts, violations [] | VERIFIED |
| Screen-reader semantics and open-menu focus trap | not exercised | UNVERIFIED |
| Every page at every viewport | only named surfaces at 390/1440 | UNVERIFIED |

## Residual

- Open mobile menu does not yet trap focus; Escape closes it and focus returns to the menu button.
- True screen-reader testing and reduced-motion visual assertions are not covered.
- No API, DB, search, or run-state change; no paid provider call.
