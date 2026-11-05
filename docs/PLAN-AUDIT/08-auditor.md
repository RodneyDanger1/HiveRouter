# PLAN-AUDIT-1 — Seat 8 Independent Auditor (First Pass)

**Audited artifact:** `docs/PLAN-v2.md`, SHA-256 `8AD841C5F572A23DAFCF5254A98F9E81B37F6D8BC7AE0B806D6BDEC146B518F2` (454 displayed lines).
**Audit mode:** read-only; no product code, canonical plan, or other seat reports edited. No installs, paid calls, or key access.
**Verdict:** **EXECUTABLE WITH FIXES.** Release A has one snapshot-scope defect; P6a is not executable until P0-1/P0-2 close; P7 is not executable until P0-3 closes.
**Second pass:** pending the seven seat reports; this file will be appended, not replaced.

## 1. Defects

| ID | Severity | Plan section | Defect | Why it bites in code | RED probe | Exact patch | GREEN verification |
|---|---|---|---|---|---|---|---|
| **P0-1** | **P0** | §4 W01, §6.1, §6.9, §7.6 | `RunSnapshot` records prompt/policy **hashes and a version label**, not the immutable content. P6a routing needs the full `AgentCapability[]`, CCR weights/priors, and CPO/RVS/CCA/CRA constants; `prompt_versions`/`policy_versions` appear only as P7 tables (§7.6). | A prompt override or registry/prior edit after intake can change route/context/confidence mid-run. The only specified test mutates a prompt hash; it never exercises capability, weight, or policy-content drift, so the safety gate passes vacuously. Old runs cannot render the old prompt after an override. | Build a run, then (a) edit the writer prompt, (b) change a `staticPrior`, (c) change `wC`, (d) change the capability manifest. The run must remain byte-identical in decisions and rendered prompt. Current plan defines no such test. | **Append to §4 W01 and replace §6.9/§7.6 table ownership:** `RunSnapshot v2 (Release A) persists immutable full content: prompt_versions(id,hash,text,created_at) referenced by the run; policy_versions(id,hash,json,created_at) for CCR/CPO/RVS/CCA/CRA presets, weights, priors; AgentCapability[] manifest (37 rows) plus priorVersion; all constants/weights/normalizers; engine map; model/thinking/limits/pricing/preset. Snapshot hash = sha256(canonical-json(sorted keys)). Nodes read snapshot.* only. prompt_versions and policy_versions are Release A tables; P7 may add learning-only rows but must never be required to render or replay a Release A snapshot.` | Test `snapshot.content-immutability`: start run; mutate prompt text, staticPrior, wC and capability row after intake; assert route decisions, context pack, confidence inputs and rendered prompt equal pre-mutation values; assert old prompt text is retrievable after override; assert snapshot hash changes only for new runs. |
| **P0-2** | **P0** | §5, §6.1, §10, §15 | CCR's input `AgentCapability[]` and `static prior` have no 37-row source of truth: no languages, path globs, output kinds, max output tokens, prior values, or `priorVersion`. CCR's `wC/wL/wR`, cost/latency normalizers and critical-path factor are also unset (§6.1). | The router cannot be implemented or falsified. Any constants/priors are invented per implementer; `NO_CAPABLE_AGENT`/budget tests can pass using hand-built fixtures while the real 37-agent registry routes incorrectly. The plan's claim "capability-constrained" is prose-only. | Run CCR against the real 37-agent registry with the manifest missing/partial. It must fail closed with an explicit completeness code, not silently default to a generic agent. Current plan has no such probe. | **Insert §5.1 and replace the §6.1 Inputs/Utility paragraphs:** `§5.1 AgentCapability manifest: 37 rows, one per catalog agent, columns id | outputKinds | languages | pathGlobs | canWrite/canReview/canTest | maxOutputTokens | staticPrior (0..1) | priorVersion | fallbackFor | enabled. The manifest is versioned, hash-pinned in RunSnapshot, and validated at boot (37 unique IDs, no placeholder, every output kind covered). §6.1 Inputs: AgentCapability[] is loaded only from this manifest at snapshot time; no runtime defaults. Add §6.1.1 preset constants: Fast/Balanced/Deep exact wC/wL/wR, qualityWeight, criticalPathFactor, costNormUsd and latencyNormMs; implementation is blocked until the table is complete and owner-approved.` | Test `capability.manifest.complete`: 37 rows, zero placeholders, every agent reachable by its declared languages/globs; fixture `NO_CAPABLE_AGENT` from real registry; mutate `agent_stats` and assert route output unchanged; property test 200 seeds never selects an agent whose row does not declare the language/output. |
| **P0-3** | **P0** | §10, §11 | The "one real learning loop" can be marked done **mock-only**: §10 makes live P7 optional and §11.3 has no live trace→eval cycle. `refused`/`no_promotion` is valid, but no real provenance is required to call L1 "real." | The app can ship a P7 UI and promotion path that has never seen a real trace, real suite, or real provider finish. That is an unverifiable learning claim and a fake-green path, even if every mock test passes. | Delete or stub the live provider; run the P7 DoD exactly as written. Current DoD can pass. That is the RED observation. | **Append to §10 Live and §11 DoD:** `P7 live proof: one explicit opt-in cycle (npm.cmd run test:live -- --p7) with a ≤$3.00 cap, no promotion required. It must produce docs/evidence/p7-live-cycle.json containing runId, traceId, provenance:"live", redaction scan, suiteId/suite hash, 50 paired case IDs, eval result, promotion-packet hash and approval state. If provenance is mock or the file is absent, P7 is labeled "mock-only" and §11.3 L1 cannot be marked done; remove the word "real" until then.` | Test `p7.live-proof.required`: gate fails if evidence file missing, provenance != live, suite hash mismatched, or approval token present (no promotion allowed in this proof). A mock-only run is displayed as `mock-only`, not `real`. |

| ID | Severity | Plan section | Defect | Why it bites in code | RED probe | Exact patch | GREEN verification |
|---|---|---|---|---|---|---|---|
| **P1-1** | P1 | §5, §6.7, §6.9, §15 | "Four logic modules" is claimed for P6a, but §15 places LG2 `run-state` and LG4 `budget-policy` in P1/Release A; P6a adds only LG1/LG3. | P6a's gate can pass by counting Release A modules, so the requested P6a logic addition is not independently delivered; counts are ambiguous. | Load P6a-only build; `LG2/LG4` already exist from Release A; the gate still counts four. That is the RED observation. | **Replace §6.7 heading and §6.9 matrix row** with: `Logic modules (4 total; LG2 run-state and LG4 budget-policy are Release A prerequisites, LG1 gate-decision and LG3 repair-plan are delivered in P6a). P6a gate counts only new LG1/LG3; §5 total remains four.` Or move all four to P6a; do not do both. | Test `traceability.logic.phase`: P6a artifact list contains exactly LG1/LG3 and both have code path/refusal/test; LG2/LG4 have Release A acceptance; no gate counts a module twice. |
| **P1-2** | P1 | §6.1, §10 | CCR is called "deterministic" but tie-break seed is `runId`, which is random per run. | Same inputs in two runs can route differently; the 200-seed property test does not prove reproducibility. | Run the same `FileTask[]`/policy twice with different runIds; assert identical routes. Current design can differ. | **Replace §6.1 Inputs seed:** `seed = sha256(policyVersion + ":" + routePolicyId)`, stored in `PolicySnapshot.routeSeed` and `RunSnapshot`; runId is not a tie-break seed. If per-run variation is intended, remove "deterministic" from §6.1/§11 and add "deterministic per run only" plus an explicit test. | Test `ccr.cross-run.determinism`: identical inputs and policy hash across two different runIds produce identical ordered routes and decision IDs; changing policyVersion changes the seed and is recorded. |
| **P1-3** | P1 | §6.5, §4 W01 row | CCA's `n<30 ⇒ abstain` is undefined: `n` could be calibration samples, evidence items, or eval cases. P6a has no calibration (§6.5/§9). | Normal runs may abstain forever (five components < 30) or accept without the intended guard; the mandatory-fail rule can be bypassed by a wrong interpretation. | Run a normal P6a confidence calculation with five measured components and no calibration; assert intended accept/needs_review. Current text gives no defined outcome. | **Replace §6.5 n<30 sentence:** `P6a has no calibration; compute confidence only when all five components are measured. Any missing component => provisional, not automatic abstain. The n<30 calibration rule is P7-only and refers to a separate calibration sample; it never gates a P6a run.` | Test `cca.n-semantics`: five-component run returns accept/needs_review thresholded by the fixed weights; missing component => provisional; mandatory failure => no accept; n=0 calibration is not consulted in P6a. |
| **P1-4** | P1 | §6.1, §6.2, §6.6 | Router weights/normalizers, CPO PageRank initial vector/tie-break, and CRA λ/value/prior constants are unspecified. | Implementers invent numbers; route/context/retry results are arbitrary and not reproducible; tests can be tautological. | Implement two independent valid readings of the formulas; they produce different routes/context packs/retries. That is the RED observation. | **Add §6.1.1/§6.2.1/§6.6.1 constant tables:** exact `wC/wL/wR`, `qualityWeight`, `criticalPathFactor`, `costNormUsd`, `latencyNormMs`; PageRank initial rank `1/N`, tie-break `(scoreDesc, pathUtf8Ascending)`, 20 iterations, dangling redistribution; CRA `λ`, `value`, prior table, attempt caps. No implementation until the tables are owner-approved and hashed in `PolicySnapshot`. | Test `constants.closed-set`: missing/placeholder constant fails boot; two independently seeded implementations using the table produce identical outputs; CPO tie-break test with equal scores; CRA EV test. |
| **P1-5** | P1 | §7.1, §4 W02 | "50 paired holdout" is not defined against a dev set; eval $3.00 vs cycle $4.50 nesting is implicit; post-promotion auto-rollback has no trigger/window. | The number of holdout pairs can silently be 25; eval+cycle caps can double-count; auto-rollback can fire on an arbitrary "safety" event and change production policy untraceably. | Configure 25 holdout + 25 dev; run the gate with n=50. Current plan accepts it. Configure eval $3 and cycle $4.50; check whether eval is additive. Current plan is ambiguous. | **Replace §7.1 evaluation clauses:** `50 paired holdout cases; the dev set is separate and not counted toward n=50. The $3.00 eval cap is inside the $4.50 cycle cap (not additive). Auto-rollback fires only on enumerated critical safety events: secret/PII leak, path escape, generated-code execution, approval bypass, or policy-hash mismatch; monitor 24h or 20 new runs, whichever first; all other regressions require manual review.` | Test `p7.sample.split`: 25 holdout fails with `E_LEARNING_INSUFFICIENT_SAMPLE`; 50 holdout passes; eval spend counted once inside cycle; auto-rollback trigger table has exactly the enumerated events and a non-trigger negative case. |
| **P1-6** | P1 | §10, §11 | Missing RED/GREEN evidence: `suite_uses` uniqueness under concurrent eval, sealed-pool exhaustion, wrong-candidate approval token, `E_LEARNING_VERSION_DRIFT`, model-fingerprint drift, no `agent_stats`/exploration use, P6a snapshot, and live P7. | These are the exact paths that produce fake promotion, reuse, drift, or vacuous snapshot safety; without tests the plan's claims are prose. | Execute the plan's listed tests; none of the above can fail. That is the RED observation. | **Append to §10 integration:** `Add tests: suite_uses unique under two concurrent candidate evaluations; pool exhaustion -> refused; approval token bound to candidate+eval hash rejects wrong candidate; E_LEARNING_VERSION_DRIFT when prompt/policy/model changed between eval and promotion; fingerprint drift blocks promotion; mutate agent_stats/attach exploration flag and assert no route change (EXPLORATION_NOT_ALLOWED); P6a route snapshot content immutability; live P7 proof gate (P0-3).` | Each listed test exists with a RED fixture and GREEN assertion; the P6a/P7 gate command reports them by name, not by prose. |
| **P1-7** | P1 | §7.4, §15, §6.2 | L3 "frozen ranker" has no distinct code path/test; it is described as "from P6a" while CPO already owns PageRank+DP, and §15 counts L3 as INFRA. | Either dead code or an uncounted duplicate of CPO; the "frozen ranker" claim is prose-only and the loop count is unaffected either way. | Search for `src/server/context/ranker.ts`/`ranker` test in the plan; absent. CPO A1 owns PageRank+DP. That is the RED observation. | **Remove L3 from §5/§7.4/§15** (`L3 is deleted; CPO A1 is the only ranker; no loop count changes; INFRA row drops L3`). If a separate ranker is required, add `src/server/context/ranker.ts` with a deterministic test and count it as INFRA, not a loop. Choose one; do not leave both. | Traceability test: every INFRA row has a path+test; CPO owns PageRank/DP; no `L3` artifact is counted; §5 counts remain 1 learning + 2 other loops. |

### Exact patch policy

Patches above are plan amendments only. The canonical plan is not edited by this seat. Where a patch requires owner-supplied constants (P0-2, P1-4), the gate is **red until the table is populated and hashed**; placeholder values are a hard failure, not a default.

## 2. Cross-section contradictions

1. **P0-1** — §3 says Release A contains zero P6/P7 tables; §4 W01 needs immutable prompt/policy content; §7.6 puts `prompt_versions`/`policy_versions` in P7. Resolution: move the version tables (or full content columns) into Release A.
2. **P0-2** — §5 claims 37-agent traceability, but §6.1 requires `AgentCapability[]`; §15 has no per-agent capability matrix. Resolution: add §5.1 and make CCR read it from the snapshot.
3. **P1-1** — §5/§6.7 claim four P6a logic modules; §15 assigns two to Release A. Resolution: declare four total, two prerequisite, two P6a; count only new P6a modules.
4. **P1-7** — §7.4 claims a frozen L3 ranker; §6.2 already owns PageRank+DP; §15 calls L3 INFRA. Resolution: delete or give it a distinct path/test.
5. **P1-5** — §7.1 uses 50 paired holdout without a dev split; §4 W02 lists eval/cycle caps without nesting; §7.1 auto-rollback has no trigger. Resolution: explicit split, nesting, enumerated safety triggers.
6. **P1-2** — §6.1 says deterministic but seeds with random `runId`. Resolution: stable policy seed or remove the determinism claim.

## 3. What I checked and found clean

- Release staging A/B1/B2 is consistent; P6a has no P7 pages/scripts in the stated scope; P7 conditional refusal path is explicit.
- Single-use evaluation suites, sealed-pool re-freeze, no canary, no auto-promotion, and screening-grade +15 pp are present and close the prior alpha/P0 issue.
- Bounded SSE, repair stall detection, full-gate rerun, DSH consent, approval tokens, global budget ledger with user priority, no generated-code execution, exact pins, and 37-agent capability badges are present.
- The plan correctly labels event replay as replay-only and refuses identical-build claims; it records provider usage/model/fingerprint provenance.
- The `no_promotion`/`refused` outcome is explicitly valid; no fake improvement numbers are promised.
- P6a CCR has no learned quality/shadow/live exploration path; `agent_stats` is observability only in the text.

## 4. Claim strength

| Claim | Strength | Basis |
|---|---|---|
| P0-1 snapshot content gap | **VERIFIED** | §4 W01 lists hashes/version only; §7.6 puts version tables in P7; no full-content field. |
| P0-2 capability/prior gap | **VERIFIED** | §6.1 references `AgentCapability[]`; §5/§15 contain no 37-row capability or prior values. |
| P0-3 mock-only P7 DoD | **INFERRED** | §10 makes live P7 optional; §11.3 has no live-cycle requirement. |
| P1-1 logic phase contradiction | **VERIFIED** | §6.7/§6.9 vs §15 phase rows. |
| P1-2 seed ambiguity | **VERIFIED** | §6.1 `seed = runId` vs "deterministic." |
| P1-3 CCA `n` ambiguity | **VERIFIED** | §6.5 text; no definition of n. |
| P1-4 constants gap | **VERIFIED** | §6.1/§6.2/§6.6 names symbols/weights but gives no values/tie-breaks. |
| P1-5 sample/cap/rollback ambiguity | **VERIFIED** | §7.1 text lacks split, nesting, triggers. |
| P1-6 missing tests | **VERIFIED** | §10 test list omits named cases. |
| P1-7 L3 duplicate | **VERIFIED** | §7.4 prose vs §6.2 CPO; §15 INFRA. |
| Live P7 behavior | **UNVERIFIED** | No product code exists; no live call allowed in this audit. |
| Actual runtime cost/feasibility | **UNVERIFIED** | No execution; plan-level arithmetic only. |

## 5. Verification checklist for seats 1–7 (exact evidence required)

| Seat | Required evidence (no prose) |
|---|---|
| **1 core-state** | `snapshot.content-immutability` test mutating prompt text, staticPrior, wC, capability row after intake; old prompt retrievable; RouteSnapshot/PromptVersion policy content in A; budget null/absent reservation test. |
| **2 api/ui** | Refusal matrix test for every named code; route refusal occurs before any file write; Routing/Context/Repairs/Checks/Confidence tabs have no dead controls; approval token bound to candidate+eval hash, TTL, replay/wrong-candidate refusal. |
| **3 security** | DSH consent denial/malformed file; secret-in-trace blocked at ingest and pre-eval; concurrent factory+ad hoc+eval budget race cannot overspend; user-run priority; token expiry/replay; no key route. |
| **4 learning** | Single-use suite refused on second evaluation after promotion **and** no-promotion; concurrent `suite_uses` unique constraint; pool exhaustion; version drift; model-fingerprint drift; one live P7 cycle (P0-3); no general-quality label. |
| **5 routing-math** | 37-row capability matrix completeness; CCR weights/priors exact; cross-run seed determinism; CPO tie-break and prefix hash; FSN tokenization; RVS mandatory tool-missing ⇒ unverified; CCA n semantics; CRA 401/500; mutate `agent_stats` ⇒ no route change. |
| **6 capability** | 37 prompt-transform fixtures; mock invocation per output kind; capability badge matrix; representative live subset; no false live claim. |
| **7 delivery** | `npm.cmd ci`; exact pins `parse5@8.1.0`, `diff@9.0.0`; disk/RAM guard; A/B1/B2 artifact separation; logic-count matrix; command list from §10; no P6/P7 artifacts in A. |

## 6. Skills applied

| Lens | Finding |
|---|---|
| **smartfix** | P0-1 snapshot content; P1-6 test gaps. |
| **logic-debugger** | P1-2 seed, P1-3 `n`, P1-4 constants. |
| **integration-logic** | P0-1 cross-release version content; P1-1 phase count; P1-5 cap/split/rollback. |
| **logic-gatekeeper** | P0-1 vacuous snapshot test; P0-2 manifest completeness; P1-1 count; P1-6 RED/GREEN. |
| **research** | P0-3 mock-only evidence; P1-5 sample/cap claims; §2 corrections checked for consistency. |
| **capability-auditor** | P0-2 37-agent capability/prior manifest; P1-7 L3 duplicate. |
| **auditor** | P0-3, P1-6, claim strength, source-of-record hash. |
| **forge** | P0-2 constants/manifest; P1-7 artifact identity. |
| **forgewright-lead** | P1-1 scope/count, P1-6 gate ownership, P1-7 cut-vs-add. |

## 7. Files read / sources

- `C:\Users\Riley\Desktop\HiveRouter\docs\PLAN-v2.md` (SHA-256 `8AD841C5F572A23DAFCF5254A98F9E81B37F6D8BC7AE0B806D6BDEC146B518F2`).
- `C:\Users\Riley\Desktop\HiveRouter\docs\PLAN-AUDIT\WAVE-SHEET.md`.
- Local directory checks: only `WAVE-SHEET.md` existed in `docs/PLAN-AUDIT`; `logs/` was empty; no product code exists.
- No official web fetch was needed in this pass; the DeepSeek/API facts in plan §2 are treated as plan claims pending the mechanisms seat and live gate. No key, paid call, install, or product edit.

**Second-pass status:** complete below.

---

# Second Pass — PLAN-v3 Verification (2026-11-03)

**Audited artifact:** `docs/PLAN-v3.md`, SHA-256 `698C1B89613FDA0ECC56AF90C21521705C33BC5CAEC3EA8BD88838C64B0927C7`, 264 physical lines / 389 displayed.
**Seat reports verified:** `01-core-state.md` `12624762…`, `02-api-ui.md` `A11BF2AF…`, `03-security.md` `8F884DFA…`, `04-learning.md` `76916FF5…`, `05-algorithms.md` `E938C597…`, `06-capability.md` `AFA010AC…`, `07-delivery.md` `B3080DDF…` (full hashes at time of read; all seven read in full).
**Mode:** read-only audit; no product code, PLAN-v3, or other reports edited. No installs, paid calls, or key access.
**Final verdict:** **NO-GO as written.** Three P0s remain. All seven reports' P0 claims are otherwise closed by v3 text; the remaining defects are new/partial from consolidation, not old unpatched prose.

## 1. Final P0 blockers

### P0-A — `consent_records` is P7-only, but DSH consent is Release A

**Evidence**
- §2 line 60: `a.json` core tables omit `consent_records`.
- §10 line 283: A tables list ends `…schema_migrations,agent_evidence`; no `consent_records`.
- §7 line 62 / §10 line 287: `consent_records` is listed only in `p7.json` / P7 tables.
- §5 line 158 and §0.5 require a persisted `consent_records` row before any DSH read; DSH consent is a Release A key-ingress control, not a learning feature.
- `assert-stage` makes this fatal: A cannot create a P7 table, and without the table A cannot persist the consent it requires.

**Why it bites:** Release A cannot both pass its stage gate and implement DSH consent. Implementers must either smuggle a P7 table into A (stage leak) or skip consent persistence (security P0 SEC-02 remains open).

**Exact patch**
```diff
@@ §2 a.json core tables
- runs,steps,events,artifacts,reviews,checks,usage,settings,run_snapshots,
- prompt_versions,policy_versions,budget_reservations,gate_decisions,idempotency_keys,schema_migrations
+ runs,steps,events,artifacts,reviews,checks,usage,settings,run_snapshots,
+ prompt_versions,policy_versions,budget_reservations,gate_decisions,idempotency_keys,
+ schema_migrations,agent_evidence,consent_records

@@ §10 A tables
- ...schema_migrations,agent_evidence
+ ...schema_migrations,agent_evidence,consent_records

@@ §2 p7.json / §10 P7 tables
- ...feedback,user_edits,consent_records
+ ...feedback,user_edits
```
P7 adds only new consent **scopes** (`trace_retention`, `trace_to_provider_reflection`, `case_to_provider_eval`) to the A table; it does not create the table. Add test `stage.consent.a-only`: grant/deny/revoke `dsh_key` in an A-only DB; no P7 tables; `assert-stage --stage=a` passes.

**GREEN:** A-only migration contains `consent_records`; A stage assert passes; DSH deny/revoke tests run without P7; P6a/P7 do not recreate the table.

### P0-B — The 37-agent manifest still lacks the actual capability/prior values

**Evidence**
- §3 line 74 declares fields: `staticPrior, priorVersion, maxOutputTokens, fallbackFor, promptVersion, schemaId, enabled`.
- §3 table lines 76–114 has only `# | Agent | Out | W/R/T | Language/path | Verification`; no `staticPrior`, `maxOutputTokens`, `fallbackFor`, `priorVersion`, `promptVersion`, `schemaId`, or `enabled` values.
- §4 line 138 says `RunSnapshot` stores `AgentCapability[]`; §6.1 line 183 says “static priors only”; §6.6 line 204 says CRA uses a “static prior table” that is not supplied.
- §3 line 72 only gates 37 IDs/prompts/schemas/engine maps; it does not gate capability values or `UNSPEC`.

**Why it bites:** CCR cannot score quality or fit context; CRA cannot compute EV; the 37-row table is a schema skeleton, not a capability manifest. Tests can pass with fixture priors while the real registry is `UNSPEC`. This is the first-pass P0-2, only partially closed.

**Exact patch**
```diff
@@ §3 table — add columns and values to all 37 rows
+| # | Agent | Out | W/R/T | Language/path | Verification | maxOutputTokens | staticPrior | priorVersion | fallbackFor |
+...
+Each row must carry a concrete `staticPrior` in [0,1], a positive `maxOutputTokens`,
+`priorVersion:"v1"`, `fallbackFor` list (may be empty), `enabled:true`, `promptVersion`,
+and `schemaId`. `UNSPEC`, null, or placeholder is a boot failure.
+
+@@ §6.6
+Add the CRA static prior table: action × failure category → pSuccess in [0.05,0.95],
+versioned with the same `priorVersion`; no action may default silently.
```
Add `agent-registry.census.test.ts`: all 37 rows complete, no `UNSPEC`/null, priors in range, max tokens positive, engine map parity; snapshot hash includes the values.

**GREEN:** 37-row manifest values exist and are hashed in `RunSnapshot`; CCR/CRA tests use real registry values, not fixture-only priors; a missing value fails boot and the census test.

### P0-C — RVS mandates syntax for languages its own manifest declares unverified; CCA then forbids accept

**Evidence**
- §3 lines 88, 95–99, 110: `baremetal` unverified, `powershell-*` static-only, `cmd`/`bash` unverified, `sandbox` static-only; `polyglot` “varies”; line 128 says these never become pass.
- §6.4 line 198: “**Mandatory: … syntax for every generated code file (T0–T3)**”; missing tool ⇒ `unverified`, never pass.
- §6.5 line 201: `mandatoryUnverified` caps at retry; **accept impossible**.
- §13 line 322: “RVS syntax mandatory all code”; §17 line 387 admits shell/CMD/PowerShell are static-only/unverified.

**Why it bites:** A full-build containing `.ps1`, `.cmd`, `.sh`, `.rs`, `.cpp`, or an unsupported polyglot language has a mandatory check that cannot run. It receives `unverified`; CCA cannot accept; there is no defined terminal `needs_review`/`completed_with_warnings` path. The run either loops to failure or must fake a pass—both violate the plan’s own rules. The 37-agent/full-build promise is not executable for those agents.

**Exact patch**
```diff
@@ §6.4
- Mandatory: ... syntax for every generated code file (T0–T3) ...
+ Mandatory syntax applies only to languages whose `verificationSupport` is `syntax` or
+ `runtime`. For `static-only` or `unverified`, the language’s mandatory check is recorded as
+ `unverified` with reason `E_SYNTAX_PARSER_UNAVAILABLE`; the gate may finalize
+ `completed_with_warnings`/`needs_review`, never `pass`. A supported language still requires
+ syntax; no tier may remove it.

@@ §6.5
- Inputs include mandatoryFailed, mandatoryUnverified; either caps at retry, accept impossible.
+ mandatoryFailed => no accept (retry/needs_review/fail). mandatoryUnverified => terminal
+ `needs_review` with `E_SYNTAX_PARSER_UNAVAILABLE` when no further attempt can add a parser;
+ never an infinite retry, never `pass`/`completed`.

@@ §13 DoD #3
- RVS syntax mandatory all code
+ RVS syntax mandatory for all parser-supported code; unsupported languages terminate
+ `needs_review`/`completed_with_warnings` and are visibly labeled `unverified`.
```
Add tests: `.py` syntax failure blocks; `.ps1`/`.cmd`/`.sh`/`.rs` full-build ends `needs_review` with the named reason and no green; supported languages unchanged. Alternatively, add parsers and remove the exception; the current plan has neither.

**GREEN:** no full-build with an unsupported language hangs or turns green; `.py` still hard-fails on syntax; UI/API show `unverified`/`needs_review`; P7 `gatePass` is false for unsupported cases.

## 2. All other P0 claims: verified closed

| Report | P0s | v3 evidence | Status |
|---|---|---|---|
| 01 core | D1 self-contained, D2 A tables, D3 repair staging, D4 idempotency | §1 standalone; §2/§10 A/P6a split; §4 staging/atomic swap; §4 Idempotency-Key + A table | **CLOSED** |
| 02 api/ui | A1 approval issuance, A2 SSE snapshot/envelope, A3 stage gating | §7 approvals; §4/§7 snapshot/stream/410; §2 features + stage manifests | **CLOSED** |
| 03 security | SEC-01 section map, SEC-02 DSH consent, SEC-03 ledger, SEC-04 approval, SEC-07 sinks | §1; §5 consent; §4/§5 ledger; §5 token; §5 sinks | **SEC-02 PARTIAL** (P0-A); other four **CLOSED** |
| 04 learning | L1-01..06 | §9 15+50=65; 6×65=390; gatePass/baseline; atomic suite_uses; SafetyPolicySnapshot; artifact redaction | **CLOSED** |
| 05 algorithms | D01 (T2/T3 syntax bypass) | §6.4 syntax all code | **PARTIAL → new P0-C**; remaining D02–D20 fixed |
| 06 capability | D1 registry, D2 capability/FileTask producer | §3 37 rows/contracts | **D1 PARTIAL → P0-B**; D2 types/transform **CLOSED** |
| 07 delivery | D01 standalone, D02 stage, D03 disk, D04 logic phases, D05 P7 outcomes | §1; §2 manifests; §4 4.5/1.5; §6.7 LG split; §9 P7_PASS/REFUSED | **CLOSED** |

**All other P0s are text-closed.** The reports' own RED/GREEN tests remain unexecuted (no product code); this is a plan verification, not a runtime pass.

## 3. P1 residuals / consistency defects (non-blocking for Release A unless stated)

1. **`agent_evidence` stage manifest omission (P1, A):** §2 `a.json` line 60 omits `agent_evidence`; §10 line 283 A includes it; §3 line 126 requires it. `assert-stage --stage=a` would fail or badges cannot persist. Add it to `a.json` and the A table list (same patch family as P0-A).
2. **P7 test count vs candidate-family cap (P1):** §11 line 296 says “5 null candidates,” §9 line 257 says candidate family max 3/cycle. A 5-candidate test crosses cycles or violates the cap. Change the test to 3 null candidates plus independent replication, or raise the cap with rationale.
3. **Global ledger cap (P1):** §4 line 150 defines global/child scopes and user priority but no numeric global ceiling or `min(balance-reserve)` rule; “one owner” is not a cap. Add exact global cap and test.
4. **Two envelopes (P2):** §7 line 227 keeps legacy v1 for core and `hive.api.v1` for new routes; report A6 asked one envelope. v3 has a client branch; acceptable only if explicitly accepted as compatibility, not parity.
5. **`E_ZIP_PATH` dead refusal (P2):** §5 line 164 says remove it if no zip extraction exists; §7 registry still lists it. Remove or implement extraction.
6. **`learn` command paid path (P1):** §12 line 310 `learn -- --dataset … --candidate …` omits `--live --yes`; if it performs paid evaluation, it must require the explicit live flag and budget. Add to command table/tests.
7. **`P7_PASS` and “no promotion expected”**: §9 line 277 and §13 line 323 are consistent now; no P0.

## 4. Coverage / double-count / execution-feasibility

- **Counts:** v3 §14: 1 router (R1), 5 algorithms (A1–A5), 4 logic (LG1/LG2/LG4 A, LG3 B1), 7 scripts (S1–S5 B1, S6–S7 B2), 3 loops (L1/L2/L4); L3 deleted; no double count. §5/§14 agree. **PASS**.
- **37 rows:** table rows 1–37 exist; unique IDs; 37 prompt/schema/engine-map claims. **Row presence PASS; value completeness FAIL (P0-B).**
- **Stage split:** P0-A/P0-B/P0-C are P6a/P7/security blockers; Release A core (snapshot, idempotency, staging, ledger) is text-closed except `consent_records`/`agent_evidence` A-stage placement (P0-A, P1).
- **Read-only execution feasibility:** C: **5.68 GB free**, RAM **1.93 GB free**, Node **v26.7.0**, npm **11.19.0**, Chrome present, port 8788 free. v3 preflight (≥4.5 GB, ≥1.5 GB) **passes** on this host. `npm ci`/build/E2E not run; no installs or key access. **PASS (plan-level resource gate), runtime UNVERIFIED.**
- **Evidence checked:** `Get-FileHash` for PLAN-v3 and 01–07; `Select-String` for headings, §19/§20/§21, `consent_records`, `agent_evidence`, capability fields, `syntax for every`, `mandatoryUnverified`, A/P7 table lists; `Get-PSDrive`, `Win32_OperatingSystem`, `node --version`, `npm --version`, Chrome path, port probe.
- **Claim strength:** all above are **VERIFIED (read/probe)** except runtime behavior (**UNVERIFIED**, no product code). No report's GREEN is accepted as executed.

## 5. Final verdict

**NO-GO as written.** Three P0s remain: **P0-A** consent table stage placement, **P0-B** missing 37-agent capability/prior values, **P0-C** RVS/CCA unsupported-language deadlock. Release A and P6a/P7 may not begin implementation until these three patches are in PLAN-v3 and the named tests exist. After those patches, the plan can be re-issued as **GO-WITH-FIXES**; Release A can proceed first, with P6a/P7 behind their gates. No fake promotion, no generated-code execution, no stage leak, no unverified green.
