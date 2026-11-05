# Observation prompts — TestDrive 20261103T2100Z

## Driver (`learning-loop`)

Workspace: `C:\Users\Riley\Desktop\HiveRouter`. Read the `cua-driver` skill and `docs/TESTDRIVE/20261103T2100Z/TEST-CARDS.md`.

Use `cua-driver` page automation only. Prepare the reusable driver-owned profile:
`browser_prepare {"session":"td-driver","allow_launch":true,"profile":{"mode":"isolated_named","name":"hive-testdrive"}}`.
Find the prepared pid/window, bind `get_browser_state`, use `browser_navigate` to `http://127.0.0.1:8787/`. For every action: take a fresh snapshot, resolve the ref from that snapshot, act, then verify with a fresh snapshot or `verify_state`. Never reuse stale refs. Never use shell-driven UI or Playwright. No destructive actions, no key entry.

Execute TD-01..TD-08 in order. Before each live card, confirm no active run from the visible Runs page. Wait for terminal state before the next card. Stop on any card failure, missing server/window, CUA setup failure, budget cap, or destructive risk; write BLOCKED with evidence.

Write append-only `docs/TESTDRIVE/20261103T2100Z/driver.jsonl`:
`{"ts":"<UTC ISO>","seq":N,"source":"driver","testId":"TD-01","step":"...","action":"...","target":"...","url":"...","runId":null,"eventSeq":null,"windowId":"...","result":"pass|fail|unknown","screenshot":"...","note":"..."}`.
Write screenshots under `screenshots/`. At the end write `driver.md` with a card-by-card English account and `phase_end` log record.

## UI watchdog (`watchdog`)

Read the test cards. Observe the CUA browser window and the real desktop `HiveRouter` window (native `get_window_state` / screenshots/geometry) every 2–3 seconds while the driver acts. Read-only; no product edits, no clicks, no key access, no server restart.

Write `ui-watch.jsonl` with same `ts`/`seq`/`testId`/`result`/`screenshot`/`note` fields. Write `ui-narrative.md`: for each card, what was visible, what changed, what looked wrong, window geometry/zoom/minimize state, console/page errors, dead controls, misleading copy, and what the driver appeared to do in plain English. Mark anything not visible as UNVERIFIED, never pass.

## Backend watchdog (`plan-audit-core`)

Read the test cards. Observe read-only: `data/logs/desktop-server.log`, `GET /api/runs/active`, `/api/runs`, `/api/runs/:id`, `/api/runs/:id/events`, `/api/stats`, and SQLite rows. Record request/status/runId/eventSeq/artifact/DB effects.

Write `backend-watch.jsonl` (`source:"backend-watch"`) and `backend-narrative.md`. Flag false “completed”, missing events, non-terminal waits, budget overruns, 500s, active-run collisions, and restart gaps. No edits/restarts.

## Matcher (`algorithm-forge`)

Read the driver, UI, and backend logs. Write `timeline.json` and `mapping.md`:
- Key: `testId`; use `runId`/`eventSeq` where present; UTC ms tolerance 1.5 s.
- Table: time · test · driver action/result · UI observation · backend event/DB · verdict.
- Every driver step must map to a UI observation and, for run/API steps, a backend event. Missing/ambiguous = `UNVERIFIED`.
- Write `defects.md` using the defect schema (severity/test/observed/expected/repro/file:line/owner/evidence).
- Stop at `phase_end`; no edits to product or logs.
