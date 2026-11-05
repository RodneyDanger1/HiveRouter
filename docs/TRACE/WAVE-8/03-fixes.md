# Wave 8 fixes and evidence

## F1 — Scripts surface missing (P1-10)

- **Symptom:** API existed; no `/scripts` route, nav, page, client, or test.
- **RED evidence:** `web/src/App.tsx` had no `/scripts`; `AppShell.tsx` NAV had no Scripts entry; `web/src/pages/` had no `ScriptsPage.tsx`.
- **Fix:** added `ScriptsPage.tsx`, `getScripts`/`dryRunScript` client functions, API types, `/scripts` route and nav, known-SPA entry, and `uiRoutes` census.
- **Test:** `test/unit/scripts-api.test.ts` (4 tests) + Playwright live trial.
- **Result:** `4 passed`; E2E `2 passed` for scripts/analysis; full E2E `29 passed`.

## F2 — E2E locator was checked against the wrong accessible name

- **Symptom:** `getByRole('cell',{name:'preflight',exact:true})` found no cell.
- **Root cause:** the cell's accessible name is the concatenation of its rendered contents; the page intentionally shows script name and id (the id was duplicated at the time).
- **Fix:** assert on a row with `/preflight/` instead of an exact cell label.
- **Classification:** test-harness defect, **not** a product defect. The product data was present.

## F3 — Duplicate name/id line was visual noise

- **Symptom:** every row showed `preflight` twice because `name === id` for all catalog entries.
- **Fix:** removed the redundant second line; the script id remains the row's stable key and accessible text.
- **Result:** screenshot `docs/screenshots/scripts.png` regenerated after the fix.

## CUA probe correction

- CUA loaded Chrome, navigated to `/scripts`, and captured the real page.
- A pixel click at the visually estimated Dry-run position did not land on the control; Chrome switched tabs. The action reported `effect:"unverifiable"` before the tab change.
- **Classification:** tooling/coordinate-frame false negative, not a dead control. Playwright clicked the same control and received the expected result.
- **No product change** was made for this observation.

## Commands and results

| Command | Result |
|---|---|
| `npm.cmd run typecheck` | exit 0 |
| `npm.cmd test -- --run test/unit/scripts-api.test.ts` | 4 passed |
| `npx playwright test e2e/ui-audit.spec.ts --grep "scripts page|analysis page"` | 2 passed |
| `npm.cmd run e2e` | 29 passed (34.9s) |
| `npm.cmd run build` | built in 1.63s |
| `npm.cmd run assert-stage -- --stage=p7 --json` | 195 files / 50 tables / 62 routes / 24 scripts, violations [] |
| `GET /api/scripts` | 8 entries |
| `POST /api/scripts/preflight/dry-run` | 200, command hint |
| `POST /api/scripts/bench/dry-run` | 422, `E_SCRIPT_DRY_RUN_UNSUPPORTED` |

## Residual

No provider call. No generated-code execution. No new table or migration. CUA native click remains unverified as a product proof; it is recorded as a tooling false negative.
