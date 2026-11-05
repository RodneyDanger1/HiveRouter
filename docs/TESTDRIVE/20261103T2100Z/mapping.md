# Matcher mapping — TestDrive 20261103T2100Z

**Inputs:** `driver.jsonl` (37 records), `ui-watch.jsonl` (276), `backend-watch.jsonl` (13), screenshots, `ui-narrative.md`, `backend-narrative.md`.
**Correlation rule:** `testId` + `runId`/`eventSeq` + UTC milliseconds, tolerance **1500 ms**; missing/ambiguous = `UNVERIFIED`.
**Phase ends:** driver `2026-11-03T21:41:21.069Z`; UI `2026-11-03T21:42:05.711Z`; backend `2026-11-03T21:42:42.833Z`.
**Result:** **1 driver step (seq 8) satisfies both UI and backend time correlation; 36/37 are UNVERIFIED under the stated rule.** Card-level outcomes agree for TD-02..TD-07 (driver + backend + UI/screenshots), but the driver log timestamps for TD-02..TD-07 were flushed at `21:41:20–21:41:21`, 2–13 minutes after the visible actions. The matcher therefore records **PASS (outcome) / UNVERIFIED (temporal)** rather than claiming a clean pass.

## Card-level mapping

| Time (UTC) | Test | Driver action/result | UI observation | Backend event/DB | Verdict |
|---|---|---|---|---|---|
| 21:23:40–21:25:02 | TD-01 | 12 real steps + 7 remediation steps; 7 pass, 12 unknown | 43 UI records; visible HiveRouter chrome, 37 agents, runs, vault, settings, learning refusal, Page-not-found | #2: all routes 200/304; no 500; `/missing-td` **200 SPA fallback**, not 404; active null | **UNVERIFIED** — HTTP 404 absent, driver `page.title=about:blank`, per-step backend not recorded |
| 21:28:04–21:32:58 | TD-02 | short brief disabled; cost 0 + Start → inline alert; no run | 131 UI records; alert screenshot `TD-02-alert.png`; start state restored | #3: no POST `/api/runs`; run count 11→11; active null | **PASS (outcome) / UNVERIFIED (temporal)** — short-brief screenshot shows 0/8000, not 5 chars |
| 21:33:47–21:35:49 | TD-03 | preset Blueprint; POST → run `run_9b…`; completed BLUEPRINT.md; cost $0.00100005 | 28 UI records; completed run detail, $0.0010 | #4: 202→completed; events 323–331 contiguous; 1 artifact; cost < $0.05 | **PASS (outcome) / UNVERIFIED (temporal)** |
| 21:36:26–21:41:20 | TD-04 | Full build; run `run_063…`; completed two files; cost $0.007642302 | 24 UI records; completed, Files tab, 2 artifacts | #5/#9: 202→completed; events **332–368**; 5 checks pass; cost < $0.10 | **PASS (outcome) / UNVERIFIED (temporal)** |
| 21:38:37–21:41:20 | TD-05 | ad-hoc python-engine; `run_faf…`; completed `src/td_adhoc.py`; cost $0.0003135 | 20 UI records; ADHOC RUN completed, $0.0003 | #6/#10: 202→completed; events **369–379**; 4 checks pass; cost < $0.03 | **PASS (outcome) / UNVERIFIED (temporal)** |
| 21:39:31–21:41:20 | TD-06 | revision child `run_32b…`; parent `run_063…`; completed; cost $0.00300495 | 3 UI records; REVISION RUN completed; parent link | #7: 380–394; parent hashes unchanged; cost < $0.05 | **PASS (outcome) / UNVERIFIED (temporal)** |
| 21:40:09–21:41:20 | TD-07 | Settings/Learning refusal; POST key route 403; no `sk-` | 15 UI records; key configured/source/fingerprint; Learning `E_LEARNING_POOL_EXHAUSTED`, tabs disabled | #11: POST key 403 `FORBIDDEN_PROVIDER_KEY_ACCESS`; learning 200 enabled:false; no promotion | **PASS (outcome) / UNVERIFIED (temporal)** |
| 21:40:39–21:41:21 | TD-08 | draft filled/reloaded; brief + 0.11 restored; restart blocked | 6 UI records; brief 28/8000 restored; native 1426×773 | #12: no restart; pid/launch.log unchanged; 15 runs, 0 interrupted; geometry 1426×773 | **PARTIAL / UNVERIFIED** — restart, DB-after-restart, exact 1440×780 not proven |

## Driver-step correlation

| Driver time (UTC) | Test | Driver step (seq, result) | UI observation | Backend event/DB | Verdict |
|---|---|---|---|---|---|
| 21:23:40.765 | PHASE | #1 phase_start (pass) | — | — | UNVERIFIED |
| 21:23:40.890 | TD-01 | #2 native_window_check (pass) | ui #2 Δ6842ms | be #2 Δ178175ms | UNVERIFIED |
| 21:23:40.905 | TD-01 | #3 browser_prepare (pass) | ui #2 Δ6827ms | be #2 Δ178160ms | UNVERIFIED |
| 21:23:40.921 | TD-01 | #4 browser_bind (pass) | ui #2 Δ6811ms | be #2 Δ178144ms | UNVERIFIED |
| 21:23:40.952 | TD-01 | #5 navigate_root (pass) | ui #2 Δ6780ms | be #2 Δ178113ms | UNVERIFIED |
| 21:24:04.937 | TD-01 | #6 route_agents (pass) | ui #7 Δ2475ms | be #2 Δ154128ms | UNVERIFIED |
| 21:24:10.836 | TD-01 | #7 route_runs (pass) | ui #8 Δ2515ms | be #2 Δ148229ms | UNVERIFIED |
| 21:24:15.264 | TD-01 | #8 route_run-detail (pass) | ui #10 Δ522ms | be #2 Δ143801ms | **PASS** |
| 21:24:22.614 | TD-01 | #9 route_vault (pass) | ui #12 Δ2734ms | be #2 Δ136451ms | UNVERIFIED |
| 21:24:38.377 | TD-01 | #10 route_settings (pass) | ui #14 Δ1051ms | be #2 Δ120688ms | UNVERIFIED |
| 21:24:51.874 | TD-01 | #11 route_learning (pass) | ui #16 Δ1389ms | be #2 Δ107191ms | UNVERIFIED |
| 21:25:02.828 | TD-01 | #12 route_missing (pass) | ui #18 Δ1734ms | be #2 Δ96237ms | UNVERIFIED |
| 21:32:58.183 | TD-02 | #13 short_brief (pass) | ui #126 Δ729ms | be #3 Δ129779ms | UNVERIFIED (screenshot Δ285225ms) |
| 21:32:58.245 | TD-02 | #14 cost_zero (pass) | ui #126 Δ791ms | be #3 Δ129841ms | UNVERIFIED (screenshot Δ27203ms) |
| 21:32:58.277 | TD-02 | #15 submit_invalid_cost (pass) | ui #126 Δ823ms | be #3 Δ129873ms | UNVERIFIED (screenshot Δ13602ms) |
| 21:35:48.709 | TD-01 | #16 route_agents (unknown) | ui #273 Δ376987ms | be #8 Δ403215ms | UNVERIFIED |
| 21:35:48.834 | TD-01 | #17 route_runs (unknown) | ui #273 Δ376862ms | be #8 Δ403090ms | UNVERIFIED |
| 21:35:48.866 | TD-01 | #18 route_run-detail (unknown) | ui #273 Δ376830ms | be #8 Δ403058ms | UNVERIFIED |
| 21:35:48.881 | TD-01 | #19 route_vault (unknown) | ui #273 Δ376815ms | be #8 Δ403043ms | UNVERIFIED |
| 21:35:48.912 | TD-01 | #20 route_settings (unknown) | ui #273 Δ376784ms | be #8 Δ403012ms | UNVERIFIED |
| 21:35:48.944 | TD-01 | #21 route_learning (unknown) | ui #273 Δ376752ms | be #8 Δ402980ms | UNVERIFIED |
| 21:35:48.975 | TD-01 | #22 route_missing (unknown) | ui #273 Δ376721ms | be #8 Δ402949ms | UNVERIFIED |
| 21:35:48.991 | TD-03 | #23 start_blueprint (pass) | ui #177 Δ19199ms | be #4 Δ81390ms | UNVERIFIED |
| 21:35:49.022 | TD-03 | #24 completed_blueprint (pass) | ui #177 Δ19168ms | be #4 Δ81421ms | UNVERIFIED |
| 21:41:20.635 | TD-02 | #25 browser_tool_attempts (pass) | ui #175 Δ350181ms | be #3 Δ632231ms | UNVERIFIED |
| 21:41:20.760 | TD-04 | #26 start_fullbuild (pass) | ui #228 Δ145506ms | be #9 Δ71947ms | UNVERIFIED |
| 21:41:20.787 | TD-04 | #27 completed_fullbuild (pass) | ui #228 Δ145533ms | be #9 Δ71920ms | UNVERIFIED (screenshot Δ224178ms) |
| 21:41:20.819 | TD-05 | #28 start_adhoc (pass) | ui #248 Δ83769ms | be #10 Δ72809ms | UNVERIFIED |
| 21:41:20.834 | TD-05 | #29 completed_adhoc (pass) | ui #248 Δ83784ms | be #10 Δ72794ms | UNVERIFIED (screenshot Δ143042ms) |
| 21:41:20.866 | TD-06 | #30 start_revision (pass) | ui #251 Δ72605ms | be #7 Δ48054ms | UNVERIFIED |
| 21:41:20.897 | TD-06 | #31 completed_revision (pass) | ui #251 Δ72636ms | be #7 Δ48085ms | UNVERIFIED (screenshot Δ82709ms) |
| 21:41:20.928 | TD-07 | #32 settings_learning_refusal (pass) | ui #266 Δ27554ms | be #11 Δ80110ms | UNVERIFIED |
| 21:41:20.959 | TD-07 | #33 key_route_403 (pass) | ui #266 Δ27585ms | be #11 Δ80079ms | UNVERIFIED |
| 21:41:20.975 | TD-08 | #34 draft_fill (pass) | ui #272 Δ8692ms | be #12 Δ80963ms | UNVERIFIED |
| 21:41:21.022 | TD-08 | #35 draft_reload (pass) | ui #272 Δ8739ms | be #12 Δ80916ms | UNVERIFIED (screenshot Δ26518ms) |
| 21:41:21.053 | TD-08 | #36 restart_portion (unknown) | ui #272 Δ8770ms | be #12 Δ80885ms | UNVERIFIED |
| 21:41:21.069 | PHASE | #37 phase_end (unknown) | — | — | UNVERIFIED |

## Evidence notes

- **Driver timestamp integrity:** records seq 13–15 (TD-02) are stamped `21:32:58` but the alert screenshot is `21:32:44` and the short-brief screenshot `21:28:12`; seq 26–35 (TD-04..TD-08) are all stamped `21:41:20–21` while their screenshots/states are `21:36:03–21:40:54`. The timestamps are flush times, not action times. This is why 36/37 steps fail the 1.5 s rule even where card outcomes agree.
- **UI watchdog:** final `phase_end` seq 276 at `21:42:05`; an earlier `phase_end` at seq 176/`21:35:39` claimed no TD-03..TD-08 evidence, which is false: driver/backend TD-03..TD-06 ran 21:33–21:39. Quarantine seq 176; final seq 276 supersedes it.
- **Backend:** corrected event ranges in seq 9/10: TD-04 `332–368` (not 337–368), TD-05 `369–379` (not 371–379). Final run count 15, active null, 0 interrupted, global events 1..394 contiguous.
- **No fake completion / no promotion:** TD-03..TD-06 terminal states have artifacts and terminal `run.completed`; TD-07 learning is disabled/refused; no promotion success.
- **Missing/ambiguous = UNVERIFIED**, per the TestDrive invariant. The card table's “PASS (outcome)” is not a substitute for per-step temporal evidence.
