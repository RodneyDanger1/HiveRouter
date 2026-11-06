# 05 Scripts, config, root code

Generated from the tracked tree and `CODE-INDEX.json`. Every row was read at least at head/target depth; full source path, imports, exports and role evidence are recorded.

## Script and config map

| Entry | Role | Read/write or paid? |
|---|---|---|
| `preflight.ts` | Free RAM/disk/Chrome/node/port checks | read-only |
| `stub-sweep.mjs` | Forbidden placeholder scan | read-only |
| `check-secrets.mjs` | Secret-pattern scan | read-only |
| `assert-stage.mjs` | Path/table/route/script allowlist census | read-only |
| `key-import.ts` | Local app-secret/env key ingress; bounded regular file/stdin; no echo | writes app secret only |
| `bench-suite.ts` | Offline algorithm benchmark | no provider |
| `eval-router.ts` | Router evaluation | no provider |
| `replay-run.ts` | Replay stored run evidence | read-only/DB |
| `build-repo-map.ts` | Lightweight symbol/import map of a generated run | read-only |
| `context-pack-report.ts` | CPO report | read-only |
| `integrity-check.ts` | Run/ledger integrity probe | read-only |
| `learn.ts`, `learning-admin.ts` | Learning admin/refusal paths | guarded writes/refusals |
| `live-smoke.ts` | Explicit live provider smoke; `--yes` required | paid when explicitly run |
| `screenshot.mjs` | UI screenshot helper | local UI only |
| `config/releases/{a,p6a,p7}.json` | Stage path/table/route/script allowlists | config |

| File | Lines | Role / first evidence | Imports (selected) |
|---|---:|---|---|
| `config/releases/a.json` | 34 | { "stage": "a", "label": "A", "paths": [ "src/shared/", "src/server/config.ts", "src/server/index.ts", "src/server/app.ts", "src/server/env.ts", "src/server/db/", "src/server/llm/", "src/server/pipeline/", "src/server/ru |  |
| `config/releases/p6a.json` | 27 | { "stage": "p6a", "label": "B1", "paths": [ "src/shared/", "src/server/config.ts", "src/server/index.ts", "src/server/app.ts", "src/server/env.ts", "src/server/db/", "src/server/llm/", "src/server/pipeline/", "src/server |  |
| `config/releases/p7.json` | 51 | { "stage": "p7", "label": "B2", "paths": [ "src/", "web/", "scripts/", "test/", "e2e/", "config/", "public/", "package.json", "playwright.config.ts" ], "tables": [ "schema_migrations", "runs", "steps", "events", "artifac |  |
| `scripts/assert-stage.mjs` | 344 | (no extractable prose in first 64 KiB) | node:fs, node:path |
| `scripts/bench-suite.ts` | 68 | (no extractable prose in first 64 KiB) | ../src/server/agents/registry.js, ../src/server/config.js, ../src/server/security/keys.js, ../src/shared/algorithms.js |
| `scripts/build-repo-map.ts` | 85 | * build-repo-map.ts * Lightweight symbol/import map for a generated run (no tree-sitter, no network). * Exit 0 pass, 2 usage, 3 not found, 9 internal. | ../src/server/config.js, ../src/server/db/database.js, node:fs, node:path |
| `scripts/check-secrets.mjs` | 169 | (no extractable prose in first 64 KiB) | node:fs, node:path |
| `scripts/context-pack-report.ts` | 58 | * context-pack-report.ts * Summarize persisted context packs for a run. Read-only. * Exit 0 pass, 2 usage, 3 not found, 9 internal. | ../src/server/config.js, ../src/server/db/database.js, node:fs, node:path |
| `scripts/eval-router.ts` | 45 | * eval-router.ts * Offline summary of deterministic route decisions. Read-only; no provider calls. * Exit 0 pass, 6 insufficient data, 9 internal. | ../src/server/config.js, ../src/server/db/database.js, node:fs, node:path |
| `scripts/integrity-check.ts` | 73 | * integrity-check.ts * Recompute artifact hashes and compare against the stored manifest/registry. * Exit 0 pass, 2 usage, 3 not found, 5 mismatch, 9 internal. | ../src/server/config.js, ../src/server/db/database.js, node:crypto, node:fs |
| `scripts/key-import.ts` | 66 | (no extractable prose in first 64 KiB) | ../src/server/config.js, ../src/server/security/keys.js, node:fs |
| `scripts/launch-desktop.ps1` | 80 | (no extractable prose in first 64 KiB) |  |
| `scripts/learn.ts` | 90 | (no extractable prose in first 64 KiB) | ../src/server/config.js, ../src/server/db/database.js, ../src/server/learning/consent.js, node:fs |
| `scripts/learning-admin.ts` | 88 | (no extractable prose in first 64 KiB) | ../src/server/db/database.js, ../src/server/learning/index.js, node:fs |
| `scripts/live-smoke.ts` | 68 | (no extractable prose in first 64 KiB) | ../src/server/config.js, ../src/server/llm/client.js, ../src/server/security/keys.js, ../src/server/security/redact.js |
| `scripts/preflight.ts` | 311 | * Preflight gate. Read-only: it never opens a key, a DB, or the network. * Exit codes: 0 pass, 2 usage, 7 resource/browser/port refusal, 9 internal. | node:child_process, node:fs, node:net, node:os |
| `scripts/replay-run.ts` | 71 | * replay-run.ts * Reconstruct a run from persisted events and artifacts. Never calls the LLM. * Exit 0 pass, 2 usage, 3 not found, 4 integrity failure, 9 internal. | ../src/server/config.js, ../src/server/db/database.js, node:crypto, node:fs |
| `scripts/screenshot.mjs` | 28 | * screenshot.mjs â€” evidence-only UI capture. Not part of the product runtime. | @playwright/test, node:fs, node:path |
| `scripts/stub-sweep.mjs` | 166 | (no extractable prose in first 64 KiB) | node:fs, node:path |