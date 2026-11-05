# QA WAVE 1 — Round 2 `qa-auditor-r2` journal

**Agent:** `qa-auditor-r2` (independent auditor, round 2)
**Workspace:** `C:\Users\Riley\Desktop\HiveRouter`
**Mode:** read-only product audit; writes limited to `docs/QA-WAVE-1/07-auditor-r2.md` and this log. No product/plan edits, installs, git writes, or key reads.
**No key access:** server already had a key; no key value read or printed; no live provider call.

## Timeline (America/Chicago, 2026-11-03)

- **10:51** — Read `docs/QA-WAVE-1/P1-FIXES.md` (13 dispositions) and `07-auditor.md` (13 P1s). Server 8787 PID 19200 started 10:48; app.ts 10:46, run.ts 10:45. Read package/lock hashes.
- **10:52** — Read fixed code: `runs/budget.ts` (overcommit/scopeCap), `runs/manager.ts` (cancel/maxCost), `verify/verifier.ts` (RVS plan), `pipeline/run.ts` (trace, ad-hoc tests, finalize guard), `app.ts` (features, badges, maxCost, P7 refusals), scripts `build-repo-map.ts` / `integrity-check.ts`.
- **10:53** — First final gates: `verify` PASS (210 tests / 26 files; stub 80 clean; secret 127 clean); build PASS; stage PASS strict but **scripts:0**; preflight PASS. Stage scripts 0 traced to `package.json` **UTF-8 BOM** (`EF BB BF`); `assert-stage` JSON.parse returned `[]`, silently disabling the script allowlist check. Recorded as a transient fake-green.
- **10:54** — E2E attempted: **7 failed ECONNREFUSED**; server had stopped after the earlier session. Started the current tree once with `npm.cmd start` (not a live-process restart); health B2 ok; E2E **7/7 passed**. Wrapper job later exited 1 while the detached server remained healthy (PID 17508).
- **10:55** — Runtime probes: `GET /api/agents` → 37 agents, `schemaValid=0`, `representativeLive=4`, `mockRun=0`; `POST /api/learning/approvals` → 422 `E_LEARNING_POOL_EXHAUSTED`; `GET /openapi.json` → 40 paths / 3 schemas.
- **10:56** — RVS runtime probe with a temp `App.tsx` and the exact `availableChecks` from `run.ts`: plan marks `syntax.tsx` unverified; verifier emits mandatory `syntax.tsx:unverified` and mandatory `syntax.all:unverified`; **valid TSX gate fails**. New P0/P1 R2-01.
- **10:57** — Targeted `logic-core` + `quality` tests: 22 passed (overcommit actual, needs_review cancel, maxCost cap). `integrity` on existing run: artifact hashes + `manifestParity.ok:true`; vault parity absent.
- **10:58** — Package BOM was gone (`7B 0A 20`); `assert-stage` now reports **scripts:23**, strict PASS. Final `verify` PASS (210 tests, 80 stub files, 127 secret files). Preflight PASS (disk 5.24, RAM 2.67). Wrote `07-auditor-r2.md` and this log.

## P1 disposition summary

- PASS: AUD-2, AUD-6, AUD-7, AUD-10.
- PASS-WITH-NOTES: AUD-1 (accepted risk), AUD-3 (terminal cancel still true), AUD-5 (schema-valid 0/37, no producer), AUD-8 (symlink follow), AUD-9 (vault parity absent), AUD-11 (API-only feature gate), AUD-12 (final warning, no pause), AUD-13 (state refusals accepted).
- **FAIL: AUD-4** — RVS plan used, but TSX/JSX missing from available checks makes valid React/NDS builds fail. New R2-01.

## Evidence captured

- `npm.cmd run verify` exit 0; 210 tests / 26 files; stub 80 clean; secret 127 clean.
- `npm.cmd run e2e` 7/7 after starting current tree; prior ECONNREFUSED recorded.
- `assert-stage --stage=p7 --json`: strict, fallback false, 125 files/45 tables/46 routes/23 scripts, violations [].
- `preflight --port 0 --json`: ok, disk 5.24, RAM 2.67, Node/npm/Chrome/port pass.
- `integrity --run run_007238d763a3956e74 --json`: ok, manifestParity ok.
- Agents badges: 37 / schema 0 / live 4 / mock 0.
- Learning approval: 422 `E_LEARNING_POOL_EXHAUSTED`.
- OpenAPI: 40 paths / 3 schemas.
- RVS probe: mandatory `syntax.tsx` + `syntax.all` unverified for valid TSX.
- Package BOM transient: `EF BB BF` at 10:56, gone at 10:58; stage scripts 0 → 23.

## Limits / unverified

- No live promotion/rollback (no 390-case pool/consent).
- No A/B1 runtime start; feature gate only code/API path.
- No full paid 3-file build; no key access this round.
- No E2E traces/screenshots (disabled).
- Symlink containment for repo-map and vault parity for integrity unverified.
- Server start was necessary because the shared process was down; no live-process restart.

**Status:** DONE. NO-GO for testing until R2-01 and the named partials are closed or accepted.
