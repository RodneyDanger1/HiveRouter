# Pre-run audit — TestDrive v1.1

## Research passes

1. **CUA transport.** Installed CUA 0.28.2; `doctor` reports interactive session 1, UI Automation OK, 14 windows. Page tools available: `browser_prepare`, `get_browser_state`, `browser_navigate`, `browser_click`, `browser_type`. `get_browser_state` is read-only; setup/profile choice is explicit. Preferred route: driver-owned `isolated_named` profile. Existing-profile attachment requires a trusted grant; not default. Sources: installed `cua-driver` BROWSER.md/WINDOWS.md.
2. **Key lifecycle.** `.env.local` is loaded first (`src/server/env.ts:6-9`); env key wins over app-secret (`src/server/security/keys.ts:28-42`). The supplied key is already installed (fingerprint `c30cfdbc`); live smoke PASS; balance $19.04.
3. **UI contract.** Composer labels/validation at `web/src/components/RunComposer.tsx:79-86,115,163,208`; routes `web/src/App.tsx:33-40`; revision gating `web/src/pages/RunDetailPage.tsx:179-202`. Invalid max-cost is an inline submit validation, not a disabled button.
4. **Window state.** `HiveRouter.lnk` exists; launcher started the app; window verified 1440×780, not zoomed/iconic.

## Logic-debugger passes

- **Transition:** PREFLIGHT→FIX1→FIX1_GATE→DRIVE→DRIVE_GATE→FIX2→FIX2_GATE→CLOSE; each gate requires artifacts; no card starts with an active run.
- **Fault injection:** key invalid, low balance, CUA setup failure, closed window, server restart, watchdog missing, matcher gap, budget hit, fixer regression. Each has a stop/rollback rule.
- **Observability:** driver/UI/backend/matcher logs require sequence, testId, runId, eventSeq, UTC ms; missing evidence = UNVERIFIED.

## Plan/evidence checks

- Plan has outcome, current behavior, decisions, file changes, failure modes, tests, rollback, out-of-scope.
- Current state verified: health, stats, no active run, 37 agents, CUA doctor, window, key fingerprint, balance.
- Unverified until execution: CUA isolated-profile bind, 8 card outcomes, defects/fixes.
- Contradiction corrected: no window existed before Phase 0; launcher was run and window verified.
- Test card correction: invalid max-cost is checked on submit, not by a disabled Start button.

## CUA strategy

Driver-owned isolated named profile `hive-testdrive`; native `get_window_state` observes the real desktop window. No existing-profile attachment unless explicitly granted. Background actions first; foreground only with user authorization.
