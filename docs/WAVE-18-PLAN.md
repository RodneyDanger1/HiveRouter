# Wave 18 — Whole-codebase cartography and live proof plan

Status: implemented/audited on 2026-11-05; evidence in `docs/TRACE/WAVE-18/` and `docs/CODEBASE-AUDIT/`.

## 1. Outcome

One code-grounded map of HiveRouter: every tracked baseline file, folder, route, table, agent, page, script, and capability traced to data and live UI; validated Mermaid maps; CUA/visible-window proof; 15 live trials; confirmed defects fixed with RED→GREEN if found.

## 2. Current behavior / evidence

- Baseline `e0d522e`: 474 tests / 74 files, 44/44 E2E, stage 209/51/62/24, verify green.
- 1,367 tracked files: 1,125 docs (617 text, 508 image), 70 server, 7 shared, 30 web, 75 tests, 8 E2E, 16 scripts, 3 config, 24 logs.
- 51 app table declarations; 57 live SQLite tables including six FTS5 shadow tables; 57 route handler registrations; 53 unique API paths; 9 SPA paths; stage route strings 62; 37 agents.
- Live app visible at `http://127.0.0.1:8787`; CUA foreground navigation and screenshot worked. Existing-profile `browser_prepare` refused consent; CUA is visible proof, Playwright is the headless interaction harness.

## 3. Decisions

| Decision | Alternative rejected | Reason |
|---|---|---|
| Cartography before P1-2 | Start repo tools immediately | Capability work needs a verified map |
| All 1,367 baseline tracked files, tiered | Code-only audit | User asked every file/folder/script |
| Master Mermaid first | Audit first | User ordering and early architecture check |
| Native CUA + Playwright split | Pretend existing-profile CUA works | Consent refusal is a hard tooling limit |
| No paid/destructive run | Exercise production sends | Live data is sufficient; safety |
| Solo Lead | Parallel seats | Work-solo instruction and one evidence chain |
| Fix only confirmed defects | “Clean up while looking” | Root-cause discipline |
| Mermaid source canonical | Edit generated images | Reviewable and reproducible |

## 4. Deliverables

- `docs/diagrams/CODEBASE-MASTER.mmd` first; then run/phase/database/API/UI/capability/data-lineage/file-ownership maps; SVG/PNG and `index.html`.
- `docs/CODEBASE-AUDIT/`: `FILE-MANIFEST.json` (1,367 baseline rows), `COVERAGE.md`, code indexes, code/web/test/script/config/log/docs audits, API surface, data capability, live UI.
- `docs/TRACE/WAVE-18/`: visual findings, claim register, trace summary, screenshots, CUA JSON.
- Current docs/plan/capability/backlog/README updates.
- Defect fixes only if confirmed; no schema migration planned.

## 5. Failure handling

- CUA background no-op → foreground only after verification; no profile consent override.
- Mermaid renderer unavailable → Kroki then local fallback; mark export unverified if both fail.
- File too large/context limit → batch and manifest; never claim coverage without count match.
- Live data change → read-only queries; record time; no writes.
- Paid/destructive test unavailable → UNVERIFIED, not fake pass.
- Docs conflict → running code wins; label historical.

## 6. Acceptance

- Manifest rows == `git ls-files` baseline count; every folder represented; no unexplained rows.
- 12 Mermaid sources validate/export; visual review readable.
- 15/15 live trials pass or confirmed defects fixed; 10-route console/network sweep clean.
- Full gate green; docs truthful; commit/push.

## 7. Rollback

Revert docs/diagram/audit commit; fix commits are separate; no DB migration; `.qa-cua` scratch removed after evidence copy.

## 8. Out of scope

P1-2 repo tools, P1-1 index, P1-3 tool loop, P1-5 approval, P1-6 checkpoints, P1-7 parallel generation, P1-8 wiring, P1-9 CPM, P7 evaluator, generated-code execution, paid live runs, native CUA capability claims.
