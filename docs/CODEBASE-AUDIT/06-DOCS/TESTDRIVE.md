# Docs group: TESTDRIVE

| File | Type | Title / evidence | Bytes | Read status |
|---|---|---|---:|---|
| `docs/TESTDRIVE/20261103T2100Z/backend-narrative.md` | .md | Backend Watch Narrative â€” TestDrive 20261103T2100Z — **Role:** backend watchdog (read-only) Â· **Driver:** `learning-loop` Â· **Window:** 21:20:50Zâ€“21:42:42Z (15:20â€“15:42 CST). | 9053 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/backend-watch.jsonl` | .jsonl | {"ts":"2026-11-03T21:21:37.591Z","seq":1,"source":"backend-watch","testId":"PHASE","step":"phase_start","action":"observe","target":"server+db","runId":null,"eventSeq":null,"result":"unknown","note":"baseline runCount=11 | 6683 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/baseline/hashes.json` | .json | [ { "path": "ns 1\\Polsia\\.git\\config", "sha256": "393C952C05FD4A241BD6646A609679882A2EE54A1FB0478687382FCE64250E91", "bytes": 557 }, { "path": "ns 1\\polsia-work\\build\\swarm-2026-10-28\\auditor\\copies\\w4\\.git\\co | 1583 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/defects.md` | .md | Matcher defects â€” TestDrive 20261103T2100Z — **Count:** 8 (2 product P3; 2 evidence P1; 2 evidence P2; 2 evidence P3). | 6133 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/driver.jsonl` | .jsonl | {"ts":"2026-11-03T21:23:40.765Z","seq":1,"source":"driver","testId":null,"step":"phase_start","action":"observe","target":"CUA isolated browser + HiveRouter desktop window","url":"http://127.0.0.1:8787/","runId":null,"ev | 18462 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/driver.md` | .md | TestDrive 20261103T2100Z â€” Driver account — **Driver:** `learning-loop` Â· **App:** `http://127.0.0.1:8787` Â· **Phase:** B2 | 5005 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/FIX1-GATE.md` | .md | FIX1 gate â€” TestDrive 20261103T2100Z — **Verdict: PASS.** Four seats reported; no out-of-scope edit found by Lead spot-check. | 1308 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/FIX2-DEFECTS.md` | .md | FIX2 defects and assignments â€” TestDrive 20261103T2100Z — Source: `defects.md` (matcher) + Lead addendum from UI/backend narratives and screenshots. | 4576 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/FIX2-GATE.md` | .md | FIX2 gate â€” TestDrive 20261103T2100Z — **Verdict: PASS.** Four FIX2 seats landed; final tree restarted and exercised. | 2009 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/fixes/td-fix-core.md` | .md | td-fix-core â€” FIX1 summary — **Scope:** `src/server/runs/**`, `db/**`, `security/**`, `logic/**`, `pipeline/**`, `llm/**` only. No server restart/install/key/git. | 3434 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/fixes/td-fix-core-fix2.md` | .md | td-fix-core â€” FIX2 CD1-D10 — **Status: DONE** â€” per-attempt budget hooks implemented; repair storm can no longer overcommit one reservation. No server restart, key, paid call, or out-of-scope edit. | 3282 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/fixes/td-fix-experience.md` | .md | td-fix-experience â€” TestDrive FIX1 — Seat: `td-fix-experience` Â· Primary: agent-experience Â· Also: forge, capability-auditor, research | 3529 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/fixes/td-fix-experience-fix2.md` | .md | td-fix-experience â€” TestDrive FIX2 (evidence/harness) — **Status: DONE** â€” six harness defects (TD1-D02, D03, D04, D06, D07, D08) closed in TestDrive v1.1.1. **No product code edited.** | 3600 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/fixes/td-fix-native.md` | .md | td-fix-native â€” FIX1 report — **Status: PARTIAL (3 real fixes GREEN; typecheck blocked by out-of-scope `e2e/ui-audit.spec.ts`)** | 3667 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/fixes/td-fix-native-fix2.md` | .md | td-fix-native â€” FIX2 report — **Defect:** TD1-D01 (P3) â€” unknown HTML route `/missing-td` returned **200** SPA fallback; TD-01 expects **404**. | 1793 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/fixes/td-fix-ui.md` | .md | td-fix-ui â€” TestDrive FIX1 — **TDFUI-01 â€” P2 â€” mobile navigation cannot be dismissed with Escape.** | 3248 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/fixes/td-fix-ui-fix2.md` | .md | td-fix-ui FIX2 â€” TD1-D09 — **Status: DONE.** Scope: `web/src/pages/RunDetailPage.tsx`, `web/src/hooks/useApi.ts`, `e2e/ui-audit.spec.ts`. No server restart, key access, installs, or paid runs. | 2404 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/mapping.md` | .md | Matcher mapping â€” TestDrive 20261103T2100Z — **Inputs:** `driver.jsonl` (37 records), `ui-watch.jsonl` (276), `backend-watch.jsonl` (13), screenshots, `ui-narrative.md`, `backend-narrative.md`. | 8869 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/PROMPTS.md` | .md | Observation prompts â€” TestDrive 20261103T2100Z — Workspace: `C:\Users\Riley\Desktop\HiveRouter`. Read the `cua-driver` skill and `docs/TESTDRIVE/20261103T2100Z/TEST-CARDS.md`. | 3221 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/TD-01-agents.png` | .png | image 884x631 .png | 103086 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/TD-01-learning.png` | .png | image 884x631 .png | 95226 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/TD-01-missing.png` | .png | image 884x631 .png | 60934 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/TD-01-native-window.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/TD-01-overview.png` | .png | image 884x631 .png | 97843 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/TD-01-run-detail.png` | .png | image 884x631 .png | 133246 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/TD-01-runs.png` | .png | image 884x631 .png | 97627 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/TD-01-settings.png` | .png | image 884x631 .png | 77259 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/TD-01-vault.png` | .png | image 884x631 .png | 76353 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/TD-02-alert.png` | .png | image 884x631 .png | 67356 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/TD-02-cost-zero.png` | .png | image 884x631 .png | 68152 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/TD-02-scrolled.png` | .png | image 884x631 .png | 67396 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/TD-02-short-brief.png` | .png | image 884x631 .png | 97848 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/TD-03-blueprint-completed.png` | .png | image 884x631 .png | 88168 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/TD-04-fullbuild-completed.png` | .png | image 884x631 .png | 80970 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/TD-05-adhoc-completed.png` | .png | image 884x631 .png | 93686 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/TD-06-revision-completed.png` | .png | image 884x631 .png | 96883 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/TD-07-learning.png` | .png | image 884x631 .png | 94694 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/TD-07-settings.png` | .png | image 884x631 .png | 76724 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/TD-08-draft-restored.png` | .png | image 884x631 .png | 92479 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0001-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0002-driver.png` | .png | image 884x631 .png | 97843 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0002-driver-window.png` | .png | image 1456x782 .png | 253817 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0003-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0004-driver.png` | .png | image 884x631 .png | 97843 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0005-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0006-driver.png` | .png | image 884x631 .png | 97843 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0007-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0008-driver.png` | .png | image 884x631 .png | 97627 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0009-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0010-driver.png` | .png | image 884x631 .png | 133246 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0011-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0012-driver.png` | .png | image 884x631 .png | 76353 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0013-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0014-driver.png` | .png | image 884x631 .png | 77259 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0015-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0016-driver.png` | .png | image 884x631 .png | 95226 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0017-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0018-driver.png` | .png | image 884x631 .png | 60934 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0019-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0020-driver.png` | .png | image 884x631 .png | 60934 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0021-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0022-driver.png` | .png | image 884x631 .png | 60934 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0023-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0024-driver.png` | .png | image 884x631 .png | 60934 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0025-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0026-driver.png` | .png | image 884x631 .png | 60934 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0027-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0028-driver.png` | .png | image 884x631 .png | 60934 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0029-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0030-driver.png` | .png | image 884x631 .png | 60934 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0031-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0032-driver.png` | .png | image 884x631 .png | 60934 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0033-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0034-driver.png` | .png | image 884x631 .png | 60934 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0035-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0036-driver.png` | .png | image 884x631 .png | 60934 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0037-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0038-driver.png` | .png | image 884x631 .png | 60934 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0039-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0040-driver.png` | .png | image 884x631 .png | 60934 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0041-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0042-driver.png` | .png | image 884x631 .png | 97848 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0043-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0044-driver.png` | .png | image 884x631 .png | 97848 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0045-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0046-driver.png` | .png | image 884x631 .png | 97848 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0047-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0048-driver.png` | .png | image 884x631 .png | 97848 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0049-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0050-driver.png` | .png | image 884x631 .png | 97848 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0051-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0052-driver.png` | .png | image 884x631 .png | 97848 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0053-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0054-driver.png` | .png | image 884x631 .png | 97848 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0055-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0056-driver.png` | .png | image 884x631 .png | 97848 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0057-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0058-driver.png` | .png | image 884x631 .png | 97848 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0059-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0060-driver.png` | .png | image 884x631 .png | 97848 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0061-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0062-driver.png` | .png | image 884x631 .png | 97848 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0063-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0064-driver.png` | .png | image 884x631 .png | 97848 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0065-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0066-driver.png` | .png | image 884x631 .png | 97848 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0067-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0068-driver.png` | .png | image 884x631 .png | 97848 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0069-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0070-driver.png` | .png | image 884x631 .png | 97654 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0071-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0072-driver.png` | .png | image 884x631 .png | 97654 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0073-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0074-driver.png` | .png | image 884x631 .png | 97654 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0075-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0076-driver.png` | .png | image 884x631 .png | 90437 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0077-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0078-driver.png` | .png | image 884x631 .png | 90437 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0079-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0080-driver.png` | .png | image 884x631 .png | 90429 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0081-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0082-driver.png` | .png | image 884x631 .png | 90437 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0083-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0084-driver.png` | .png | image 884x631 .png | 100943 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0085-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0086-driver.png` | .png | image 884x631 .png | 100957 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0087-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0088-driver.png` | .png | image 884x631 .png | 100943 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0089-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0090-driver.png` | .png | image 884x631 .png | 100943 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0091-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0092-driver.png` | .png | image 884x631 .png | 97672 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0093-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0094-driver.png` | .png | image 884x631 .png | 99477 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0095-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0096-driver.png` | .png | image 884x631 .png | 67396 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0097-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0098-driver.png` | .png | image 884x631 .png | 68486 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0099-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0100-driver.png` | .png | image 884x631 .png | 67396 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0101-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0102-driver.png` | .png | image 884x631 .png | 67396 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0103-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0104-driver.png` | .png | image 884x631 .png | 67396 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0105-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0106-driver.png` | .png | image 884x631 .png | 98143 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0107-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0108-driver.png` | .png | image 884x631 .png | 98143 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0109-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0110-driver.png` | .png | image 884x631 .png | 98143 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0111-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0112-driver.png` | .png | image 884x631 .png | 93148 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0113-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0114-driver.png` | .png | image 884x631 .png | 93148 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0115-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0116-driver.png` | .png | image 884x631 .png | 68152 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0117-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0118-driver.png` | .png | image 884x631 .png | 68152 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0119-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0120-driver.png` | .png | image 884x631 .png | 67356 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0121-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0122-driver.png` | .png | image 884x631 .png | 67356 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0123-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0124-driver.png` | .png | image 884x631 .png | 67356 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0125-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0126-driver.png` | .png | image 884x631 .png | 67356 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0127-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0128-driver.png` | .png | image 884x631 .png | 67356 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0129-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0130-driver.png` | .png | image 884x631 .png | 67356 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0131-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0132-driver.png` | .png | image 884x631 .png | 68122 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0133-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0134-driver.png` | .png | image 884x631 .png | 68125 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0135-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0136-driver.png` | .png | image 884x631 .png | 68125 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0137-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0138-driver.png` | .png | image 884x631 .png | 68125 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0139-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0140-driver.png` | .png | image 884x631 .png | 69046 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0141-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0142-driver.png` | .png | image 884x631 .png | 69046 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0143-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0144-driver.png` | .png | image 884x631 .png | 87681 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0145-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0146-driver.png` | .png | image 884x631 .png | 88168 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0147-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0148-driver.png` | .png | image 884x631 .png | 88168 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0149-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0150-driver.png` | .png | image 884x631 .png | 88168 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0151-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0152-driver.png` | .png | image 884x631 .png | 88168 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0153-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0154-driver.png` | .png | image 884x631 .png | 88168 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0155-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0156-driver.png` | .png | image 884x631 .png | 88168 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0157-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0158-driver.png` | .png | image 884x631 .png | 88168 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0159-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0160-driver.png` | .png | image 884x631 .png | 88168 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0161-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0162-driver.png` | .png | image 884x631 .png | 88168 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0163-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0164-driver.png` | .png | image 884x631 .png | 88168 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0165-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0166-driver.png` | .png | image 884x631 .png | 88168 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0167-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0168-driver.png` | .png | image 884x631 .png | 88168 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0169-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0170-driver.png` | .png | image 884x631 .png | 88168 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0171-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0172-driver.png` | .png | image 884x631 .png | 88168 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0173-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0174-driver.png` | .png | image 884x631 .png | 88168 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0175-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0177-driver.png` | .png | image 884x631 .png | 99310 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0178-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0179-driver.png` | .png | image 884x631 .png | 69297 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0180-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0181-driver.png` | .png | image 884x631 .png | 68376 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0182-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0183-driver.png` | .png | image 884x631 .png | 120667 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0184-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0185-driver.png` | .png | image 884x631 .png | 120667 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0186-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0187-driver.png` | .png | image 884x631 .png | 120903 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0188-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0189-driver.png` | .png | image 884x631 .png | 120706 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0190-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0191-driver.png` | .png | image 884x631 .png | 120826 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0192-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0193-driver.png` | .png | image 884x631 .png | 120826 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0194-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0195-driver.png` | .png | image 884x631 .png | 120826 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0196-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0197-driver.png` | .png | image 884x631 .png | 120826 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0198-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0199-driver.png` | .png | image 884x631 .png | 120568 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0200-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0201-driver.png` | .png | image 884x631 .png | 124716 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0202-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0203-driver.png` | .png | image 884x631 .png | 124716 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0204-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0205-driver.png` | .png | image 884x631 .png | 80970 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0206-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0207-driver.png` | .png | image 884x631 .png | 80970 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0208-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0209-driver.png` | .png | image 884x631 .png | 102552 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0210-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0211-driver.png` | .png | image 884x631 .png | 99295 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0212-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0213-driver.png` | .png | image 884x631 .png | 99295 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0214-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0215-driver.png` | .png | image 884x631 .png | 99295 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0216-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0217-driver.png` | .png | image 884x631 .png | 117215 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0218-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0219-driver.png` | .png | image 884x631 .png | 117238 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0220-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0221-driver.png` | .png | image 884x631 .png | 117433 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0222-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0223-driver.png` | .png | image 884x631 .png | 117431 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0224-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0225-driver.png` | .png | image 884x631 .png | 93686 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0226-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0227-driver.png` | .png | image 884x631 .png | 93686 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0228-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0229-driver.png` | .png | image 884x631 .png | 93686 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0230-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0231-driver.png` | .png | image 884x631 .png | 124716 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0232-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0233-driver.png` | .png | image 884x631 .png | 127908 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0234-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0235-driver.png` | .png | image 884x631 .png | 127908 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0236-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0237-driver.png` | .png | image 884x631 .png | 133277 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0238-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0239-driver.png` | .png | image 884x631 .png | 133277 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0240-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0241-driver.png` | .png | image 884x631 .png | 93351 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0242-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0243-driver.png` | .png | image 884x631 .png | 93456 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0244-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0245-driver.png` | .png | image 884x631 .png | 96883 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0246-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0247-driver.png` | .png | image 884x631 .png | 96883 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0248-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0249-driver.png` | .png | image 884x631 .png | 96883 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0250-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0251-driver.png` | .png | image 884x631 .png | 76724 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0252-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0253-driver.png` | .png | image 884x631 .png | 94694 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0254-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0255-driver.png` | .png | image 884x631 .png | 94694 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0256-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0257-driver.png` | .png | image 884x631 .png | 94694 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0258-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0259-driver.png` | .png | image 884x631 .png | 94694 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0260-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0261-driver.png` | .png | image 884x631 .png | 98941 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0262-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0263-driver.png` | .png | image 884x631 .png | 92895 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0264-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0265-driver.png` | .png | image 884x631 .png | 92479 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0266-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0267-driver.png` | .png | image 884x631 .png | 92479 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0268-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0269-driver.png` | .png | image 884x631 .png | 92479 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0270-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0271-driver.png` | .png | image 884x631 .png | 92479 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/screenshots/uiw-0272-desktop.png` | .png | image 1424x771 .png | 199142 | metadata+dimensions |
| `docs/TESTDRIVE/20261103T2100Z/state-TD01-agents.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p19:35", "role": "rootwebarea", "states": { "focusable": true }, "value": null, "visibility": "in_viewport" },  | 92322 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD01-agents-pre.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p18:7", "role": "rootwebarea", "states": { "focusable": true }, "value": null, "visibility": "in_viewport" }, { | 71732 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD01-initial.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p17:7", "role": "rootwebarea", "states": { "focusable": true }, "value": null, "visibility": "in_viewport" }, { | 71732 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD01-learning.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p29:7", "role": "rootwebarea", "states": { "focusable": true }, "value": null, "visibility": "in_viewport" }, { | 21298 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD01-learning-pre.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p28:5", "role": "rootwebarea", "states": { "focusable": true }, "value": null, "visibility": "in_viewport" }, { | 34615 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD01-missing.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p31:5", "role": "rootwebarea", "states": { "focusable": true }, "value": null, "visibility": "in_viewport" }, { | 13301 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD01-missing-pre.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p30:7", "role": "rootwebarea", "states": { "focusable": true }, "value": null, "visibility": "in_viewport" }, { | 21298 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD01-run-detail.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p23:9", "role": "rootwebarea", "states": { "focusable": true }, "value": null, "visibility": "in_viewport" }, { | 64218 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD01-run-detail-pre.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p22:11", "role": "rootwebarea", "states": { "focusable": true }, "value": null, "visibility": "in_viewport" },  | 55857 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD01-runs.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p21:11", "role": "rootwebarea", "states": { "focusable": true }, "value": null, "visibility": "in_viewport" },  | 55857 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD01-runs-pre.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p20:35", "role": "rootwebarea", "states": { "focusable": true }, "value": null, "visibility": "in_viewport" },  | 92322 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD01-settings.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p27:5", "role": "rootwebarea", "states": { "focusable": true }, "value": null, "visibility": "in_viewport" }, { | 34615 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD01-settings-pre.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p26:24", "role": "rootwebarea", "states": { "focusable": true }, "value": null, "visibility": "in_viewport" },  | 65871 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD01-vault.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p25:24", "role": "rootwebarea", "states": { "focusable": true }, "value": null, "visibility": "in_viewport" },  | 65871 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD01-vault-pre.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p24:9", "role": "rootwebarea", "states": { "focusable": true }, "value": null, "visibility": "in_viewport" }, { | 64218 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD02-aftertype.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p37:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 72138 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD02-alert.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p45:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 72969 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD02-attempt1.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p42:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 72508 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD02-brieftyped.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p43:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 72295 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD02-cleared.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p39:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 72547 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD02-cost0.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p41:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 72759 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD02-cost0b.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p44:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 72478 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD02-cost-uia.json` | .json | { "_note": "Prefer `elements` â€” `tree_markdown` will continue to work but new fields will only be added to the structured side. Issue #22865: use `max_elements` / `max_depth` to bound the UIA walk on apps with very large | 3647 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD02-cost-uia2.json` | .json | { "_note": "Prefer `elements` â€” `tree_markdown` will continue to work but new fields will only be added to the structured side. Issue #22865: use `max_elements` / `max_depth` to bound the UIA walk on apps with very large | 3648 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD02-focused.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p35:7", "role": "rootwebarea", "states": { "focusable": true }, "value": null, "visibility": "in_viewport" }, { | 71732 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD02-fresh.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p36:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 71797 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD02-native-uia.json` | .json | { "_note": "Prefer `elements` â€” `tree_markdown` will continue to work but new fields will only be added to the structured side. Issue #22865: use `max_elements` / `max_depth` to bound the UIA walk on apps with very large | 3698 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD02-pre-short.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p33:7", "role": "rootwebarea", "states": { "focusable": true }, "value": null, "visibility": "in_viewport" }, { | 71732 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD02-root.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p32:7", "role": "rootwebarea", "states": { "focusable": true }, "value": null, "visibility": "in_viewport" }, { | 71732 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD02-scrolled.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p40:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 72798 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD02-short.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p34:7", "role": "rootwebarea", "states": { "focusable": true }, "value": null, "visibility": "in_viewport" }, { | 71732 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD02-validbrief.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p38:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 72569 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD03-completed.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p51:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 43046 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD03-presetdone.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p49:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 73001 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD03-presetopen.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p47:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 72979 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD03-ready.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p48:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 72979 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD03-start.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p46:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 72969 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD03-started.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p50:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 40247 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD04-brief.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p53:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 72367 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD04-completed.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p57:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 64084 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD04-cost.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p54:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 72562 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD04-files.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p58:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 61581 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD04-form.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p52:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 72060 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD04-ready.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p55:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 72542 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD04-started.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p56:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 40519 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD05-agents.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p59:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 92348 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD05-completed.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p65:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 43122 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD05-costtyped.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p62:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 91265 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD05-drawer.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p60:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 90785 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD05-inputtyped.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p61:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 91265 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD05-ready.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p63:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 91291 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD05-started.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p64:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 40287 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD06-completed.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p70:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 47879 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD06-feedback.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p68:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 56500 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD06-parent.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p66:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 64084 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD06-revise.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p67:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 55958 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD06-started.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p69:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 40984 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD07-learning.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p72:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 21324 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD07-settings.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p71:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 34641 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD08-after-reload.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p76:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 71326 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD08-before-reload.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p75:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 71560 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD08-filled.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p74:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 71365 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/state-TD08-start.json` | .json | { "content_refs": [ { "actions": [], "frame": "main", "name": "HiveRouter â€” AI Agent Coding Router", "ref": "p73:0", "role": "rootwebarea", "states": { "focusable": true, "focused": true }, "value": null, "visibility": " | 71610 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/SUMMARY.md` | .md | TestDrive 20261103T2100Z â€” summary — **App:** HiveRouter B2 Â· **Skill:** testdrive v1.2.0 Â· **Key:** fingerprint `c30cfdbc`, balance $19.04, never printed Â· **Window:** 1426Ã—773 client area (outer 1440Ã—780), on-screen, not zoomed/iconic. | 2266 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/TD-08-RESTART.md` | .md | TD-08 Lead-owned restart evidence — **TestDrive run:** `20261103T2100Z` | 1058 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/TEST-CARDS.md` | .md | Test cards â€” TestDrive 20261103T2100Z — Order is mandatory. No live card may start while a run is active. Driver resolves accessible names/refs from the current CUA snapshot; never hardcode stale refs or pixels. | 5201 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/timeline.json` | .json | { "drive": "20261103T2100Z", "generatedAt": "2026-11-03T21:43:50.0343965Z", "counts": { "driver": 37, "uiWatch": 276, "backendWatch": 13 }, "driverPhaseEnd": "2026-11-03T21:41:21.069Z", "uiPhaseEnd": "2026-11-03T21:42:05 | 397930 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/ui-narrative.md` | .md | TestDrive 20261103T2100Z â€” UI Watchdog Narrative — **Observer:** `watchdog` (UI watchdog, Phase 2) | 9702 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/ui-watch.jsonl` | .jsonl | {"ts":"2026-11-03T21:22:24.9635912Z","seq":1,"source":"ui-watch","testId":"PRE","step":"phase_start","action":"observe","target":"desktop:HiveRouter","windowId":"9765866","result":"unknown","screenshot":"C:\\Users\\Riley | 199412 | head-read |
| `docs/TESTDRIVE/20261103T2100Z/WAVE-SHEET.md` | .md | Wave sheet â€” TestDrive 20261103T2100Z — **App:** `C:\Users\Riley\Desktop\HiveRouter` Â· `http://127.0.0.1:8787` Â· phase B2. | 2696 | head-read |
| `docs/TESTDRIVE/INDEX.md` | .md | TestDrive index — / Run / Date / App / Result / Artifacts / | 337 | head-read |
| `docs/TESTDRIVE/LEDGER.md` | .md | TestDrive ledger — Append-only. One block per run: start â†’ seats â†’ cards â†’ defects â†’ fixes â†’ gates â†’ lesson. | 1222 | head-read |
| `docs/TESTDRIVE/PRE-RUN-AUDIT.md` | .md | Pre-run audit â€” TestDrive v1.1 — 4. **Window state.** `HiveRouter.lnk` exists; launcher started the app; window verified 1440Ã—780, not zoomed/iconic. | 2462 | head-read |