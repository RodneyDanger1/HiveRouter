# 01 — Capability audit, Trace 20261103T2200Z

**Seat:** 1 / capability auditor (`watchdog`) · **App:** HiveRouter B2 at `http://127.0.0.1:8787` · **Inventory:** `controls.json` (299 controls / 8 surfaces) · **Mode:** read-only Playwright Chrome, safe navigation/tabs/drawers/filters only. No product edits, server restart, key access, or paid run.

## Counts

| Tab / surface | Controls | Local | Shared shell | Evidence |
|---|---:|---:|---:|---|
| Overview | 30 | 20 | 10 | `controls.json`; `GET /api/health`, `/meta`, `/runs?limit=5`, `/stats`, `/settings/key-status` 200 |
| Agents | 51 | 41 | 10 | 37 cards + search/group/output + Refresh; `GET /api/agents` 200 |
| Runs | 43 | 33 | 10 | 15 rows × 2 links + status filter + New/Refresh; `GET /api/runs?limit=100` 200 |
| Run detail (union of 8 sub-tabs) | 34 | 24 | 10 | one render per shared/action/tab control; `snapshot`, files content, routing, context, failures, retries, confidence 200 |
| Vault | 95 | 85 | 10 | 84 tree rows + Refresh; `GET /api/vault/tree` 200 |
| Learning | 21 | 11 | 10 | 8 disabled tabs + trust/settings/refresh; `GET /api/learning/overview` 200, `E_LEARNING_POOL_EXHAUSTED` |
| Settings | 12 | 2 | 10 | Refresh + Open Learning status; `GET /api/settings`, `/settings/key-status` 200 |
| Agent drawer | 13 | 13 | 0 | drawer open + edit state; `GET /api/agents/router` 200 |
| **Total** | **299** | **229** | **70** | 10 shell controls are repeated on seven routed surfaces; drawer is modal-local |

## Categories covered

- **Shell/navigation:** skip link, mobile nav toggle, brand, six nav links, Trust & status; `AppShell.tsx:52-127`.
- **Links/cards/rows:** 37 agent cards (`AgentsPage.tsx:155`), 30 run links (`RunTable.tsx:26,37`), 84 vault rows (`VaultPage.tsx:92,107`), recent-run and header links (`OverviewPage.tsx:54,57,126,224`).
- **Forms/selects/filters:** composer brief/preset/model/thinking/max cost (`RunComposer.tsx:117-170,208`); agent drawer Input/Mode/Max cost/Target (`AgentsPage.tsx:435-479`); search/group/output (`AgentsPage.tsx:100-121`); runs status (`RunsPage.tsx:48`).
- **Tabs:** eight run-detail tabs (`RunDetailPage.tsx:76-87,387`) exercised; eight learning tabs are disabled (`LearningPage.tsx:164-168`).
- **Drawers/dialogs:** agent drawer opened, edited, closed; confirm/reset, revise, audit, stop dialogs identified at `AgentsPage.tsx:495-505`, `RunDetailPage.tsx:418-462`, `ui.tsx:465-538`; destructive dialogs not confirmed.
- **Actions:** Start run, Run agent, Revise/Audit (header + run actions), Download, Open folder, Stop, Copy, Refresh, Save/Reset. Paid/destructive actions remain UNVERIFIED.
- **Empty/error/refusal:** learning refusal rendered; error/empty components exist but were not all triggered. No visible page error occurred.

## Corrected probe evidence

1. **Open navigation — false negative fixed.** `AppShell.tsx:57-64` changes the accessible name on toggle. Old probe reused `getByRole('button', { name: 'Open navigation' })` after the click and timed out at `getAttribute`. Stable `button.topbar-menu` result: `aria-expanded false → true → false`, label `Open navigation → Close navigation → Open navigation`, `sidebar → sidebar sidebar-open + scrim → sidebar`. App behavior is correct; the old timeout was test-design error, now quarantined in `controls.json.probeCorrections`.
2. **Vault file — corrected.** `button.vault-row.first()` selected a directory. Selecting `getByRole('button', { name: /^Log_/ })` opened `Log_007238d763_architect.md`; `GET /api/vault/file?path=000_Hive_Control%2FLog_007238d763_architect.md` returned 200 and the Markdown preview rendered.
3. **Direct-URL caveat.** Top-level routes were loaded directly for inventory, not all via nav-link clicks; only safe state changes are claimed as exercised.

## Capability-auditor gaps

- **G1 P2 — duplicate run-detail actions.** `Revise` appears at `RunDetailPage.tsx:277` and `Revise accepted files` at `:362`; `Audit` at `:283` and `Audit this run` at `:370`; `Download` is duplicated in the action cards. Both variants resolve to the same handlers/route; verify they stay identical and the duplication is intentional.
- **G2 P2 — agent evidence claims.** 37 cards render verification badges (`AgentsPage.tsx:155,168,381-385`). Visible cards expose UNVERIFIED/REGISTERED/LIVE EVIDENCE, but schema-valid evidence is not exposed as a control; trace the `/api/agents` badge derivation rather than infer from card labels.
- **G3 P2 — Learning approvals unreachable.** `LearningPage.tsx:501-517` and `:618-623` implement promote/rollback/APPROVE, but the current `E_LEARNING_POOL_EXHAUSTED` refusal renders only disabled tabs and refusal copy. This is correct `REFUSED-BY-NAME`, but the approval chain is untestable in this build.
- **G4 P3 — agent run disabled state.** `Run agent` is disabled with empty Input (`AgentsPage.tsx:479`); Target is disabled for this non-writing agent (`:457`). The page gives generic schema text, not a field-specific “enter input” reason. No run was created.
- **G5 P3 — Settings key capability.** `SettingsPage.tsx:50-55` renders Checked/Balance as “Not reported” when the API lacks values; Configured/Source/Fingerprint are present. Honest, but the key capability stops at configured/fingerprint.
- **G6 P3 — Vault depth.** 84 tree rows; one file preview exercised. Directory toggles, empty/error states, encoded paths, and traversal guards are not verified.
- **G7 P3 — Runs filtering.** The Completed filter reduced rendered rows 15→12 with no API call (`RunsPage.tsx:48`); all statuses and the no-match empty state are not asserted.
- **G8 P3 — action coverage.** Start run, Run agent, Save/Reset prompt, Revise, Audit, Download, Open folder, Stop, Copy, approvals/rollback were deliberately not exercised. They remain UNVERIFIED, not dead.
- **No WIRED-BUT-DEAD or MISSING control was proven.** Learning is REFUSED-BY-NAME; disabled states are explained by source/refusal; no dead `href="#"` or no-op handler was observed.

## HANDOFF TO FORGE:

Top 10 controls/areas for deep trace (exact files):

1. `web/src/pages/RunDetailPage.tsx:277` Revise and `:362` Revise accepted files — duplicate handlers; trace modal → revision API → child run/parent immutability (`:214`, `:418-435`).
2. `web/src/pages/RunDetailPage.tsx:283` Audit and `:370` Audit this run — duplicate; trace audit API, child artifacts, and paid/idempotency boundary (`:229`).
3. `web/src/components/RunComposer.tsx:208` Start run — trace disabled length guard, cost validation, POST run, SSE/terminal transition (`OverviewPage.tsx:70`).
4. `web/src/pages/AgentsPage.tsx:479` Run agent — trace enabled path, Input/Mode/Max cost/Target, live budget, no-key refusal, no-run-on-invalid (`:269`, `:446-479`).
5. `web/src/pages/AgentsPage.tsx:411-414` Reset/Save prompt — trace confirm dialog, override write, reset DELETE, snapshot pinning (`:235`, `:495-505`).
6. `web/src/pages/AgentsPage.tsx:155,381-385` agent cards/evidence badges — trace `/api/agents` badge truth; do not accept UNVERIFIED card labels as capability proof.
7. `web/src/pages/LearningPage.tsx:501-517,618-623` promotion/rollback — trace refusal gates, approval token phrase, no auto-apply; currently unreachable by design.
8. `web/src/pages/VaultPage.tsx:92,107` tree/file rows — trace `vault/tree` → file path encoding → preview; empty/error/traversal.
9. `web/src/pages/RunsPage.tsx:48` status filter and `web/src/components/RunTable.tsx:26,37` row links — trace all statuses, no-match state, run-detail navigation.
10. `web/src/pages/SettingsPage.tsx:34,50-55,89` Refresh/key status/balance and `/api/settings/key-status` — trace “Not reported” fallback and Trust/Learning links.

Quarantined false negatives:
- `getByRole('button', { name: 'Open navigation' })` reused after its accessible name changed: timeout is a **test-harness bug**; use `button.topbar-menu` + `aria-expanded` assertions (`probeCorrections` P1).
- First vault row was a directory; file-preview failure was **probe selection**, not Vault (`probeCorrections` P2).
- Top-level routes were inventoried by direct URL, not nav-link clicks; do not claim click-path coverage.
- Prior TestDrive driver `page.title=about:blank` remains a known CUA title false-negative, not evidence of a product title failure.

Exact artifacts: `docs/TRACE/20261103T2200Z/controls.json`, this report, `docs/TRACE/20261103T2200Z/WAVE-SHEET.md`; source under `web/src`; live API evidence in the Playwright capture summarized above.
