# UI / Visual Wave 1 — wave sheet

**Tree:** current HiveRouter tree after P1 remediation + RVS gate fix. No server restart by seats; Lead owns the server.
**Live URL:** `http://127.0.0.1:8787` (Fastify serves the built `web/dist`; system Chrome is installed).
**Rules:** evidence or it did not happen; screenshots + exact route + control; no paid provider run without Lead approval; no installs, git writes, or key reads. One writer per file. UI fixes only in `web/**` (seat UI-1); e2e-only writes for UI-2; backend scopes below.

## Seats

| Seat | Teammate | Role / write scope | Output |
|---|---|---|---|
| **UI-1** | `agent-native-ux` | Live visual/UI auditor **and UI fixer**, owns `web/**` only | `docs/UI-WAVE-1/01-ui-findings.md`, screenshots under `docs/UI-WAVE-1/shots/` |
| **UI-2** | `integration-architect` | Independent UI/API seam auditor, writes only `e2e/ui-audit.spec.ts`, `docs/UI-WAVE-1/02-ui-api.md` | seam findings + Playwright test |
| **BE-1** | `logic-scripts` | Backend fixer, owns `src/server/app.ts`, `src/server/runs/**`, `src/server/db/**`, `src/server/security/**`, `src/server/verify/**` | `docs/UI-WAVE-1/03-backend.md` |
| **BE-2** | `deepseek-mechanisms` | Backend fixer, owns `src/server/pipeline/**`, `src/server/llm/**`, `src/server/agents/**`, `src/server/learning/**`, `src/shared/**` | `docs/UI-WAVE-1/04-backend.md` |

## UI checklist (UI-1 + UI-2)

Open the live URL in system Chrome/Playwright. Exercise every route and control:
- Overview: composer (brief, preset, model, thinking, max cost), Run button, stats, recent runs, links.
- Agents: all 37 cards, search/filter, drawer role/objective/prompt/rules/pathGlobs/schema, prompt edit/reset, ad-hoc run modal (live/mock state, target, budget), badges/evidence honesty.
- Runs: list/filter, status badges, empty/loading/error, open run.
- Run detail: overview/checks/files/routing/context/repairs/confidence/events tabs, refresh, stop, revise (modal, validation), audit, download, open-folder, file viewer, live SSE status, terminal vs running states.
- Learning: overview/traces/failures/datasets/candidates/evaluations/promotions/audit, disabled/refusal banners, no fake metrics.
- Vault: tree/file preview, path safety.
- Settings: key status (never key), phase/features, trust notice.
- All: responsive 1440/1024/390 widths, keyboard focus/escape, console/page errors, dead buttons, misleading copy, empty-as-success, secret leakage.
- Capture a screenshot per route and per defect in `docs/UI-WAVE-1/shots/`.
- Append findings to `docs/UI-WAVE-1/FINDINGS.md` as `UI-### | severity | route/control | expected | actual | screenshot | suspected owner (ui/backend)`.

## Backend fixers (BE-1/BE-2)

Read `FINDINGS.md` as it appears; fix backend defects **in your scope only** with RED→GREEN. If a finding belongs to the other seat, leave it and note it. Do not edit `web/**`; do not restart the server. Run targeted tests + `npm.cmd run typecheck`; write receipts. Fix only defects with evidence; no speculative refactors.

## Gates

- `npm.cmd run build`, `npm.cmd run e2e`, `npm.cmd run typecheck`; UI-2 may add `e2e/ui-audit.spec.ts` and run it.
- Lead runs the final full gate after all seats finish and restarts the server on the final tree.
