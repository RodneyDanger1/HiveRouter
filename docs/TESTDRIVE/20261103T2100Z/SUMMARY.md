# TestDrive 20261103T2100Z — summary

**App:** HiveRouter B2 · **Skill:** testdrive v1.2.0 · **Key:** fingerprint `c30cfdbc`, balance $19.04, never printed · **Window:** 1426×773 client area (outer 1440×780), on-screen, not zoomed/iconic.

## Cards

| Card | Result | Evidence |
|---|---|---|
TD-01 launch/window/nav | **UNVERIFIED** | 37 agents, all routes rendered, `/missing-td` now 404; driver `page.title=about:blank` false-negative; window client 1426×773 vs 1440×780 accepted |
TD-02 validation | **PASS (outcome)** | empty/short disabled; cost 0 inline alert; no POST/run; short-brief screenshot inconsistent (driver evidence defect, fixed in skill) |
TD-03 blueprint | **PASS** | `run_9b144184491ce0f41b`, completed, $0.00100005, BLUEPRINT.md |
TD-04 full build | **PASS** | `run_063580525bb149f98d`, completed, $0.007642302, two artifacts, 5 checks pass |
TD-05 ad-hoc | **PASS** | `run_faf2600e5bf180b0dc`, completed, $0.0003135, `src/td_adhoc.py` |
TD-06 revision | **PASS** | child `run_32b087305f87bfa8bf`, parent unchanged, $0.00300495 |
TD-07 security/learning | **PASS** | key 403; learning `E_LEARNING_POOL_EXHAUSTED`; no key, no fake promotion |
TD-08 persistence/restart | **PARTIAL → verified** | draft reload passed; Lead restart preserved 15 runs, active null; exact client geometry accepted |

Live spend **$0.011960802**; total DB cost $0.07927932; no active run after.

## Defects

- **Product fixed:** D01 unknown HTML route 404; D09 terminal run “Live stream”/SSE; D10 JSON-repair reservation overcommit.
- **Evidence/harness fixed in skill v1.2.0:** D02 geometry tolerance, D03 action-time flush, D04 single phase_end, D06 contiguous eventRange, D07 field-value readback, D08 CUA title false-negative.
- **Accepted:** D05 restart done by Lead; TD-01 route-title evidence remains unverified; short-brief visual inconsistency.

## Final gates

`verify` PASS (214 tests / 28 files); `e2e` **24/24**; strict stage 47 routes; preflight PASS; live smoke PASS; window/route/404/live-stream fixes verified; skill hashes equal `51643F…A9A3`.

Artifacts: driver.jsonl/driver.md, ui-watch.jsonl/ui-narrative.md, backend-watch.jsonl/backend-narrative.md, timeline.json/mapping.md, defects.md, FIX1/FIX2 gates, fixes/, screenshots/.
