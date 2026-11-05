# IMPROVE-WAVE-7 — final closure audit

- **Role:** independent closure verification (auditor protocol) plus UI/control trace (trace protocol).
- **Tree state:** product/test files frozen at the Wave 7 hashes below; only docs/trace evidence added since the independent audit.
- **App:** `http://127.0.0.1:8787`, B2, healthy; no active run.
- **Verdict:** **PASS-WITH-NOTES**. No new product defect; two low-severity residuals remain documented, not hidden.

## Quiescence / territory

| File | SHA-256 |
|---|---|
| `src/server/runs/recorder.ts` | `52C468137695E944072788E3492AED7FE5274FC4B328D23F3ACF2306E7B9833A` |
| `web/src/api.ts` | `A67F13477B516069E885DAC69E558567A1028AA5E962AEBB2C65F7F193D303F3` |
| `web/src/pages/RunsPage.tsx` | `AC49CCF80312657DA9BC76CF9508318195A11B0CD614675DCCC099C73B40A8D4` |
| `web/src/pages/SettingsPage.tsx` | `B02A692E150E9643FF7FA850ADD383F0E3128D864AAE5E4328B8C5364FF0FDE4` |
| `test/unit/run-transition-guard.test.ts` | `C126A93B6EA3E11876CF4ADF0C6D4E401DF1408268FA3D9B99B329740073529E` |
| `e2e/ui-audit.spec.ts` | `295F270545F9E40DA15E32D8767490848EA4B953726E15A2D14CABD46BA57C77` |

These match the frozen auditor snapshot. The earlier `audit2/` attempt was stopped before a verdict; it is **not** evidence of record and is marked incomplete. No product/test/config/DB/P7/workspace writes were made in this closure.

## Gates (verified this closure)

| Gate | Result |
|---|---|
| `npm.cmd test -- --run` | **51 files / 317 tests passed**, 0 failed/skipped |
| `npm.cmd run verify` | exit 0; typecheck/build/stub-sweep clean (86), secret-scan clean (161) |
| `npm.cmd run e2e` | **26/26 passed** |
| `npm.cmd run assert-stage -- --stage=p7 --json` | **163 files / 45 tables / 48 routes / 24 scripts**, violations `[]` |
| Active run | `null` |
| Run ledger | 30 runs; total measured cost `$1.188757662`; no synthetic data |
| F1 docs check | no stale `315 tests` / `GREEN 3/3` in README/PLAN; docs now 317/5-of-5 |

## Trace evidence (`/tracer`)

`docs/IMPROVE-WAVE-7/trace/trace.json` and screenshots:

- **6 app pages** rendered: Overview, Agents, Runs, Vault, Learning, Settings.
- **Runs filter:** initial 30 rows; `status=failed` request observed with **3 rows**; `status=queued` **0 rows**; UI says server-filtered. This proves the client-side 100-row filter is gone for status changes.
- **Settings:** rendered text contains `LIMITS.MAXRUNCOSTUSD`, `LIMITS.EVENTREPLAYWINDOW`, `LIMITS.MAXFILES`; no `[OBJECT OBJECT]`, no `sk-` key material.
- **Terminal run detail:** `run_c41f1fb4779d302af7`, completed, 14 artifacts, 77 persisted events, cost `$0.051059388`; **8/8 tabs** selected and visible (Overview/Files/Checks/Routing/Context/Repairs/Confidence/Events).
- Console: only the known `/favicon.ico` 404; no failed requests, no runDetail error.
- No active run before/after trace.

## Auditor notes / residual

| ID | Finding | Status |
|---|---|---|
| F1 | README/PLAN still claimed 315 tests and 3/3 after phase tests added | **fixed** (docs only; 317 tests / 5-of-5) |
| F2 | Runs count is returned-row count, not a total; 100-row display cap remains (>100 matches show 100) | **documented, not fixed** |
| F3 | Phase-only CAS race throws `to=undefined` in `recorder.ts`; fail-closed but imprecise | **documented, not fixed** |
| F4 | Missing-run status write is a silent no-op; invalid status is a pre-existing ZodError | **documented, not fixed** |
| — | Full `PHASE_TRANSITIONS` graph remains intentionally unwired; only status/terminal-phase invariants are live | **deliberate scope** |
| — | Second `audit2` attempt stopped without a verdict | **not used; marked incomplete** |

## Claims register

| Claim | Status |
|---|---|
| Status guard rejects illegal transitions and preserves legal lifecycle writes | **VERIFIED** (guard tests + prior 100-case audit; hashes unchanged) |
| Runs filter is server-side and includes failed/queued | **VERIFIED** (trace requests + row counts) |
| Settings exposes nested limits without object/key leak | **VERIFIED** (trace + E2E) |
| 317 tests / 26 E2E / 163-file stage | **VERIFIED** (commands above) |
| Phase matrix is fully implemented | **UNVERIFIED / FALSE — deliberately unwired** |
| >100-match filter total is accurate | **UNVERIFIED — F2 cap remains** |
| Build independently verified by previous auditor | **VERIFIED by Lead in this closure; `audit2` did not complete** |
