# FIX1 gate — TestDrive 20261103T2100Z

**Verdict: PASS.** Four seats reported; no out-of-scope edit found by Lead spot-check.

| Check | Result |
|---|---|
| `npm.cmd run typecheck` | PASS (clean) |
| `npm test -- --run` | 27 files / **213 tests PASS** |
| `npm run e2e` on restarted fixed tree | **23/23 PASS** (API 8, app 3, UI audit 12) |
| `assert-stage --stage=p7` | PASS, strict, **47 routes**, routes/tables/scripts present |
| Server restart | launcher started fixed tree; health B2; key env fingerprint only; no active run |

## Seat receipts

- `td-fix-ui`: mobile Escape close, honest Learning availability copy, unknown key-check timestamp. Files: AppShell/Overview/Settings.
- `td-fix-core`: low-cap output fitting; `needs_review` interruption on startup. Files: runs/manager, pipeline/agent-runner.
- `td-fix-native`: typed OpenAPI responses; run-list limit normalization; checks subresource. Files: app.ts, openapi-schema, stage manifests, api E2E.
- `td-fix-experience`: ad-hoc tests target rule; Audit hidden without artifacts. Files: AgentsPage, RunDetailPage, UI E2E.

**Residual:** revision/audit cost cap not user-adjustable; snapshot lacks limits for CostMeter; JSON-repair retry overcommit candidate; per-file finalize accepted. These are FIX2 candidates if the drive exposes them.
