# Wave 9 — tab-by-tab trace and repair

Date: 2026-11-05
Baseline before audit: `32345d3` (428 tests / 66 files; 29 E2E; 195 stage files)
Final gates after audit: **438 tests / 69 files**, **30/30 E2E**, stage **199 files / 50 tables / 62 routes / 24 scripts**, preflight PASS (free RAM 2.38 GB, disk 9.13 GB), `verify` exit 0.

## Scope walked, in order

1. Overview (composer, provider, stage, stats, recent runs)
2. Agents (37 cards, search/group/output filters, drawer, prompt edit/save/reset, ad-hoc run, evidence)
3. Chat (threads, send, SSE status, cancellation, job fields, token usage)
4. Runs (status filter, ledger rows, run-detail tabs: Overview, Files, Search, Checks, Routing, Context, Repairs, Confidence, Events)
5. Analysis (dominators, scorecards)
6. Scripts (catalog, dry-run, paid refusal)
7. Vault (tree, file preview, refresh)
8. Learning (refused state, disabled tabs, refresh)
9. Settings (key status, runtime settings, safety posture)
10. Shell (nav, mobile menu, scrim, skip link, API-offline banner)

## Confirmed defects and fixes

| ID | Tab | Defect | Root cause (file:line) | Fix | Evidence |
|---|---|---|---|---|---|
| W9-01 | Chat | A measured prompt count with an unknown completion count rendered `0 out` | `web/src/pages/ChatPage.tsx` used `job.completionTokens ?? 0` | Shared `formatChatTokenUsage` keeps each measurement independent; both unknown means "not reported" | `test/unit/chat-usage.test.ts` 4 tests; full suite |
| W9-02 | Chat | Replaying an idempotency key after newer turns returned every job in the thread, not the original message's jobs | `src/server/chat/store.ts` replay path used `snapshot.jobs.map(...)` | Query `chat_jobs WHERE user_message_id = existing.id` and return only those ids | `test/unit/chat-store.test.ts` replay test; full suite |
| W9-03 | Agents | Saving a prompt returned `saved:true`, but detail/list still showed the registry prompt; the drawer's "Full prompt" omitted the runtime contract | `toAgentView` returned `agent.prompt`; overrides were only read by the snapshot builder | New `agents/overrides.ts`; both list/detail apply the effective override; `systemPrompt` includes agent/contract headers; snapshot uses the same builder; `PUT` validates `[ROLE]`/`[OBJECTIVE]` and returns `E_PROMPT_OVERRIDE_INVALID` | `test/unit/agent-prompt-override.test.ts` 3 tests; live PUT/GET; E2E prompt round-trip |
| W9-04 | Runs | `?status=not-a-status` returned an empty `200` instead of a named refusal | `GET /api/runs` passed any string to SQL | Validate against `RUN_STATUSES`; `E_INVALID_RUN_FILTER` 422 | `test/unit/runs-list-api.test.ts`; live 422 |
| W9-05 | Run detail | Search/download blocked only `queued`/`running`; `paused` and `needs_review` slipped past the UI's "terminal only" rule | `src/server/app.ts` duplicate status checks | Both routes now require `TERMINAL_STATUSES` | Static diff + full E2E (negative path unverified) |
| W9-06 | Run detail | Files-content route read any path in the run workspace, including non-artifacts | Route checked only `safePath`, not artifact membership | Require a persisted artifact row; non-artifact path returns `E_FILE_NOT_FOUND` | Live: artifact 200, `RUN_REPORT.md` 404 |
| W9-07 | Run detail | A download whose artifact rows existed but whose bytes were gone returned an empty zip with 200 | `download` built an empty entries map and continued | Refuse with `E_ZIP_EMPTY` when no bytes are present | Code path only; negative fixture not run |
| W9-08 | Vault | Refresh reloaded the tree but left the selected file preview stale | Refresh called only `tree.reload()` | Refresh increments a file nonce included in `VaultFile`'s resource dependencies | Code path; no automated test |
| W9-09 | Agents | Refresh reloaded agents but not provider-key status, so live-run availability stayed stale | Refresh called only `agents.reload()` | Refresh now reloads key status too | Code path; no automated test |
| W9-10 | Scripts / Runs / Events | Stale dry-run result remained beside a new error; runs empty state said "No runs recorded" under a filter; persisted Events error had no retry | component state/copy/ErrorPanel props | Clear result on retry; status-aware copy; pass `persistedEvents.reload` | Code path; no automated test |

## Claims and evidence

| Claim | Evidence | Status |
|---|---|---|
| 438 tests pass | `npm.cmd test` → 69 files / 438 tests | VERIFIED |
| 30 E2E pass | `npm.cmd run e2e` → 30 passed (1.1m) | VERIFIED |
| Stage is 199/50/62/24 | `assert-stage --stage=p7` → files 199, tables 50, routes 62, scripts 24, violations [] | VERIFIED |
| Preflight passes | `preflight --port 0` → free RAM 2.38 GB, disk 9.13 GB | VERIFIED |
| Prompt override round-trips | live PUT 200, GET detail `promptSource=override`, list same; invalid 422; reset 200 | VERIFIED |
| Invalid run status is refused | live `GET /api/runs?status=nope` → 422 `E_INVALID_RUN_FILTER` | VERIFIED |
| Files content only serves artifacts | live artifact 200/4991 bytes; `RUN_REPORT.md` 404 `E_FILE_NOT_FOUND` | VERIFIED |
| Empty-zip refusal | not exercised with a wiped artifact fixture | UNVERIFIED |
| Vault preview refresh | not exercised with changed file bytes | UNVERIFIED |
| Events retry button | not exercised with an induced `/events` failure | UNVERIFIED |
| Search/download reject `paused`/`needs_review` | static check only; no negative fixture | UNVERIFIED |
| Chat replay returns only original jobs | `chat-store` test with two turns and replay | VERIFIED |
| Chat unknown usage never shown as zero | 4 formatter tests | VERIFIED |

## Probe corrections / test-harness notes

- The initial broad Playwright `getByRole('cell', {name:'preflight',exact:true})` was a test-harness defect; the cell's accessible name includes multiple columns. Fixed to a row-level locator.
- The earlier CUA native pixel click on Chromium content remained `effect:unverifiable` and is not claimed as product proof.
- No paid provider call was made in this audit. Provider behavior is not newly verified.

## Residual

The fixes above do not add `needs_review`/approval, repo tools, the tool-call loop, P7 evaluation, full checkpoints, parallel generation, or module wiring; those remain in `docs/BACKLOG.md`.
