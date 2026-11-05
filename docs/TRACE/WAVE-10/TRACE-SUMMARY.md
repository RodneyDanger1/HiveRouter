# Wave 10 — search index freshness

Date: 2026-11-05
Baseline: `60203e5` (438 tests / 69 files; 30/30 E2E; 199 stage files / 50 tables)
Final: **440 tests / 69 files**, 30/30 E2E, **199 files / 51 tables / 62 routes / 24 scripts**, `verify` exit 0, preflight PASS (free RAM 1.92 GB, disk 9.07 GB).

## Problem

`searchRunWorkspace` treated a non-empty `run_search_docs` as fresh. If a published file was edited, deleted, or added after the first search, the cached FTS document was never invalidated and stale matches were served as current.

## Change

- New `run_search_index` table: `run_id`, `workspace_signature`, `indexed_files`, `indexed_at`.
- New workspace signature over sorted eligible path + byte size + mtimeMs. Missing workspace → `missing`.
- On each search: compute signature, compare state and actual doc count; build (`built`), rebuild (`rebuilt`), or reuse (`reused`).
- Rebuild happens before query results are served.
- Response adds `indexState`; UI renders `index built on demand`, `index rebuilt: workspace changed`, or `index reused`.
- No path input, no workspace write, no provider call, no generated-code execution.

## RED evidence

Temporarily restored the old `run-search.ts` from `HEAD` and ran the new tests:

```
Test Files  1 failed (1)
Tests  4 failed | 1 passed (5)
AssertionError: expected undefined to be 'built'  (first.indexState)
```

The failing tests included the edit-rebuild and delete-rebuild paths. Restored the new file:

```
Test Files  1 passed (1)
Tests  5 passed (5)
```

## Acceptance evidence

| Claim | Evidence | Status |
|---|---|---|
| First search builds | `test/unit/run-search.test.ts` `indexState='built'` | VERIFIED |
| Unchanged workspace reuses | second search `indexed=false`, `indexState='reused'`; E2E second Search click finds `index reused` | VERIFIED |
| Edited file rebuilds | test writes a new token to `src/a.ts`; next search `indexState='rebuilt'`, new token found, old token absent | VERIFIED |
| Deleted file rebuilds | test deletes `src/b.md`; next search `indexState='rebuilt'`, file count 1, old path absent | VERIFIED |
| Missing workspace is honest | first `built` / zero files / no matches; repeat `reused` / zero | VERIFIED |
| Live response exposes state | `POST /api/runs/run_c41f1fb4779d302af7/search` → `indexState='reused'`, `indexed=false`, 14 files, 10 matches on both calls | VERIFIED |
| Stage table census | `assert-stage --stage=p7` → 51 tables, violations [] | VERIFIED |
| Full gates | `npm test` 440/69; `npm run e2e` 30; `npm run verify` exit 0; preflight PASS | VERIFIED |
| Freshness is cryptographic | mtime+size can miss same-size/same-mtime edits | UNVERIFIED / accepted limitation |

## Live note

The live run already had an index state row from the E2E pass, so its first live call reported `reused`, not `built`. The `built` and `rebuilt` paths are proven by the isolated unit tests, not fabricated live claims. No production run workspace was mutated to force a live rebuild.

## Residual / next

- Content hash freshness remains a possible later upgrade if the cost is acceptable.
- External repository indexing and repo tools remain P1-1/P1-2.
- Approval/`needs_review`, checkpoints, parallel generation, P7 evaluation, module wiring, weighted CPM, mobile/keyboard, CI/license/dependency work remain open in `docs/BACKLOG.md`.
- No paid provider call was made.
