# FIX2 defects and assignments — TestDrive 20261103T2100Z

Source: `defects.md` (matcher) + Lead addendum from UI/backend narratives and screenshots.

| ID | Severity | Test | Defect | Owner | Disposition |
|---|---|---|---|---|---|
| TD1-D01 | P3 | TD-01 | Unknown HTML route returns 200 SPA fallback; card expects 404 | `td-fix-native` | Status 404 for unknown client routes only; known SPA routes (incl. `/runs/:id`) stay 200; API 404 unchanged |
| TD1-D02 | P3 | TD-01/08 | Native window client area 1426×773 vs requested 1440×780 | `td-fix-experience` | Scope test cards to client-area tolerance ±20 px and record outer/inner; no product geometry change |
| TD1-D03 | P1 | TD-02..08 | Driver timestamps are flushed at card end (only 1/37 correlates) | `td-fix-experience` | Update testdrive skill: write/flush each action line at action time; include snapshotId/value; no batching |
| TD1-D04 | P1 | PHASE | UI watchdog wrote premature `phase_end` (seq 176), then continued to 276 | `td-fix-experience` | Update skill: exactly one phase_end after driver; premature marker quarantined/superseded |
| TD1-D05 | P2 | TD-08 | No server restart in drive; restart/DB/window persistence unverified | Lead | Lead performs restart now and records evidence; skill remains Lead-owned |
| TD1-D06 | P2 | TD-04/05 | Backend watchdog first event ranges omitted queued events; corrected later | `td-fix-experience` | Update skill: wait for terminal, record min/max/count and contiguous check before first verdict |
| TD1-D07 | P3 | TD-02 | Short-brief screenshot shows 0/8000, not 5 chars; driver claimed pass | `td-fix-experience` | Update skill: assert field value after type; missing value => UNVERIFIED |
| TD1-D08 | P3 | TD-01 | CUA post-navigation `page.title=about:blank` false-negative | `td-fix-experience` | Update skill: route pass requires heading/URL/visible tab title; title-only false negative recorded as tooling, not product |
| TD1-D09 | P2 | TD-01..08 | Completed run detail still shows “Live stream” badge | `td-fix-ui` | Hide/close SSE when terminal; show “Complete · snapshot”; add E2E |
| TD1-D10 | P2 | residual | JSON-repair retries share one budget reservation; repair storm can overcommit | `td-fix-core` | Reproduce RED, minimal reservation/repair fix or BLOCKED with evidence |

Not product defects: D02 (frame/client geometry), D05 (policy/Lead), D06/D07/D08 (evidence harness). Do not change product code for those.

## Clarifications applied by `td-fix-experience` (skill v1.1.1)

The following are harness/skill changes only; no product code was edited.

- **TD1-D02:** accepted as a client-area tolerance issue. TestDrive v1.1.1 records outer/inner bounds and passes when the client area is within **±20 px** of 1440×780; a 1426×773 frame delta is accepted. No product geometry change requested. See skill §Evidence integrity rule 5 and `TEST-CARDS.md` TD-01/TD-08.
- **TD1-D03:** driver must **flush each action record at action time**, before the next action; no card-end batching. Records must include `snapshotId`, intended `value`, and observed `fieldValue`. This restores the 1.5 s correlation window. See skill rules 1 and log schema.
- **TD1-D04:** each observer writes **exactly one `phase_end`**, after the driver terminal record. The premature seq 176 marker is quarantined/superseded by the final seq 276; it must not be used as a card verdict. See skill rule 3.
- **TD1-D06:** backend terminal verdicts must include a **contiguous `eventRange {min,max,count}`**; tail-sampled ranges (e.g., TD-04 337–368 before correction to 332–368) are not terminal evidence and must be re-read. See skill rule 4.
- **TD1-D07:** after type/select, the driver must assert the visible field value; a short-brief capture showing `0/8000` or a missing value is **UNVERIFIED**, not a pass. See skill rule 2 and `TEST-CARDS.md` TD-02.
- **TD1-D08:** route pass requires visible heading + URL/path + visible tab/heading. A CUA `page.title=about:blank` while screenshots/heading match is a **tooling false-negative**; re-bind/refresh and record it, never fail the product on title alone. See skill rule 6.
- **TD1-D05** remains Lead-owned (server restart/persistence was not performed); this seat did not restart or touch the key.
- **TD1-D09/D10** remain with their assigned owners; no cross-scope edits were made.

## Fix rules

Only owned paths; RED before edit; minimal fix; GREEN; add regression test; do not touch other seats; no server restart/key access/paid runs; update `fixes/td-*.md`; report DONE/PARTIAL/BLOCKED with evidence.
