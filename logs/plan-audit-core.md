# plan-audit-core — Seat 1 Journal

**Wave:** PLAN-AUDIT-1 · **Seat:** 1 `plan-audit-core` · **Scope:** core lifecycle §0/§3/§4/§8/§9/§10/§14/§15/§17
**Target:** `C:\Users\Riley\Desktop\HiveRouter\docs\PLAN-v2.md` (454 lines; mtime 2026-11-03 09:24)
**Budget:** 15 min work + 5 min check (seat); no product code exists.
**STATUS:** DONE (document audit; no runtime claims).

## 09:22 — task clock (prompt) / first reads
- Task received at `2026-11-03T09:22:04-06:00` (prompt clock).
- Read `docs/PLAN-AUDIT/WAVE-SHEET.md` (41 lines): seat scope, forbidden actions (no product code/canonical plan/other reports/installs/API/key), required report fields, RED→patch→GREEN gate.
- Checked `HiveRouter` tree: only `docs/PLAN-AUDIT/WAVE-SHEET.md` exists in docs; plan v2 not yet present at first listing.

## 09:28:52 — clock check (Get-Date)
- `T1=2026-11-03 09:28:52 -06:00`; `T2=2026-11-03 09:28:53 -06:00`.
- `PLAN-v1_exists=False`; `PLAN_v2_lines=454`; `WAVE_lines=41`.
- Read v2 headings: §§0–17 only; no §19, no §21. Traceability is §15; sources §17; diagrams §16.
- Read v2 in full (lines 1–454), then re-read the core sections against exact line numbers.

## Hypotheses (ranked before findings)
- **H1 (confirmed):** v2 is an amendment that says v1 §§1–19 remain in force, but v1 is not in the repo; §0/§5 point at §19/§21 which do not exist. Discriminator: `Test-Path docs/PLAN-v1.md` + heading scan. Result: false/absent; references unresolved. → D1.
- **H2 (confirmed):** Release A snapshots/budget/gate/idempotency tables are listed in the P6a section while §0 says A has zero P6/P7 tables. Discriminator: compare §3 A contents, W01/W02, §6.9 table list, §0.17. Result: contradiction. → D2.
- **H3 (confirmed):** W07 says “no partial writes” but the repair node writes the project before the gate rerun. Discriminator: graph `verify→repair→verify` + W07 text + no staging object in the plan. Result: unimplementable invariant. → D3.
- **H4 (confirmed):** core run creation is not idempotent; `E_ACTIVE_RUN_EXISTS` and “concurrent-run race test” cannot both be true as written; `idempotency_keys` is P6a. Discriminator: §14 vs W02 vs §6.9. Result: contradiction. → D4.
- **H5 (confirmed):** the “global” ledger has no global cap, no crash recovery, and no exact missing-usage rule; money rule is micro-USD only in the pure module, not the service boundary. Discriminator: W02 text vs LG4 text. Result: missing invariants. → D5.
- **H6 (confirmed):** LG2 has no enums/phase attempts; a failed phase is terminal, so the repair loop cannot legally rerun; `REPAIR_STALLED` has no status home. Discriminator: LG2 text vs §8 graph vs W07. Result: dead/illegal transition. → D6.
- **H7 (confirmed):** gate precedence `budget > failed` can hide a hard failure; LG1 and FSN both define a “failure signature” for stall detection. Discriminator: LG1 precedence + W07 + FSN signature. Result: ambiguous/lying status. → D7.
- **H8 (confirmed):** SSE replay has no subscribe/query order, no truncation/expiry refusal, no slow-client bound; 500-event window vs 10k replay test. Discriminator: W06 vs §10 vs test matrix. Result: lost/duplicate/incomplete streams. → D8.

## RED evidence (READ/INFERRED — no product code, no runs)
- **RED-D1:** `docs/PLAN-v2.md:30` says v1 §§1–19 remain in force; v2 ends at §17; `docs/PLAN-v1.md` absent; §0.9 says §19, §0.10/§5 say §21. Expected plan-lint: all refs resolve + v1 exists; actual: 3 unresolved refs + missing file. (Textual contradiction, READ.)
- **RED-D2:** `:17` A zero P6/P7 tables; `:65` A includes snapshots/budget/SSE; `:186` lists `run_snapshots (A)`, `budget_reservations (A)`, `gate_decisions`, `idempotency_keys` under P6a. Expected A migration has tables; actual plan assigns them to P6a. (READ.)
- **RED-D3:** `:82` “no partial writes”; `:252` `verify→repair→verify`; no staging path. Test design: repair writes syntax error, verify fails, accepted hash must stay `H0`; plan has no mechanism to satisfy. (Test design, INFERRED.)
- **RED-D4:** `:87` active run 409; `:78` concurrent-run race; `:350` idempotency only new P6a/P7 surfaces; `:186` `idempotency_keys` P6a. Test design: same `Idempotency-Key` twice; expected same run/one reservation; actual plan gives 409 or duplicate. (Test design, INFERRED.)
- **RED-D5:** `:78` per-run/eval/cycle caps but no global cap; no reservation recovery; `:178` micro-USD only in pure policy. Test design: crash-after-reserve; expected orphan release; actual no rule. (Test design, INFERRED.)
- **RED-D6:** `:176` LG2 terminal rule; `:252` repair loop. Test design: verify attempt 1 failed → attempt 2; expected new attempt; actual contract has no attempt identity. (Test design, INFERRED.)
- **RED-D7:** `:175` precedence `budget > failed`; `:82`/`:157` both use “failure signature”. Test design: hard fail + budget exhausted → expected failed; actual precedence budget. (Test design, INFERRED.)
- **RED-D8:** `:81` 500-event window; `:288` 10k replay; no gap signal. Test design: reconnect with old cursor → expected named truncation/snapshot-required; actual silent partial. (Test design, INFERRED.)
- **RED-D9:** `:89`/`:254` additive migrations, crash consistency, 7 GB guard; no lock/reconciliation/threshold. Test design: kill after file write before artifact row; expected orphan reconciliation; actual no algorithm. (Test design, INFERRED.)
- **RED-D10:** `:143` `NO_CAPABLE_AGENT...`; `:352` `E_*`; `:363`/`:365` mixed; `FORBIDDEN_*` no `E_`. Test design: grep tokens vs §14 enum; expected zero unknown; actual ≥7 mismatches. (READ.)
- **RED-D11:** `:67` 50-case pool; `:209` re-freeze per evaluation; `:213` five candidates; `:278` 50 pairs; `:302` refused is valid. Test design: 5 candidates from 50 cases → must reuse; expected 5 disjoint suites. (READ/INFERRED.)
- **RED-D12:** `:77` snapshot “prompt versions/hashes”; `:238` prompt_versions; no append-only/content store. Test design: edit prompt mid-run; expected old body/hash used; actual plan cannot retrieve old body if edited/deleted. (READ/INFERRED.)
- **RED-D13:** `:252` “Release A graph unchanged”; v1 absent; no preset matrix; W13 audit. Test design: blueprint zero-file run reaches verify and fails. (READ/INFERRED.)
- **RED-D14:** `:24` one artifact/one type; `:380` INFRA row of five; `:369` LG1 P1/P6a. Test design: matrix lint; actual row lacks IDs/phases. (READ.)
- **RED-D15:** `:341` hive.api.v1 for new surfaces; `:256` existing routes v1 envelope; W12 core refusals on existing routes. Test design: core active-run 409 shape; actual two contracts. (READ.)
- **RED-D16:** `:448` prose source list; no URL/date/claim rows. Test design: source-lint; actual zero rows. (READ.)

## Patch synthesis (exact text in the report)
- D1: add canonical corpus + `docs/PLAN-v1.md` requirement; fix §19→§9 and §21→§15; add `scripts/plan-lint.mjs`.
- D2: move A tables into `001_core.sql`; §6.9 consumes A tables; P6a adds only its tables; schema-ownership test.
- D3: repair staging `.staging/repair-<round>` + atomic promote + `attempts/` + `acceptedRevision`.
- D4: core `Idempotency-Key` + `idempotency_keys` A table + `E_IDEMPOTENCY_CONFLICT`; lookup before active-run; define concurrency (1 factory + 2 ad hoc).
- D5: micro-USD, global cap = min(5.00, balance-0.50), reservation states, crash recovery, missing-usage conservative commit, repair bucket.
- D6: exact enums + phase attempts + `REPAIR_STALLED` mapping + transition matrix.
- D7: precedence `cancelled > failed > budget > warnings > pass`; FSN signature for stall; LG1 signature receipt-only.
- D8: subscribe-buffer-query-flush-dedupe; `E_REPLAY_TRUNCATED`/`E_REPLAY_EXPIRED`; queue caps; retention excludes active runs.
- D9: schema_migrations checksum/backup/fail-closed; lock; reconciliation; atomic manifest; disk thresholds.
- D10: one `src/shared/refusals.ts` enum + aliases; all codes in §14; §6.1/§15 use E_ forms.
- D11: 250-case pool / 5 suites; P7 gate accepts valid eval or honest refused; no silent shrink.
- D12: materialized prompt/contract blob + append-only prompt_versions; `prompt_blobs`.
- D13: explicit Release A preset→phase matrix; zero-task phases skip; route refusal → finalize failed.
- D14: split INFRA I1–I5; LG1 P1; matrix lint.
- D15: one hive.api.v1 envelope for core + new refusals; status mapping table.
- D16: §17 source table with URL/read date/claim; source lint.

## 09:30:39 — verification (document-level)
- `T3=2026-11-03 09:30:39 -06:00`.
- Wrote `docs/PLAN-AUDIT/01-core-state.md` (57,572 bytes); all 16 defects have section, why, RED, exact patch, GREEN, lens.
- Re-read the report after write; all planned defects present; no product code or canonical-plan edits.
- Coverage check: §0, §3, §4 W01–W19, §6.7/§6.9 seams, §8, §9, §10, §14, §15, §17; clean-list evidence included.
- No installs, no API calls, no key access; only two audit files written.
- **No runtime RED/GREEN claims**; all probes are test designs or textual contradictions (READ/INFERRED).

## Missed / limits
- v1 text is not in the repo; I used the Lead-conversation v1 only as context, not as a file. D1 asks the Lead to persist it.
- §21 does not exist; audited §15/§17 per the Lead’s correction. No finding is claimed against a nonexistent section.
- P7 feasibility (250-case pool, $3 eval, 50 pairs), `BEGIN IMMEDIATE` behavior, `system_fingerprint` stability, and DSH balance are **UNVERIFIED** (no API/key access).
- The repair staging patch is specified for repair only; if “no partial writes” is intended globally, the initial generation path needs the same staging rule — flagged in D3.
- No product code exists, so no test was executed; every RED/GREEN is a design, not a run.

## Files changed (only these two)
- `docs/PLAN-AUDIT/01-core-state.md` (created, 57,572 bytes)
- `logs/plan-audit-core.md` (this journal)

**STATUS: DONE** — report at `docs/PLAN-AUDIT/01-core-state.md`; journal at `logs/plan-audit-core.md`.
