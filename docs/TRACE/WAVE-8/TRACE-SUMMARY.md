# Wave 8 trace summary

## Verdict

| Trial | Surface | Verdict |
|---|---|---|
| T1 | `/scripts` catalog + dry-run command hint + paid refusal | **WIRED-AND-WORKS** |
| T2 | `/analysis` dominators + scorecards | **WIRED-AND-WORKS** |
| T3 | run-detail Search over a completed run | **WIRED-AND-WORKS** |

## Evidence index

| File | Contents |
|---|---|
| `01-capability-audit.md` | control inventory, route/client/service verdicts, gaps |
| `02-live-trials.md` | three trials, observed API/UI results, wrong/right analysis |
| `03-fixes.md` | fixes, RED evidence, commands, residual |
| `live-api.json` | captured dominators/scorecards/search response |
| `search-edge.json` | short-query LIKE fallback and no-match result |
| `runtime.json` | HEAD, health time, phase, route/file counts |
| `cua-scripts-page.png` | real Chrome window at `/scripts` via CUA |
| `analysis-dominators.png` | Playwright analysis result |
| `run-detail-search.png` | Playwright search result |
| `../../screenshots/scripts.png` | portfolio screenshot of the scripts page |

## What changed

- New `/scripts` page, nav, client, types, route, SPA known-route entry, and census entry.
- New `test/unit/scripts-api.test.ts` and Playwright scripts trial.
- UX polish: removed a duplicate name/id line; corrected a test locator.
- Docs: `docs/WAVE-8-PLAN.md`, `docs/TRACE/WAVE-8/*`, README/capability/plan/backlog updates.

## Honest boundaries

- Scripts page is **catalog + command hint**; it does not execute or accept typed script arguments.
- CUA native click on Chromium content did not land; that interaction is **UNVERIFIED** natively and proven only with Playwright.
- No paid provider call; no learning promotion; no P7 evaluation.
- Search index freshness after manual edits remains a known P2 limitation.
