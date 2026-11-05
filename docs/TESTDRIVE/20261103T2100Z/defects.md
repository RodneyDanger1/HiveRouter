# Matcher defects — TestDrive 20261103T2100Z

**Count:** 8 (2 product P3; 2 evidence P1; 2 evidence P2; 2 evidence P3).
**Rule:** every card pass requires driver + UI + backend evidence within 1.5 s; missing/ambiguous is UNVERIFIED. Defects below are evidence-backed; no product edits were made.

```yaml
id: TD1-D01
severity: P3
testId: TD-01
observed: HTTP GET /missing-td returned 200 SPA fallback (same index.html), while the UI rendered a Page-not-found card.
expected: Card TD-01 expects HTTP 404 for an unknown route.
repro: `curl -i http://127.0.0.1:8787/missing-td` -> HTTP 200; backend-watch seq 2 records `/missing-td returned 200 SPA fallback (not HTTP 404)`; screenshot `TD-01-missing.png` shows Page not found.
suspected: src/server/app.ts:735-737 (`setNotFoundHandler` sends index.html without a 404 status).
owner: td-fix-native
evidence: [driver seq 12, backend-watch line 3/seq 2, ui-narrative TD-01 anomaly 1, mapping card TD-01]
```

```yaml
id: TD1-D02
severity: P3
testId: TD-01 / TD-08
observed: Native HiveRouter window is 1426x773 at 87,40; the wave baseline requires 1440x780.
expected: 1440x780, not zoomed/iconic.
repro: UI watchdog notes bounds=1426x773 repeatedly; driver seq 2 note; backend-watch seq 12 note `14x7 short`.
suspected: scripts/launch-desktop.ps1:69-76 (working-area minus 80; Chrome window-size/frame).
owner: td-fix-native
evidence: [driver seq 2, ui-watch seq 2/31/276, backend-watch seq 12, ui-narrative TD-01 anomaly 3]
```

```yaml
id: TD1-D03
severity: P1
testId: TD-02..TD-08
observed: 36 of 37 driver steps fail the 1.5 s UI/backend correlation; only driver seq 8 passes. Driver records TD-02 seq 13-15 are stamped 21:32:58 but their screenshots are 21:28:12/21:32:31/21:32:44; TD-04..TD-08 records are all stamped 21:41:20-21 while screenshots/states are 21:36:03-21:40:54.
expected: Each driver record's `ts` is the action time, bracketed by a snapshot/verify; a 1.5 s matcher must be able to align it.
repro: Compare `driver.jsonl` seq 13-15/26-35 timestamps with screenshot file mtimes and `state-TD04-brief.json`/`state-TD08-*` mtimes; `timeline.json.correlationSummary` = 1 pass / 36 unverified.
suspected: driver logging/flush buffer (records written at card completion, not at action time); no product file implicated.
owner: lead
evidence: [driver seq 1-37, timeline.json correlations, screenshot/state mtimes, mapping step table]
```

```yaml
id: TD1-D04
severity: P1
testId: PHASE / TD-03..TD-08
observed: UI watchdog wrote `phase_end` at seq 176 / 21:35:39 claiming “no TD-03..TD-08 evidence,” then continued observing and wrote final seq 276 / 21:42:05.
expected: One phase_end after the driver stops; a terminal phase log must not be superseded.
repro: `Select-String ui-watch.jsonl phase_end` returns line 176 and line 276; driver/backend show TD-03..TD-06 ran 21:33-21:39, after seq 176.
suspected: UI watchdog phase-end logic (premature termination); no product edit.
owner: lead
evidence: [ui-watch seq 176 and 276, backend-watch seq 4-7, backend-narrative §TD-03 “watchdog miss”, ui-narrative header]
```

```yaml
id: TD1-D05
severity: P2
testId: TD-08
observed: Draft reload restored brief (28/8000) and driver says max cost 0.11; server restart was not performed; no DB-count-after-restart or process-restart persistence evidence.
expected: Lead stops/restarts server, driver reloads, draft survives, DB run count equals prior + completed test runs, window geometry valid.
repro: driver seq 36 result=unknown “BLOCKED: no server restart”; backend seq 12 “no restart observed; pid 20248 unchanged”; health continuous.
suspected: test execution policy (driver cannot restart); not a product defect.
owner: lead
evidence: [driver seq 34-36, backend-watch seq 12, ui-watch seq 275, ui-narrative TD-08]
```

```yaml
id: TD1-D06
severity: P2
testId: TD-04 / TD-05
observed: Backend watchdog first reported TD-04 event range 337-368 and TD-05 371-379, then corrected them to 332-368 and 369-379 in later records.
expected: First terminal record contains the complete contiguous event range.
repro: backend-watch seq 5 vs seq 9 (TD-04), seq 6 vs seq 10 (TD-05).
suspected: backend watchdog tail sampling before queued/start events; no product defect.
owner: lead
evidence: [backend-watch seq 5/9, seq 6/10, backend-narrative TD-04/TD-05]
```

```yaml
id: TD1-D07
severity: P3
testId: TD-02
observed: `TD-02-short-brief.png` was captured at 21:28:12 and shows 0/8000, not the driver's 5-char brief; the short-brief sub-step has no matching visual capture.
expected: Visual evidence of the 5-char brief and disabled Start run.
repro: Open screenshot `TD-02-short-brief.png`; driver seq 13 note “5-char brief; Start run disabled”; ui-narrative TD-02 anomaly.
suspected: driver capture/timing; no product defect.
owner: lead
evidence: [driver seq 13, screenshot TD-02-short-brief.png, ui-narrative TD-02, mapping]
```

```yaml
id: TD1-D08
severity: P3
testId: TD-01
observed: Driver logged `page.title=about:blank` after every navigation (seq 5-12, 16-22), while screenshots/UI watchdog show `HiveRouter — AI Agent Coding Router` and correct route content.
expected: CUA post-navigation page title matches the visible page.
repro: driver seq 5-12/16-22 notes; `screenshots/TD-01-*.png` title bars; ui-narrative TD-01 anomaly 2.
suspected: CUA snapshot/binding false-negative, not a product defect; it caused TD-01 to be UNVERIFIED.
owner: lead
evidence: [driver seq 5-12/16-22, ui-narrative TD-01 anomaly 2, ui-watch seq 274]
```

## Triage note

- **Product defects for Phase 3:** TD1-D01 (404 status) and TD1-D02 (window geometry) only. Both are P3.
- **Test-evidence defects:** TD1-D03/D04 are P1 and block a clean DRIVE_GATE; TD1-D05/D06 are P2; TD1-D07/D08 are P3. These belong to the Lead/driver/watchdog, not a product fixer.
- **No fake completion or promotion:** TD-03..TD-06 have terminal `run.completed`, artifacts, contiguous event ranges, and cost under caps; TD-07 learning is refused; no promotion success.
- **Missing/ambiguous evidence remains UNVERIFIED**; the card table’s outcome passes are not upgraded to matcher passes.
