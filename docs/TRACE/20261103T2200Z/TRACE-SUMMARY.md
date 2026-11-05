# TRACE campaign 20261103T2200Z — summary

**App:** HiveRouter B2 · **Trace skill:** v1.1.0 (both roots, SHA-256 `FFA9995F46402AA60266D25EDBBF1665773DD21A541EBB48DED397A1D60BEDF6`) · **Seats:** capability auditor → forge → forgewright lead, strict sequential handoff.

## Coverage

- **299 controls / 8 surfaces:** Overview 30, Agents 51, Runs 43, Run detail 34, Vault 95, Learning 21, Settings 12, Agent drawer 13.
- `traces.json`: **239 entries** — 10 grouped shell families (70 instances) + 229 per-control local entries.
- Verdicts: **253 WIRED-AND-WORKS / 36 UNVERIFIED / 1 WIRED-BUT-DEAD / 9 REFUSED-BY-NAME**.
- Live chain census: 37/37 agent details 200, 15/15 run snapshots 200, 75/75 vault files 200, 8/8 run-detail tabs, 6/6 shell nav clicks; no paid run.
- Auditor false negatives quarantined: stateful `Open navigation` locator, vault directory selected as first row, direct-URL inventory, CUA title mismatch.

## Confirmed defects and fixes

| ID | Defect | Fix | Verification |
|---|---|---|---|
| TRACE-01 | Agent detail lost badges/evidence | Shared `toAgentView` enrichment for list + detail (`app.ts:31-76,223,232`) | live detail badges `registered,representative-live`, 5 evidence rows; unit parity + E2E |
| TRACE-02 | `route_candidates` persisted but `/routing` hardcoded empty | Query/map candidates + model/chosen reasons (`app.ts:305-378`) | live `decisions=2 candidatesTotal=2 firstCandidates=1`; unit |
| TRACE-03 | Revise `files[]` stored but never read; all files revised | Validate against parent artifacts, pass in `metadata.revisionFiles`, read in pipeline before executor | unit `[A,B]→[A]`, no-scope all, invalid `E_INVALID_REVISION_SCOPE`; live paid revision not run |
| TRACE-04 | `schema-valid` badge had no producer | Always write `schema-valid` evidence after validated success; add representative-live where applicable | unit router step → `['schema-valid']`; new live badge requires a new run |
| TRACE-05 | `POST /api/runs` accepted bogus preset/model/thinking | Runtime enum arrays + 422 `E_INVALID_RUN_INPUT` before create | live 422 with allowed/observed details; run count unchanged |
| TRACE-06 | Terminal Events tab hid persisted events | `getRunEvents` + shared mapper + terminal fetch/merge/loading/error | E2E terminal Events tab shows persisted ledger; 322 events available |

## Gates

- `npm.cmd run typecheck` → **PASS**
- `npm.cmd test -- --run` → **29 files / 220 tests PASS**
- `npm.cmd run build` → **PASS** (Vite, 656 kB JS)
- `npm.cmd run e2e` → **26/26 PASS**
- `assert-stage --stage=p7` → **PASS strict** — 134 files, 45 tables, 47 routes, 23 scripts
- `preflight --port 0` → **PASS**
- `test:live` → **PASS** `$0.00001605`
- layout matrix → **42/42, 0 failures**
- Key fingerprint only (`c30cfdbc`); no key read/logged; no paid tracing.

## Residual

- TRACE-03 paid live revision not run (unit invariant only); TRACE-04 live badge needs a new successful run; TRACE-01/02/06 live verified. No test weakening. The six defects are fixed in source and the restarted process; TRACE-03/04 remain UNVERIFIED at the paid/live-run level only.
