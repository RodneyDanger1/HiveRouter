# plan-audit-math — seat 5 journal

HEAD: n/a (no git repository; no product code) · Scope: `docs/PLAN-v2.md` §6, §10, §15, §17, §21-references · Budget: 15 min work + 5 min check
STATUS: DONE

## 09:24 — research
Read `docs/PLAN-v2.md` in full (454 lines; headings at L1–L446). Read `docs/PLAN-AUDIT/WAVE-SHEET.md` (41 lines). Confirmed: repository has 0 product files under `src/`, `web/`, `test/`, `scripts/`; only `docs/PLAN-AUDIT/WAVE-SHEET.md` and `docs/PLAN-v2.md` exist. No git repo. No product code to test; audit must be plan-text/math based.

## 09:25 — probes (static, plan text)
command: `Select-String -Path docs\PLAN-v2.md -Pattern '20%|accept ≥0.75|retry 0.45|§21|syntax for T0/T1|PageRank|Jaccard|EV =|run_snapshots|budget_reservations|qualitySource|E_BUDGET|REPAIR_STALLED|MISSING_DEPENDENCY|CONTEXT_INFEASIBLE'`
observed: W02 L78 and §6.1 L139 both contain “20% repair reserve”; §6.1 L139 uses “$0.001; ≤$0.50” and “20% reserved”; §6.4 L161 says “syntax for T0/T1”; §6.5 L165 has “accept ≥0.75” and “retry 0.45–0.75”; §6.3 L157 says “Jaccard ≥0.80 … max 200 clusters”; §6.6 L169 gives `EV = pSuccess*value - cost - λ*time`; §6.9 L186 lists `run_snapshots`/`budget_reservations` under “New tables” for P6a; §6.1 L135 says `qualitySource:"prior"`, `sampleSize:0`.

## 09:27 — final static probes
command: heading list + `Select-String -Pattern '§21'` + refusal-token grep
observed: 17 headings; **2** `§21` references (L24, L114); **0** headings named §21; v2 ends at §17. Refusal tokens show `NO_CAPABLE_AGENT` (L143) and `REPAIR_STALLED` (L157/§15 L365) vs `E_REPAIR_STALLED` (§14 L352/§15 L361); `CONTEXT_INFEASIBLE` (L143/§15 L364) but §14 has `E_PROMPT_TOO_LARGE`; `MISSING_DEPENDENCY` absent; `RISK_UNVERIFIABLE` has no trigger sentence; `ALL_CANDIDATES_DISABLED` overlaps `NO_CAPABLE_AGENT`.

## 09:28 — hypothesis set (before report)
H1: RVS allows T2/T3 code without syntax (P0) — discriminator: mandatory-set truth table.
H2: Budget reserve is double-counted / units can overspend (P1) — discriminator: cap arithmetic.
H3: CPO/FSN/RVS/CCA/CRA contracts/call sites/refusals are underspecified (P1) — discriminator: missing schemas/call sites/ambiguous intervals.
H4: Traceability/staging references are stale (§21, A tables in P6a) (P2) — discriminator: heading/table grep.
H5: P7 route-threshold language contradicts no-route-learning (P2) — discriminator: cross-section text.

## 09:30 — RED evidence (no product code; plan/math RED)
- D01: T2 `.py` syntax error; mandatory set = path/secret/plan/stub; syntax not present ⇒ gate can pass.
- D02: cap $0.50; ledger reserve $0.10 + CCR reserve $0.10 + one $0.45 route ⇒ $0.55; or silence.
- D03: 3 × $0.1667 with $0.001 floor units = $0.498 selected, actual $0.5001 > $0.50.
- D04: optional `config.py` → required `main.py`; DP skip breaks required dep.
- D05: normalization/denominator and tie key undefined; rank changes with candidate-set composition.
- D11: raw 0.75 matches accept and retry; raw 0.45 matches retry and needs_review.
- D12: `EV` subtracts USD cost and λ*time without a USD unit; content_filter/aborted unmapped.
- D15: 2 §21 refs, 0 §21 headings.
- D16: A tables `run_snapshots`/`budget_reservations` listed in P6a.
- D17: A1-A5 refusals bare/incorrect; R1 “etc.”; missing route_candidates/confidence outcome.
- D18: blanket provenance claim; no per-source license/version row.
- D19: `eval-router` route-policy/threshold variants vs no route-policy learning.
- D20: LG1 3×4 vs 6 gate states; LG3 “depth” direction undefined; LG4 micro-USD unit absent.

## 09:31 — fix scope
Wrote only `docs/PLAN-AUDIT/05-algorithms.md` (defect register, exact patches, GREEN tests, cross-section contradictions, clean checks, claim strength, skills, sources, patch map) and this journal. No product code, canonical plan, other reports, git, installs, API/key access.

## 09:34 — read-back verification
command: `Get-Item docs\PLAN-AUDIT\05-algorithms.md, logs\plan-audit-math.md`
observed: both files created; report contains D01–D20, Phase 1 JSONL (20 records), patch map, Mermaid not required for this seat, cross-section list, clean checks, claim-strength table.

## Missed / limits
- No product code exists; all GREEN verification is **proposed**, not executed. RED is plan-text/math, not runtime.
- No external fetch; license/version claims in D18 are UNVERIFIED by design.
- DP/candidate-set complexity is bounded in the plan (≤24 tasks, ≤500 units); I did not measure runtime.
- §21 does not exist in v2; reported as D15 rather than inventing a section.
- Watchdog may disagree on severity; D01 is the only P0 because it permits acceptance of syntactically invalid code.

## Files changed
- `docs/PLAN-AUDIT/05-algorithms.md`
- `logs/plan-audit-math.md`

STATUS: DONE
