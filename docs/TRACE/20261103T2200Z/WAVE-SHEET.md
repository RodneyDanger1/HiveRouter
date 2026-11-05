# Trace campaign — HiveRouter tabs

**Run:** `20261103T2200Z` · **App:** `C:\Users\Riley\Desktop\HiveRouter` · `http://127.0.0.1:8787` · **Skill:** `C:\Users\Riley\.agents\skills\trace\SKILL.md`

## Scope

Trace every control on these tabs, left-to-right/top-to-bottom:

1. **Overview**: nav links, composer brief/preset/model/thinking/max-cost, Start, Run history, Agent registry, trust/status, recent-run links.
2. **Agents**: Refresh, search, group/output filters, 37 agent cards, drawer close/edit/save/reset/full prompt, Input/Mode/Max cost/Target/Run agent.
3. **Runs**: list/links, status/actions, run-detail links.
4. **Vault**: tree/file links, file preview, refresh/empty state.
5. **Learning**: tabs, refresh, datasets/candidates/evaluations/promotions/audit controls, approval input/buttons, disabled/refused states.
6. **Settings**: key status/trust links, any inputs/buttons.

Also trace detail-page controls reached from those tabs (run detail tabs/actions, agent drawer) even though they are not top-level nav items.

## Seats (strict sequential handoff)

| Order | Seat | Teammate | Skill | Output |
|---|---|---|---|---|
| 1 | Capability auditor | `watchdog` | capability-auditor + trace | `01-capability-audit.md`, `controls.json` |
| 2 | Forge tracer | `logic-scripts` | forge + trace | `02-forge-trace.md`, `traces.json` |
| 3 | Forgewright lead | `integration-architect` | forgewright-lead + research + logic-gatekeeper + logic-debugger | `03-forgewright-fixes.md`, `fixes/` |

No seat edits another seat's output. Auditor/forge read-only. Lead may fix product code only after the per-bug research → gatekeeper → logic-debugger sequence. Lead does not restart the server; Lead does not touch the key. Final gates are Lead-owned.

## Method

- Inventory each tab from the rendered UI (Playwright/DOM) and source; record every link, button, form, input, select, filter, dialog, menu item and empty/error state.
- For each control: render → React handler → `web/src/api.ts` → Fastify route → server service/pipeline/DB/vault/LLM → response → client state/render.
- Use static `Grep/Read` and live network capture. Safe, read-only probes; do not start paid runs, do not delete, do not mutate settings.
- Record every hop as `path:line` or an observed HTTP/DOM/DB result. Missing hop = candidate defect.
- Verdict vocabulary: WIRED-AND-WORKS / WIRED-BUT-DEAD / MISSING / REFUSED-BY-NAME / UNVERIFIED.

## Gates

- Audit gate: all six tabs + detail controls inventoried with counts.
- Forge gate: each control has a chain table; defects have reproducible evidence and minimal fix seam.
- Fix gate: every fix has research note, logic-gatekeeper Phase 1 JSON, logic-debugger RED/GREEN, regression test, no test weakening.
- Lead final: typecheck, unit, E2E, stage, preflight, live smoke; trace skill updated with lessons.
