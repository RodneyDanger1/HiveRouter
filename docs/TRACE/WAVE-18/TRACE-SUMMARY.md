# Wave 18 — whole-codebase cartography and live proof

Date: 2026-11-05
Baseline: `e0d522e` — 474 tests / 74 files; 44/44 E2E; stage 209/51/62/24; verify green.
Server: `http://127.0.0.1:8787` (B2); native Chrome window visible; Playwright headless harness separate.

## Delivered

- **First Mermaid map:** `docs/diagrams/CODEBASE-MASTER.mmd` (validated/exported before the deep audit).
- **12 Mermaid maps:** master, run status, phase, core/B1/P7/chat-search schemas, API, UI, capability, data lineage, file ownership; SVG/PNG and `index.html`; visual review.
- **Exhaustive baseline inventory:** `docs/CODEBASE-AUDIT/FILE-MANIFEST.json` — 1,367 rows for 1,367 `git ls-files`; 617 text + 508 image docs; code/test/script/config/log/docs indexes.
- **Data/capability truth:** 51 app tables + 6 FTS5 shadow tables = 57 live tables; 57 route registrations = 53 unique API paths + 9 SPA paths; stage 62 strings; 37 agents; live read-only census (30 runs, 8 terminal NULL spend, 1 unaccounted); capability matrix.
- **Live proof:** CUA visible window screenshot and foreground navigation; **15/15** live Playwright trials; **10/10** route console/network sweep; no confirmed product defect.
- **Docs:** `docs/CODEBASE-AUDIT/00-INDEX.md`, `01..08`, `API-SURFACE.md`, `COVERAGE.md`; `docs/TRACE/WAVE-18/` evidence; current docs/plan updated.

## Key reconciliations

- **Routes:** 57 handler registrations, 53 unique API paths, 9 SPA paths; stage scanner counts 62. The four extra registrations are the second methods on `/api/settings/key` (POST+PUT), `/api/agents/:id/prompt` (PUT+DELETE), `/api/chat/threads` (GET+POST), and `/api/runs` (GET+POST).
- **Tables:** 51 app table declarations; live SQLite 57 because `run_search_fts` creates six shadow tables. The stage allowlist intentionally names the 51 application tables.
- **Tests:** the 15 live trials are additional evidence; they do not replace the 474-test unit suite or 44 committed E2E tests.

## Live trials

Initial 5: Overview, Runs filter, completed-run Files/Search, Agents filters/drawer, Settings key status.
Designed 10: Vault, Scripts dry-runs, Analysis refusal, Learning refusal, Chat cap, mobile nav, keyboard tabs, persisted events, agent-registry 503 retry, stats truth.
All pass. Three initial probe failures (uppercase expectation, strict locator, row locator) were test errors and were corrected; no production source changed for them.

## Unverified

Paid submits, live Stop/cancel, mid-run SSE, resume success, `E_ZIP_EMPTY`, existing-profile CUA browser automation, and native app/CUA capability. No paid provider call or generated-code execution.

## Gate

Final gate: **474 tests / 74 files**, **44/44 E2E**, stage **209/51/62/24**, verify exit 0, preflight PASS (RAM 1.74 GB, disk 7.71 GB), audit 0. Commit/push recorded below after commit.

```text
npm.cmd test
npm.cmd run e2e
npm.cmd run verify
npm.cmd run assert-stage -- --stage=p7 --json
npm.cmd run preflight -- --port 0 --json
npm.cmd audit --omit=dev
```
