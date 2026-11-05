# plan-audit-delivery — Seat 7 journal

**STATUS:** DONE (plan audit only; no product edits)
**Checkpoint:** `docs/PLAN-v2.md` SHA-256 `8AD841C5…18F2`; repo empty except audit tree.
**Scope:** §3, §9, §10, §18, §19, §20. **Budget:** 09:22–09:37 America/Chicago.
**Write scope:** this log + `docs/PLAN-AUDIT/07-delivery.md` only.

## 09:22 — instruction / research
- Read WAVE-SHEET in full: seat 7 = delivery gates, phases, team, pins, resources, acceptance.
- Lead corrected canonical plan to `docs/PLAN-v2.md`; read all 454 lines.
- Loaded nine required lenses: smartfix, logic-debugger, integration-logic, logic-gatekeeper, research, capability-auditor, auditor, forge, forgewright-lead.
- Hypotheses before probing:
  - H1: “no P6/P7 in Release A” is prose-only; layout/DB/commands mix stages.
  - H2: phase assignments for the four logic modules contradict the traceability matrix.
  - H3: P7 “refused” is incompatible with a 50-case P7 gate and DoD.
  - H4: 7 GB disk guard vs 5.8 GB assumption is unsatisfiable on this host.
  - H5: exact-pin and command claims are incomplete; `npm ci` precedes the lockfile.

## 09:24 — plan structure / verification
Command: `Select-String '^## ' docs\PLAN-v2.md`
Observed: headings `## 0` … `## 17` only. No top-level §18/§19/§20/§21.
Command: `Select-String '§18|§19|§20|§21' docs\PLAN-v2.md`
Observed: §19 only line 23 (reference); §21 only line 24; §18 only line 268 as a patch bullet. No §20.
=> D01 RED (canonical plan not self-contained).

## 09:25 — staging contradiction
- §0.3: “zero P6/P7 tables, routes, pages, scripts”.
- §8 “§5 Layout”: adds `src/server/{routing,context,repair,quality,retry,logic,learning}/**`, `web/src/pages/Learning*`, `scripts/**`, `eval/suites/**` with only “P7 files are not in Release A”.
- §6.9: “New tables” includes A tables (`run_snapshots`, `budget_reservations`) plus P6a tables.
- §10: lists `learn`/`eval:router` without stage.
=> D02 RED (no executable stage allowlist); D04 (logic module phases) also visible.

## 09:26 — resources / pins / Chrome
Command: `Get-PSDrive C` → FreeGB 5.78.
Command: `Get-CimInstance Win32_OperatingSystem` → FreePhysicalMemory 2.12 GB.
Command: `chrome.exe --headless=new --disable-gpu --no-first-run --user-data-dir=… --dump-dom about:blank` → `<html>…</html>`, exit 0. Chrome 156.0.8078.75.
Command: `npm view …` for pins/engines:
- parse5@8.1.0 exists; diff@9.0.0 exists; langgraph 1.6.0 peer core ^1.1.48 + zod ^3.25||^4.2; core 1.3.4; zod 4.6.7; ts 5.9.3.
- Vite 8.3.5 node ^20.19||>=22.12; Vitest 5.1.0 node ^22.12||^24||>=26; plugin-react 6.2.1 peers optional; @playwright/test 1.64.1 node >=20.
=> D03 RED: W14 7 GB guard vs measured 5.78 GB. D07 partial: six pins resolve, full pin table absent. D09: system Chrome works but E2E config missing.

## 09:27 — P7 gate arithmetic
- §3: P7 stops at `refused`, A/B1 ship.
- §9: P7 gate requires 50 paired cases + screening gate.
- §7.1: `<12 ⇒ refused`, `12–49 ⇒ shadow-only`.
- §11 DoD #3: P7 must implement 50-case suites.
=> D05 RED (three outcomes for one fixture).
- Five no-effect candidates × 50-case single-use suites = 250 minimum; pool size absent; dev/holdout unstated.
=> D06 RED (test unbuildable as written).

## 09:28 — phase ownership / commands / scopes
- §6.7: “P6a Logic modules (4)”; §9 P6a “4 logic modules”; §15: LG1/LG2/LG4 P1, LG3 P6a.
=> D04 RED.
- §9 P0–P5 gate starts `npm ci`; repo empty (no package.json/lockfile).
- §10 lists scripts without required args (`learn`, `replay`, `eval:router`, `test:live` undefined; `verify` undefined).
=> D07/D08 RED.
- §0.9 points to missing §19; §9 team scope says Lead `src/server/{core,...}`; `logic`/`scripts`/tests overlap.
=> D13 RED.
- P6a/P7 gates omit stub/secret sweeps; §10 has no sweep command.
=> D11 RED.
- §10 only “old-DB migration”; no crash/retention/stage-table test.
=> D12 RED.
- P6a/P7 “A gate +” could re-run live A gate; no gate receipt/balance floor.
=> D14 P2.

## 09:29 — patch design
- D01: add §18/§19/§20; fix §0.9→§19, §0.10→§15, §8 §18 ref, DoD #1.
- D02: stage manifests `config/releases/{a,p6a,p7}.json` + `scripts/assert-stage.mjs`; migration prefixes.
- D03: choose 4.5 GB guard or cleanup-to-7 GB; `E_RESOURCE_INSUFFICIENT`.
- D04: LG1/LG2/LG4 P1; LG3 P6a; update §6.7/§9.
- D05: P7_PASS / P7_REFUSED / P7_INVALID outcome matrix; DoD 3a/3b.
- D06: maxCandidates=5; pool ≥300; disjoint 50-case folds; refuse below.
- D07: full exact pin table; packageManager/engines; P0a install then P0 `npm ci`.
- D08: §20 command table with args/exit codes/phase.
- D09: `channel:'chrome'`, temp DATA_DIR, mock webServer, workers 1, preflight.
- D10: preflight disk/RAM; `NODE_OPTIONS=--max-old-space-size=1024`; sequential build.
- D11: `stub-sweep`/`secret-scan` every gate; planted fixtures.
- D12: migration/crash/retention/stage-table fixtures.
- D13: §19 file-level ownership table.
- D14: `gate_receipts`; balance preflight; CI mock-only.
- D15: §20 evidence template with command/output/hash/provenance.

## 09:30 — report written / read-back
Command: `write docs/PLAN-AUDIT/07-delivery.md` → Created.
Read-back: report contains 15 defects, cross-section list, clean checks, claim strength, skills, sources; no product/canonical edits.
Command: `Get-FileHash`/`Get-Item` will be used by Lead; report hash recorded after write.

## Verification / limits
- This is a **plan audit**, not a build: `npm ci`, build, tests, E2E, live smoke, migration/crash tests were **not run** (no installs/paid calls/key allowed). Those are UNVERIFIED.
- No canonical/product file edited; only this log and 07-delivery.md written.
- No secret read, printed, or stored. No DeepSeek API call.
- Residual risk: 4.5 GB disk threshold and 1.5 GB RAM floor are inferred, not measured against a real install; the Lead must confirm after P0a.
- D05/D06 overlap learning-statistics seat; reported as **delivery gate testability**, not a statistical claim.
- D09 Chrome probe proves the browser exists, not that Playwright E2E runs.

**STATUS: DONE.**
