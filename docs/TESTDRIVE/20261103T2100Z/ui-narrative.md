# TestDrive 20261103T2100Z — UI Watchdog Narrative

**Observer:** `watchdog` (UI watchdog, Phase 2)
**Mode:** read-only native observation. No clicks, typing, key reads, server restart, product edits, or shell UI automation.
**Evidence:** `ui-watch.jsonl` (276 append-only records, final `phase_end` seq 276), 272+ per-2.5s screenshots under `screenshots/uiw-*.png`, driver `driver.jsonl` and `screenshots/TD-*.png`, backend `backend-watch.jsonl`.
**Windows observed:** desktop `HiveRouter` 9765866 (pid 11112) at **1426×773, 87,40**, not minimized; CUA isolated driver 15140156 (pid 17248) at **886×633, 47,40**; an additional 1600×860 HiveRouter window (8192964) was on screen but not used by the driver. The desktop window stayed on Overview; all driver navigation occurred in the isolated CUA window.

**Overall:** the visible UI is coherent and matched most card expectations. **No page-error banner or broken page was visible** in any capture. Console errors and browser zoom were **not observable** through native `get_window_state`; they remain UNVERIFIED. The driver marked TD-02..TD-07 pass, TD-01 UNVERIFIED (stale title), TD-08 PARTIAL (restart blocked). The UI watchdog does not upgrade those claims.

## TD-01 — launch, window, navigation (driver: UNVERIFIED; UI visual: matched, with anomalies)

**Observed:** overview rendered with HiveRouter title, “Build with a routed factory, not a single bot.”, API online, Stage B2, 37 agents, 11 runs, 110,973/86,869 tokens, $0.0673 estimated spend. Provider card: Configured Yes, Source environment, Fingerprint shown (read-only), Balance “Not reported”. Start run was **disabled** with the empty brief (UIA `states.disabled=true`), despite its dark styling. The desktop window stayed on this page; the driver used its isolated window.

**Route-by-route:** `/agents` showed “37 of 37 shown”, group/output filters, and cards; router and architect showed UNVERIFIED + REGISTERED, architect also LIVE EVIDENCE, no schema-valid badge. `/runs` showed “11 of 11 shown”; `run_b8a8e239…` COMPLETED, `run_23af9b78…` BUDGET EXCEEDED. Run detail for `run_b8a8e239a57052f146` showed USER RUN, COMPLETED, DONE, 6 STEPS, LIVE STREAM, 31s, 6,225/5,635 tokens, snapshot, Parent None, and Refresh/Revise/Audit/Download. `/vault` showed 5 roots and `000_Hive_Control` logs. `/settings` showed the read-only provider key card; “Checked” and “Balance” were “Not reported”. `/learning` showed “Learning is unavailable”, reason `E_LEARNING_POOL_EXHAUSTED`, consent required, and all tabs visually disabled. `/missing-td` rendered “Page not found” with Return to overview.

**Anomalies:**
1. **HTTP 404 not observed.** The UI shows the 404 page, but `backend-watch.jsonl` records `/missing-td` as **HTTP 200 SPA fallback**, not 404. The card explicitly expects 404; UI status and HTTP status disagree. This is the main TD-01 gap.
2. **Driver title false-negative.** Every driver navigation logged `page.title=about:blank`; the actual tab title in every screenshot was `HiveRouter — AI Agent Coding Router` and the heading/path matched. This is a CUA snapshot/tooling anomaly, not visible UI. It caused the driver to mark TD-01 UNVERIFIED.
3. **Window geometry** 1426×773 vs the wave-sheet 1440×780 (14×7 px difference); not minimized and not iconic. Exact 1440×780 is **UNVERIFIED**.
4. **No console evidence.** Page errors were not observable; no visible error banner appeared. Console remains UNVERIFIED.

## TD-02 — composer validation (driver: PASS; UI visual: PASS, with one evidence inconsistency)

**Observed:** with the empty brief, Start run was disabled. Driver typed a short brief (log says 5 chars), then a 32-char valid brief, set Max run cost to `0`, and clicked Start run. The visible result was the inline alert **“Max cost must be a positive number.”**; no navigation, no new run, active run remained null. The alert screenshot is `TD-02-alert.png`; UIA shows `alert` + static text, Start run focused, brief `Create a tiny Python add module.` (32/8000), cost `0`.

**Anomaly:** `TD-02-short-brief.png` was captured at 21:28:12 and shows **0/8000**, not the 5-char brief the driver later logged; the short-brief sub-step lacks a matching visual capture. The valid-brief/0-cost/alert path is visually confirmed. Start run remains enabled with a valid brief and invalid cost so the click can produce the alert; that matches the card. No new run and no active run were observed.

## TD-03 — blueprint live (driver: PASS; UI visual: PASS-WITH-NOTES)

**Observed:** run `run_9b144184491ce0f41b`, brief “Create a tiny Python add module.”, preset Blueprint, COMPLETED, DONE, 1 STEP, LIVE STREAM, 9s, 535/1,533 tokens, snapshot, Parent None, estimated spend **$0.0010**. Driver reports BLUEPRINT.md artifact and cost $0.00100005 < $0.05. The artifact itself was below the captured viewport; the run ID, completed state, and cost are visible. No active run after completion.

## TD-04 — full-build live (driver: PASS; UI visual: PASS-WITH-NOTES)

**Observed:** run `run_063580525bb149f98d`, Full Build, RUNNING → Planning → Hardening → COMPLETED; during the run the page showed `RUNNING`, `PLANNING`/`HARDENING`, 1/5 steps, Stop enabled, Download disabled, duration/tokens still `—`. Final screenshot shows COMPLETED and Files tab with **src/math_td.py** and **tests/test_math_td.py** (2 artifacts), `CODE`, `PYTHON`, `CLEAN`, 983 bytes for `src/math_td.py`. Driver reports cost $0.007642302 < $0.10 and mandatory checks pass. The Checks tab was not captured above the fold; UI checks evidence is UNVERIFIED from screenshots alone.

## TD-05 — ad-hoc agent live (driver: PASS; UI visual: PASS-WITH-NOTES)

**Observed:** run `run_faf2600e5bf180b0dc`, ADHOC RUN, brief “Write greet(name) returning Hello, name!”, COMPLETED, DONE, 1 STEP, LIVE STREAM, 3s, 538/388 tokens, estimated spend **$0.0003**, Parent None. Driver reports `src/td_adhoc.py` and cost $0.0003135 < $0.03. The artifact is below the captured viewport; run completion and cost are visible.

## TD-06 — revision live (driver: PASS; UI visual: PASS)

**Observed:** parent `run_063580525bb149f98d` was opened; Revise modal appeared with “Revise this run”, parent-immutability copy, feedback “Add a short module docstring, keep behavior”, Cancel/Start revision. Child `run_32b087305f87bfa8bf` completed: REVISION RUN, COMPLETED, 2 STEPS, LIVE STREAM, 16s, 5,489/3,636 tokens, Parent link to `run_06358052…`, estimated spend **$0.0030**. Driver reports parent snapshotHash unchanged `19f380f5…`. Parent hash is not visible in the UI; driver/backend evidence is required.

## TD-07 — security/learning refusal (driver: PASS; UI visual: PASS)

**Observed:** Settings says the provider key is never accepted/displayed; Configured Yes, Source environment, Fingerprint shown, Checked/Balance “Not reported”; no key material visible. Learning page says “Learning is unavailable”, reason `E_LEARNING_POOL_EXHAUSTED`, consent required, tabs disabled, promotions empty; no promotion control is active. Driver reports `POST /api/settings/key` → **403 FORBIDDEN_PROVIDER_KEY_ACCESS**, and no `sk-` pattern was found. This matches the card; the “Not reported” balance is honest but less informative than the wave-sheet balance.

## TD-08 — persistence and restart (driver: PARTIAL; UI visual: PARTIAL)

**Observed:** brief “TD-08 draft persistence test” (28/8000) and the driver’s 0.11 max cost survived a browser reload; the draft is visibly restored. Driver reports run count 15, active null. **Server restart was not allowed**, so DB-count equality after restart and process-restart persistence are UNVERIFIED. Native window is 1426×773, not 1440×780; not minimized/iconic, but the exact geometry check is UNVERIFIED. TD-08 cannot be marked pass.

## Dead/misleading control observations

- **Start run** is disabled with an empty brief (verified via UIA) but rendered dark like an enabled button; the affordance is ambiguous, though the control behaves correctly.
- **Download** is disabled while a run is running and appears only for terminal runs with artifacts; no dead download observed.
- **Learning tabs** are clearly disabled and the page says all sections are unavailable; no fake promotion.
- **Run detail “LIVE STREAM”** remains visible on a COMPLETED/DONE run; it denotes the SSE connection, but could be read as a live-run status. Completed/Done badges are adjacent, so this is a minor copy risk, not a dead control.
- **Settings “Checked” / “Balance”** show “Not reported”; this is honest, but the wave sheet expected a balance. No false value is shown.
- **Overview “Learning feature: enabled”** while Learning says unavailable is explained by “Availability depends on consent and the sealed evaluation pool”; not misleading enough to call a defect.

## Final UI-watchdog verdict

- **TD-01: UNVERIFIED** — UI visual match, but HTTP 404 absent and driver title stale.
- **TD-02: PASS (UI)** — alert and no-run behavior visually confirmed; short-brief screenshot inconsistent.
- **TD-03, TD-04, TD-05: PASS-WITH-NOTES (UI)** — completed/cost visible; artifact/check details below fold or driver-only.
- **TD-06, TD-07: PASS (UI)** — child run/parent link and security/refusal states visible.
- **TD-08: PARTIAL/UNVERIFIED** — draft restore visible; restart/DB persistence and exact geometry not verified.
- **No page/console errors observed**; console and zoom remain UNVERIFIED.
- **No product edits, clicks, typing, key access, or server restart** were performed by this observer. All screenshots and JSONL are evidence, not a pass claim.
