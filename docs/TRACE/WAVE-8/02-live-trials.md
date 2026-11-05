# Wave 8 live trials — scripts, analysis, run search

Captured: 2026-11-05T06:44–06:47Z (local America/Chicago)
Build served: `npm.cmd run build` → `web/dist/assets/index-*.js` (1.63s build)
Server: `npm.cmd start`, `127.0.0.1:8787`, `/api/health` 200, phase B2
HEAD at capture: `ca00a26` + working-tree Wave 8 changes

## Trial 1 — Scripts catalog and command-hint dry-run

**Expected:** 8 catalog entries; 6 dry-runnable; preflight returns a local command; bench/learn are labeled paid and refused by name; no process is spawned.

**Observed API:**

- `GET /api/scripts` → 8 entries: `preflight, stub-sweep, secret-scan, assert-stage, bench, replay, integrity, learn`.
- `safety` values: 6 `read`, 2 `paid` (`bench`, `learn`).
- `dryRun` true for the 6 read scripts, false for the 2 paid scripts.
- `POST /api/scripts/preflight/dry-run` → `200`:
  `{"script":"preflight","dryRun":true,"message":"Run locally: npm.cmd run preflight -- --json"}`
- `POST /api/scripts/bench/dry-run` → `422`:
  `{"error":{"code":"E_SCRIPT_DRY_RUN_UNSUPPORTED","message":"This script cannot be dry-run in-process.","retryable":false,"details":{"script":"bench"}}}`

**Observed UI:**

- Playwright: `/scripts` heading, 8 rows, preflight command rendered, bench/learn disabled, 422 refusal asserted.
- Command: `npx playwright test e2e/ui-audit.spec.ts --grep "scripts page|analysis page"`
- Result: `2 passed (4.3s)`.

**CUA:**

- `cua-driver 0.28.2`; Chrome pid `11636`, window `131860`.
- `browser_prepare` refused `browser_requires_setup` (no owned endpoint); native window route used.
- `get_window_state` + foreground navigation reached `http://127.0.0.1:8787/scripts`; screenshot `cua-scripts-page.png` shows the real page.
- A native pixel click at the estimated Dry-run coordinate did not land on the control; Chrome switched tabs. This is a **CUA coordinate/tooling false negative**, not evidence that the button is dead. Playwright exercised the button and API successfully.

**Evidence:** `docs/TRACE/WAVE-8/cua-scripts-page.png`, `docs/screenshots/scripts.png`, `docs/TRACE/WAVE-8/live-api.json`.

**Verdict:** WIRED-AND-WORKS for the read-only catalog and dry-run; paid refusal is enforced server-side.

## Trial 2 — Bounded static analysis

**Expected:** a static file-dominator graph and a four-role scorecard result; no file reads, no execution, named 422 for bad input.

**Observed API (`POST /api/analysis/dominators`):**

- root `src/app.ts`, edges `src/app.ts -> src/api.ts`, `src/api.ts -> src/store.ts`
- `nodes: 3`, `edgeCount: 2`, `dynamic: false`, `cfg: false`
- `dominatedCounts: { "src/app.ts": 2, "src/api.ts": 1, "src/store.ts": 0 }`
- `overallRisk: 0.5`, `truncated: false`, `iterations: 2`

**Observed API (`POST /api/analysis/scorecards`):**

- two scorecards with a 1.5 threshold
- `variance: 3`, `needsDebate: true`, `missing: ["testability-engineer","clarity-editor"]`

**Observed UI:**

- Playwright filled root/edges, clicked Analyze graph, saw `src/api.ts` and `src/store.ts`, saw "Static only".
- Filled four evidence fields, evaluated disagreement, saw the no-debate trigger copy and the non-certificate disclaimer.
- Result: included in the `2 passed` run above.

**Verdict:** WIRED-AND-WORKS for the bounded, non-executing static analysis path.

## Trial 3 — Published-run FTS5 search

**Expected:** a terminal run's published files are indexed on demand; a real query returns bounded matches; a short query (< trigram length) uses the LIKE fallback; a nonsense query returns zero matches; staged files are excluded.

**Fixture:** completed full-build run `run_c41f1fb4779d302af7` (14 indexed files).

**Observed API:**

- `POST /api/runs/run_c41f1fb4779d302af7/search {"query":"function"}` → `matches: 10`, `indexedFiles: 14`, `indexed: false` (reused index), `truncated: false`.
- short query `{"query":"fn"}` → `matches: 3`, same index.
- nonsense `{"query":"zzzznotfoundzzzz"}` → `matches: 0`.

**Observed UI:**

- Playwright opened the terminal run, visited all tabs, opened Search, searched a real token from the first artifact, and saw `14 files indexed` plus results.
- Result: included in `29 passed` full E2E run.

**Verdict:** WIRED-AND-WORKS; index reuse is explicit, not silent.

## What went wrong / right

| Observation | Classification | Action |
|---|---|---|
| Playwright `getByRole('cell',{name:'preflight',exact:true})` found no cell | **Test-harness defect** — accessible cell name included both name and id | Replaced with a row-level locator; did not change product code |
| CUA pixel click switched Chrome tabs instead of activating Dry-run | **Tooling/probe defect** — coordinate frame/foreground tab divergence; `effect:unverifiable` | Recorded as false negative; used Playwright for interaction proof; no product claim |
| Scripts table repeated the same value as name and id | **UX polish** | Removed the duplicate second line |
| Everything else in the three trials | **Product behavior matched the claim** | Kept |

## Unverified / residual

- The CUA native click path for Chromium web content remained `effect:unverifiable`; a native-only trial is not claimed.
- No paid provider call was made. The scripts and analysis paths are free; the search path reads an existing run.
- Mobile/keyboard-only behavior was not part of these three trials.
- Search index freshness after manual published-file edits remains a documented limitation (P2-3).
