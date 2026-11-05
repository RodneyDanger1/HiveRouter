# PLAN-AUDIT-1 — Seat 4 `plan-audit-learning`

**Target:** `docs/PLAN-v2.md` §7 (L1/L2/L4/L3), related §4 W03/W04/W05, §15, §17; v2 test matrix §10 and DoD §11.
**Plan SHA-256:** `8AD841C5F572A23DAFCF5254A98F9E81B37F6D8BC7AE0B806D6BDEC146B518F2`
**Wave sheet SHA-256:** `C5724D2F51671E74DC840F415EC3234CFF3405AA5E726D615CE973A8D23316FA`
**Mode:** plan audit only; no product code, canonical-plan, or other-seat edits. No API calls, no key access.
**Evidence classes:** READ (file), VERIFIED (local command/arithmetic), INFERRED (code consequence from plan), UNVERIFIED (would need a live experiment).

---

## 1. Verdict

**P7 is NOT executable as written.** Release A and P6a are not implicated by this seat. P7 needs the P0 fixes below before any implementation; after them it is executable-with-fixes. The core learning idea is sound and correctly refuses to claim general quality, but the plan currently has four structural contradictions (suite arithmetic, pool/partition, metric/baseline, suite-use atomicity), one safety hole in candidate lint, one trace/artifact leak path, and a statistical gate whose effective minimum detectable effect is ~30 pp, not the stated 15 pp.

**Honest outcome preserved:** `refused` and `no_promotion` remain first-class; no auto-apply; no canary. The fixes below do not weaken those.

---

## 2. Defects

Severity: P0 = would make P7 produce a broken, unsafe, or unfalsifiable learning system; P1 = would make a core P7 claim untestable or wrong; P2 = consistency/coverage.

| ID | Sev | Plan section | Defect and why it bites in code | RED probe / contradiction | Patch | GREEN verification |
|---|---|---|---|---|---|---|
| **L1-01** | **P0** | §7.1 lines 209, 211 | “frozen suite, 50 paired cases, dev/holdout” means 50 total; gate demands **n=50 paired holdout**. If dev ≥1, holdout ≤49, so the promotion gate is arithmetically unsatisfiable. If “50” is holdout only, the suite is 50+dev and the DB/cost counts are undefined. `[logic-debugger][scientific-thinking]` | Arithmetic: `holdout = 50 − dev_count`; with the plan’s 15-dev intent, holdout=35; `assertHoldout(suite,50)` fails. Cost line 215 also assumes 50 pairs, not 35. | **P-01** | Test builds a 65-case block (15 dev + 50 holdout) → gate sees exactly 50 holdout pairs; a 50-total suite is refused at import; dev/holdout hashes are disjoint. |
| **L1-02** | **P0** | §7.1 lines 209, 213; §7.6 line 238 | “Single-use 50-case suite” + “re-freeze from a sealed pre-approved pool” has **no pool size, block partition, disjointness, or exhaustion rule**. Five synthetic no-effect candidates need 5 suites: 5×50=250 cases (5×65=325 with dev). A 100-case pool dies on eval 3; sampling with replacement puts the same case in two suites and destroys single-use independence. `[truthseeker][capability-auditor]` | 5 eval attempts on a 100-case pool: 3rd must refuse; the plan’s “five no-effect candidates cannot reuse a suite” test is impossible. If re-freeze samples with replacement, `case_id` appears in two suites; independence test fails. | **P-02** | `sealed_pool` + `sealed_pool_blocks`, min **6 disjoint 65-case blocks (390 cases)**; each eval claims one block; 5 no-effect evals use 5 blocks; 6th returns `E_LEARNING_POOL_EXHAUSTED`; no `case_id` in two blocks; pool manifest hash verified. |
| **L1-03** | **P0** | §7.1 lines 207–211; §14 `E_LEARNING_NO_BASELINE`, `E_LEARNING_VERSION_DRIFT`; §7.6 | **Primary metric is undefined** (“binary/paired” is not a metric), and **baseline is not frozen**. `E_LEARNING_NO_BASELINE`/`VERSION_DRIFT` appear in §14 but have no §7 rule. Eval code cannot build `pairedOutcome`; a candidate created at v1 can be evaluated after v2 becomes active and silently compare against the wrong baseline. `[logic-debugger][integration-logic]` | Type probe: `EvalCaseResult` has no `primaryMetric`; candidate v1 created, v2 promoted, eval v1 candidate → `baselineVersionId` resolves to v2; gate result is invalid but looks successful. | **P-03** | `PrimaryMetric='gatePass'` with exact boolean definition; `variants.baseline_version_id` and `eval_runs.baseline_version_id` frozen at candidate creation; eval refuses if active ≠ frozen baseline (`E_LEARNING_VERSION_DRIFT`); 50 pairs computed from `gatePass`; drift test fails RED without patch, passes GREEN. |
| **L1-04** | **P0** | §7.6 line 238 `suite_uses` unique constraint | The **unique key is unspecified**. If unique on `suite_id` only, baseline+candidate inserts collide; if on `(suite_id,candidate_id)`, a second candidate reuses the suite. There is also no atomic claim: two concurrent eval jobs can both pass an unused check and spend before one insert fails. `[logic-debugger][truthseeker]` | Two concurrent `POST /api/learning/evaluations` on the same suite: both jobs start, one fails after call 1, cost is spent. Or candidate B evaluates on a suite already used by A because the unique key includes candidate. | **P-04** | `suite_uses(suite_id UNIQUE, suite_version, block_id, candidate_id, eval_run_id UNIQUE, claimed_at, status)`; claim in `BEGIN IMMEDIATE` before any model call; baseline and candidate share one row; loser gets `E_LEARNING_SUITE_ALREADY_USED` before spend; one candidate per suite. |
| **L1-05** | **P0** | §7.1 lines 207, 211 | Threshold candidates can **weaken mandatory safety checks** (secret scan, stub scan, gate precedence). The lint forbids tool/exec/permission escalation and “ignore verifier,” but not lowering a check’s severity/threshold. The eval then sees fewer failures, passes the screening gate, and “zero critical safety regression” is false because the check was disabled. `[logic-gatekeeper][auditor]` | Candidate threshold changes `secretScan` from fail to warn; case with `sk-…` passes; gate reports zero critical safety regressions; promotion. Unit test `unsafeThresholdVariant` returns `ok:true` today. | **P-05** | Immutable `SafetyPolicySnapshot` per eval; threshold allowlist only for non-safety keys (`maxRepairRounds`, `contextTokenBudget`, `retryBackoffMs`, `costWarnPercent`) with bounds; any change to mandatory checks/secret/PII/stub/path/gate precedence → `E_LEARNING_UNSAFE_THRESHOLD`; hidden adversarial checks + human review. |
| **L1-06** | **P0** | §7.1 line 203; §4 W03/W04 line 79; §11 line 304 | Trace previews are redacted, but **“full outputs stay in artifacts.”** If mining or the Metacognitive call reads artifacts, secrets can enter learning evidence; if it does not, raw secrets still persist in the workspace/UI read path, contradicting “no secret in DB/datasets.” Redaction is not applied to artifacts. `[truthseeker][integration-logic]` | Generate a file containing `sk-…`; trace preview is masked, artifact contains the key; mining prompt or `check-secrets` sees it. Test `artifact contains key` fails lock-down. | **P-06** | Artifacts store `redaction_status` + `redactor_version`; secret/PII patterns are redacted at artifact write; unredactable raw is quarantined outside the learning/UI read path; learning reads **only** redacted previews; `E_LEARNING_REDACTION_BLOCKED`; test asserts no key in artifact/mining prompt/log. |
| **L1-07** | **P1** | §7.1 lines 209, 211, 213; §2 line 55; §11 line 302 | “Alpha control: single-use suites + sealed pool + one primary metric + pre-registration” is **incomplete**: single-use controls suite reuse, not multiple candidates/cycles; Holm is only for pre-registered secondaries; no candidate-family alpha budget. Separately, **n=50/+15 pp lower bound is underpowered**: analytic paired check shows 30 pp observed (b=5,c=20) gives lower ≈15.1 pp (barely passes), while a true 15 pp effect (b=8,c=16) gives lower ≈0.3 pp (fails). The gate’s effective MDE is ~30 pp, not 15 pp. `[scientific-thinking][truthseeker]` | Deterministic fixtures: b=8,c=16 → lower 0.003 (<0.15); b=5,c=20 → lower 0.151 (passes). Five null candidates on five fresh suites have no family-level control. | **P-07** | `candidate_family_id`, max 3 candidates/cycle, all pre-registered; Holm/Bonferroni across primary gates or a fresh independent replication before activation; record `alpha_spent`. State the MDE explicitly: at n=50 the gate screens ~30 pp observed; either relabel “large-effect screen” (and keep +15 pp lower bound) or increase n / pre-register a different margin. Add positive control (b=5,c=20 passes) and negative control (b=8,c=16 fails); 5-null family produces no promotion. |
| **L1-08** | **P1** | §7.1 line 211 | “12–49 pairs ⇒ shadow-only, no promotion” — v2 explicitly removes shadow/live exploration and has **no shadow implementation**. “Shadow-only” is a dead state; it can be misread as production shadow traffic, which v2 forbids. `[logic-debugger][auditor]` | 20-pair run has no defined status/route; no `shadow` code path; test cannot assert a shadow decision. | **P-08** | Replace with “12–49 ⇒ `E_LEARNING_INSUFFICIENT_SAMPLE`: record the evaluation, consume the suite, no promotion.” No shadow code; no canary. UI shows insufficient-sample. |
| **L1-09** | **P1** | §4 W05 line 80; §7.1 line 211; §7.6 line 240 | Approval token is “signed single-use, bound to candidate+eval hash, hashed storage” but **not bound to baseline, suite-use, or action**, and “signed” has no key/format. A token can promote after the baseline changes; concurrent consumes can both pass if not atomic; a promotion token could authorize a rollback. `[auditor][integration-logic]` | Token for eval E is accepted after active baseline changes; two concurrent `POST /promotions` with same token both succeed; token bound only to candidate+eval is reused for a different action. | **P-09** | Token `v1.<nonce>.<hmac>`; HMAC-SHA256 with per-install secret outside repo; bind `{candidateHash, evalEvidenceHash, baselineVersionId, suiteUseId, action, issuedAt, expiresAt}`; store hash+nonce; consume with `UPDATE … WHERE consumed_at IS NULL`; 10-min TTL; tests replay/expiry/wrong-baseline/concurrent/action. |
| **L1-10** | **P1** | §7.1 line 211; §11 line 302 | “Post-promotion monitoring and auto-rollback on critical safety” has **no window, trigger, status, table, or audit**. It cannot be tested or implemented; a 100% promotion can run indefinitely with no defined rollback condition. `[integration-logic][forge]` | No `post_promotion_monitor` schema or test; `auto-rollback` is prose-only; no definition of “critical safety” for learning. | **P-10** | `post_promotion_monitor(promotion_id, started_at, window_runs=20, window_days=14, status, rolled_back_at, trigger)`; critical = T0/mandatory secret/PII/path failure; first critical → auto-rollback + audit; non-critical 2-consecutive gate fail or cost >+25% → pause/review; UI status. Test synthetic critical → rollback; no critical → monitoring completes. |
| **L1-11** | **P1** | §7.1 line 209; §7.6 line 240; §10 line 288 | **Holdout access/contamination is unspecified.** `GET /api/learning/datasets` can expose holdout text; the Metacognitive call could include it; “no holdout seen by mining” has no mechanism. `[capability-auditor][integration-logic]` | API returns holdout case text; candidate prompt contains a holdout excerpt; test `holdoutSeenByMining` is unenforced. | **P-11** | Holdout cases only accessible to `EvalWorker`; API returns counts/hash only; separate table/role; mining/candidate queries filter `split='dev'` or have no holdout grant; `holdout_seen_by` audit; test API cannot read holdout, mining prompt excludes it. |
| **L1-12** | **P1** | §7 line 192; §7.1 line 209; §4 W03/W04 line 79 | **Consent scope is too broad/false**: one “learning” opt-in is described as sending “redacted case data … for evaluation,” but candidate generation sends redacted **traces** to DeepSeek for Metacognitive reflection. There is no separate scope and no revocation/withdrawal; a suite frozen before revocation is still evaluated. `[truthseeker][auditor]` | Enable learning; no consent prompt for trace-to-provider reflection; revoke after suite freeze; eval still runs. Consent table has no scope/revoked_at. | **P-12** | `consent_records(scope, version, granted_at, revoked_at)` with scopes `trace_retention`, `trace_to_provider_reflection`, `case_to_provider_eval`, `dsh_key`; separate toggles; no provider call without its scope; revoke invalidates pending suites/cases; audit; matrix tests. |
| **L1-13** | **P1** | §7.3 lines 221–223 | L4 guard has **no numeric trigger thresholds** (repeated signature count, identical-call count, spend %, no-progress window), and its status semantics conflict: “pause → terminal `needs_review`” vs “cancel with `E_LOOP_GUARD_TRIPPED`.” Cannot force a deterministic test; deadlock/false-positive behavior untestable. `[logic-debugger][forge]` | Test cannot trigger guard without invented thresholds; status matrix has `needs_review` and `cancelled` for the same event. | **P-13** | Thresholds: repeated identical signature ≥3 consecutive, identical request hash ≥2, spend ≥90% of run cap, no new artifact/check for 5 min. On trigger: abort in-flight, `paused`; after 10 min `needs_review`, release budget, `E_LOOP_GUARD_TRIPPED`; only user cancel sets `cancelled`. Test each trigger + false positive (long call with heartbeat) + no deadlock. |
| **L1-14** | **P1** | §7.1 line 211; §17 line 450 | “Model fingerprint stable” is a **hard promotion gate** on a property §17 explicitly lists as **unverified**. If `system_fingerprint` is absent, the gate cannot decide; if it changes every call, P7 can never promote. No fallback. `[research][truthseeker]` | Mock response omits `system_fingerprint`: gate has no boolean; or fingerprint changes between arms: every eval is inconclusive with no named reason. | **P-14** | `fingerprint_status: stable\|changed\|unavailable`; if unavailable require a fresh paired replication or refuse with `E_LEARNING_VERSION_DRIFT`; if changed → inconclusive; record status per eval; test all three paths. |
| **L1-15** | **P1** | §3 lines 65–67; §4 W01 line 77; §7.6 line 238 | **Staging contradiction:** W01 needs prompt versions/hashes in the immutable `RunSnapshot` in Release A; §7.6 lists `prompt_versions` under P7 tables; §3 says Release A contains **zero** P7 artifacts. Either A has a P7 table or A cannot snapshot. `[forgewright-lead][integration-logic]` | Migration census: A has no `prompt_versions` → snapshot test fails; or A has `prompt_versions` → “no P7 artifacts in A” fails. | **P-15** | Release A creates immutable `prompt_versions` and `policy_versions` registries (snapshot dependencies); P7 adds `variants`, `eval_*`, `suite_uses`, `sealed_pool`, `promotions`, etc.; no learning routes/UI in A. Migration census test asserts split. |
| **L1-16** | **P1** | §7.1 line 209; §10 line 288; §11 line 302 | **Testability contradiction:** mock-only provenance cannot promote, but the integration matrix asks for a “valid promotion→rollback” with the mock provider. Marking mock as live falsifies provenance; without a live path, the test cannot exercise promotion. `[auditor][capability-auditor]` | Integration test with mock provider attempts promotion: API must refuse (mock-only), so “valid promotion” cannot pass; if it passes, provenance is fake. | **P-16** | Add `provenance='synthetic'` for fixtures; unit-test `PromotionGate` with synthetic evidence; API promotion requires `live`; integration/E2E assert mock/synthetic refusal; rollback tested with a seeded `promotions` row; DoD changes “valid promotion” to “gate unit + API refusal under mock; live promotion only opt-in.” No test-only production flag. |
| **L1-17** | **P1** | §7.1 lines 209, 211; §10 line 288 | No **missing/invalid pair rule** and no **eval cost preflight**. One-sided exclusion of provider errors can bias the gate; a cap hit mid-eval consumes the single-use suite with no promotion and no reservation. `[truthseeker][scientific-thinking]` | 5 candidate-arm provider errors excluded while baseline arm counted → n=50 valid pairs but biased. Cap hit at case 49 → suite used, eval inconclusive, budget spent. | **P-17** | ITT rule: provider errors count as failure for both arms or are symmetrically excluded; require exactly 50 valid pairs; record `excluded_pairs` with reason/hash. Preflight `estimateEvalCost` + reserve before suite claim; insufficient → refuse before claim; partial eval `inconclusive`, suite consumed, no promotion. Test error injection + cap abort. |
| **L1-18** | **P2** | §8 lines 262, 266; §15 lines 356–382 | **Cross-reference drift:** §8 says “§15 Tests / §17 DoD,” but v2 §15 is traceability and §17 is sources; tests/DoD are §10/§11. Implementers can miss them. §15 also has no rows for `sealed_pool`, `suite_uses`, `approval_tokens`, `post_promotion_monitor`, so P0 infra is uncounted. `[forgewright-lead][logic-debugger]` | `Select-String` section refs shows mismatch; matrix census lacks the four P0 infra items. | **P-18** | Update §8 to “§10 Tests / §11 DoD”; add INFRA rows for `sealed_pool`, `suite_uses`, `approval_tokens`, `post_promotion_monitor`; keep “no double counting.” Doc-link test. |
| **L1-19** | **P2** | §7.2 line 219 | L2 repair memory has no **TTL, decay formula, or project identity**. “Expiry/decay/cross-project” cannot be tested; stale or wrong-project fixes can persist. `[logic-debugger][truthseeker]` | `repair_memory` schema lacks `project_id`, `expires_at`, `confidence`; test cannot assert expiry/decay; cross-project lookup returns entries. | **P-19** | Add `project_id`, `expires_at=30d`, `confidence` (1.0 start, ×0.5 on failure, archive <0.2); query filters project/signature/status/expiry; test wrong project, expired, zero-success decay. |

---

## 3. Exact patches (insert/replace text)

### P-01 — Holdout count (§7.1 line 209; §7.6)
Replace:
> `frozen suite, 50 paired cases, dev/holdout`
with:
> `frozen suite = 15 dev cases + 50 holdout cases (65 unique cases, disjoint); only the 50 holdout pairs count toward n; dev is authoring-only, is never evaluated for promotion, and is not counted in n.`
Schema: `eval_suites(..., dev_count INTEGER NOT NULL DEFAULT 15, holdout_count INTEGER NOT NULL DEFAULT 50, block_id TEXT NOT NULL, CHECK(dev_count=15 AND holdout_count=50))`; `eval_cases.split IN ('dev','holdout')`; import refuses any suite with `holdout_count<>50` or overlapping case hashes.
GREEN: 65-case block → 50 holdout pairs; 50-total suite refused; dev/holdout hashes disjoint.

### P-02 — Sealed pool and blocks (§7.1 line 209/213; §7.6)
Add:
```sql
sealed_pool(case_id TEXT PRIMARY KEY, block_id TEXT NOT NULL, case_index INTEGER NOT NULL,
  source TEXT NOT NULL, license TEXT NOT NULL, consent_id TEXT,
  captured_at TEXT NOT NULL, hash TEXT NOT NULL, redaction_scan TEXT NOT NULL,
  UNIQUE(block_id, case_index));
sealed_pool_blocks(block_id TEXT PRIMARY KEY, status TEXT NOT NULL,
  dev_count INTEGER NOT NULL DEFAULT 15, holdout_count INTEGER NOT NULL DEFAULT 50,
  used_by_suite_id TEXT UNIQUE, created_at TEXT NOT NULL);
```
Policy: P7 enables only when **6 disjoint blocks (390 cases)** exist; each suite claims one block; no `case_id` in two blocks; pool manifest (hash + approval + consent) required; no sampling with replacement; `E_LEARNING_POOL_EXHAUSTED`; replenish only with new consented cases.
GREEN: 5 no-effect candidates consume 5 blocks; 6th refused; overlap test fails; manifest hash verified.

### P-03 — Primary metric and baseline freeze (§7.1 lines 207–211; §7.6)
Add:
```ts
type PrimaryMetric = "gatePass";
type GatePass = boolean; // all mandatory checks pass && no critical safety && planned file set complete && syntax pass
```
`eval_suites.metric_id='gatePass'`; `variants.baseline_version_id NOT NULL` set at candidate creation; `eval_runs.baseline_version_id NOT NULL`; at eval start, if active prompt version ≠ `baseline_version_id` → `E_LEARNING_VERSION_DRIFT`; approval token binds the same baseline. No LLM judge in the primary metric.
GREEN: candidate at v1, v2 active → refusal; same baseline → eval; gatePass unit truth table (fail mandatory ⇒ false).

### P-04 — Atomic single-use suite (§7.6 line 238)
Replace `suite_uses` with:
```sql
suite_uses(suite_use_id TEXT PRIMARY KEY, suite_id TEXT NOT NULL UNIQUE,
  suite_version TEXT NOT NULL, block_id TEXT NOT NULL, candidate_id TEXT NOT NULL,
  eval_run_id TEXT NOT NULL UNIQUE, claimed_at TEXT NOT NULL, status TEXT NOT NULL);
```
Claim before any provider call: `BEGIN IMMEDIATE; INSERT INTO suite_uses ...; COMMIT;` if `changes=0` → `E_LEARNING_SUITE_ALREADY_USED`; baseline and candidate share the one row.
GREEN: concurrent evaluate → one claim, one refusal, zero loser spend; second candidate refused.

### P-05 — Threshold safety allowlist (§7.1 line 207/211)
Add `SafetyPolicySnapshot` frozen per eval. Allowed threshold keys only: `maxRepairRounds` (1–2), `contextTokenBudget` (100k–500k chars), `retryBackoffMs` (500–30000), `costWarnPercent` (10–100). Reject any diff touching: mandatory checks, secret/PII scan, stub scan, path safety, gate precedence, check severity. Error `E_LEARNING_UNSAFE_THRESHOLD`. Add hidden adversarial checks and human packet review.
GREEN: candidate lowering `secretScan` → refused; allowed `maxRepairRounds` → evaluated; secret case still fails.

### P-06 — Artifact redaction (§7.1 line 203; §11 line 304)
Replace:
> `Previews redacted and capped; full outputs stay in artifacts.`
with:
> `Previews are redacted and capped. Artifacts are written with secret/PII redaction and a redactor_version; content that cannot be redacted is quarantined outside the learning/UI read path. Learning reads only redacted previews.`
Add `artifacts.redaction_status`, `redactor_version`; `E_LEARNING_REDACTION_BLOCKED` if a case cannot be cleaned.
GREEN: secret output → artifact redacted/quarantined; mining prompt and logs contain no key.

### P-07 — Candidate family and MDE (§7.1 lines 209–213; §11 line 302)
Add `candidate_family_id`, max 3 candidates/cycle, all pre-registered; Holm/Bonferroni across primary gates or independent replication before activation; record `alpha_spent`. State in §7.1: “At n=50, a +15 pp **lower** bound is a large-effect screen; analytic check: 30 pp observed barely passes; true 15 pp fails. Promotion is not expected.” Add fixtures: pass b=5,c=20; fail b=8,c=16; 5-null family no promotion.
GREEN: fixtures produce the stated lower bounds; null family yields zero promotions; UI shows MDE.

### P-08 — Remove shadow-only (§7.1 line 211)
Replace:
> `12–49 pairs ⇒ shadow-only, no promotion`
with:
> `12–49 valid pairs ⇒ E_LEARNING_INSUFFICIENT_SAMPLE: record the evaluation, consume the suite, no promotion. No shadow/canary in v2.`
GREEN: 20-pair eval returns the code; no `shadow` branch; UI insufficient-sample.

### P-09 — Approval token (§4 W05 line 80; §7.1 line 211)
Add:
```
token = "v1." + base64url(nonce) + "." + base64url(HMAC-SHA256(key, payload))
payload = {candidateHash, evalEvidenceHash, baselineVersionId, suiteUseId,
           action:"promote"|"rollback", issuedAt, expiresAt}
```
HMAC key in `data/approval.key` (0600, outside repo, generated once); DB stores `token_hash`, `nonce`, `consumed_at`; consume atomically; 10-min TTL; errors `E_LEARNING_APPROVAL_EXPIRED`, `E_LEARNING_EVIDENCE_TAMPERED`, `E_LEARNING_VERSION_DRIFT`.
GREEN: replay, expiry, wrong baseline, action swap, concurrent consume all refused.

### P-10 — Post-promotion monitor (§7.1 line 211; §11 line 302)
Add `post_promotion_monitor(promotion_id PK, started_at, window_runs=20, window_days=14, status, rolled_back_at, trigger)`; critical safety = any T0/mandatory secret/PII/path failure; first critical → auto-rollback + `learning_audit`; non-critical 2-consecutive gate failure or cost >+25% → pause/review; UI status.
GREEN: synthetic critical event → rollback; no event → monitor completes; audit row.

### P-11 — Holdout access (§7.1 line 209; §7.6 line 240)
Holdout cases only in `EvalWorker`; `GET /api/learning/datasets` returns `{count, hash}`; mining/candidate queries filter `split='dev'` or require an `eval_worker` grant; add `holdout_seen_by` audit.
GREEN: API cannot read holdout; candidate prompt lacks holdout; audit records access.

### P-12 — Consent scopes (§7 line 192; §7.1 line 209)
Add `consent_records(scope, version, granted_at, revoked_at)` with `trace_retention`, `trace_to_provider_reflection`, `case_to_provider_eval`, `dsh_key`; separate toggles; no provider call without its scope; revoke invalidates pending suites/cases; audit.
GREEN: consent matrix; revoke blocks eval; no reflection call without scope.

### P-13 — L4 threshold/status (§7.3 lines 221–223)
Add `GuardPolicy` thresholds as above; trigger aborts in-flight, `paused`; after 10 min `needs_review`, release budget, `E_LOOP_GUARD_TRIPPED`; user cancel only `cancelled`; heartbeat prevents false positive on long progress.
GREEN: each trigger, false positive, no deadlock, budget released.

### P-14 — Fingerprint fallback (§7.1 line 211; §17 line 450)
Add `fingerprint_status`; unavailable → fresh paired replication or `E_LEARNING_VERSION_DRIFT`; changed → inconclusive; record per eval.
GREEN: absent/stable/changed paths; no silent pass.

### P-15 — Staging split (§3 lines 65–67; §4 W01 line 77; §7.6 line 238)
Release A creates immutable `prompt_versions` and `policy_versions`; P7 adds learning tables/API/UI only; migration census test.
GREEN: A snapshot works; no P7 UI/routes in A; P7 migration additive.

### P-16 — Synthetic provenance and test matrix (§7.1 line 209; §10 line 288; §11 line 302)
Add `provenance='synthetic'` for fixtures; `PromotionGate` unit tests use synthetic; API promotion requires `live`; integration/E2E assert mock/synthetic refusal; rollback seeded; DoD updated.
GREEN: gate unit passes synthetic; API refuses mock; no fake live.

### P-17 — ITT and preflight (§7.1 lines 209–211; §10 line 288)
Add `valid_pair_count`; provider errors count as failure for both arms or symmetric exclusion; require 50 valid pairs; `estimateEvalCost` + reserve before suite claim; partial eval `inconclusive`, suite consumed.
GREEN: error injection; cap abort; 50 valid pairs.

### P-18 — Cross-reference/traceability (§8 lines 262, 266; §15 lines 356–382)
Replace “§15 Tests / §17 DoD” with “§10 Tests / §11 DoD”; add INFRA rows for `sealed_pool`, `suite_uses`, `approval_tokens`, `post_promotion_monitor`.
GREEN: doc link check; matrix census complete.

### P-19 — Repair memory decay (§7.2 line 219)
Add `project_id`, `expires_at=30d`, `confidence`; query filters; test expiry/decay/cross-project.
GREEN: expired/wrong-project/zero-success entries excluded; active high-confidence retrieved.

---

## 4. Cross-section contradictions (Lead action requested)

1. **C1 — W01 vs §7.6 staging:** `prompt_versions`/`policy_versions` needed in Release A snapshots, but listed as P7 tables. Resolve with P-15; Lead must amend §3/§7.6.
2. **C2 — W02 vs P7 eval budget:** eval cap $3.00/cycle $4.50 is a separate queue/budget, but the global ledger’s user-run priority/preemption rule and reservation interaction are unspecified. Need a Lead rule: eval reservations are lower priority, cannot starve a user run, and release on pause/cancel; add a test.
3. **C3 — W05 vs §7.6 approval API:** W05 names candidate+eval binding; §7.6 says promotion/rollback require a token. P-09 adds baseline/suite/action binding; Lead must align W05.
4. **C4 — §8 numbering:** “§15 Tests / §17 DoD” is wrong for v2 (§10/§11). P-18.
5. **C5 — §10 “valid promotion” vs mock-only refusal:** P-16 splits gate unit tests from API/E2E refusal; Lead must update §10/§11.
6. **C6 — §17 unverified fingerprint vs hard gate:** P-14 adds fallback; Lead must update §11/§17 wording.
7. **C7 — §3 no P7 artifacts vs `prompt_versions`:** same as C1; P-15.

---

## 5. What I checked and found clean

- **L3 is correctly counted as INFRA, not a loop** (§7.4, §15): no online ranker update; consistent with “frozen ranker” in §4.
- **No route-policy learning** in L1 candidate types (§7.1) and no learned CCR; consistent with §1/§4 “learned CCR deferred.”
- **No canary** in §7.1/W05; the only residue is the dead “shadow-only” phrase (L1-08).
- **Cost arithmetic is under the $3.00 cap if 50 holdout pairs are used:** 100 runs × 8K input = 800K input; ×1.5K output = 150K output; peak flash $0.24 + $0.18 = **$0.42** (READ + arithmetic; assumes 50 holdout pairs, which L1-01 currently contradicts).
- **Retention windows are defined** (events 90d, context 30d, traces 180d, eval 365d, audit/policy permanent) and no destructive migration; READ §7.6/§8.
- **Mock-only promotion refusal, no auto-apply, `learn --apply` forbidden, human approval, rollback** are stated; no route for automatic promotion.
- **L2 retrieval caps** (≤3, ≤600 tokens, active only) and **L4 terminal timeout/budget release** are stated, though thresholds/decay are missing (L1-13/19).
- **37-agent scope unaffected**; P7 adds no teammate; no product code exists, so no code-level contradiction can be verified beyond plan text.

---

## 6. Claim strength

| Claim | Class | Evidence |
|---|---|---|
| Plan v2 §7 contains the defects above | **READ** | `docs/PLAN-v2.md` lines cited; SHA recorded |
| 50-total vs 50-holdout is impossible | **VERIFIED** | arithmetic; `50 − dev < 50` |
| 5 no-effect candidates need ≥250 cases (325 with dev) | **VERIFIED** | arithmetic 5×50, 5×65 |
| n=50/+15 pp lower bound is ~30 pp MDE | **VERIFIED (analytic sanity check)** | Node pair-diff lower bounds: b=5,c=20 → 0.151; b=8,c=16 → 0.003 |
| Suite-use atomic/reuse failure follows from §7.6 | **INFERRED** | no product code; schema text only |
| Artifact leakage path follows from §7.1 line 203 | **INFERRED** | no product code; text contradiction |
| Approval token gaps follow from W05/§7.6 | **INFERRED** | text lacks binding fields |
| P7 cannot be executed as written | **READ + INFERRED** | no product code; four P0 text contradictions |
| Actual DeepSeek behavior, pool availability, consent uptake | **UNVERIFIED** | not tested; no paid calls allowed |

---

## 7. Skills applied (lens → finding)

| Lens | Finding(s) |
|---|---|
| **smartfix** | Structured minimal patch pack P-01–P-19; no test weakening; kept fixes surgical. |
| **logic-debugger** | L1-01 holdout arithmetic; L1-03 baseline/metric; L1-04 suite-use atomicity; L1-08 dead shadow state; L1-13 guard statuses; L1-19 decay. |
| **integration-logic** | L1-03 eval/baseline seam; L1-06 artifacts→mining leak; L1-09 approval API; L1-10 monitor/rollback; L1-11 holdout API; L1-15 staging. |
| **logic-gatekeeper** | Phase-1 root cause/data-flow/edge-case for every patch; L1-05 threshold safety hole; no patch without RED/GREEN. |
| **research** | Read plan/skills only; no paid calls/key; separated READ/INFERRED/UNVERIFIED; L1-14 unverified fingerprint gate. |
| **capability-auditor** | L1-02 claimed pool vs no pool schema; L1-11 claimed sealed pool vs readable API; L1-16 claimed promotion test vs mock-only. |
| **auditor** | Independent RED probes; claims register; L1-16/17 test contradictions; no product edits. |
| **forge** | Minimal-diff patches; P-06/P-10/P-13 closure; no fake code/test weakening. |
| **forgewright-lead** | L1-15 staging/phase split; L1-18 cross-reference/DoD; ownership boundary. |
| **truthseeker** | L1-02 suite counts; L1-06 provenance/redaction; L1-07 measurement; L1-12 consent; L1-17 ITT; L1-19 decay. |
| **scientific-thinking** | L1-07 alpha/MDE/power; L1-01 paired arithmetic; no general-quality claim. |

---

## 8. Files read / sources

- `C:\Users\Riley\Desktop\HiveRouter\docs\PLAN-v2.md` — full 454 lines; §§3,4,7,8,10,11,15,17 cited.
- `C:\Users\Riley\Desktop\HiveRouter\docs\PLAN-AUDIT\WAVE-SHEET.md` — full 41 lines.
- Skills read: `logic-debugger`, `integration-logic`, `forgewright-logic-gatekeeper`, `truthseeker`, `capability-auditor`, `auditor`, `forge`, `forgewright-lead`, `forgewright-research` (research lens).
- No product code exists (`HiveRouter` contains only `docs/PLAN-AUDIT/WAVE-SHEET.md` and now the audit reports).
- No web calls, no DeepSeek calls, no key read/printed, no installs, no git writes.

**Local arithmetic probe (VERIFIED):**
```
b=5,c=20,n=50 -> diff=0.30, se=0.09055, lower=0.15104 (passes +0.15 barely)
b=8,c=16,n=50 -> diff=0.16, se=0.09533, lower=0.00318 (fails +0.15)
b=10,c=18,n=50 -> diff=0.16, se=0.10338, lower=-0.01006 (fails)
```

**Auditor note:** P7 should not be declared GO on the current text. After P-01–P-19 and C1–C7 are applied, re-run this seat's RED probes; the P0 defects L1-01–L1-06 must be re-read against the amended plan, not the current text.
