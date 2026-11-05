# Wave 17 — Seat A (wave 2): independent re-verification + adjacent control audit

Date: 2026-11-05
Seat: A (`weaver` + `agent-experience` + `trace`; operating contract `forgewright-lead` + `forgewright-plan` + `forgewright-recon` + `forge`)
Base: `db4e6d5` plus integrated wave-1 Seat A + Lead changes (working tree, not committed).
Scope: `web/**`, `e2e/**`, this new file only. No `src/server/**`, `test/unit/**`, shared docs/package files, git writes, paid provider call, destructive action, or server restart.
Server under test: `http://127.0.0.1:8787` — the process started before wave 2 (not restarted by this seat). `web/dist` was rebuilt from `web/src` after every temporary plant and after the final fixes; the running process served the rebuilt bundle.

## 1. Independent re-verification of D1/D2/D3 (planted-defect method)

For each wave-1 fix I restored the exact pre-fix source **in this seat's own files**, rebuilt `web/dist`, ran the named wave-1 pin, captured RED, restored the integrated file byte-identically, verified SHA-256, rebuilt, and captured GREEN. No temporary edit remains; the current hashes of the three wave-1 files equal the hashes published in `seat-a.md` §6.

| Defect | Planted state | Named test | RED (quoted) | Restore SHA-256 (expected = match) | GREEN (quoted) |
|---|---|---|---|---|---|
| D1 | `.topbar .topbar-menu` → `.topbar-menu` in `web/src/styles.css:122,1037` (2 lines) | `npx.cmd playwright test e2e/wave17-controls.spec.ts -g "desktop chrome"` | `Expect "toBeHidden" ... unexpected value "visible"` · `1 failed ... desktop chrome does not expose the mobile navigation toggle` | `791dd1ac85795fd5b4f496b77af1febfc947424a11731df1dd68b91b51e43e55` — **true** | `ok 1 ... desktop chrome does not expose the mobile navigation toggle (1.9s)` · `1 passed (3.9s)` |
| D2 | `web/src/pages/ChatPage.tsx` replaced with the `db4e6d5` pre-fix file (no `agents.error` render path) | `... -g "agent-registry"` | `Expected: visible` / `Error: element(s) not found` for `getByRole('alert').filter({ hasText: 'E_AGENT_REGISTRY_UNAVAILABLE' })` · `1 failed ... chat names an agent-registry failure and recovers on retry` | `d006dd10f1ed0ed0137dd6d46f2d184e7b95f12722541bcbe68d557eefa07d35` — **true** | `ok 1 ... chat names an agent-registry failure and recovers on retry (1.4s)` · `1 passed (3.4s)` |
| D3 | `web/src/api.ts` + `web/src/pages/RunDetailPage.tsx` replaced with the `db4e6d5` pre-fix files (`resumeRun` minted a key per call; page passed no key) | `... -g "resume retry"` | `Error: an unchanged resume retry must replay the same key` · `Expected: "2df4dea3-…"` / `Received: "bb8c58c5-…"` · `1 failed ... resume retry reuses the idempotency key` | `a42df7eff5690430a7d5ef818a9919f7d7b952d787bf41495f57a3aa005abb52` and `987e828741a48c2110b60f7d717ece9974a854efd527ca3b4cfa92d2d73992f6` — **both true** | `ok 1 ... resume retry reuses the idempotency key (2.2s)` · `1 passed (16.9s)` |

The restore hashes for D1/D2/D3 match `seat-a.md` §6 exactly, which independently confirms the wave-1 fixes are present, unmodified, and effective on the integrated tree. The D2 retry test also re-proved the 503 → named alert → Retry → 37 options → create re-enabled chain; the D3 test re-proved two real POSTs with equal keys.

## 2. Adjacent audit — recon ledger

Audited surface: `/runs` list + run-detail action/state transitions, and the `/agents` drawer run/reset/close state machine. Live inventory used the same running server: 30 recorded runs (23 completed, 4 budget_exceeded, 3 failed); every non-completed run had zero artifact rows, and accepted artifacts appeared only on completed runs.

### D-A (confirmed) — Run detail offers Revise/Audit for terminal statuses the server rejects

- **Target behavior:** an action is rendered only when the server will accept it for this run. The card copy already claims “Actions are real API calls; unavailable actions are not rendered.” (`RunDetailPage.tsx:415`).
- **Entry point:** `web/src/pages/RunDetailPage.tsx:224-225` computed `canRevise`/`canAudit` as `terminal && acceptedArtifacts.length > 0`; header buttons at `:339-343` (Revise) and `:344-350` (Audit); card buttons/hints at `:426-446`; submit paths `startAudit` at `:260` → `auditRun` and `submitRevision` at `:245` → `reviseRun`.
- **Client:** `web/src/api.ts:411-446` → `POST /api/runs` with `preset:'audit'` / `POST /api/runs/:id/revise`.
- **Route contract:** `src/server/app.ts:1037` (`preset === 'audit' || 'revise'`) and `src/server/app.ts:1175` (revise) both require the parent status to be one of `completed`, `completed_with_warnings`, `failed` (plus ≥1 accepted artifact). `TERMINAL_STATUSES` also contains `cancelled`, `budget_exceeded`, `interrupted` (`src/shared/types.ts:15-22`) — the UI accepted those.
- **Live consequence (captured through the UI before the fix):** with a mocked snapshot for live run `run_26e2456caef4b8be0c` (`budget_exceeded`) carrying one accepted artifact, the page rendered **2 Revise + 2 Audit buttons**. Clicking them issued real requests (no run was created) and the server refused:
  - `POST /api/runs` → `409 {"error":{"code":"E_INVALID_PARENT","message":"Parent run is not terminal or has no artifacts.","hint":"Choose a completed or failed run with files."}}`
  - `POST /api/runs/run_26e2456caef4b8be0c/revise` → the same `409 E_INVALID_PARENT`.
  The refusal copy itself (`src/shared/refusals.ts:13`, hint “Choose a completed or failed run with files.”) states the intended eligible set.
- **Reachability:** a run can be terminal with accepted artifacts and a non-eligible status when the process dies between whole-tree publish/artifact insert and `updateRun(status:…)` in `src/server/pipeline/run.ts:1225-1253`; the next startup marks it `interrupted` (`src/server/runs/manager.ts:214-243`) while accepted rows remain. `budget_exceeded`/`cancelled` are the same availability class.
- **Tests + command:** `e2e/wave17-actions.spec.ts:74` (new permanent pin), RED captured on the integrated tree.
- **Unknowns:** none about the contract; no live interrupted-after-publish row exists in this DB, so the pin uses an HTTP snapshot double (permitted test double) plus the real route refusal above as the contract proof.

### D-B (confirmed) — Drawer/confirmation dialogs can be dismissed mid-flight and drop the failure

- **Target behavior:** while a mutation is in flight, the control that started it owns the outcome. The shared confirmation flow already disables its Cancel button while busy (`ui.tsx:508`), but the modal chrome did not honor the same state.
- **Entry point:** `web/src/components/ui.tsx:376-469` — backdrop `onMouseDown` closed on any click (`:445`), document `Escape` called `onClose` unconditionally (`:409-414`), and the `Close dialog` X was always enabled (`:460`). `ConfirmDialog` passed no busy state to `Modal`; it now forwards it (`:505`).
- **Agents drawer:** `web/src/pages/AgentsPage.tsx:317-335` passed no busy state to `Modal`; footer `Close` (`:325-327`) and `Edit prompt` (`:329-331`) were always enabled; the drawer now derives `drawerBusy` at `:239` and disables both. `AgentDrawer` clears `runError`/`saveError` whenever `agentId` changes (`:227-233`), so a failure that arrives after the drawer is closed is set, then cleared on reopen and never rendered. Save/reset busy states had the same dismissal window.
- **Live consequence (captured before the fix):** route-mocked `POST /api/agents/gatekeeper/run` delayed 1.5 s then 500 `{error:{code:'E_PROBE_RUN_FAILED'}}`. While in flight, the footer `Close` was **enabled**; clicking it hid the drawer; after the failure no error was visible (`count=0`), and reopening the same agent still showed `count=0`. The failure was silently discarded.
- **Same class in run detail:** Stop/Revise/Audit confirm dialogs had `Cancel` disabled while busy but `Escape`, backdrop, and X still closed them; the failure notice is only rendered inside the dialog (`RunDetailPage.tsx:498-542`), so the user could dismiss during an in-flight audit and see no outcome until reopening.
- **Tests + command:** `e2e/wave17-actions.spec.ts:112` (drawer) and `:149` (run-detail Audit dialog). RED captured on the integrated tree.
- **Unknowns:** none.

## 3. Decision-complete plan

- **Outcome:** (A) on a terminal run, Revise/Audit appear only for the statuses the server accepts, and the hint names the real reason when they do not; (B) a run/save/reset/audit/stop/revise request in flight cannot be dismissed through Close, X, or Escape/backdrop, so its refusal is rendered where the user can see it, and dismissal resumes when the request settles.
- **Current behavior:** §2. Both were measured, not inferred: the server 409 was captured through the real UI; the dropped agent-run failure was captured with a deterministic browser double.
- **Decisions:**
  - A — add a local `REVISABLE_STATUSES` set mirroring `src/server/app.ts:1037,1175` and include it in `canRevise`/`canAudit`; make the two hints state-specific. Rejected: changing the server to accept more statuses (forbidden scope; the refusal copy defines the intended contract), and hiding the hints entirely (loses the reason).
  - B — extend the shared `Modal` with an optional `busy` prop that vetoes Escape/backdrop closes and disables the X; `ConfirmDialog` forwards its existing `busy`; `AgentDrawer` passes `runBusy || saveBusy || resetBusy` and disables Close/Edit/Reset/Save accordingly. Rejected: only disabling the footer Close (X/Escape would still discard), and lifting the drawer error to page level (a failure could be shown far from the control that caused it, and the in-flight mutation would still be dismissible).
- **File-by-file change:**
  - `web/src/pages/RunDetailPage.tsx:84-90,224-225,430-446` — eligibility set, canRevise/canAudit, three-state hints.
  - `web/src/components/ui.tsx:383,392,397-398,412,445,460,505` — `Modal.busy` and `ConfirmDialog` forwarding.
  - `web/src/pages/AgentsPage.tsx:239,322,325,329,425,428` — drawer busy state, Close/Edit/Reset/Save disables, modal veto.
  - `e2e/wave17-actions.spec.ts` — three permanent pins (availability; drawer in-flight; run-detail dialog in-flight).
- **Failure modes:** ineligible terminal status → no action, accurate hint; eligible failed/completed → actions remain; zero artifacts → existing “Audit requires stored artifacts.” copy preserved; in-flight mutation → all four dismissal paths blocked, refusal rendered, then dismissal re-enabled; transport failure → error stays visible in the open modal. No paid provider call is made by any pin.
- **Tests:** `npx.cmd playwright test e2e/wave17-actions.spec.ts` (RED→GREEN), `npx.cmd playwright test e2e/wave17-controls.spec.ts`, targeted 7-file regression set, then `npm.cmd run e2e`.
- **Rollback:** revert the three `web/src` edits and delete `e2e/wave17-actions.spec.ts`; no route, schema, data, or server change.
- **Out of scope:** server routes/services, unit tests, package files, shared docs, paid runs, active-run cancellation, server restart.

## 4. Logic-gatekeeper Phase 1 (recorded before mutation)

```json
{
  "phase1": {
    "architecture": "React 19 SPA (web/src) over Fastify routes. RunDetailPage owns run-action availability; ui.tsx owns shared Modal/ConfirmDialog dismissal semantics; AgentsPage's AgentDrawer owns drawer mutation state.",
    "dataFlow": "Run snapshot -> canRevise/canAudit -> button -> api.reviseRun/auditRun -> POST /api/runs/:id/revise or POST /api/runs -> server parent-status guard. Drawer action -> api.runAgent/updateAgentPrompt/resetAgentPrompt -> POST/PUT/DELETE; modal onClose -> drawer close.",
    "edgeCases": [
      "budget_exceeded/cancelled/interrupted terminal run with an accepted artifact: server returns 409 E_INVALID_PARENT; the UI must not offer Revise/Audit.",
      "failed/completed/completed_with_warnings with accepted artifacts: server accepts; actions must remain.",
      "terminal run with zero artifacts: the existing 'Audit requires stored artifacts.' pin must still pass.",
      "agent run/save/reset in flight: Close, X, Escape, backdrop must not dismiss and discard the refusal; after settle, dismissal must work.",
      "run-detail Audit/Stop/Revise confirm dialog in flight: Cancel is already disabled; X/Escape/backdrop must match."
    ],
    "rootCause": "A: canRevise/canAudit used TERMINAL_STATUSES (six statuses) while the server accepts only completed/completed_with_warnings/failed (app.ts:1037,1175), so ineligible terminal runs render actions that can only fail. B: Modal always allowed X/Escape/backdrop close regardless of an in-flight mutation, and AgentDrawer clears runError/saveError when agentId changes, so a failure arriving after dismissal is never rendered."
  }
}
```

## 5. Deterministic RED for the new pins (pre-fix integrated tree)

Command: `npx.cmd playwright test e2e/wave17-actions.spec.ts --reporter=list`

```
1) @wave17 action availability › run actions match the backend terminal-status eligibility
   > 99 | await expect(page.getByRole('button', { name: /^Revise/i })).toHaveCount(0);
        (recon probe measured revise=2, audit=2: header + run-actions card)

2) @wave17 action availability › agent drawer cannot drop a failed run while the request is in flight
   Locator: getByRole('dialog').getByRole('button', { name: 'Close', exact: true })
   Expected: disabled
   Received: enabled

3) @wave17 action availability › run-detail confirmation dialogs stay open while their request is in flight
   Locator: getByRole('dialog').getByRole('button', { name: 'Close dialog' })
   Expected: disabled
   Received: enabled

  3 failed
```

The pre-fix recon probe had already captured the real refusal (`409 E_INVALID_PARENT` from both routes) and `closeEnabledWhileBusy=true`, `visibleFailureAfterClose=0`, `visibleFailureAfterReopen=0`. The temporary probe spec and its runner artifacts were deleted.

## 6. Fixes (minimal, complete wiring)

| Defect | Root cause | Change | SHA-256 |
|---|---|---|---|
| D-A | action availability used all terminal statuses | `REVISABLE_STATUSES` set mirrors `src/server/app.ts:1037,1175`; `canRevise`/`canAudit` include it (`RunDetailPage.tsx:90,224-225`); hints distinguish non-terminal / no-artifacts / ineligible-terminal (`:430-446`) | `4910b56800f6c2b71cc2eb9eb1aaef266f32525446240d2520faec1604a4b2ca` |
| D-B | modal chrome ignored the in-flight state | optional `Modal.busy` vetoes Escape (`ui.tsx:412`), backdrop (`:445`), and disables X (`:460`); `ConfirmDialog` forwards `busy` (`:505`); drawer passes `drawerBusy` and disables Close/Edit/Reset/Save (`AgentsPage.tsx:239,322,325,329,425,428`) | `78cfddbf187935d2b8cb8e21529585959403353d0da5ff71a685edefdaa4febe` · `82c93007421edf5219a7e2167ce7fe2a98f25e48249be6cdc765bd13d4b401ae` |
| Tests | permanent regression pins | `e2e/wave17-actions.spec.ts` (3 tests; HTTP doubles only; no provider call, no paid run) | `b86cb59e8ab367f1418674344d7380cf3cf9bdaf21ba474afe45c44360ac4ab0` |

Wave-1 files `web/src/styles.css`, `web/src/pages/ChatPage.tsx`, `web/src/api.ts` were restored to their integrated hashes (`791dd1ac…`, `d006dd10…`, `a42df7ef…`) and are unchanged by wave 2. The changed-file pattern sweep returned only HTML `placeholder` attributes and existing evidence-badge / disabled `mock`-mode copy (`mock-run`, `mock`), which are UI copy and attributes, not mock code. No server/route/contract change; no test was weakened, skipped, or deleted; no TODO/mock/stub in production code (the new spec's HTTP doubles are classified test doubles in `e2e/` only).

## 7. GREEN and gates (commands + observed output)

1. `npx.cmd playwright test e2e/wave17-controls.spec.ts --reporter=list` → `ok 1 desktop chrome … (1.4s)`, `ok 2 chat names an agent-registry failure … (941ms)`, `ok 3 resume retry reuses the idempotency key (861ms)`, **`3 passed (4.8s)`**.
2. `npx.cmd playwright test e2e/wave17-actions.spec.ts --reporter=list` → `ok 1 … terminal-status eligibility (1.4s)`, `ok 2 … agent drawer cannot drop a failed run … (2.8s)`, `ok 3 … run-detail confirmation dialogs … (2.1s)`, **`3 passed (8.1s)`**.
3. Targeted regression set (7 files): **`35 passed (54.1s)`**.
4. `npm.cmd run e2e` → **`44 passed (58.0s)`** (41 pre-existing + 3 new). `.qa-api-results/.last-run.json` = `{"status":"passed","failedTests":[]}`.
5. `npm.cmd run typecheck` → exit **0**, no diagnostics.
6. `npm.cmd run build` → `✓ built in 2.52s` (pre-existing >500 kB chunk advisory unchanged).
7. `npm.cmd run stub-sweep` → **`stub-sweep: clean (104 files)`**.
8. Server quiescence at final capture (2026-11-05 17:25:47 local, -06:00): `/api/health` = `ok`, `/api/runs/active` = `{"activeRunId":null}`.

PowerShell 5.1 surfaces npm/Playwright stderr progress as `[exit code: 1]` after green runs (documented wave-1 behaviour); the Playwright pass lines and `.last-run.json` are authoritative and agree.

## 8. Audited control matrix (wave 2)

| Surface · control | Chain evidence | Verdict |
|---|---|---|
| `/runs` · status filter (11 values, `all` omitted from query) | `RunsPage.tsx:16,20,44`; `api.ts:318-325`; live probe previously narrowed/restored | WIRED-AND-WORKS (unchanged) |
| `/runs` · Refresh / loading / error / empty | `RunsPage.tsx:34,57-71`; `useApiResource` keeps last data but the page renders the error panel instead of stale rows | WIRED-AND-WORKS (read + prior live run) |
| `/runs` · run rows + open links | `RunTable.tsx:22-44`; ui-audit navigation | WIRED-AND-WORKS |
| Run detail · Resume availability + retry key | `RunDetailPage.tsx:226-229,275-287`; wave-1 pin | WIRED-AND-WORKS for retry/availability; success UNVERIFIED |
| Run detail · Stop (non-terminal only) | `RunDetailPage.tsx:334-338,420-424,498-508`; server cancel guard `manager.ts:185-212` accepts every non-terminal shape | WIRED (render/contract); live cancel UNVERIFIED (no active run; destructive) |
| Run detail · Revise / Audit availability | **D-A fix**, `RunDetailPage.tsx:90,224-225,430-446`; new pin + live 409 recon | WIRED-AND-WORKS (availability); submit UNVERIFIED (paid/creates run) |
| Run detail · Revise/Audit/Stop dialog dismissal while busy | **D-B fix**; new pin (`wave17-actions:149`); `ui.tsx:412,445,460,505` | WIRED-AND-WORKS |
| Run detail · Download enable/disable | `RunDetailPage.tsx:229,351-364`; `app.ts:910-932`; ui-audit live download | WIRED-AND-WORKS (artifact rows exist); E_ZIP_EMPTY path UNVERIFIED |
| `/agents` · Refresh / 37 cards / search / filters | ui-audit live; unchanged | WIRED-AND-WORKS |
| `/agents` drawer · open/close, Edit/Save/Reset | `AgentsPage.tsx:317-335,422-430`; ui-audit live save/reset; D-B keeps failures visible while busy | WIRED-AND-WORKS |
| `/agents` drawer · Run agent enable/disable + retry key | `AgentsPage.tsx:238-239,275-313,495`; ui-audit gatekeeper payload; new D-B pin | WIRED-AND-WORKS for render/key/refusal; submit success UNVERIFIED (paid) |
| `/agents` drawer · in-flight Close/Edit/Reset/Save | **D-B fix**, new pin (`wave17-actions:112`) | WIRED-AND-WORKS |
| `/settings` · Refresh / key status / error panels | `SettingsPage.tsx:24-35,44,100-107`; ui-audit live | WIRED-AND-WORKS (unchanged; no defect found) |
| `/settings` · health/meta “API” row | `SettingsPage.tsx:23,85`; context meta/health | WIRED (context-level values, not reloaded by the page Refresh) |

## 9. Verdict

**VERIFIED**
- D1/D2/D3 are independently re-proven on the integrated tree by planted-defect RED and byte-identical restore (SHA-256 match against `seat-a.md` §6) → GREEN.
- D-A and D-B are confirmed, fixed in `web/src` only, and pinned by three new E2E tests that failed before the fix.
- Full Playwright suite **44/44**; typecheck exit 0; build green; stub sweep clean.
- No `src/server/**`, `test/unit/**`, package, or shared-doc file was edited by this seat; no paid provider call, destructive action, server restart, or git write.

**UNVERIFIED**
- Resume success (real staged run completing through the UI) — no live failed run with retained staged files; only the retry-key/dedup path is proven.
- Paid/submitting actions: Audit/Revise submit, Run agent success, chat Send/fan-out, Start run, Analyze prompt — no provider call made; only availability, enable/disable, payload/header wiring, refusal rendering, and the mocked failure path are proven.
- Stop/cancel against a live running or needs_review/paused run — no active run; destructive.
- Download refusal when artifact rows outlive their files (`E_ZIP_EMPTY`) — not reachable on this DB.
- Nested-dialog Escape: the drawer’s outer Modal and an open nested Reset ConfirmDialog both listen for Escape at document level, so pressing Escape with the Reset dialog open (not busy) closes both. Read from `ui.tsx:408-427`; not driven in this wave and not fixed here (a third, lower-severity observation outside the two-defect cap).
- `/api/runs` returns no total/truncation marker while the UI prints the shown count “· server-filtered” (`api.ts:318-325`, `app.ts:985-997`); with >100 runs that count would understate the ledger. Live data has 30, so not a confirmed defect.

**Residual / observations for the Lead**
- Mandatory full-suite runs rewrite tracked screenshots under `docs/UI-WAVE-1/shots/` (pre-existing suite behaviour, same as wave 1). This seat did not hand-edit them; the Lead decides whether to fold the refreshed images.
- Concurrent work landed outside this seat during wave 2: `src/server/pipeline/run.ts` (17:16), `test/unit/review-coverage.test.ts` (17:16), and `docs/PLAN-v3.md` (17:09). They are not part of this seat’s diff and were not read/edited by it. The running server process predates them (not restarted), so this seat’s E2E evidence describes the served build, not a rebuilt server tree. The Lead must rerun the gate after the integrated server restart/rebuild.
- `cancelRun` sends an `Idempotency-Key` that `POST /api/runs/:id/cancel` does not read (`api.ts:402-409`, `app.ts:1157-1168`); a lost cancel response followed by a retry would surface `E_RUN_NOT_CANCELLABLE` even though the first cancel succeeded. Read-only observation; no live run was cancelled.
- `resumeRun` returns `payload.runId` without the `normalizeRunId` validation used by `startRun`/`reviseRun`/`runAgent` (`api.ts:448-460`); a malformed server response would navigate to `/runs/undefined`. Current server always returns `runId`; not reachable.
- The busy veto relies on the request settling; `request()` has no client timeout (`api.ts:132-173`), so a permanently hung mutation would pin the dialog until reload. This matches the pre-existing disabled-Cancel policy in `ConfirmDialog`; no hang was observed.
- Overlapping copy: `Run actions` says “unavailable actions are not rendered” (`RunDetailPage.tsx:415`) — now true for Revise/Audit; the Stop control is still rendered in both the header and the actions card when non-terminal (duplicate, not a dead control).

**Scope/cleanup:** temporary probe spec `e2e/_wave17a2-probe.spec.ts` and its `.qa-api-results` artifacts were deleted; the source backup used for byte-identical restores was outside the repo and has been removed. The only new permanent files from this seat are `e2e/wave17-actions.spec.ts` and this report. No file was committed.
