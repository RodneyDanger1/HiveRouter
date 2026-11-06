# Docs group: CHAT-WAVE-1

| File | Type | Title / evidence | Bytes | Read status |
|---|---|---|---:|---|
| `docs/CHAT-WAVE-1/backup/config/releases/p7.json` | .json | { "stage": "p7", "label": "B2", "paths": [ "src/", "web/", "scripts/", "test/", "e2e/", "config/", "public/", "package.json", "playwright.config.ts" ], "tables": [ "schema_migrations", "runs", "steps", "events", "artifac | 2486 | head-read |
| `docs/CHAT-WAVE-1/backup/docs/PLAN-v3.md` | .md | HiveRouter â€” Build Plan v3 (Standalone, Audit-Closed) — **Status:** authoritative implementation plan. v3 **replaces** v1/v2 as the source of truth. The seven seat reports and the independent auditor's first pass are evidence; this file is the contract. | 53879 | head-read |
| `docs/CHAT-WAVE-1/backup/README.md` | .md | HiveRouter — - Node.js **26.7.0**, TypeScript **5.9.3** | 12567 | head-read |
| `docs/CHAT-WAVE-1/backup/src/server/app.ts` | .ts | REPRESENTATIVE_LIVE — (no extractable prose in first 64 KiB) | 50836 | head-read |
| `docs/CHAT-WAVE-1/backup/src/server/db/database.ts` | .ts | db — (no extractable prose in first 64 KiB) | 5161 | head-read |
| `docs/CHAT-WAVE-1/backup/src/server/db/migrations.ts` | .ts | A_SQL — (no extractable prose in first 64 KiB) | 15791 | head-read |
| `docs/CHAT-WAVE-1/backup/src/server/index.ts` | .ts | closing — (no extractable prose in first 64 KiB) | 2708 | head-read |
| `docs/CHAT-WAVE-1/backup/src/shared/features.ts` | .ts | PHASE — (no extractable prose in first 64 KiB) | 411 | head-read |
| `docs/CHAT-WAVE-1/backup/src/shared/refusals.ts` | .ts | RefusalDefinition — (no extractable prose in first 64 KiB) | 12465 | head-read |
| `docs/CHAT-WAVE-1/backup/web/src/api.ts` | .ts | API_BASE — keep text | 18023 | head-read |
| `docs/CHAT-WAVE-1/backup/web/src/api-types.ts` | .ts | PromptAnalysisResponse — (no extractable prose in first 64 KiB) | 5618 | head-read |
| `docs/CHAT-WAVE-1/backup/web/src/App.tsx` | .tsx | meta — (no extractable prose in first 64 KiB) | 1682 | head-read |
| `docs/CHAT-WAVE-1/backup/web/src/components/AppShell.tsx` | .tsx | NAV — (no extractable prose in first 64 KiB) | 6906 | head-read |
| `docs/CHAT-WAVE-1/baseline.sha256` | .sha256 | DBD67B176019CBDD6AA1D42A10F637DE8539D1004EC843805851F2084CF09D27 src/server/db/migrations.ts 7E1AC48CD315576DFD19389889B8945816E70DA020594FF0FD64193DE5EAE662 src/server/db/database.ts 826499516BB5688A7D9622DA2ECA82E02B9E | 1146 | head-read |
| `docs/CHAT-WAVE-1/data-audit.ts` | .ts | db — (no extractable prose in first 64 KiB) | 1600 | head-read |
| `docs/CHAT-WAVE-1/final-shot.ts` | .ts | browser — (no extractable prose in first 64 KiB) | 863 | head-read |
| `docs/CHAT-WAVE-1/live-chat.json` | .json | { "liveThreadVisible": true, "liveJobFields": 1, "liveStatusMentions": 4, "newThreadVisible": true, "assistantCount": 1, "pendingCount": 1, "consoleErrors": [ "Failed to load resource: the server responded with a status  | 349 | head-read |
| `docs/CHAT-WAVE-1/live-chat.png` | .png | image 1440x1000 .png | 112912 | metadata+dimensions |
| `docs/CHAT-WAVE-1/live-chat.ts` | .ts | base — (no extractable prose in first 64 KiB) | 2510 | head-read |
| `docs/CHAT-WAVE-1/live-chat-final.png` | .png | image 1440x1000 .png | 107822 | metadata+dimensions |
| `docs/CHAT-WAVE-1/live-chat-message.png` | .png | image 1440x1000 .png | 110626 | metadata+dimensions |
| `docs/CHAT-WAVE-1/PLAN.md` | .md | CHAT-WAVE-1 â€” live-chat projection, durable agent jobs, residual fields — **Status:** implemented; verification in progress. | 7882 | head-read |
| `docs/CHAT-WAVE-1/preflight.json` | .json | > hive-router@0.1.0 preflight > tsx scripts/preflight.ts --port 0 --json { "schema": "hive.cli.v1", "ok": true, "command": "hive.preflight", "code": null, "data": { "checks": [ { "name": "node", "ok": true, "actual": "v2 | 1763 | head-read |
| `docs/CHAT-WAVE-1/RECEIPT.md` | .md | CHAT-WAVE-1 â€” receipt — **Goal:** add the missing live-chat projection, a real durable agent-job worker/reaper, and the residual projection fields to HiveRouter B2 â€” without mocks, fake success, or provider-key exposure. | 6732 | head-read |
| `docs/CHAT-WAVE-1/sse.json` | .json | { "status": "ok", "events": [ { "seq": 1, "type": "chat.thread.updated" }, { "seq": 2, "type": "chat.message.created" }, { "seq": 3, "type": "chat.message.created" }, { "seq": 4, "type": "chat.job.queued" }, { "seq": 5,  | 555 | head-read |
| `docs/CHAT-WAVE-1/sse-check.ts` | .ts | base — (no extractable prose in first 64 KiB) | 1604 | head-read |
| `docs/CHAT-WAVE-1/TRACE.md` | .md | CHAT-WAVE-1 â€” trace — / Surface / Control / Verdict / Evidence / | 2505 | head-read |
| `docs/CHAT-WAVE-1/verify.out.txt` | .txt | > hive-router@0.1.0 verify > npm run typecheck && npm run test && npm run build && npm run stub-sweep && npm run secret-scan > hive-router@0.1.0 typecheck > tsc --noEmit > hive-router@0.1.0 test > vitest run RUN v5.1.0 C | 21016 | head-read |