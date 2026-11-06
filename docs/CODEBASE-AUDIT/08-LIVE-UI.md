# 08 — Live UI proof (CUA + Playwright)

Date: 2026-11-05
Server: `http://127.0.0.1:8787`, B2, API online.
Visible browser: Chrome pid 11636, HiveRouter window brought to front; native CUA screenshot `docs/TRACE/WAVE-18/live/overview-visible.png`; current window after later launch is tracked in CUA evidence.

## CUA findings

- The native HiveRouter window is visible on screen with title `HiveRouter — AI Agent Coding Router - Google Chrome` and URL `127.0.0.1:8787`.
- CUA `bring_to_front` landed on the target (`landed_on_target:true`); `get_window_state` returned the accessibility tree and 1456×782 screenshot.
- CUA background click on a nav link returned `effect:"unverifiable"` / `synthetic_events` and did not navigate; foreground delivery navigated correctly to `/runs`. This is a Chromium/CUA delivery constraint, not an app defect.
- `browser_prepare` existing-profile attachment was refused with `browser_consent_required`. I did **not** override the profile consent or launch a second user-facing app instance.
- Consequently: native CUA is the visible-window proof; Playwright is the separate headless DOM/network test harness against the same server.

## Initial 5 trials

| ID | Trial | Expected | Result |
|---|---|---|---|
| T01 | Overview | 37 agents, 30 runs, unknown-spend warning, no page error | PASS; screenshot `pw-t01-overview.png`; CUA `overview-visible.png` |
| T02 | Runs status filter | `failed` returns exactly 3 failed rows, server-filtered | PASS; screenshot `t02-runs-failed-final.png` / `pw-t02-runs-failed.png` |
| T03 | Completed run detail | COMPLETED, Files artifacts, Search returns indexed result | PASS after probe locator corrections; `pw-t03-run-search.png` |
| T04 | Agents | 37 cards, Python search narrows, drawer opens/closes | PASS after probe locator correction; `pw-t04-agents.png` |
| T05 | Settings | key status/fingerprint visible, refresh works | PASS; `pw-t05-settings.png` |

## Designed 10 trials

| ID | Trial | Result |
|---|---|---|
| T06 | Vault tree + markdown preview + refresh | PASS; `pw-t06-vault.png` |
| T07 | Scripts: six read-only dry-runs enabled; bench/learn disabled | PASS; `pw-t07-scripts.png` |
| T08 | Analysis page + invalid-input refusal | PASS; API 4xx with named error; `pw-t08-analysis.png` |
| T09 | Learning refusal, no fake promotion | PASS; `pw-t09-learning.png` |
| T10 | Chat: 37 options, `of 3` cap, empty send disabled | PASS; `pw-t10-chat.png` |
| T11 | Mobile 390: menu opens, no horizontal overflow | PASS; `pw-t11-mobile.png` |
| T12 | Keyboard: run-tab ArrowRight selects Files | PASS; `pw-t12-keyboard.png` |
| T13 | Persisted terminal events visible | PASS; `pw-t13-events.png` |
| T14 | `/api/agents` 503 → named error + Retry restores 37 options | PASS; `pw-t14-chat-error-retry.png` |
| T15 | Stats truth: partial/NULL totals/unknown run spend, never zero | PASS; `pw-t15-stats-truth.png` |

**Result: 15/15 Playwright live trials pass.** No production defect was confirmed in these trials. Three initial failures were test-probe errors (case-sensitive text expectation, strict `ARTIFACTS` locator, agent-card name / scripts row locator); each was corrected in the temporary probe before rerunning. These are not product fixes and no product code was changed.

## Console/network sweep

10 routes (`/`, `/agents`, `/runs`, `/chat`, `/analysis`, `/scripts`, `/vault`, `/settings`, `/learning`, one completed run detail) were loaded with console/page-error and failed-request capture. **10/10 passed**: no page errors, no console errors, no failed non-stream requests. Screenshots: `sweep-*.png`.

## Visual checks

- Overview at 1440: no clipped headings, no overlap, honest unknown-spend notice visible.
- Runs failed filter: 3 rows, status/preset/spend columns readable; no horizontal overflow.
- Run detail: 9 tabs, Files/Artifacts and Search result visible; no clipping.
- Agents: 37 cards; search/filters; drawer close works.
- Settings: key fingerprint visible, balance says Not reported; no secret.
- Mobile 390: nav drawer opens and overlay is usable; document width 390; no horizontal overflow. The screenshot shows the intended open drawer, not a layout failure.
- Analysis: pure-static warning visible; no misleading verdict claim.
- Stats: total tokens/spend show `—`, not zero; measured spend `$1.1888`; unknown counts visible.

## Unverified by live probe

- Paid submits: Start run, Analyze prompt, Run agent, Revise/Audit submit, chat Send/fan-out. Only controls/payloads/keys were inspected; no provider call was made.
- Live Stop/cancel, live mid-run SSE, resume **success**, `E_ZIP_EMPTY` download refusal.
- Existing-profile CUA browser automation; refused by consent.
- Native desktop/CUA capability of the product itself: absent; CUA is external test tooling.
