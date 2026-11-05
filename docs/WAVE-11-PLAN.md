# Wave 11 decision plan — mobile and keyboard-only verification

Date: 2026-11-05
Owner: HiveRouter lead
Baseline: `a37615a` (440 tests / 69 files; 30/30 E2E; 199 stage files / 51 tables / 62 routes / 24 scripts)
Scope item: `docs/BACKLOG.md` P2-4 — mobile and keyboard-only UI pass.

## Execution status

Implemented and verified. `e2e/mobile-keyboard.spec.ts` has four trials; Analysis and Search pass at 390×844 without document overflow, run-detail tabs pass selection+focus, and the closed mobile sidebar is now `inert`/`aria-hidden` with focus ownership. RED: 1/4 failed before the shell fix; GREEN: 4/4. Final: **440 tests / 69 files**, **34/34 E2E**, stage **200 files / 51 tables / 62 routes / 24 scripts**, preflight PASS. Evidence: `docs/TRACE/WAVE-11/TRACE-SUMMARY.md`.

## 1. Outcome

A keyboard-only operator can traverse the shell and run-detail tabs without a mouse, and a 390×844 operator can use static analysis and published-run Search without clipped controls or horizontal page overflow. Any confirmed defect is fixed at the component/CSS seam; no data model changes.

## 2. Current behavior (evidence)

- Existing mobile coverage only reaches the Overview composer and navigation (`e2e/ui-audit.spec.ts:164-171`).
- No mobile test for `/analysis` or run-detail Search.
- No keyboard test for the roving run-detail tabs.
- `Tabs` implements ArrowRight/ArrowLeft and roving `tabIndex` (`web/src/components/ui.tsx:307-366`), but the tab buttons have no `id`/`aria-controls` linkage to the tabpanel.
- `AppShell` hides the sidebar offscreen at ≤1000 px with `transform: translateX(-105%)` (`web/src/styles.css:1026`); the links remain in the document and can remain keyboard-focusable when the menu is closed.
- `data-table` has `min-width: 680px` by default and `min-width: 0` below 600 px (`web/src/styles.css:624,1058`), which may let wide tables compress instead of scrolling cleanly.
- No evidence yet that the Analysis or Search layout overflows at 390 px.

## 3. Decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Add a dedicated `e2e/mobile-keyboard.spec.ts` | Extend the already-large ui-audit test | Keeps failure attribution and runtime bounded |
| Test 390×844 explicitly | Rely on desktop viewport | Mobile is the actual claim; 390 is the narrow reference |
| Assert document overflow, not just screenshots | Visual review only | Overflow is objective and reproducible |
| Test keyboard tab activation with `aria-selected`/focus | Assert on internal state | The user-visible contract is selected + focused |
| Fix hidden-sidebar tabbability with `inert` on the mobile-closed sidebar | Remove nav links from DOM | Links must still work when the menu opens; inert removes focus without DOM churn |
| Add `aria-controls`/`tabpanel` linkage only if tests or code show it is needed | Rewrite the tab component | Minimal change; keep existing behavior |
| Do not change any API, DB, search, or run state | — | This wave is UI accessibility only |

## 4. File-by-file change

- **New `e2e/mobile-keyboard.spec.ts`**
  - `/analysis` at 390×844: heading, graph form, result table, no horizontal document overflow.
  - Run-detail Search at 390×844: terminal run, Search tab, query, indexed count/results, no overflow.
  - Keyboard tabs: focus active tab, ArrowRight selects/focuses next enabled tab; ArrowLeft wraps.
  - Mobile navigation: open/close with Escape; closed sidebar is not keyboard-focusable.
  - Screenshot each captured state under `docs/UI-WAVE-1/shots` only as test artifacts.
- **`web/src/components/AppShell.tsx`** (only if the keyboard test fails):
  - Track `(max-width: 1000px)` with `matchMedia`.
  - Apply `inert` to the closed mobile sidebar, remove on open; keep desktop nav interactive.
  - On open, focus the first enabled nav link; on close, return focus to the menu button.
- **`web/src/components/ui.tsx`** (only if keyboard test fails):
  - Ensure tab `id`, `aria-controls`, and `role="tabpanel"` linkage if the current active/focus behavior is insufficient.
- **`web/src/pages/AnalysisPage.tsx` / CSS** (only if overflow test fails):
  - Bounded grid/table wrappers; no forced min-width that exceeds the viewport.
- **Docs**: Wave 11 trace/evidence; BACKLOG P2-4 delivered.

## 5. Failure modes

| Failure | Expected |
|---|---|
| Analysis table wider than 390 | Table wrapper scrolls horizontally without making the document scroll |
| Search result snippet long | Wrap/break words, no document overflow |
| Tab active but not focused | Arrow key moves selection and focus together |
| Menu closed but links focusable | `inert` prevents focus; menu button opens and focuses first link |
| Menu open then route change | Existing effect closes menu; focus returns safely |
| Reduced motion | Existing `prefers-reduced-motion` rule remains |
| API unavailable | Existing error panels remain; tests use live local API |

## 6. Tests and commands

```powershell
npx playwright test e2e/mobile-keyboard.spec.ts
npm.cmd run e2e
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run assert-stage -- --stage=p7 --json
npm.cmd run preflight -- --port 0 --json
```

Acceptance: four mobile/keyboard tests pass; no horizontal overflow at 390; closed mobile nav cannot receive focus; run-detail tabs show selected + focused after ArrowRight/ArrowLeft; full E2E remains green; no API/DB behavior change.

## 7. Rollback

- Remove the new E2E spec and any `inert`/focus changes; no database migration or API surface changes exist to roll back.

## 8. Out of scope

- P0 writer/state fixes, P1 repo tools/tool loop/approval/checkpoints, P7 evaluation, and visual redesign.
- No paid provider call. No generated-code execution.
