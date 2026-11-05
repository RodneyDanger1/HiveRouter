# Backend Watch Narrative — TestDrive 20261103T2100Z

**Role:** backend watchdog (read-only) · **Driver:** `learning-loop` · **Window:** 21:20:50Z–21:42:42Z (15:20–15:42 CST).
**Inputs:** `data/logs/desktop-server.log`, `data/logs/desktop-server.err.log`, `data/logs/launch.log`, live `GET /api/runs/active`, `/api/runs`, `/api/runs/:id`, `/api/runs/:id/events`, `/api/stats`, and read-only SQLite `data/hive.db`.
**Output:** `backend-watch.jsonl` (13 append-only records, seq 1–13) + this narrative.
**Verdict by backend:** **PASS for TD-02 through TD-07**; **TD-01 UNVERIFIED** by cross-observer contradiction; **TD-08 PARTIAL/BLOCKED** (restart not performed). No false completion, missing run event, active-run collision, 5xx, or driver-card budget overrun was observed.

---

## 1. Baseline → final state

| Measure | Baseline 21:21:37Z | Final 21:42:42Z |
|---|---|---|
| `runs` rows | 11 | **15** (+4: TD-03, TD-04, TD-05, TD-06) |
| Active runs (queued/running/paused/needs_review) | 0 | **0** |
| `interrupted` runs | — | **0** |
| Global event seq | 322 | **394**, contiguous 1..394 |
| Sum `runs.cost_usd` | 0.042339426 (DB) / stats 0.067318518 | **0.054300228** (DB) |
| `desktop-server.log` status counts | — | 200:518, 202:4, 304:131, 403:4, 404:10, 422:1, **5xx:0** |
| `desktop-server.err.log` | 0 bytes | 0 bytes |
| Server pid / launcher | 20248, launcher start 15:19:10 | **same pid; no restart** |

`/api/stats` at phase start reported `runCount:11`, `totalCostUsd:0.067318518`; final DB sum is 0.054300228 (stats includes other aggregated usage). No run row was lost.

---

## 2. Card-by-card backend evidence

### TD-01 — launch/navigation (backend PASS, card UNVERIFIED)
- All page/API requests observed returned **200 or 304**: `/agents` 200, `/runs` 200, `/runs/run_b8a8e239a57052f146` 200 + snapshot 200, `/vault` 200 + `/api/vault/tree` 200, `/settings` 200 + `/api/settings` and key-status 200, `/learning` 200 + `/api/learning/overview` 200, `/api/agents` 200.
- `/missing-td` returned **200 SPA fallback**, not HTTP 404; no 500.
- No run created; active null; event count unchanged at 322.
- **Cross-observer contradiction:** driver marks TD-01 UNVERIFIED because post-navigation `page.title=about:blank` (seq16–22); UI watchdog phase_end at 21:35:39 claims only TD-01/TD-02 observed and no TD-03.. evidence. The backend HTTP slice itself passed; card overall is **UNVERIFIED** until driver/UI evidence agrees.

### TD-02 — composer validation (PASS)
- **No POST `/api/runs` from the driver**; no run created; active null; run count remained 11.
- The only POST `/api/runs` near the start was **21:20:04.308Z, HTTP 422**, before driver start (21:23:40) and before TD-02; it created no row — baseline E2E traffic, not the driver.
- Driver reported inline alert “Max cost must be a positive number.”; backend effect matches a pure client-side validation (no API mutation).

### TD-03 — blueprint live (PASS)
- Run **`run_9b144184491ce0f41b`**: POST 202 → `completed`, 21:33:47.494Z→21:33:56.711Z.
- Events **seq 323–331** (9): `run.queued` 323, `run.started` 324, phase/agent 325–330, **`run.completed` 331**; contiguous.
- Cost **$0.00100005** < $0.05; prompt 535 / completion 1533; 1 step; 0 checks (blueprint expected); 1 artifact **`BLUEPRINT.md`** (1191 bytes, sha256 `fc5616af…`).
- Active null after terminal; no collision.
- **Watchdog miss:** UI watchdog phase_end at 21:35:39 says “no TD-03.. evidence,” but driver seq23–24 records TD-03 start/completed with the same run ID at 21:35:48–49; the UI watchdog ended before the driver logged. Matcher should quarantine the UI-watch phase_end, not the run.

### TD-04 — full-build live (PASS)
- Run **`run_063580525bb149f98d`**: 202 → `completed`, 21:36:26.302Z→21:37:20.283Z.
- Events **seq 332–368** (37; corrected from the earlier tail view that started at 337); `run.completed` **368**; contiguous.
- Cost **$0.007642302** < $0.10; prompt 10993 / completion 10083; 6 steps; 5 checks all `pass` (`plan.coverage`, `secret.scan`, `stub.scan`, `verification.plan`, `syntax.all`).
- Artifacts **`src/math_td.py`** 983 bytes and **`tests/test_math_td.py`** 3194 bytes; active null after terminal.

### TD-05 — ad-hoc agent live (PASS)
- Run **`run_faf2600e5bf180b0dc`**: `preset:adhoc`, `runKind:adhoc`, brief `Write greet(name) returning Hello, name!`; 202 → `completed`, 21:38:37.576Z→21:38:40.184Z.
- Events **seq 369–379** (11; corrected from 371); `run.completed` **379**; contiguous.
- Cost **$0.0003135** < $0.03; prompt 538 / completion 388; 1 step; 4 checks all pass; artifact **`src/td_adhoc.py`** 938 bytes.
- Active null after terminal; no second run.

### TD-06 — revision live (PASS)
- Child **`run_32b087305f87bfa8bf`**, `parentRunId=run_063580525bb149f98d`; 202 → `completed`, 21:39:31.451Z→21:39:47.738Z.
- Events **seq 380–394** (15); `run.completed` **394**; contiguous.
- Cost **$0.00300495** < $0.05; prompt 5489 / completion 3636; 2 steps; 4 checks all pass.
- Child artifacts: `src/math_td.py` sha256 `4156d490…`, `tests/test_math_td.py` sha256 `2cb289db…`.
- **Parent immutability:** parent `run_063…` artifact hashes before and after were identical (`e0f5615b…` / `9403d3df…`); parent bytes unchanged (983/3194).
- Active null after terminal.

### TD-07 — security/learning refusal (PASS)
- `POST /api/settings/key` returned **403 `FORBIDDEN_PROVIDER_KEY_ACCESS`** (driver probes at 21:40:20.638 and 21:40:25.653; baseline probes also 403).
- `/api/learning/overview` returned **200** with `enabled:false`, `reason:"E_LEARNING_POOL_EXHAUSTED"`, 0 blocks/0 consents/0 promotions.
- No run created; no promotion endpoint success; no fake learning evidence.
- No 5xx.

### TD-08 — persistence/restart (PARTIAL / UNVERIFIED)
- Driver reports draft brief + `0.11` restored after reload; this is a client-side check; backend can confirm no run was created and DB unchanged.
- **No server restart occurred during observation:** pid 20248 unchanged; `launch.log` last entries remain 15:19:10/15:19:18; `/api/health` stayed 200 across the window.
- DB: **15 runs**, **0 interrupted**, active null, events max 394; no lost writes observed.
- Restart-portion acceptance is **UNVERIFIED/BLOCKED** by driver policy (“no server restart allowed by driver policy”). Native geometry observed by driver/UI is **1426×773** vs required **1440×780** (14×7 px short) — a window-bounds discrepancy, not a backend defect.
- No restart gap can be assessed without the Lead restart.

---

## 3. Flags checked

| Flag | Result | Evidence |
|---|---|---|
| False `completed` | **None observed** | TD-03/04/05/06 completed with required artifacts/checks; TD-03 blueprint correctly 0 checks; no completed run without expected artifacts |
| Missing run events | **None** | Run ranges 323–331, 332–368, 369–379, 380–394 are contiguous; global 1..394; each run has terminal `run.completed` |
| Active-run collision | **None** | Each run terminal before next; active null at every terminal check and phase_end |
| 5xx | **None** | Server log status counts: 200:518, 202:4, 304:131, 403:4, 404:10, 422:1 |
| Budget overrun (driver cards) | **None** | TD-03 $0.00100005/0.05; TD-04 $0.007642302/0.10; TD-05 $0.0003135/0.03; TD-06 $0.00300495/0.05 |
| Restart gap | **Not observed / unverified** | No restart performed; pid/launch.log unchanged; `interrupted=0` |
| Fake promotion | **None** | Learning overview `enabled:false`; key route 403; no promotion data |
| Cross-watch mismatch | **Yes** | TD-01 driver UNVERIFIED vs backend pass; UI watchdog phase_end at 21:35:39 says no TD-03.. but driver/backend TD-03..06 ran 21:33–21:39; matcher must quarantine UI phase_end, not the runs |

---

## 4. Notes / anomalies
- `POST /api/runs` at 21:20:04.308Z returned 422, before the driver started and before TD-02; it created no run and is baseline/E2E traffic, not a TD-02 API call.
- `GET /api/runs/run_td_gatekeeper/...` 404s at 21:20:04 are from baseline E2E test traffic (`e2e/ui-audit.spec.ts:303`), not the driver; no `run_td_gatekeeper` row exists. Not a driver-card defect.
- `desktop-server.log` was present and populated; `desktop-server.err.log` is 0 bytes throughout; no server errors.
- Baseline DB contains prior `budget_exceeded` runs (`run_23af…`, `run_1e5a…`) with `cost_usd NULL`; these predate the drive and are not driver-card overruns.
- TD-01 `/missing-td` returns 200 SPA fallback; frontend 404 rendering must come from the UI, not HTTP 404.
- TD-03/04/05/06 costs and artifacts match the cards; no false completed state, no duplicate run IDs, no active-run overlap.
- The UI watchdog’s `phase_end` at 21:35:39 is inconsistent with driver/backend TD-03–TD-06 evidence; it ended early. The driver’s own `phase_end` at 21:41:21 correctly notes 5 pass, TD-01 UNVERIFIED, TD-08 partial.

**Backend watchdog phase_end:** no product edits, no restart, no key access; all findings above are from read-only logs/APIs/SQLite and the two written artifacts.
