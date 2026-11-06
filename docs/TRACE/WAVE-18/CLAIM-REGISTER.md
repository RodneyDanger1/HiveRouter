# Wave 18 claim register

Date: 2026-11-05
Baseline: `e0d522e`; final commit recorded after the gate.
Status labels: `VERIFIED` (command/output read), `READ` (file inspected), `UNVERIFIED`, `CONTRADICTED`.

| ID | Claim | Evidence | Status |
|---|---|---|---|
| C-001 | Baseline tracked tree is 1,367 files | `git ls-files`; `FILE-MANIFEST.json` rows | VERIFIED |
| C-002 | Docs are 1,125 files: 617 non-image, 508 image | manifest grouping; `COVERAGE.md` | VERIFIED |
| C-003 | There are 51 app table declarations | `src/server/db/migrations.ts`; stage output | VERIFIED |
| C-004 | Live SQLite has 57 tables because `run_search_fts` creates 6 shadow tables | read-only `sqlite_master` query | VERIFIED |
| C-005 | 57 route handler registrations collapse to 53 unique API paths; 9 SPA paths; stage route strings 62 | `src/server/app.ts`, `web/src/App.tsx`, `API-SURFACE.md` | VERIFIED |
| C-006 | 37 registry agents: 28 files, 4 plan, 3 review, 1 tests, 1 text | `agents/registry.ts` parse | VERIFIED |
| C-007 | Baseline gate is 474 tests / 74 files, 44/44 E2E, stage 209/51/62/24 | previous committed evidence; re-check at final gate | VERIFIED at baseline |
| C-008 | Live DB has 30 runs, 8 terminal NULL-spend rows, 1 truly unaccounted run | read-only SQL | VERIFIED |
| C-009 | `/api/stats` is partial, totals NULL, unknownRunSpendRows=1 | live API; Playwright T15 | VERIFIED |
| C-010 | The app is visibly open in a native Chrome window at `127.0.0.1:8787` | CUA `overview-visible.png` + `bring_to_front` response | VERIFIED |
| C-011 | CUA background navigation can report `unverifiable`/no-op; foreground works | CUA click responses + `/runs` state | VERIFIED |
| C-012 | Existing-profile CUA browser attachment is refused | `browser_consent_required` refusal | VERIFIED |
| C-013 | 15 live trials pass after test-probe corrections | Playwright output `15 passed` | VERIFIED |
| C-014 | 10-route console/network sweep is clean | Playwright output `10 passed` | VERIFIED |
| C-015 | No product defect was confirmed in the live trials | screenshot/console/network evidence; no source fix needed | VERIFIED for covered trials |
| C-016 | Mermaid master and 11 domain maps validate | Kroki HTTP 200 for 12 `.mmd` files | VERIFIED |
| C-017 | Master and key diagrams are visually readable | `read_image` review; `docs/diagrams/REVIEW.md` | VERIFIED for reviewed diagrams |
| C-018 | Every source row has an evidence depth: head-read, metadata+dimensions, or inventory-only | `FILE-MANIFEST.json` `read_status` | VERIFIED |
| C-019 | Every baseline file is represented; no tracked path omitted | manifest count == `git ls-files` | VERIFIED |
| C-020 | Repository read/search tools remain absent | no tool registry; capability matrix | VERIFIED |
| C-021 | Tool-call loop, generated-code execution, approval, checkpoints, parallel generation, P7 evaluator remain absent/partial | source and capability matrix | VERIFIED |
| C-022 | Paid submits and live destructive paths are unverified | no provider call/destructive action | UNVERIFIED |
| C-023 | Existing-profile CUA browser automation is unverified | consent refusal; native CUA only | UNVERIFIED |
| C-024 | Native app/CUA capability inside HiveRouter is absent | product code has no browser driver | VERIFIED |
| C-025 | Full final gate is green | `npm.cmd run verify` 474/74 + build + stub 104 + secret 206; E2E 44/44; stage 209/51/62/24; preflight PASS RAM 1.74 GB/disk 7.71 GB; audit 0 | VERIFIED |

## Contradictions checked

- Stage says **62 routes**, config p7 says 61 route strings, app has 57 registrations: reconciled as 53 unique API paths + 9 SPA paths; the 57 registrations include four paths with two methods. No route was invented.
- Architecture/PLAN says **51 tables**, live SQLite shows **57**: six are FTS5 shadow tables, not app tables. No missing schema.
- Docs historical counts differ from current counts intentionally; current docs use Wave 18 counts.
