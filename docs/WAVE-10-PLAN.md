# Wave 10 decision plan — search index freshness

Date: 2026-11-05
Owner: HiveRouter lead
Baseline: `60203e5` (438 tests / 69 files; 30/30 E2E; 199 stage files / 50 tables / 62 routes / 24 scripts)
Scope item: `docs/BACKLOG.md` P2-3 — **Search index freshness**.

## Execution status

Implemented and verified: `run_search_index`, workspace signature, built/reused/rebuilt response and UI, RED/GREEN tests, E2E 30/30, full suite 440/69, stage 199 files / 51 tables / 62 routes / 24 scripts, preflight PASS. Evidence: `docs/TRACE/WAVE-10/TRACE-SUMMARY.md`.

## 1. Outcome

After this wave, searching a terminal run’s published workspace detects whether the files changed since the last search. An unchanged workspace reuses the index; a changed workspace rebuilds it before returning matches; the API and Search tab report `built`, `reused`, or `rebuilt` truthfully. A missing workspace remains an honest empty result.

## 2. Current behavior (evidence)

- `src/server/search/run-search.ts:106-111` counts `run_search_docs` and rebuilds only when the count is zero.
- `:105-139` therefore silently serves stale matches after a published file is edited, renamed, deleted, or added.
- `run_search_docs` has no state row for the indexed file set or its metadata; `SEARCH_SQL` only creates docs and FTS tables.
- The route accepts only a query/limit and never a path (`src/server/app.ts:933-955`).
- `RunSearchResponse` has `indexed: boolean` only (`web/src/api-types.ts:132-141`), so the UI cannot distinguish first build from rebuild.
- Existing tests pin first build, reuse, short-query fallback, and missing workspace, but not workspace mutation (`test/unit/run-search.test.ts`).

## 3. Decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Store a workspace signature (sorted eligible path + size + mtimeMs) in `run_search_index` | Content hashing every file on every search | Content hashing defeats the cache; mtime+size is a bounded standard freshness signal. The index remains disposable and is rebuilt from content. |
| Rebuild synchronously before serving when the signature differs | Serve stale results with a warning | A “freshness” feature that still returns stale matches is a lie. The index is small and bounded at 2,000 files. |
| Keep `indexed` for compatibility and add `indexState: 'built'|'reused'|'rebuilt'` | Replace `indexed` | Existing clients/tests use `indexed`; additive field avoids a needless break. |
| New table `run_search_index(run_id PK, workspace_signature, indexed_files, indexed_at)` | Add columns to `run_search_docs` | A run-level state row is the correct cardinality; docs rows are per file. |
| Signature covers all eligible candidates, including files beyond the 2,000 cap | Signature only over indexed files | A file moving into the cap must invalidate the index; the extra stat work is bounded by the walk already performed. |
| Missing workspace records `signature='missing'`, zero files | Treat it as stale forever or error | Repeated searches should reuse the honest empty state; creating files later changes the signature. |
| UI says “rebuilt: workspace changed” | Generic “indexed” | The operator needs to know the cache was invalidated, not just that files exist. |

## 4. File-by-file change

### `src/server/db/migrations.ts` — `SEARCH_SQL`

Add:

```sql
CREATE TABLE IF NOT EXISTS run_search_index (
  run_id TEXT PRIMARY KEY,
  workspace_signature TEXT NOT NULL,
  indexed_files INTEGER NOT NULL,
  indexed_at TEXT NOT NULL
);
```

Keep the table in the existing `040_p7_search` group; `initDb` executes the group idempotently on every B2 start, so existing databases gain the table without a destructive migration.

### `src/server/search/run-search.ts`

- Add `IndexState = 'built' | 'reused' | 'rebuilt'` and `indexState` to `WorkspaceSearchResult`.
- Add `workspaceSignature(workspacePath): { signature: string; files: string[] }`:
  - missing workspace → `{ signature: 'missing', files: [] }`.
  - `listFiles`, filter `shouldIndex`, sort, and hash `path\0size\0mtimeMs` with SHA-256.
  - Exclude files that are non-files; no content read.
- Add `readIndexState(runId)` and `writeIndexState` in the same transaction as `clearRun`/inserts.
- `indexRun` accepts the signature and files, writes the state row, returns `{ indexedFiles, signature }`.
- `searchRunWorkspace`:
  1. compute signature/files.
  2. read state.
  3. if no state → build (`indexState='built'`).
  4. if signature differs → rebuild (`'rebuilt'`).
  5. else reuse (`'reused'`).
  6. bounded query/match logic unchanged.
- Preserve `indexed: true` for build **and** rebuild; `false` for reuse.
- No new path input, no write to workspace, no provider call.

### `web/src/api-types.ts`

Add `indexState: 'built' | 'reused' | 'rebuilt'` to `RunSearchResponse`.

### `web/src/pages/RunDetailPage.tsx`

Replace the binary `result.indexed ? 'index built on demand' : 'index reused'` copy with explicit states:
- `built`: “index built on demand”
- `rebuilt`: “index rebuilt: workspace changed”
- `reused`: “index reused”
Keep the existing file count and truncation badge.

### `config/releases/p7.json`

Add `run_search_index` to `tables` (50 → 51).

### Tests — `test/unit/run-search.test.ts`

Add:
1. **reuse:** first search builds; unchanged second search is `indexState='reused'`, `indexed=false`.
2. **mutation:** edit `src/a.ts` to contain a new token; next search is `indexState='rebuilt'`, finds the new token, no longer matches the removed token.
3. **delete:** remove `src/b.md`; next search is `rebuilt`, `indexedFiles` decreases, match disappears.
4. **missing workspace:** first call `built`, second `reused`, zero files, no matches.
5. Existing tests remain unchanged except expected `indexState` additions where already touched.

### Docs / census

- `docs/PLAN-v3.md`: append Wave 10 with gates and evidence.
- `docs/CAPABILITY-MATRIX.md`: search row says “detects workspace mutation and rebuilds”.
- `docs/BACKLOG.md`: mark P2-3 delivered; keep the remaining list.
- `README.md`: update table count 50→51 and describe freshness.
- `docs/TRACE/WAVE-10/TRACE-SUMMARY.md`: evidence, claims, residual.

## 5. Failure modes

| Failure | Behavior |
|---|---|
| Workspace missing | `signature='missing'`, zero indexed files, empty matches; second search reuses |
| File >256 KB | Excluded from docs; signature still covers it, so its mtime change triggers a harmless rebuild |
| File renamed/deleted | Signature differs; rebuild; old doc rows cleared |
| Empty/NUL file | Indexed file excluded from docs; signature covers it; no invented content |
| Symlink | `listFiles` skips; signature excludes |
| Concurrent first searches | `tx` serializes writes; both may rebuild, final state matches last signature; no partial docs |
| Index state row absent (upgrade) | Treat as stale; rebuild on first search |
| Workspace unreadable / stat race | Per-file stat failure skips that file; if the signature cannot be computed, fall back to rebuilding and do not claim freshness |
| Query invalid | Existing 422 `E_SEARCH_INVALID_QUERY` |

## 6. Acceptance tests and commands

```powershell
npm.cmd test -- --run test/unit/run-search.test.ts
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run e2e
npm.cmd run assert-stage -- --stage=p7 --json
npm.cmd run preflight -- --port 0 --json
```

Acceptance:
- unchanged workspace → `indexState='reused'`, no rebuild.
- edited/deleted/added file → `indexState='rebuilt'`, new content searchable, removed content absent.
- first search → `indexState='built'`.
- missing workspace → `built`, zero files, then `reused`, zero matches.
- stage table count **51** (new `run_search_index`); assert-stage is authoritative.
- E2E run-detail Search still passes.

## 7. Rollback

- Drop `run_search_index`; remove `indexState` from result/UI; revert `searchRunWorkspace` to count-only rebuild.
- No run data or accepted artifact is touched; the index is disposable. A rollback leaves the previous stale-cache behavior but no lost user data.
- Existing `run_search_docs`/FTS tables remain compatible.

## 8. Out of scope / blockers

- External repository indexing (P1-1) and repo tools (P1-2).
- Approval/`needs_review` (P1-5), checkpoints (P1-6), parallel generation (P1-7).
- P7 evaluator/promotion (P2-1), multi-process chat (P2-2), mobile/keyboard pass (P2-4).
- Content hashing every file on every search; cryptographic freshness is an accepted limitation of mtime+size, tested as such.
- No paid provider call.
