# Docs group: IMPROVE-WAVE-7

| File | Type | Title / evidence | Bytes | Read status |
|---|---|---|---:|---|
| `docs/IMPROVE-WAVE-7/audit/assert-stage.out.txt` | .txt | > hive-router@0.1.0 assert-stage > node scripts/assert-stage.mjs --stage=p7 --json { "schema": "hive.cli.v1", "ok": true, "command": "hive.assert-stage", "code": null, "data": { "stage": "p7", "label": "B2", "fallback":  | 1406 | head-read |
| `docs/IMPROVE-WAVE-7/audit/AUDIT.md` | .md | AUDIT â€” IMPROVE-WAVE-7 (independent, read-only) — - **Auditor role:** independent read-only verification. Skill `auditor` loaded before acting. | 19352 | head-read |
| `docs/IMPROVE-WAVE-7/audit/claims.json` | .json | { "schema": "hive.audit.wave7.v1", "auditor": { "role": "independent read-only auditor", "skill": "auditor", "write_scope": "docs/IMPROVE-WAVE-7/audit/**", "no_git": true, "no_paid_calls": true, "no_server_restart_by_aud | 15287 | head-read |
| `docs/IMPROVE-WAVE-7/audit/e2e.out.txt` | .txt | > hive-router@0.1.0 e2e > playwright test Running 26 tests using 1 worker npm.cmd : (node:10804) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set. At line:1 char:561 + ... 0,16),$f }; npm.cmd | 8558 | head-read |
| `docs/IMPROVE-WAVE-7/audit/full-suite.out.txt` | .txt | > hive-router@0.1.0 test > vitest run RUN v5.1.0 C:/Users/Riley/Desktop/HiveRouter {"level":30,"time":1793773239121,"pid":20376,"hostname":"DESKTOP-5GATL9H","reqId":"req-1","req":{"method":"GET","url":"/api/runs/run_rout | 39486 | head-read |
| `docs/IMPROVE-WAVE-7/audit/full-suite-2.out.txt` | .txt | > hive-router@0.1.0 test > vitest run RUN v5.1.0 C:/Users/Riley/Desktop/HiveRouter {"level":30,"time":1793773365363,"pid":20980,"hostname":"DESKTOP-5GATL9H","reqId":"req-1","req":{"method":"GET","url":"/api/runs/run_rout | 36142 | head-read |
| `docs/IMPROVE-WAVE-7/audit/hash-compare-vs-w6.txt` | .txt | W6_final_entries=162 CHANGED=5 CHANGED e2e/ui-audit.spec.ts CHANGED src/server/runs/recorder.ts CHANGED web/src/api.ts CHANGED web/src/pages/RunsPage.tsx CHANGED web/src/pages/SettingsPage.tsx MISSING=0 NOT_IN_W6_SET=1 N | 294 | head-read |
| `docs/IMPROVE-WAVE-7/audit/live-runs-failed.png` | .png | image 1440x1000 .png | 92862 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit/live-runs-queued.png` | .png | image 1440x1000 .png | 63063 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit/live-settings.png` | .png | image 1440x1000 .png | 84665 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit/probe-db.err.txt` | .txt | (no extractable prose in first 64 KiB) | 0 | head-read |
| `docs/IMPROVE-WAVE-7/audit/probe-db.mjs` | .mjs | db — (no extractable prose in first 64 KiB) | 1154 | head-read |
| `docs/IMPROVE-WAVE-7/audit/probe-db.out.json` | .json | { "runs": 30, "statuses": [ { "status": "budget_exceeded", "n": 4 }, { "status": "completed", "n": 23 }, { "status": "failed", "n": 3 } ], "latestRuns": [ { "id": "run_c41f1fb4779d302af7", "status": "completed", "created | 3038 | head-read |
| `docs/IMPROVE-WAVE-7/audit/probe-red.err.txt` | .txt | (no extractable prose in first 64 KiB) | 0 | head-read |
| `docs/IMPROVE-WAVE-7/audit/probe-red.out.json` | .json | { "probe": "RED on pre-fix recorder copy", "results": [ { "case": "RED pre-fix: completed->running", "outcome": "NO-THROW (defect reproduced)", "row": { "id": "red_terminal", "parentRunId": null, "brief": "wave-7 RED pro | 3684 | head-read |
| `docs/IMPROVE-WAVE-7/audit/probe-red.ts` | .ts | makeRun — (no extractable prose in first 64 KiB) | 1956 | head-read |
| `docs/IMPROVE-WAVE-7/audit/probe-transitions.err.txt` | .txt | (no extractable prose in first 64 KiB) | 0 | head-read |
| `docs/IMPROVE-WAVE-7/audit/probe-transitions.out.json` | .json | { "probe": "updateRun transitions + CAS", "results": [ { "case": "queued->running", "outcome": "ok", "row": { "id": "p_legal", "parentRunId": null, "brief": "wave-7 transition probe", "preset": "full-build", "status": "r | 73808 | head-read |
| `docs/IMPROVE-WAVE-7/audit/probe-transitions.ts` | .ts | AUDIT_DIR — * Wave 7 adversarial probe: updateRun status guard + CAS. * Uses a throwaway file DB under the audit directory (never the product DB). * Run: node_modules\.bin\tsx.cmd docs\IMPROVE-WAVE-7\audit\probe-transitions.ts | 10382 | head-read |
| `docs/IMPROVE-WAVE-7/audit/probe-ui.err.txt` | .txt | (no extractable prose in first 64 KiB) | 0 | head-read |
| `docs/IMPROVE-WAVE-7/audit/probe-ui.mjs` | .mjs | BASE — (no extractable prose in first 64 KiB) | 3352 | head-read |
| `docs/IMPROVE-WAVE-7/audit/probe-ui.out.json` | .json | { "initialRequest": "/api/runs?limit=100", "initialRows": 30, "initialCountLabel": "30 runs Â· server-filtered", "failedRequest": "/api/runs?limit=100&status=failed", "failedRows": 3, "failedLinks": 6, "failedCountLabel": | 5304 | head-read |
| `docs/IMPROVE-WAVE-7/audit/red-copy-recorder.ts` | .ts | emitter — Number of this run's events after the cursor (the run's own rows, not the global seq space). | 16529 | head-read |
| `docs/IMPROVE-WAVE-7/audit/secret-scan.out.txt` | .txt | > hive-router@0.1.0 secret-scan > node scripts/check-secrets.mjs secret-scan: clean (161 files) | 208 | head-read |
| `docs/IMPROVE-WAVE-7/audit/snapshot.txt` | .txt | snapshot_utc=2026-11-04T00:32:26.4508354-06:00 repo=C:\Users\Riley\Desktop\HiveRouter git_present=False 2026-11-04 00:20:49 52C468137695E944072788E3492AED7FE5274FC4B328D23F3ACF2306E7B9833A 18274 src/server/runs/recorder. | 1409 | head-read |
| `docs/IMPROVE-WAVE-7/audit/stub-sweep.out.txt` | .txt | > hive-router@0.1.0 stub-sweep > node scripts/stub-sweep.mjs stub-sweep: clean (86 files) | 196 | head-read |
| `docs/IMPROVE-WAVE-7/audit/targeted-after-move.out.txt` | .txt | > hive-router@0.1.0 test > vitest run --run test/unit/run-transition-guard.test.ts RUN v5.1.0 C:/Users/Riley/Desktop/HiveRouter âœ“ test/unit/run-transition-guard.test.ts (5 tests) 135ms Test Files 1 passed (1) Tests 5 pas | 732 | head-read |
| `docs/IMPROVE-WAVE-7/audit/typecheck.out.txt` | .txt | > hive-router@0.1.0 typecheck > tsc --noEmit | 104 | head-read |
| `docs/IMPROVE-WAVE-7/audit2/analyze-probe.py` | .py | (no extractable prose in first 64 KiB) | 2466 | head-read |
| `docs/IMPROVE-WAVE-7/audit2/assert-stage.out.txt` | .txt | > hive-router@0.1.0 assert-stage > node scripts/assert-stage.mjs --stage=p7 --json { "schema": "hive.cli.v1", "ok": true, "command": "hive.assert-stage", "code": null, "data": { "stage": "p7", "label": "B2", "fallback":  | 705 | head-read |
| `docs/IMPROVE-WAVE-7/audit2/diff_baseline.py` | .py | (no extractable prose in first 64 KiB) | 1681 | head-read |
| `docs/IMPROVE-WAVE-7/audit2/diff-summary.tsv` | .tsv | file current_sha256 baseline_sha256 added_lines removed_lines src/server/runs/recorder.ts 52C468137695E944072788E3492AED7FE5274FC4B328D23F3ACF2306E7B9833A 83223417C125B50E51F49AD91A7CB574D56E0E96A9D3248F10EA458A0ECA9068  | 863 | head-read |
| `docs/IMPROVE-WAVE-7/audit2/diff-vs-baseline.txt` | .txt | --- docs/IMPROVE-WAVE-7/backup/src/server/runs/recorder.ts +++ src/server/runs/recorder.ts @@ -3,6 +3,7 @@ import { getDb, nowIso } from '../db/database.js'; import { config } from '../config.js'; import { redactValue }  | 8240 | head-read |
| `docs/IMPROVE-WAVE-7/audit2/docs/UI-WAVE-1/shots/agent-drawer.png` | .png | image 1440x3336 .png | 444014 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit2/docs/UI-WAVE-1/shots/agent-drawer-edit.png` | .png | image 1440x3336 .png | 453836 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit2/docs/UI-WAVE-1/shots/agents-all.png` | .png | image 1440x3336 .png | 405159 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit2/docs/UI-WAVE-1/shots/agents-filtered.png` | .png | image 1440x1000 .png | 72634 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit2/docs/UI-WAVE-1/shots/learning-disabled.png` | .png | image 1440x1000 .png | 79229 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit2/docs/UI-WAVE-1/shots/overview-390.png` | .png | image 390x4001 .png | 215130 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit2/docs/UI-WAVE-1/shots/overview-390-nav.png` | .png | image 390x4001 .png | 211171 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit2/docs/UI-WAVE-1/shots/overview-composer-filled.png` | .png | image 1440x1905 .png | 245482 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit2/docs/UI-WAVE-1/shots/route-agents.png` | .png | image 1440x3336 .png | 405159 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit2/docs/UI-WAVE-1/shots/route-learning.png` | .png | image 1440x1000 .png | 79229 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit2/docs/UI-WAVE-1/shots/route-not-found.png` | .png | image 1440x1000 .png | 47517 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit2/docs/UI-WAVE-1/shots/route-overview.png` | .png | image 1440x1837 .png | 243642 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit2/docs/UI-WAVE-1/shots/route-runs.png` | .png | image 1440x2317 .png | 416488 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit2/docs/UI-WAVE-1/shots/route-settings.png` | .png | image 1440x1836 .png | 148475 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit2/docs/UI-WAVE-1/shots/route-vault.png` | .png | image 1440x1051 .png | 104721 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit2/docs/UI-WAVE-1/shots/run-detail-audit-dialog.png` | .png | image 1440x2659 .png | 563000 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit2/docs/UI-WAVE-1/shots/run-detail-checks.png` | .png | image 1440x1194 .png | 166710 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit2/docs/UI-WAVE-1/shots/run-detail-confidence.png` | .png | image 1440x1133 .png | 157733 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit2/docs/UI-WAVE-1/shots/run-detail-context.png` | .png | image 1440x5774 .png | 445552 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit2/docs/UI-WAVE-1/shots/run-detail-events.png` | .png | image 1440x3927 .png | 359340 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit2/docs/UI-WAVE-1/shots/run-detail-files.png` | .png | image 1440x1715 .png | 218750 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit2/docs/UI-WAVE-1/shots/run-detail-file-viewer.png` | .png | image 1440x1715 .png | 218719 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit2/docs/UI-WAVE-1/shots/run-detail-overview.png` | .png | image 1440x2659 .png | 435042 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit2/docs/UI-WAVE-1/shots/run-detail-repairs.png` | .png | image 1440x1074 .png | 163103 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit2/docs/UI-WAVE-1/shots/run-detail-revise-dialog.png` | .png | image 1440x2659 .png | 564068 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit2/docs/UI-WAVE-1/shots/run-detail-routing.png` | .png | image 1440x4137 .png | 401765 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit2/docs/UI-WAVE-1/shots/run-missing-refusal.png` | .png | image 1440x1000 .png | 45471 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit2/docs/UI-WAVE-1/shots/runs-list.png` | .png | image 1440x2317 .png | 416488 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit2/docs/UI-WAVE-1/shots/settings.png` | .png | image 1440x1836 .png | 148475 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit2/docs/UI-WAVE-1/shots/vault-file.png` | .png | image 1440x1051 .png | 99994 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit2/docs/UI-WAVE-1/shots/vault-tree.png` | .png | image 1440x1051 .png | 104721 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/audit2/e2e-list.out.txt` | .txt | Listing tests: api-contract.spec.ts:6:3 â€º @qa-api API contract pins â€º openapi.json is JSON and advertises /api/health api-contract.spec.ts:15:3 â€º @qa-api API contract pins â€º every OpenAPI operation has typed 2xx and 4xx  | 3354 | head-read |
| `docs/IMPROVE-WAVE-7/audit2/full-suite.out.txt` | .txt | > hive-router@0.1.0 test > vitest run RUN v5.1.0 C:/Users/Riley/Desktop/HiveRouter {"level":30,"time":1793773781185,"pid":21672,"hostname":"DESKTOP-5GATL9H","reqId":"req-1","req":{"method":"GET","url":"/api/runs/run_cont | 18253 | head-read |
| `docs/IMPROVE-WAVE-7/audit2/INCOMPLETE.md` | .md | audit2 â€” INCOMPLETE — This directory was written by a second frozen-snapshot auditor attempt that was **stopped before completion**. It produced partial diffs/probes and UI screenshots but **no final AUDIT.md/claims.json verdict**. | 492 | head-read |
| `docs/IMPROVE-WAVE-7/audit2/probe-cas.err.txt` | .txt | (no extractable prose in first 64 KiB) | 0 | head-read |
| `docs/IMPROVE-WAVE-7/audit2/probe-cas.out.json` | .json | { "probe": "independent run-status guard + CAS", "results": [ { "probe": "status-edge matrix", "total": 100, "mismatches": [], "legalPairs": 33, "illegalPairs": 67 }, { "case": "completed->queued", "outcome": "threw", "e | 144687 | head-read |
| `docs/IMPROVE-WAVE-7/audit2/probe-cas.ts` | .ts | TransitionKind — Build a run in `status` through legal edges only. Returns the run id. | 12669 | head-read |
| `docs/IMPROVE-WAVE-7/audit2/probe-cas-summary.txt` | .txt | matrixSummary: {"total": 100, "mismatches": [], "legalPairs": 33, "illegalPairs": 67} matrixMismatches: 0 results: 100 - None / outcome=None - completed->queued / outcome=threw / code=E_ILLEGAL_RUN_TRANSITION kind=status | 13485 | head-read |
| `docs/IMPROVE-WAVE-7/audit2/probe-client-url.err.txt` | .txt | (no extractable prose in first 64 KiB) | 0 | head-read |
| `docs/IMPROVE-WAVE-7/audit2/probe-client-url.out.json` | .json | { "requested": [ "/api/runs?limit=100&status=failed", "/api/runs?limit=100", "/api/runs?limit=50", "/api/runs?limit=10&status=completed+with+warnings%26x%3D1", "/api/runs?limit=7&status=completed_with_warnings", "/api/ru | 1119 | head-read |
| `docs/IMPROVE-WAVE-7/audit2/probe-client-url.ts` | .ts | requested — (no extractable prose in first 64 KiB) | 1186 | head-read |
| `docs/IMPROVE-WAVE-7/audit2/probe-db.mjs` | .mjs | db — (no extractable prose in first 64 KiB) | 2211 | head-read |
| `docs/IMPROVE-WAVE-7/audit2/probe-db.out.json` | .json | { "tables": 45, "tableNames": [ "agent_evidence", "agent_stats", "approval_tokens", "artifacts", "budget_reservations", "checks", "confidence_records", "consent_records", "context_manifests", "context_packs", "eval_cases | 4383 | head-read |
| `docs/IMPROVE-WAVE-7/audit2/probe-runs.err.txt` | .txt | (no extractable prose in first 64 KiB) | 0 | head-read |
| `docs/IMPROVE-WAVE-7/audit2/probe-runs.out.json` | .json | {"level":30,"time":1793774034901,"pid":21604,"hostname":"DESKTOP-5GATL9H","reqId":"req-1","req":{"method":"GET","url":"/api/runs?limit=100","host":"127.0.0.1:8787","remoteAddress":"127.0.0.1"},"msg":"incoming request"} { | 4840 | head-read |
| `docs/IMPROVE-WAVE-7/audit2/probe-runs.ts` | .ts | report — * INDEPENDENT Wave 7 auditor probe â€” server-side runs filter truth. * Uses an in-memory DB only. Does not touch the production DB. * * Run: node_modules\.bin\tsx.cmd docs\IMPROVE-WAVE-7\audit2\probe-runs.ts | 4314 | head-read |
| `docs/IMPROVE-WAVE-7/audit2/probe-ui.err.txt` | .txt | (no extractable prose in first 64 KiB) | 0 | head-read |
| `docs/IMPROVE-WAVE-7/audit2/probe-ui.mjs` | .mjs | BASE — (no extractable prose in first 64 KiB) | 5616 | head-read |
| `docs/IMPROVE-WAVE-7/audit2/probe-ui.out.json` | .json | { "settings": { "expectedCount": 22, "renderedCount": 22, "expected": [ [ "model", "deepseek-flash" ], [ "thinking", "disabled" ], [ "limits.briefChars", "8000" ], [ "limits.maxFiles", "24" ], [ "limits.maxFileBytes", "2 | 7018 | head-read |
| `docs/IMPROVE-WAVE-7/audit2/quiescence-start.csv` | .csv | "rel","hash","len","lw" "config\releases\a.json","25C8E9E0E4724DEF8FA4A6E78B5DC32A0A82EB0769DF4A4B368522743C727172","1828","2026-11-03T10:28:12.1976894-06:00" "config\releases\p6a.json","76F8C2B425E05B0A0EBDB8458773883E6 | 23589 | head-read |
| `docs/IMPROVE-WAVE-7/audit2/shots-before.sha256` | .sha256 | 8EF6970D1DCBD9BDCC2FD57B79CA367D3E82D23C8840EE56EAF59EECFE8FE91E C:\Users\Riley\Desktop\HiveRouter\docs\UI-WAVE-1\shots\agent-drawer.png 82D20D6197213175747C7771DB012E0270F895DAFF2FE53FEC2145E9A44E9920 C:\Users\Riley\Des | 6143 | head-read |
| `docs/IMPROVE-WAVE-7/audit2/targeted-guard.out.txt` | .txt | > hive-router@0.1.0 test > vitest run --run test/unit/run-transition-guard.test.ts RUN v5.1.0 C:/Users/Riley/Desktop/HiveRouter âœ“ test/unit/run-transition-guard.test.ts (5 tests) 159ms Test Files 1 passed (1) Tests 5 pas | 355 | head-read |
| `docs/IMPROVE-WAVE-7/audit2/typecheck.out.txt` | .txt | > hive-router@0.1.0 typecheck > tsc --noEmit | 54 | head-read |
| `docs/IMPROVE-WAVE-7/backup/e2e/ui-audit.spec.ts` | .ts | SHOTS — (no extractable prose in first 64 KiB) | 17405 | head-read |
| `docs/IMPROVE-WAVE-7/backup/src/server/runs/recorder.ts` | .ts | emitter — Number of this run's events after the cursor (the run's own rows, not the global seq space). | 16468 | head-read |
| `docs/IMPROVE-WAVE-7/backup/web/src/api.ts` | .ts | API_BASE — keep text | 17903 | head-read |
| `docs/IMPROVE-WAVE-7/backup/web/src/pages/RunsPage.tsx` | .tsx | FILTERS — (no extractable prose in first 64 KiB) | 2911 | head-read |
| `docs/IMPROVE-WAVE-7/backup/web/src/pages/SettingsPage.tsx` | .tsx | SettingsPage — (no extractable prose in first 64 KiB) | 7711 | head-read |
| `docs/IMPROVE-WAVE-7/baseline.sha256` | .sha256 | 83223417C125B50E51F49AD91A7CB574D56E0E96A9D3248F10EA458A0ECA9068 src/server/runs/recorder.ts 1DE3C8FF86F4F3A5A3706BA6BDBDAF2441A4C14592C7684779F598CBE3CF662D web/src/pages/RunsPage.tsx 62126BC5E77A31FB2F6A5102181DAE4458E | 460 | head-read |
| `docs/IMPROVE-WAVE-7/CLOSURE.md` | .md | IMPROVE-WAVE-7 â€” final closure audit — - **Role:** independent closure verification (auditor protocol) plus UI/control trace (trace protocol). | 4393 | head-read |
| `docs/IMPROVE-WAVE-7/live-check.ts` | .ts | base — (no extractable prose in first 64 KiB) | 1451 | head-read |
| `docs/IMPROVE-WAVE-7/REPORT.md` | .md | IMPROVE-WAVE-7 â€” logical hardening after Wave 6 — Wave 6 left these unsafe/deferred items. Wave 7 closes the two safe, high-value ones and fixes a related UI/data seam: | 6638 | head-read |
| `docs/IMPROVE-WAVE-7/runs-filtered-failed.png` | .png | image 1440x1000 .png | 92862 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/settings-limits.png` | .png | image 1440x1000 .png | 84665 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/trace/agents.png` | .png | image 1440x1000 .png | 119696 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/trace/closure-trace.ts` | .ts | base — (no extractable prose in first 64 KiB) | 6331 | head-read |
| `docs/IMPROVE-WAVE-7/trace/learning.png` | .png | image 1440x1000 .png | 79229 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/trace/overview.png` | .png | image 1440x1000 .png | 127279 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/trace/run-checks.png` | .png | image 1440x1000 .png | 144306 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/trace/run-confidence.png` | .png | image 1440x1000 .png | 146281 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/trace/run-context.png` | .png | image 1440x1000 .png | 139872 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/trace/run-events.png` | .png | image 1440x1000 .png | 138889 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/trace/run-files.png` | .png | image 1440x1000 .png | 147915 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/trace/run-overview.png` | .png | image 1440x1000 .png | 168881 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/trace/run-repairs.png` | .png | image 1440x1000 .png | 155096 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/trace/run-routing.png` | .png | image 1440x1000 .png | 144022 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/trace/runs.png` | .png | image 1440x1000 .png | 155974 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/trace/runs-failed.png` | .png | image 1440x1000 .png | 92862 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/trace/runs-queued.png` | .png | image 1440x1000 .png | 63063 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/trace/settings.png` | .png | image 1440x1000 .png | 84665 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/trace/settings-limits.png` | .png | image 1440x1000 .png | 84665 | metadata+dimensions |
| `docs/IMPROVE-WAVE-7/trace/trace.json` | .json | { "startedAt": "2026-11-04T18:41:15.165Z", "finishedAt": "2026-11-04T18:41:30.859Z", "health": { "status": "ok", "version": "0.1.0", "phase": "B2", "features": { "routing": true, "learning": true }, "db": "ok", "key": {  | 5145 | head-read |
| `docs/IMPROVE-WAVE-7/trace/TRACE-SUMMARY.md` | .md | TRACE closure summary â€” Wave 7 — - **Target:** `run_c41f1fb4779d302af7` (completed full-build; 14 artifacts; 77 persisted events; $0.051059388). | 801 | head-read |
| `docs/IMPROVE-WAVE-7/trace/vault.png` | .png | image 1440x1000 .png | 97946 | metadata+dimensions |