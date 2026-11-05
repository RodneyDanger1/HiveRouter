# Wave 17 — Seat A: UI/API control truth

Date: 2026-11-05
Seat: A (`weaver` + `agent-experience` + `trace`; operating contract `forgewright-lead` + `forgewright-plan` + `forgewright-recon` + `forge`)
Base: `db4e6d5` (455 tests / 71 files; 38/38 E2E; stage 204 files / 51 tables / 62 routes / 24 scripts)
Scope: `web/**`, `e2e/**`, this file. No server, unit-test, package, shared-doc, or git writes. No paid provider call, no destructive action, no server restart.
Server under test: `http://127.0.0.1:8787` (already running before this seat). `web/dist` was rebuilt from this seat's `web/src` changes and served by the existing process without restart.

## 1. Live inventory

Playwright/Chrome at `1440x1000` and `390x844`; routes `/`, `/agents`, `/runs`, `/chat`, `/analysis`, `/scripts`, `/vault`, `/settings`, `/learning`, and a completed run detail (`/runs/run_c41f1fb4779d302af7`) with tabs Overview/Files/Search/Checks/Routing/Context/Repairs/Confidence/Events.

- All routes returned HTTP 200 with a visible `h1`. Console errors **0**, page errors **0**, failed requests **0**, 4xx/5xx responses **0** on every route at both viewports, before and after the fixes.
- Document horizontal overflow at `390`: **0** on all nine routes (full census, not a sample).
- Visible interactive-control counts (DOM-deduped), pre-fix → post-fix at 1440:

| Route | 1440 pre → post | 390 pre → post |
|---|---|---|
| `/` | 34 → **33** | 34 → 34 |
| `/agents` | 54 → **53** | 54 → 54 |
| `/runs` | 76 → **75** | 76 → 76 |
| `/chat` | 60 → **59** | 60 → 60 |
| `/analysis` | 38 → **37** | 38 → 38 |
| `/scripts` | 22 → **21** | 22 → 22 |
| `/vault` | 261 → **266*** | 261 → **267*** |
| `/settings` | 15 → **14** | 15 → 15 |
| `/learning` | 24 → **23** | 24 → 24 |
| run detail (top) | 30 → **29** | 30 → 30 |
| run-detail panels (1440) | Files 45→44, Search 32→31, Routing 41→40, Events 107→106 | unchanged |

Every non-vault page lost exactly one control at 1440 and none at 390: that control is the mobile navigation toggle removed by D1. `*` `/vault` gained five/six rows because the shared live vault gained published files between the two pass inventories; the desktop-to-mobile delta remains exactly the menu toggle.

- Post-fix inventory re-run: `20 passed (58.4s)`; `menuControls=0` at 1440 and one at 390.

## 2. Recon ledger

### D1 — desktop renders and activates the mobile navigation toggle

- **Target behavior:** the hamburger `Open navigation` control exists only at `<=1000px`, where the sidebar is off-canvas. Above 1000px the sidebar is permanently visible and no toggle is shown or focusable.
- **Entry point:** `web/src/components/AppShell.tsx:91-101` renders `className="icon-button topbar-menu"`, `aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}`, `aria-expanded={mobileOpen}`, `onClick={() => setMobileOpen((value) => !value)}`.
- **Callers/uses:** no client call; the handler flips `mobileOpen`, which drives `aside.sidebar` (`AppShell.tsx:131-137`), `aria-hidden/inert` only when `isMobile`, and the `sidebar-scrim` button (`AppShell.tsx:172-179`).
- **Intended CSS:** `web/src/styles.css:122-126` `.topbar-menu { display: none; ... }`; shown by the `max-width:1000px` rule at `web/src/styles.css:1013,1037-1039`.
- **Actual CSS:** `web/src/styles.css:412-423` declares `.icon-button { display: inline-flex; ... }` **after** `.topbar-menu` with equal specificity (`0,1,0`), so it wins the cascade. Live CSS provenance at `1440`: `.topbar-menu` display rule order 26, `.icon-button` order 73; `matchMedia('(max-width:1000px)').matches === false`; the button measured 30x30 at `(20,13.5)` and was visible.
- **Tests + command:** `npx playwright test e2e/wave17-controls.spec.ts --reporter=list` (new pin, RED below). Existing coverage only asserts the control is visible at 390 (`e2e/mobile-keyboard.spec.ts:68-88`); nothing asserted it hidden at desktop.
- **Data flow / failure path:** click at 1440 → `mobileOpen=true` → `aria-expanded=true` + X icon; `.sidebar-scrim` computes `display:none` outside `<=1000px` (`styles.css:270-272`); sidebar already visible (`transform:none`) → no navigation surface opens or closes. The control is **WIRED-BUT-DEAD** at desktop and lies about `aria-expanded`.
- **Unknowns:** none.
- **Files touched:** `web/src/styles.css`, `e2e/wave17-controls.spec.ts`.

### D2 — chat swallows an agent-registry failure and leaves the composer silently inert

- **Target behavior:** when `GET /api/agents` fails, the Chat surface names the failed dependency, offers a retry, and does not present an unexplained disabled composer; loading/failure are distinguishable from an empty registry.
- **Entry point:** `web/src/pages/ChatPage.tsx:127` `const agents = useApiResource(listAgents)`; consumers `ChatPage.tsx:146` (`agentList = agents.data ?? []`), `265-279` (new-conversation agent select + button), `362-389` (fan-out multi-select and `1 of 3` help), `414` (Send).
- **Client:** `web/src/api.ts:507-510` `listAgents()` → `GET /api/agents`.
- **Route:** `src/server/app.ts:280-288`; refusal shape `{error:{code,message,hint,retryable,details}}` through `refusal()`.
- **Tests + command:** `npx playwright test e2e/wave17-controls.spec.ts --reporter=list`. Existing coverage mocks `/api/chat/threads*` only (`e2e/ui-audit.spec.ts:521-563`); no `/api/agents` failure case existed.
- **Data flow / failure path:** route 503 `{error:{code:'E_AGENT_REGISTRY_UNAVAILABLE'}}` → `errorFromPayload` sets `agents.error` → **nothing read `agents.error`/`agents.loading`** (verified by reading the whole page; only `agents.data` was referenced). Result: empty `Agent` select, disabled `New conversation`, `0 of 3 selected`, disabled Send, and no error/retry. A failed request was indistinguishable from a successful empty registry — a missing render-back hop.
- **Unknowns:** none; the live registry is healthy (37 agents), so this is an error-path defect exercised with a browser-level route double (permitted test double; no server change).
- **Files touched:** `web/src/pages/ChatPage.tsx`, `e2e/wave17-controls.spec.ts`.

### D3 — Resume retry allocated a fresh idempotency key (duplicate child run)

- **Target behavior:** an unchanged `Resume from staged` retry after a transport failure replays the original request under the same `Idempotency-Key`, so the server returns the original child run instead of creating a second one.
- **Entry point:** `web/src/pages/RunDetailPage.tsx:433-437` Resume button; `startResume` at `:267-279` called `resumeRun(run.id)`.
- **Client:** `web/src/api.ts:448-456`: `resumeRun` built `idempotencyKey: newIdempotencyKey()` **inside** every call, so the UI could never replay.
- **Route:** `src/server/app.ts:1208-1237` requires `Idempotency-Key` and passes it into `createRun({..., idempotencyKey, parentRunId, runKind:'resume'})`; the server contract is same key+body → original run (`docs/PLAN-v3.md:140` and `:221`).
- **Tests + command:** `npx playwright test e2e/wave17-controls.spec.ts --reporter=list`. Existing retry pins covered composer and revision/audit but not resume.
- **Data flow / failure path:** click Resume → POST `/resume` with key A → transport abort (response lost) → inline `Resume failed.` → click again → POST with key B. The server sees a different key for the same body/path and creates a new resume child run; a plausible lost-response retry therefore duplicated durable work. Wave 16 fixed this exact class for `startRun`, `runAgent`, `reviseRun`, and `auditRun`; `resumeRun` was missed.
- **Unknowns:** live data has no failed run with a retained staged directory, so the browser pin uses a mocked snapshot + a mocked failing POST (test doubles only; no provider call). The production handler and client are the real ones.
- **Files touched:** `web/src/api.ts`, `web/src/pages/RunDetailPage.tsx`, `e2e/wave17-controls.spec.ts`.

## 3. Decision-complete plan

- **Outcome:** (1) the mobile navigation toggle is absent and non-focusable at desktop widths while unchanged at `<=1000px`; (2) a chat agent-registry failure is visible with its code and a retry that recovers the selectors; (3) an unchanged Resume retry replays the same idempotency key, so the server cannot create a duplicate resume run.
- **Current behavior:** measured in §2; RED in §5; all other audited controls in §8 are WIRED-AND-WORKS or named UNVERIFIED.
- **Decisions:**
  - D1 — fix the cascade, not the component: scope the base hide rule to `.topbar .topbar-menu` (`0,2,0`) and match the media-query show rule. Rejected: removing `icon-button`'s display (affects every icon button) or conditionally rendering from `isMobile` (duplicates the media-query truth in JS and adds an untested layout branch). Sidebar stays permanently visible on desktop; no server contract change.
  - D2 — render the existing `agents.error` with the shared `ErrorPanel` (named code + Retry) and disable/annotate both agent selects while loading or failed. Rejected: hiding the composer (loses the thread surface) or inventing a local retry timer (the shared resource already reloads).
  - D3 — mirror the Wave 16 pattern: caller-supplied optional key on `resumeRun`, memoized per `runId` in `RunDetailPage`. Rejected: key per click (does not replay) or page-only key creation (breaks the default for other callers).
- **File-by-file change:**
  - `web/src/styles.css:122,1037` — `.topbar .topbar-menu` selectors for hide/show.
  - `web/src/pages/ChatPage.tsx:261-291,380-409,436` — `ErrorPanel` for `agents.error` with `agents.reload`; loading/error placeholder + disable for both agent selects; state-specific help text; create/send disabled while the registry is loading or failed.
  - `web/src/api.ts:448-460` — `resumeRun(runId, signal?, idempotencyKey = newIdempotencyKey())`; default preserved for other callers.
  - `web/src/pages/RunDetailPage.tsx:142,273` — `resumeRequestKey = useMemo(..., [runId])`; pass it to `resumeRun`.
  - `e2e/wave17-controls.spec.ts` — three permanent regression pins; HTTP doubles only in tests; no provider call.
- **Failure modes:** `/api/agents` failure → visible error + retry; retry while loading → controls disabled; desktop width → toggle absent; mobile → toggle works; resume transport failure → same key on retry; server refusal → existing inline notice; no test weakened.
- **Tests:** `npx playwright test e2e/wave17-controls.spec.ts` (RED→GREEN), targeted `npx playwright test e2e/ui-audit.spec.ts e2e/mobile-keyboard.spec.ts e2e/chat.spec.ts e2e/app.spec.ts e2e/trace-fixes.spec.ts e2e/wave17-controls.spec.ts`, then `npm.cmd run e2e`.
- **Rollback:** revert the four `web/src` edits and delete the new spec; no data/schema/route changes.
- **Out of scope / blockers:** server routes/services, `test/unit/**`, package files, shared docs, paid runs, destructive actions, provider calls.

## 4. Logic-gatekeeper Phase 1 (required before each mutation)

```json
{
  "phase1": {
    "architecture": "React 19 SPA (web/src) over Fastify routes. AppShell owns responsive navigation chrome; ChatPage owns chat resource rendering; RunDetailPage owns run actions; web/src/api.ts owns HTTP keys/headers.",
    "dataFlow": "User intent -> React handler -> web/src/api.ts fetch -> Fastify route -> response -> React state render. For resume: RunDetailPage.startResume -> api.resumeRun -> POST /api/runs/:id/resume with Idempotency-Key -> server createRun replay store -> child runId.",
    "edgeCases": [
      "Desktop viewport 1440 with sidebar permanently visible: the toggle must not exist or be focusable.",
      "GET /api/agents returns 503 while /api/chat/threads succeeds: the page must name the failure and recover on retry.",
      "Resume POST commits then the response is lost: a second click with an unchanged payload must send the identical Idempotency-Key.",
      "Server refusal from resume (e.g. E_RESUME_NO_STAGED_FILES): the existing inline error must still render and the retry key must remain stable."
    ],
    "rootCause": "D1: `.icon-button` is declared after `.topbar-menu` at equal specificity and overrides `display:none`, so the mobile toggle renders active at desktop. D2: ChatPage never reads `agents.error`/`agents.loading`, so a failed `/api/agents` has no render-back and leaves unexplained disabled controls. D3: `resumeRun` creates a new idempotency key inside every call, so a lost-response retry cannot replay and the server creates a duplicate child run."
  }
}
```

## 5. Deterministic RED (pre-fix, captured output)

Command: `npx.cmd playwright test e2e/wave17-controls.spec.ts --reporter=list`

```
  x  1 ... desktop chrome does not expose the mobile navigation toggle (12.8s)
      Error: expect(locator).toBeHidden() failed
      Locator: locator('.topbar-menu')
      Expected: hidden
      Received: visible
  x  2 ... chat names an agent-registry failure and recovers on retry (12.5s)
      Error: expect(locator).toBeVisible() failed
      Locator: getByRole('alert').filter({ hasText: 'E_AGENT_REGISTRY_UNAVAILABLE' })
      Error: element(s) not found
  x  3 ... resume retry reuses the idempotency key (1.6s)
      Error: an unchanged resume retry must replay the same key
      expect(received).toBe(expected)
      Expected: "3b186cd8-574e-4c6c-a175-58b8ded109ee"
      Received: "07fbf821-7cec-4867-8a21-01f872bf06bc"
  3 failed
```

The third failure is the product defect, not a harness limitation: both POSTs were observed, both carried a valid key, and only the key differed.

## 6. Fixes (minimal, complete wiring)

| Defect | Root cause | Change | SHA-256 |
|---|---|---|---|
| D1 | `.icon-button` later at equal specificity overrides `.topbar-menu{display:none}` | `web/src/styles.css:122` and `:1037` scoped to `.topbar .topbar-menu` (0,2,0); no component/JS change, sidebar semantics untouched | `791dd1ac85795fd5b4f496b77af1febfc947424a11731df1dd68b91b51e43e55` |
| D2 | chat had no render path for `agents.error`/`agents.loading` | `ErrorPanel` with `agents.reload` (`ChatPage.tsx:261-265`); both agent selects disabled with `Loading agents…`/`No agents available` placeholders (`:268-286`, `:380-392`); help text names `Agent selection unavailable (<code>)` (`:402-409`); create/send disabled while registry loading/failed (`:291`, `:436`) | `d006dd10f1ed0ed0137dd6d46f2d184e7b95f12722541bcbe68d557eefa07d35` |
| D3 | `resumeRun` minted a key internally per call | optional caller key defaulted to `newIdempotencyKey()` (`api.ts:448-460`); `resumeRequestKey` memoized per `runId` (`RunDetailPage.tsx:142`) and passed at `:273` | `a42df7eff5690430a7d5ef818a9919f7d7b952d787bf41495f57a3aa005abb52` · `987e828741a48c2110b60f7d717ece9974a854efd527ca3b4cfa92d2d73992f6` |
| Tests | regression pins | `e2e/wave17-controls.spec.ts` (3 tests; mocked HTTP only; no provider call) | `5caf64db2bc4c4a649d303d7072867107e4de4db7db493c01707c90a0856e12c` |

No server change was needed; no route/contract change; no test was weakened or deleted; no mock/stub/TODO reachable from production code (the new spec's HTTP doubles live only in `e2e/` and are classified test doubles). `npm.cmd run stub-sweep` → `stub-sweep: clean (104 files)`; the changed-file pattern sweep returned only `mock-run` evidence-badge copy and input `placeholder` attributes (permitted UI copy, not mock code).

## 7. GREEN and gates

1. Targeted pin, post-fix: `npx.cmd playwright test e2e/wave17-controls.spec.ts --reporter=list`
```
  ok 1 desktop chrome does not expose the mobile navigation toggle (2.3s)
  ok 2 chat names an agent-registry failure and recovers on retry (1.7s)
  ok 3 resume retry reuses the idempotency key (1.3s)
  3 passed (17.6s)
```
   Re-confirmed on the current built bundle after the external 17:02 rebuild: `3 passed (11.6s)`.
2. Targeted regression set (`ui-audit`, `mobile-keyboard`, `chat`, `app`, `trace-fixes`, `wave17-controls`): **`32 passed (57.1s)`**.
3. Full suite: `npm.cmd run e2e` → **`41 passed (1.8m)`** (38 pre-existing + 3 new). Playwright's own artifact `.qa-api-results/.last-run.json` = `{"status":"passed","failedTests":[]}`.
4. `npm.cmd run typecheck` → exit 0, no diagnostics.
5. `npm.cmd run build` → `✓ built in 2.76s` (web assets rebuilt; the pre-existing >500 kB chunk advisory is unchanged).
6. Post-fix live inventory: `20 passed (58.4s)`; desktop toggle count 0 at 1440, one at 390; console/page/failed/HTTP error counts all 0 on every route.
7. `npm.cmd run stub-sweep` → `stub-sweep: clean (104 files)`.

Note on shell exit codes: PowerShell 5.1 reports npm/Playwright stderr progress as `NativeCommandError` and may surface `[exit code: 1]` after a green run. The Playwright output (`41 passed`) and `.last-run.json` (`status: passed`, `failedTests: []`) are the authoritative results and agree.

## 8. Control matrix (covered controls)

Verdicts: WIRED-AND-WORKS (live request/response/render proven), WIRED (handler/contract read; not driven), UNVERIFIED (not safely exercised: paid, destructive, or no fixture), N/A.

| Surface · control | Chain evidence | Verdict |
|---|---|---|
| Shell · primary nav (9 links), brand, skip link | `AppShell.tsx:138-157`; route sweep 200; app/ui-audit navigation | WIRED-AND-WORKS (skip link render-only) |
| Shell · mobile menu toggle | D1 fix; pin test both viewports (1440 hidden, 390 expanded → true/false) | WIRED-AND-WORKS |
| Shell · API/status/stage chips | `/api/health`, `/api/meta`; inventory text | WIRED-AND-WORKS |
| Overview · Run history / Agent registry / Trust links / View all / recent-run links | `OverviewPage.tsx`; app.spec navigation; run list | WIRED-AND-WORKS |
| Overview · brief/preset/model/thinking/max cost/effort (draft) | `RunComposer.tsx:56-80`; e2e reload persistence + option counts | WIRED-AND-WORKS (render/state) |
| Overview · Analyze prompt | `RunComposer.tsx:85-105` → `POST /api/prompt/analyze` (paid) | UNVERIFIED (render/enable only; no provider call) |
| Overview · Start run | `RunComposer.tsx:107-140` → `POST /api/runs` (paid); retry-key e2e | WIRED-AND-WORKS for enable/validation/key; submit UNVERIFIED (paid) |
| Overview · key status / stats / pipeline / recent runs | live API values matched | WIRED-AND-WORKS |
| Agents · Refresh / search / group / output / count | live probe: filters narrowed and restored; card counts 37→Control→files→37 | WIRED-AND-WORKS |
| Agents · 37 cards, drawer open/close, Edit/Save/Reset | ui-audit live save/reset + reload | WIRED-AND-WORKS |
| Agents · Input/Mode/Max cost/Target/Run agent | render/disable rules; ui-audit captured gatekeeper payload without `targetPath` | WIRED-AND-WORKS for render/payload; submit UNVERIFIED (paid) |
| Runs · filter / rows / links / New run | `RunsPage.tsx:20,44`; live probe `status=failed` → 3 failed rows, count text, completed refilter | WIRED-AND-WORKS |
| Runs · Refresh | `runs.reload` | WIRED (not clicked this pass) |
| Run detail · Back / Refresh / Download | ui-audit (download event, filename, no failure) | WIRED-AND-WORKS |
| Run detail · Revise / Audit dialogs (+ zero-artifact guard) | ui-audit dialog/enable/guard; submit UNVERIFIED (paid) | WIRED-AND-WORKS (dialog); submit UNVERIFIED |
| Run detail · Resume from staged | pin: retry sends identical key; success UNVERIFIED (no staged run; would create a child run) | WIRED-AND-WORKS (retry wiring); success UNVERIFIED |
| Run detail · Stop / Open folder | render rules only; no active run / spawns Explorer | UNVERIFIED |
| Run detail · 9 tabs + keyboard arrows + persisted Events | inventory click-through, ui-audit, trace-fixes, mobile-keyboard | WIRED-AND-WORKS |
| Run detail · Files content / Search | ui-audit + live probe (content bytes matched; search indexed) | WIRED-AND-WORKS |
| Run detail · tab-level Refresh (Routing/Context/Repairs/Confidence) | handlers call resource reload | WIRED (not clicked this pass) |
| Chat · New conversation / thread rows | chat.spec live create + projected fields; probe snapshot on select | WIRED-AND-WORKS |
| Chat · agent registry failure → retry | D2 fix + pin (503 named, Retry restores 37 options, create re-enabled) | WIRED-AND-WORKS |
| Chat · agent select / multi-select / cap text | ui-audit wave16 (37 options, `1 of 3`, Ctrl/Cmd help) | WIRED-AND-WORKS |
| Chat · Message / Send / fan-out | render/disable/cap; submit UNVERIFIED (would enqueue provider jobs) | UNVERIFIED (submit) |
| Chat · Cancel job / live SSE feed | no active job fixture; SSE opens (`live` badge observed) | UNVERIFIED (event delivery) |
| Analysis · dominators / scorecards / refusal | ui-audit both operations; probe empty evidence → `E_ANALYSIS_INVALID_INPUT` rendered | WIRED-AND-WORKS |
| Scripts · catalog + every dry-run + paid disabled | live probe all 6 read-only commands returned and rendered; ui-audit preflight; 2 paid disabled | WIRED-AND-WORKS |
| Vault · Refresh / file preview | live probe: click `.md` → 200 bytes rendered in article; Refresh re-fetched tree+file | WIRED-AND-WORKS |
| Vault · directory expand/collapse, empty/error | handler read; tree populated | WIRED (toggle) / UNVERIFIED (empty/error) |
| Settings · Refresh / key status / phase / runtime values | live probe both requests; ui-audit values; API cross-check | WIRED-AND-WORKS |
| Learning · disabled tabs / refusal copy / Open settings | ui-audit; API refusal matched | WIRED-AND-WORKS |
| Learning · Refresh status | `window.location.reload()` handler read; not clicked | WIRED (not clicked) |
| Learning · approval/promote/rollback | not rendered while disabled | N/A in this build |
| Not found · Return link | ui-audit | WIRED-AND-WORKS |

## 9. Verified / unverified / residual

**VERIFIED**
- Three defects D1/D2/D3 were reproduced deterministically before the fix and pass after it (quoted RED/GREEN above).
- Full Playwright suite is green at **41/41**; typecheck and build are green; stub sweep clean.
- Post-fix layout: the mobile toggle is absent at 1440 and present/working at 390; zero console/page/request errors and zero document overflow across all nine routes at both viewports.
- No server file was edited by this seat; no route/service/contract changed; no paid provider call or destructive action was made.
- The three changes are confined to `web/src` + one new `e2e` spec + this report (hashes in §6).

**UNVERIFIED**
- Resume success path (a real staged run completing through the UI) — no failed run with a retained staged directory exists, and driving one creates a durable child run; the retry key equality is proven, the success navigation is not.
- Paid/submitting actions: Start run, Analyze prompt, Run agent, Revise submit, Audit submit, chat Send/fan-out, Cancel job — no provider call was made; only render/enable/disable and (where mocked at the browser) payload/header wiring is proven.
- Open folder (spawns Explorer) and Stop/cancel (no active run).
- Live run-detail SSE/event delivery and chat SSE event delivery; terminal persisted ledgers are verified, but no event was observed arriving mid-run.
- The Chat loading state (rather than the failure state) is implemented and disables the selects, but only the failure/retry path has a dedicated pin.
- Full `npm.cmd run verify` and the Lead-owned gates (`assert-stage`, `preflight`, `test:live`) were not run by this seat; the Lead owns the integrated gate.

**Residual / observations for the Lead**
- Mandatory E2E runs rewrite tracked screenshots under `docs/UI-WAVE-1/shots/` (pre-existing suite behaviour). This seat did not edit those files by hand; the Lead should decide whether to fold the refreshed images. They are the only changes outside this seat's owned files that this seat's runs caused.
- The working tree also contains concurrent work outside this seat: `src/server/app.ts`, `src/server/runs/recorder.ts`, `src/shared/types.ts`, `test/unit/historical-usage.test.ts`, `test/unit/writer-matrix.test.ts`, and **`web/src/pages/OverviewPage.tsx`**. The Overview edit appeared at 17:01 local, after this seat's edits/build, and an external `web/dist` rebuild landed at 17:02:26. None of those files are part of this seat's diff and their hashes are not in §6; this seat neither read nor edited them. The final E2E (`41 passed`, finished 17:03) ran against the server process that started before the wave and the web assets on disk during the run; the three new pins ran at the end of that run. The Lead must revalidate the integrated tree on a quiet rebuild, because the concurrent Overview/type changes were not authored or independently tested by this seat.
- No Lead-owned REQUEST; no server change is required for these three fixes.
- Chat thread creation remains non-idempotent (documented Wave 16 residual; not a paid provider mutation) and was not changed here.
- `Learning`'s "Refresh status" performs a full page reload; it works, but it is heavier than a resource reload. Recorded as an observation, not a confirmed defect.

**Scope/cleanup:** temporary probe specs (`_wave17-inventory`, `_wave17-trace`, `_wave17-diag`, `_wave17-css`) and temporary `test-results/wave17` captures were deleted; the permanent pin is `e2e/wave17-controls.spec.ts`. Only Playwright's standard gitignored `.qa-api-results/.last-run.json` remains as runner metadata. No file was committed.
