# FIX2 gate — TestDrive 20261103T2100Z

**Verdict: PASS.** Four FIX2 seats landed; final tree restarted and exercised.

| Check | Result |
|---|---|
| `npm.cmd run typecheck` | PASS |
| `npm test -- --run` | 28 files / **214 tests PASS** |
| `npm run e2e` on restarted tree | **24/24 PASS** (API 9, app 3, UI 12) |
| `GET /missing-td` | **404 text/html**; `/`, `/agents`, `/runs/:id`, `/vault`, `/settings`, `/learning` still **200** |
| Completed run detail | **Complete · snapshot**, zero `/stream` requests; no “Live stream” badge |
| TD-08 restart | before/after `runCount=15` (11 baseline + 4 live), same tokens/cost, active `null`, no interrupted run |
| `assert-stage --stage=p7` | PASS, strict, 47 routes |
| testdrive skill | v1.2.0, both roots SHA-256 `51643FD9DF009F5C24C1298A74E48E289192411EF1A3654033698F010D91A9A3` |

## Fix receipts

| Defect | Fix |
|---|---|
| TD1-D01 unknown HTML route 200 | `src/server/app.ts` notFoundHandler: known SPA routes 200; unknown 404 index; API unchanged |
| TD1-D09 terminal run shows Live stream | `RunDetailPage` resolves terminal before stream; terminal badge `Complete · snapshot`/`Terminal · snapshot`; no SSE; E2E asserts 0 stream requests |
| TD1-D10 repair retries share reservation | `llm/client` per-attempt start/end + `agent-runner` per-attempt reserve/commit; regression test `llm-budget-repair.test.ts` |
| TD1-D02..D08 evidence/harness | testdrive v1.2.0: action-time flush, field-value readback, one phase_end, contiguous terminal eventRange, client-area tolerance, CUA title false-negative handling |

## Residual

- TD-01 remains **UNVERIFIED** for driver route-title evidence; 404 and visible route content are now correct.
- TD-08 draft/DB/restart verified; exact client-area 1426×773 vs outer 1440×780 is accepted frame/client difference.
- Internal HTTP 5xx retries within one attempt still share that attempt's reservation (not exercised).
- P7 live promotion, whole-tree atomic finalize, A/B1 runtime remain accepted limits.
