# Test cards — TestDrive 20261103T2100Z

Order is mandatory. No live card may start while a run is active. Driver resolves accessible names/refs from the current CUA snapshot; never hardcode stale refs or pixels.

**Evidence rules (testdrive v1.1.1):** driver JSONL is flushed at action time, one line per action; typing/selecting asserts the visible `fieldValue` (mismatch = UNVERIFIED); each observer writes exactly one `phase_end` after the driver terminal (premature = quarantined); backend terminal records include a contiguous `eventRange {min,max,count}`; window geometry uses client-area ±20 px and records outer/inner; a CUA `page.title=about:blank` with matching heading/URL is a tooling false-negative, not a product failure.

## TD-01 — launch, window, navigation (no spend)
Preconditions: server healthy, window open, no active run.
Steps: native window bounds/zoom/iconic check; CUA isolated page open `/`; visit `/`, `/agents`, `/runs`, `/runs/:id` (first completed run), `/vault`, `/settings`, `/learning`, `/missing-td` (404); assert an `h1`/not-found and no page/console errors.
Geometry: record outer/inner client bounds; pass 1440×780 ±20 px client area; a frame-size delta (e.g., 1426×773) is accepted. Route pass requires visible heading + URL/path + visible tab/heading; title-only mismatch is tooling.
UI expected: HiveRouter title; 37 agent cards; run detail ID; learning refusal; 404.
Backend expected: health 200/B2, meta 200, agents 37, no 500s. Cost cap $0.
Evidence: driver screenshots; UI narrative; backend HTTP records.

## TD-02 — composer validation (no spend)
Preconditions: overview loaded.
Steps: empty brief → `Start run` disabled; short brief `<8` → disabled; fill valid brief; set `Max run cost` to `0`; click `Start run`; assert inline “Max cost must be a positive number”; assert no new run.
Evidence: after typing the short brief, read back the visible `fieldValue` and capture at action time; `5/8000` or equivalent must be visible. A `0/8000` capture or missing value is UNVERIFIED, not a pass.
UI expected: validation role alert; no navigation to run.
Backend expected: no `POST /api/runs`; no active run. Cost cap $0.

## TD-03 — blueprint live
Preconditions: no active run; balance ≥ $0.25.
Steps: valid brief; preset `Blueprint only`; max cost `0.05`; Start; wait for terminal run; open run detail; inspect report/files.
UI expected: run ID; completed; blueprint/report visible.
Backend expected: 202; phases; terminal completed; report artifact; cost < $0.05; first terminal record includes contiguous event range min/max/count. Cost cap $0.05.

## TD-04 — full-build live
Preconditions: no active run.
Steps: brief = “Create src/math_td.py with add(a,b) and tests/test_math_td.py using unittest; standard library only”; preset `Full build`; max cost `0.10`; Start; wait terminal; inspect files/checks.
UI expected: completed/completed_with_warnings; files and checks visible; no gate fail.
Backend expected: artifacts + manifest; mandatory checks pass; cost < $0.10; terminal event range contiguous min/max/count. Cost cap $0.10.

## TD-05 — ad-hoc agent live
Preconditions: no active run.
Steps: Agents page → `python-engine` card → drawer; Input “Write greet(name) returning Hello, name!”; Target `src/td_adhoc.py`; Mode live; Max cost `0.03`; Run agent; follow to run detail.
UI expected: run detail completed; artifact listed.
Backend expected: ad-hoc run; target artifact; cost < $0.03; terminal event range contiguous min/max/count. Cost cap $0.03.

## TD-06 — revision live
Preconditions: a completed run with artifacts exists; no active run.
Steps: open that run; Revise; feedback “Add a short module docstring, keep behavior”; submit; wait child run; compare parent artifacts unchanged.
UI expected: child run ID; completed.
Backend expected: child `parentRunId`; parent unchanged hash; cost < $0.05; terminal event range contiguous min/max/count. Cost cap $0.05.

## TD-07 — security/learning refusal (no spend)
Preconditions: server healthy.
Steps: Settings page shows key configured/source/fingerprint only; Learning page shows refusal and disabled tabs; no `sk-` pattern in body.
Backend expected: `/api/settings/key` POST → 403 `FORBIDDEN_PROVIDER_KEY_ACCESS`; `/api/learning/overview` → `enabled:false`, `E_LEARNING_POOL_EXHAUSTED`; no fake promotion. Cost $0.

## TD-08 — persistence and restart (no spend)
Preconditions: TD-01..TD-07 complete; no active run.
Steps: in CUA isolated profile, fill composer brief/max-cost; reload; assert draft survives. Lead stops/restarts server; driver reloads; assert health and draft survive; DB run count equals prior + completed test runs; relaunch desktop window if needed; verify 1440×780 geometry and not zoomed/iconic.
UI expected: draft restored; app healthy; window valid (client area 1440×780 ±20 px, outer/inner recorded).
Backend expected: same DB file/run count; no lost writes; startup interruption=0. Cost $0.

## Abort rules
Stop on key/balance failure, CUA bind failure, missing window, active run, server error, budget cap, destructive action, or missing observer evidence. Record BLOCKED with exact evidence; do not guess.
