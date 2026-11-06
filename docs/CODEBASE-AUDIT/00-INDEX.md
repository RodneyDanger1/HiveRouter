# Codebase audit — Wave 18

Baseline: `e0d522e` plus the Wave 18 working tree.
Scope: every tracked file at baseline (1,367), every top-level folder, every application table, every route registration, every registry agent, every page, and every script. Generated runtime data and dependencies are excluded and named.

| File | Contents |
|---|---|
| `FILE-MANIFEST.json` | One row per tracked baseline file: path, category, tier, extension, bytes, SHA-256, read status, title, summary, diagram node |
| `COVERAGE.md` | Counts by category/tier and reconciliation of tracked files to manifest rows |
| `CODE-INDEX.json` | Code-level index: lines, imports, exports, first evidence |
| `01-RUNTIME.md` | `src/server/**` subsystem map and 70 file rows |
| `02-SHARED.md` | 7 shared contract files |
| `03-WEB.md` | 26 code files, page/control map, 30-file web scope |
| `04-TESTS.md` | 75 tests + 8 E2E specs, coverage map |
| `05-SCRIPTS-CONFIG.md` | 16 scripts, 3 release configs, package scripts |
| `05-LOGS.md` | 24 historical log files |
| `06-DOCS/` | Every docs file (1,125: 617 text, 508 images) grouped by folder |
| `07-DATA-CAPABILITY.md` | 51 app tables, live census, 57 route registrations/62 stage strings, 37 agents, capability truth |
| `API-SURFACE.md` | All 57 route registrations + SPA paths + stage reconciliation |
| `08-LIVE-UI.md` | CUA/Playwright live proof and findings (completed after live phase) |

Reading-depth rule: code rows were read at target/head depth; textual docs at least head depth; images by hash/dimensions/referrer; logs and historical traces are labelled historical, not current behavior. `UNVERIFIED` is used where a fact could not be established.
