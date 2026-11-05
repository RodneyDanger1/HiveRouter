# 05 — Algorithms & routing-math audit (seat 5)

**Seat:** 5 `plan-routing-math` · **Wave:** PLAN-AUDIT-1 · **Plan of record:** `docs/PLAN-v2.md` (454 lines, read in full 2026-11-03 09:24–09:27)
**Scope:** §6.1–§6.7 (CCR, CPO, FSN, RVS, CCA, CRA, LG1–LG4), §10, §15, §17, and every `§21` reference in v2. No product code exists; no canonical-plan edits.
**Verdict:** **GO-WITH-FIXES.** P6a is NO-GO until D01 (P0) and D02–D15 (P1) are patched. Release A is unaffected except D02/D16 (budget/staging).
**Claim strength:** plan text = VERIFIED(read); counterexamples = VERIFIED(math/logic); code effects = INFERRED (no product code); every GREEN = UNVERIFIED (not run; no product code).

---

## 0. Logic-gatekeeper Phase 1 records (one per proposed mutation)

```jsonl
{"id":"D01","phase1":{"architecture":"RVS plan -> LG1 gate -> CCA; plan text only, no product code","dataFlow":"risk tier -> mandatory set -> check results -> gate status -> accept/retry","edgeCases":["T2 Python file with a syntax error: syntax is not in the mandatory set, path/secret/stub pass, so the gate can pass"],"rootCause":"RVS conditions syntax checks on risk tier T0/T1, so a T2 code file can be accepted without any syntax check."}}
{"id":"D02","phase1":{"architecture":"W02 budget ledger + CCR allocation","dataFlow":"cap -> global reserve -> CCR allocation -> generation -> repair reserve","edgeCases":["cap $0.50; one task costs $0.45; ledger reserves $0.10 and CCR reserves another $0.10 => $0.55 or a silently reduced allocation"],"rootCause":"Two plan sections each claim a 20% repair reserve without naming a single owner, so the reserve can be counted twice or not at all."}}
{"id":"D03","phase1":{"architecture":"CCR DP over discrete budget units","dataFlow":"candidate cost -> unit rounding -> DP -> actual spend","edgeCases":["three tasks at $0.1667 each: floor units 166*3=$0.498 but actual $0.5001 > $0.50; ceil units 501 > 500"],"rootCause":"The plan uses $0.001 units without defining rounding or a post-DP actual-cost assertion, so a selected route can exceed the cap."}}
{"id":"D04","phase1":{"architecture":"CCR task DAG + optional-task skip","dataFlow":"plan tasks -> required closure -> DP skip/include -> generate deps","edgeCases":["optional config.py is a direct dependency of required main.py; DP skips config.py to save money; main.py is routed but its dependency is absent"],"rootCause":"Optionality is defined per task without a required-descendant closure, so a skipped optional task can break a required dependent."}}
{"id":"D05","phase1":{"architecture":"CCR scoring and deterministic tie-breaks","dataFlow":"candidates -> normalization -> utility -> DP -> rank key","edgeCases":["the same candidate is ranked differently when another candidate joins the set; equal-utility candidates reverse when insertion order changes; a one-candidate task gets an undefined normalized cost"],"rootCause":"Cost/latency denominators, criticalPath, candidateKey and the DP tie rule are not defined, so the router is not reproducible or comparable."}}
{"id":"D06","phase1":{"architecture":"CCR/CPO/FSN/CRA refusal surfaces + §14 envelope + §15 matrix","dataFlow":"module refusal -> API code -> UI/ledger","edgeCases":["CCR returns NO_CAPABLE_AGENT while §14 names E_*; FSN returns REPAIR_STALLED while §14/§15 use E_REPAIR_STALLED; ALL_CANDIDATES_DISABLED and NO_CAPABLE_AGENT overlap; RISK_UNVERIFIABLE has no trigger"],"rootCause":"Each algorithm invents a local refusal vocabulary while the API contract and traceability matrix claim one canonical set, so callers cannot map refusals deterministically."}}
{"id":"D07","phase1":{"architecture":"CPO PageRank importance","dataFlow":"file graph -> PageRank -> item importance -> DP","edgeCases":["a dangling-node graph loses rank mass; a cyclic graph needs more than 20 iterations; the plan has no convergence threshold or fallback"],"rootCause":"PageRank is specified by a fixed iteration count without convergence or dangling-node semantics, so ranking can depend on graph shape rather than a measured fixed point."}}
{"id":"D08","phase1":{"architecture":"CPO mandatory/optional token packing","dataFlow":"mandatory tokens -> optional units -> DP -> pack","edgeCases":["mandatory 149.6k + optional 1k with a 150k cap: floor units includes 150.6k; a mandatory item contains a secret and is silently excluded"],"rootCause":"CPO uses floor 1k units and an unspecified maxTokens/reserve, and treats secret exclusion as uniform even when the secret item is mandatory."}}
{"id":"D09","phase1":{"architecture":"FSN signature normalization and clustering","dataFlow":"failure -> normalized signature -> token set -> Jaccard cluster","edgeCases":["shuffling the same failures changes the representative and therefore the cluster; the 201st cluster has undefined behavior"],"rootCause":"Tokenization, representative selection, input order, and the 200-cluster cap behavior are unspecified, so cluster IDs are not stable or reproducible."}}
{"id":"D10","phase1":{"architecture":"RVS check ordering and budget accounting","dataFlow":"risk tiers -> mandatory set -> comparator -> execution budget","edgeCases":["two mandatory checks take 10s and 1s with a 5ms budget; the plan simultaneously says mandatory-first and fast-first; mandatory overrun is not recorded"],"rootCause":"The scheduler has two conflicting ordering rules and no explicit mandatory-overrun semantics, so the executed order and budget outcome are implementation-dependent."}}
{"id":"D11","phase1":{"architecture":"CCA scoring, thresholds, and abstention","dataFlow":"components -> raw score -> interval -> decision -> persist","edgeCases":["raw 0.75 satisfies accept>=0.75 and retry 0.45-0.75; raw 0.45 satisfies retry and needs_review 0.25-0.45; mandatoryFailed is not an input"],"rootCause":"The plan uses closed intervals that overlap at both boundaries and states a mandatory-failure hard rule without a corresponding input, so the decision is ambiguous and the hard rule is uncomputable."}}
{"id":"D12","phase1":{"architecture":"CRA expected-value retry/switch allocator","dataFlow":"failure -> pSuccess/cost/time -> EV -> action","edgeCases":["EV subtracts a dimensionless value and a USD cost from lambda*time with no units; content_filter/aborted/insufficient_system_resource have no mapping; null spent is treated as zero"],"rootCause":"The EV formula mixes units and leaves priors, finish-reason mapping, and unknown-budget handling unspecified, so two implementations produce different retry decisions from the same state."}}
{"id":"D13","phase1":{"architecture":"P6a graph + modules + persistence","dataFlow":"plan -> route -> generate/verify/repair -> finalize","edgeCases":["CPO/RVS/CCA/CRA and LG1-LG4 are described with tables/tests but no graph node or service calls them; static call-site check finds no invocation"],"rootCause":"The plan specifies algorithm contracts but not call sites, so modules can ship as dead code while the run uses an undefined inline behavior."}}
{"id":"D14","phase1":{"architecture":"algorithm boundaries and persistence","dataFlow":"inputs -> Zod parse -> algorithm -> Zod parse -> DB/API","edgeCases":["no schema exists for RouteResult/ContextPack/FailureTriage/VerifyPlan/ConfidenceResult/RetryDecision; any shape passes"],"rootCause":"Section 6 describes shapes in prose only, so there is no executable contract to validate against the persisted tables and API responses."}}
{"id":"D15","phase1":{"architecture":"plan cross-references and traceability","dataFlow":"§0.10/§5 -> '§21' -> matrix","edgeCases":["grep finds two §21 references and a 17-section document; the auditor scope and WAVE-SHEET also cite §21"],"rootCause":"v2 renumbered the matrix to §15 but left §21 references, so the 'count of record' is unreachable and the audit scope is stale."}}
{"id":"D16","phase1":{"architecture":"Release A vs P6a staging","dataFlow":"§3 staging -> §4 W01/W02 tables -> §6.9 P6a table list","edgeCases":["run_snapshots and budget_reservations are A requirements but appear in the P6a new-table list; Release A gate forbids P6a artifacts"],"rootCause":"A tables are listed under P6a, so a literal implementer can omit them from Release A or smuggle P6a into A."}}
{"id":"D17","phase1":{"architecture":"§15 traceability matrix","dataFlow":"artifact -> path -> refusal -> test -> phase","edgeCases":["A1-A5 refusal columns carry bare/incorrect codes; R1 says 'etc.'; route_candidates/agent_stats/confidence outcome are absent"],"rootCause":"The matrix does not pin exact refusal codes or all persisted artifacts, so it cannot be used as the count-of-record or as a test cross-check."}}
{"id":"D18","phase1":{"architecture":"§17 source provenance","dataFlow":"borrowed mechanism -> source -> license/copy status -> implementation","edgeCases":["Aider, AlphaCodium, DSPy/GEPA, calibration papers are listed without per-source version/license/copy evidence; the blanket 'no external code copied' claim has no audit row"],"rootCause":"A blanket provenance claim replaces a per-source license/version table, so the claim is unfalsifiable and cannot be audited."}}
{"id":"D19","phase1":{"architecture":"P7 learning candidates + eval-router vs deterministic CCR","dataFlow":"L1 candidate -> eval-router -> promotion packet","edgeCases":["eval-router evaluates route-policy/threshold variants while §5/§7.1 forbid route-policy learning; 'threshold' is not scoped to CCA"],"rootCause":"The same threshold term is used for route policy and confidence policy, so a P7 candidate can change deterministic routing without a stated prohibition."}}
{"id":"D20","phase1":{"architecture":"LG1 gate truth table, LG3 repair priority, LG4 budget units","dataFlow":"checks -> LG1; failures -> LG3; budget -> LG4","edgeCases":["LG1 tests 3 policies x 4 states but gate has cancelled/budget/failed/warnings/unverified/pass (6); LG3 says 'depth' without direction; LG4 says micro-USD without a unit"],"rootCause":"The logic modules' state domains and units are underspecified, so their advertised truth-table and accounting tests cannot be exhaustive or comparable."}}
```

---

## 1. Defect register

| ID | Sev | Plan § | Defect | Lens | RED probe (plan text / math) |
|---|---|---|---|---|---|
| D01 | **P0** | §6.4 L161 | Syntax is mandatory only for T0/T1; T2/T3 code can pass without it | logic-gatekeeper | T2 `src/util.py` syntax fail; mandatory set = path/secret/plan/stub; all pass → gate pass |
| D02 | P1 | §4 W02 L78 + §6.1 L139 | Two 20% repair reserves with no single owner | auditor | cap $0.50; ledger $0.10 + CCR $0.10 + one $0.45 route = $0.55 |
| D03 | P1 | §6.1 L139 | $0.001 DP units have no rounding/actual-cost rule; reserve base ambiguous | forge | 3 × $0.1667: floor 498 units ($0.498) but actual $0.5001 > $0.50 |
| D04 | P1 | §6.1 L139 | Optional tasks can be skipped even when a required task depends on them | integration-logic | optional `config.py` → required `main.py`; DP skips config; main's dep missing |
| D05 | P1 | §6.1 L137-139 | Cost/latency normalization, criticalPath, candidateKey, DP tie undefined | logic-debugger | same candidate's rank changes when an unrelated candidate joins the set |
| D06 | P1 | §6.1 L143, §6.3 L157, §6.6 L169, §14 L352, §15 L363-368 | Bare refusal codes vs `E_*`; overlap, dead code, missing `MISSING_DEPENDENCY` | capability-auditor | `NO_CAPABLE_AGENT` vs §14; `REPAIR_STALLED` vs `E_REPAIR_STALLED`; `RISK_UNVERIFIABLE` trigger absent |
| D07 | P1 | §6.2 L153 | PageRank fixed 20 iterations, no convergence threshold/dangling/fallback | research | dangling/cyclic graph order can differ at 20 vs 50 iterations; no `converged` output |
| D08 | P1 | §6.2 L153 | CPO 1k-token units round down; mandatory secret excluded; maxTokens absent | forge | mandatory 149.6k + optional 1k → 150.6k in a 150k cap |
| D09 | P1 | §6.3 L157 | Jaccard tokenization/representative/order/200-cluster cap undefined | logic-debugger | shuffling failures changes cluster representative/IDs; 201st cluster undefined |
| D10 | P1 | §6.4 L161 | Two ordering rules; mandatory overrun undefined; `unverified` is not a status | logic-debugger | mandatory 10s + 1s with 5ms budget; mandatory-first vs fast-first conflict |
| D11 | P1 | §6.5 L165 | Threshold intervals overlap at 0.75/0.45; hard rule lacks inputs; n<30 has no dataset | logic-gatekeeper | raw 0.75 → accept and retry; raw 0.45 → retry and needs_review |
| D12 | P1 | §6.6 L169 | EV mixes dimensionless value, USD cost, λ·time; priors/finish/null unspecified | forge | λ*time has no USD unit; content_filter/aborted unmapped; null spent treated as zero |
| D13 | P1 | §6.2-6.7, §8 L252 | No call sites for CPO/RVS/CCA/CRA/LG1-LG4 | integration-logic | static call-site check: no graph node imports or invokes these modules |
| D14 | P1 | §6.1-6.7 | No typed Zod contracts for six algorithms/four logic modules | capability-auditor | no schema exists; any input/output shape passes |
| D15 | P1 | §0.10 L24, §5 L114, §15 L356 | `§21` referenced twice; v2 ends at §17; scope also says §21 | auditor | grep: 2 refs, 0 headings named §21 |
| D16 | P2 | §3 L65, §4 L77-78, §6.9 L186 | A tables `run_snapshots`/`budget_reservations` listed under P6a | integration-logic | phase manifest: A needs snapshots/budget; §6.9 puts them in P6a |
| D17 | P2 | §15 L356-382 | Matrix does not pin exact refusals/tests; missing route_candidates, CCA outcome, agent_stats | auditor | A1-A5 refusal columns conflict with §14; R1 "etc." |
| D18 | P2 | §17 L448 | Blanket "all mechanisms reimplemented/no code copied" without per-source license/version table | research | no license/copy-status row for Aider/AlphaCodium/calibration sources |
| D19 | P2 | §5 L110, §7.1 L207, §7.5 L232 | `eval-router` route-policy/threshold variants conflict with "no route-policy learning" | integration-logic | same "threshold" covers route and confidence; no prohibition code |
| D20 | P2 | §6.7 L175-178 | LG1 truth table 3×4 misses states; LG3 depth direction undefined; LG4 micro-USD undefined | auditor | gate has 6 states; no LG4 unit/state shape |

---

## 2. Exact patches and GREEN verification

### D01 — P0: T2/T3 syntax bypass
**Patch (replace §6.4 L161 sentence):**
> “Mandatory: path safety, secret scan, plan coverage, syntax for **every generated code file (T0–T3)** and stub scan for code; markdown/doc files use `markdown.structure`. Tiers may add checks, but no tier removes a base mandatory check.”

**GREEN (proposed):** `test/verify/rvs-mandatory-truth-table.test.ts` runs 3 policies × 6 states (pass/warn/fail/unverified/cancelled/budget); asserts `syntax.python` is in `mandatory` for a T2 `.py` file and that a T2 syntax failure produces `fail`, never `pass`.

### D02 — P1: double repair reserve
**Patch (replace §6.1 L139 allocation opener):**
> “Allocation receives `allocatableUsd` from the single §4/W02 `budget-policy` ledger. `reserveUsd = 0.20 * capUsd`; `allocatableUsd = capUsd - reserveUsd`. CCR must not compute or hold a second reserve. Repairs debit the reserve only. Invariant at every step: `committedUsd + reservedUsd <= capUsd`.”

**GREEN (proposed):** `budget-ledger.test.ts` concurrent reserve/commit/release; `ccr.budget.test.ts` asserts `allocated <= allocatable` and after a repair `spent + reserved <= cap`. A fixture with cap $0.50 must show $0.40 allocatable and $0.10 reserve, not $0.30 and $0.20.

### D03 — P1: DP units and actual-cost assertion
**Patch (replace §6.1 L139 unit clause):**
> “Use micro-USD (`1 unit = 10^-6 USD`). Candidate units = `ceil(costUsd * 1_000_000)`. DP capacity = `floor((capUsd - reserveUsd) * 1_000_000)`. After selection, assert `sum(actualCostUsd) <= capUsd - reserveUsd`; if rounding makes the selection infeasible, drop the highest-cost optional task, then refuse `BUDGET_INFEASIBLE` with the cheapest feasible set and shortfall.”

**GREEN (proposed):** property over 200 seeded cost sets: `sum(actual) + reserve <= cap`; explicit 3 × $0.1667 case; exact-cap case.

### D04 — P1: optional dependency closure
**Patch (replace §6.1 L139 optional clause):**
> “Compute `requiredClosure` = every task reachable by `deps` from a required task. A task is skippable only if `required=false` **and** it is not in `requiredClosure`. A skipped task that is a dependency makes its required dependents refused with `E_MISSING_DEPENDENCY`. `RouteResult` adds `skippedTasks: TaskId[]`.”

**GREEN (proposed):** `ccr.budget.test.ts` optional-dep fixture; assert `main.py` is refused, not routed, when `config.py` is skipped; property: every required task's deps are routed.

### D05 — P1: normalization, criticalPath, ties
**Patch (replace §6.1 L137 utility block and L139 tie clause):**
> “Per-task normalization: `norm(x) = 0` if `max == min`, else `(x - min)/(max - min)`; single-candidate norms are 0. `criticalPath(task) = 1` iff the task lies on a longest source→sink path (ties broken by sorted task id). Risk is the deterministic table in §6.1a (riskHints weights, T0 path patterns, requiredChecks). `candidateKey = agentId + '|' + model + '|' + thinking + '|' + (effort ?? '-')`. Sort candidates by `sha256(seed + ':' + taskId + ':' + candidateKey)` ascending, then agentId/model/thinking. DP ties use the same key; no object insertion order may affect a result.”

**GREEN (proposed):** invariance test: adding an unrelated candidate does not change a candidate's normalized score; 200-seed replay is byte-identical; criticalPath fixture.

### D06 — P1: canonical refusal registry and precedence
**Patch (add to §6.1 after L143 and to §14 L352):**
> “All P6a algorithms emit the canonical `E_*` code set. CCR: `E_NO_CAPABLE_AGENT`, `E_ROUTE_BUDGET_INFEASIBLE`, `E_CONTEXT_INFEASIBLE`, `E_POLICY_BLOCKED`, `E_ALL_CANDIDATES_DISABLED`, `E_DAG_CYCLE_DETECTED`, `E_RISK_UNVERIFIABLE`, `E_MISSING_DEPENDENCY`. FSN: `E_REPAIR_STALLED`, `E_FSN_CLUSTER_LIMIT`. RVS: `E_VERIFY_TOOL_UNAVAILABLE`. CCA: `E_CONFIDENCE_ABSTAIN`. CRA: `E_BUDGET_EXCEEDED`, `E_BUDGET_UNKNOWN_RESERVATION`, `E_RETRY_INFEASIBLE`. Precedence: `E_DAG_CYCLE_DETECTED` > `E_ALL_CANDIDATES_DISABLED` (only if every candidate was disabled before capability evaluation) > `E_NO_CAPABLE_AGENT` > `E_RISK_UNVERIFIABLE` > `E_POLICY_BLOCKED` > `E_CONTEXT_INFEASIBLE` > `E_ROUTE_BUDGET_INFEASIBLE`. `risk_unverifiable` triggers when a T0/T1 task needs a check the platform cannot run and no fallback check exists. Each code has exactly one trigger row and one test.”

**GREEN (proposed):** `refusal-registry.test.ts` asserts every `E_*` has a trigger and every trigger has a code; API envelope test maps each to `hive.api.v1.error.code`; no bare `NO_CAPABLE_AGENT` remains.

### D07 — P1: PageRank convergence
**Patch (replace §6.2 L153 PageRank clause):**
> “PageRank: damping 0.85, max 50 iterations, L1 delta ≤ 1e-9; dangling mass redistributed uniformly; node order sorted by task id. Emit `{converged, iterations}`. If not converged, rank importance by direct dependency count only and set `degraded:true`; never use an unconverged rank without the flag.”

**GREEN (proposed):** `packer.pagerank.test.ts`: cycle/dangling fixtures converge or degrade deterministically; 100 shuffles produce identical order; `converged:false` fixture uses the degraded path.

### D08 — P1: CPO token units and mandatory secret
**Patch (replace §6.2 L153 token clause):**
> “`maxTokens` is an explicit input. Reserve mandatory units first. Optional unit cost = `ceil(tokens / 1000)`; optional capacity = `floor((maxTokens - mandatoryTokens) / 1000)`. Mandatory > `maxTokens` ⇒ `E_CONTEXT_INFEASIBLE`. A mandatory item containing a secret ⇒ `E_POLICY_BLOCKED`; an optional secret is excluded with reason. If a regex outline still exceeds its cap, exclude with `summarized-over-budget`; if mandatory, refuse.”

**GREEN (proposed):** boundary tests at 149.6k/1k; mandatory secret; optional secret; outline overflow; 200 seeded packs never exceed `maxTokens`.

### D09 — P1: FSN stable clustering
**Patch (replace §6.3 L157 clustering clause):**
> “Normalize to lowercase tokens matching `[a-z0-9_]+` (length ≥2); Jaccard = `|A∩B|/|A∪B|`. Sort failures by signature before clustering; representative = lexicographically first signature; clusterId = `sha256(category + '|' + language + '|' + representative)[:16]`. At 200 clusters, new signatures return `E_FSN_CLUSTER_LIMIT`; never create an implicit 201st cluster.”

**GREEN (proposed):** 100 input shuffles yield identical cluster IDs; 201-cluster fixture refuses; same error/different line clusters; different category never merges.

### D10 — P1: RVS comparator and overrun
**Patch (replace §6.4 L161 ordering clause):**
> “Comparator: `(mandatory desc, riskRank desc, estimatedMs asc, checkId asc)`. Remove the separate ‘fast checks first’ rule. Reserve mandatory time; if `budgetMs < mandatoryEstimate`, run every mandatory check, set `overBudget:true`, and skip only optional checks with reason `budget`. `CheckStatus = pass | fail | warn | unverified | skipped`; missing tool ⇒ `unverified`.”

**GREEN (proposed):** `scheduler.test.ts` mandatory 10s+1s with 5ms budget: both mandatory run, `overBudget:true`, optional skipped; a T2 syntax check is mandatory; deterministic order across shuffled inputs.

### D11 — P1: CCA half-open thresholds and hard rule
**Patch (replace §6.5 L165 decisions):**
> “Intervals: `accept [0.75,1]`, `retry [0.45,0.75)`, `needs_review [0.25,0.45)`, `reject [0,0.25)`. Add inputs `mandatoryFailed:boolean` and `mandatoryUnverified:boolean`; if either, the decision cap is `retry` and `accept` is impossible. Missing required components ⇒ renormalize only over present components, set `provisional:true`. `calibrationSamples` = count of `confidence_records` rows with non-null `outcome`; `<30` ⇒ provisional/abstain, no calibration claim.”

**GREEN (proposed):** boundary tests at 0.75/0.45/0.25; mandatory-fail + raw 0.99 ⇒ reject/needs_review, never accept; missing review ⇒ provisional.

### D12 — P1: CRA EV units and mappings
**Patch (replace §6.6 L169 formula):**
> “`EV = pSuccess * value - costUsd - lambdaUsdPerSec * expectedSeconds`; `value = 1.5` for T0/T1, else 1.0; `pSuccess` is a static prior table by action/failure category, clipped `[0.05,0.95]`, adjusted once by current-attempt evidence; no cross-run learning. Mapping: `content_filter` ⇒ abort, `aborted`/`insufficient_system_resource` ⇒ retry_same with backoff, `length` ⇒ retry_same with a larger output budget or switch_model, `stop` ⇒ evaluate. Null spent/reserved ⇒ `E_BUDGET_UNKNOWN_RESERVATION`; no capability-filtered alternative ⇒ `E_RETRY_INFEASIBLE`. Attempts are per task; repairs per cluster.”

**GREEN (proposed):** `retry.test.ts` EV ordering with fixed λ; content_filter abort; null budget refusal; 401 no retry; 429 retry; incapable alternative never selected; endless 500 hits max attempts.

### D13 — P1: call sites
**Patch (add to §6.1/§6.2/§6.4/§6.5/§6.6/§6.7 and §8 L252):**
> “Call sites: `route` node → CCR; `generate` → CPO before every provider call; `verify` → RVS, then LG1; `verify/finalize` → CCA; `repair` → FSN, then CRA, then LG3; `run-manager` → LG2; `budget-ledger` → LG4. Each call persists its table row (`route_decisions`, `context_packs`, `verification_plans`, `confidence_records`, `retry_attempts`, `failure_signatures`, `gate_decisions`, `budget_reservations`).”

**GREEN (proposed):** `p6a-callsites.test.ts` imports each module and asserts one persisted row per invocation; static grep for call sites; E2E run shows Routing/Context/Checks/Confidence/Repairs tabs populated.

### D14 — P1: typed contracts
**Patch (add `src/shared/algorithms.ts`):**
> “Zod schemas for `FileTask`, `AgentCapability`, `PolicySnapshot`, `RouteResult`, `Refusal`, `ContextRequest/ContextPack`, `FailureInput/FailureTriage`, `VerifyPlan/VerifyResult`, `ConfidenceInput/ConfidenceResult`, `RetryState/RetryDecision`, and LG1-LG4 state/result. Parse at every module entry and exit; `.strict()`; persist only parsed values.”

**GREEN (proposed):** contract fixtures for each schema; unknown keys rejected; DB rows round-trip through the schema; API response validates.

### D15 — P1: §21 references
**Patch (replace §0.10 L24 and §5 L114):**
> “The matrix in **§15** is the count of record.” (Both occurrences.)

**GREEN (proposed):** `docs-links.test.ts` asserts every `§N` reference resolves to a heading in `PLAN-v2.md`; no `§21` string remains. Lead updates WAVE-SHEET/seat scope to §15.

### D16 — P2: A tables in P6a
**Patch (move from §6.9 L186 to §8 §10 A list):**
> “A tables: `run_snapshots`, `budget_reservations`. P6a tables: `route_decisions`, `route_candidates`, `agent_stats`, `context_packs`, `context_manifests`, `failure_signatures`, `failure_occurrences`, `verification_plans`, `confidence_records`, `retry_attempts`, `gate_decisions`, `script_runs`, `idempotency_keys`.”

**GREEN (proposed):** phase-artifact manifest test: P0–P5 migrations contain only A tables; P6a migration contains no A table creation.

### D17 — P2: traceability completeness
**Patch (replace §15 rows for R1/A1-A5):**
> Pin exact refusal codes from D06; add `route_candidates` to R1; add `confidence_records.outcome` to A4; add `agent_stats` to INFRA as observability only; replace “etc.” and bare codes; keep one row per artifact and the matrix count unchanged.

**GREEN (proposed):** `traceability.test.ts` parses §15 and the code registry; every code/path/test exists; no duplicate artifact.

### D18 — P2: provenance table
**Patch (replace §17 L448 blanket claim):**
> “Add a provenance table: mechanism, source URL, version/date read, license, copied? (`none`), verified? (`yes|unknown`), implementation note. Cover Aider repo map, AlphaCodium (AGPL, mechanism only), DSPy/GEPA, MIPROv2, TextGrad, Reflexion, Voyager, SWE-agent, OpenHands, Agentless, calibration papers, Lost in the Middle. A blanket ‘no external code copied’ claim is only allowed after this table is complete and licenses are checked.”

**GREEN (proposed):** `docs-provenance.test.ts` requires every borrowed mechanism to have a row and a license field; unknown licenses are labelled, not asserted.

### D19 — P2: route-policy threshold contradiction
**Patch (replace §7.5 L232 `eval-router` scope):**
> “`eval-router` is read-only diagnostics of fixed CCR weights; it never promotes a route policy or threshold. L1 threshold candidates are restricted to CCA thresholds and context templates; route-policy changes return `E_LEARNING_ROUTE_POLICY_FORBIDDEN`.”

**GREEN (proposed):** candidate lint rejects any diff touching CCR weights/thresholds; `eval-router` has no promotion path; test the refusal.

### D20 — P2: LG1/LG3/LG4 precision
**Patch (replace §6.7 L175-178):**
> “LG1 truth table = 3 policies × 6 states (`pass,warn,fail,unverified,cancelled,budget`), precedence `cancelled > budget > failed > unverified > warn > pass`; signature includes policy version. LG3 priority = `severity desc, depth desc (deepest first), lexical path asc`; owner must be an explicit file→owner map or manual. LG4 state = `{capMicroUsd, reservedMicroUsd, committedMicroUsd}` with `1 unit = 10^-6 USD`; null means unknown, never zero.”

**GREEN (proposed):** 18-case LG1 truth table; deterministic LG3 ordering fixture; LG4 exact-cap/over-commit/null tests.

---

## 3. Cross-section contradictions (requested from Lead)

1. **§21 is unreachable.** §0.10 and §5 cite §21; v2 has 17 sections and the matrix is §15. The WAVE-SHEET and seat scope also cite §21. **Action:** Lead updates references/scope to §15 (D15).
2. **Release A vs P6a tables.** `run_snapshots` and `budget_reservations` are A (W01/W02) but appear in §6.9 P6a. **Action:** move the rows (D16).
3. **Double repair reserve.** W02 and §6.1 both claim 20% without one owner. **Action:** budget-policy owns reserve; CCR consumes `allocatableUsd` (D02).
4. **Refusal vocabulary.** §6/§15 use bare codes; §14 uses `E_*`; `REPAIR_STALLED` vs `E_REPAIR_STALLED`; `CONTEXT_INFEASIBLE` absent from §14. **Action:** canonical registry (D06).
5. **Route-policy learning.** §5/§7.1 forbid it; §7.5 `eval-router` evaluates route-policy/threshold variants. **Action:** restrict to diagnostics/CCA (D19).
6. **CPO vs API budget refusal.** CPO uses `CONTEXT_INFEASIBLE`; §14 has `E_PROMPT_TOO_LARGE`. **Action:** map to one code with `details.stage` (D06).

---

## 4. What I checked and found clean (plan text)

- **Static priors / no learned quality:** §6.1 L135 (`qualitySource:"prior"`, `sampleSize:0`, `agent_stats` observability only) and §4 L96 (no learned quality/shadow/live exploration) agree. VERIFIED(read).
- **No exploration path:** §12 L316 non-goals and §14 `E_EXPLORATION_NOT_ALLOWED`; no bandit code path promised. VERIFIED(read).
- **Bounded search:** CCR ≤24 tasks, 500 DP units; CPO ≤24 items/150 units; FSN ≤200 clusters; no unbounded search in the plan. VERIFIED(read/math).
- **No generated-code execution:** §6.4 L161 and §12 L316. VERIFIED(read).
- **CRA no-retry list:** 401/402/path/policy/budget explicit at L169. VERIFIED(read).
- **RVS missing-tool semantics:** unverified, never pass (L161). VERIFIED(read).
- **CCA hard-rule intent:** “failed or unverified mandatory forbids accept” (L165) is correct in intent; the missing input is D11. VERIFIED(intent).
- **Traceability count:** §5 counts 1 router + 5 algorithms + 4 logic + 7 scripts = 17 artifacts; §15 has 17 artifact rows. No double count in the count itself (rows are incomplete, D17). VERIFIED(count).
- **§17 unknown list:** actual cache-hit rates, deterministic seed, 50-case attainability, prompt/repair generalization, fingerprint stability are labelled unverified (L450). VERIFIED(read).

---

## 5. Claim strength

| Claim | Strength | Evidence |
|---|---|---|
| Plan sections/line numbers | VERIFIED (read) | `docs/PLAN-v2.md` read in full; headings probed 09:27 |
| Math/overlap/units counterexamples | VERIFIED (math) | arithmetic and interval analysis above |
| Code would fail when enacted | INFERRED | no product code exists; no runtime test possible |
| GREEN tests pass | UNVERIFIED | proposed only; no implementation |
| Performance/cost of DP at runtime | UNVERIFIED | no code/measurement |
| External licenses/provenance | UNVERIFIED | no external fetch performed; D18 requires audit |

---

## 6. Skills applied (lens → finding)

- **smartfix:** defect isolation and RED-before-patch discipline → D13 call-site gap.
- **logic-debugger:** state/boundary analysis → D10 ordering, D11 thresholds, D20 state domains.
- **integration-logic:** call-chain seams → D04 dependency closure, D13 call sites, D17 matrix.
- **logic-gatekeeper:** Phase 1 JSON for every proposed mutation (§0); D14 contracts.
- **research:** PageRank mechanism boundaries and provenance → D07, D18.
- **capability-auditor:** capability/refusal parity → D06 refusal registry, D13.
- **auditor:** evidence vs claim, stale references → D15, §5 claim-strength table.
- **forge:** exact RED/math counterexample and minimal patch → all P0/P1 patches.
- **forgewright-lead:** contract/gate discipline → verdict GO-WITH-FIXES; no product edits.

---

## 7. Files read / sources

- `C:\Users\Riley\Desktop\HiveRouter\docs\PLAN-v2.md` — read in full (454 lines); line citations are from this file.
- `C:\Users\Riley\Desktop\HiveRouter\docs\PLAN-AUDIT\WAVE-SHEET.md` — read in full (41 lines).
- Local static probes at 2026-11-03 09:25:58 and 09:27:08: `Select-String` for `20%`, `§21`, `accept ≥0.75`, `retry 0.45`, `syntax for T0/T1`, `PageRank`, `Jaccard`, `EV =`, `run_snapshots`, `qualitySource`, refusal tokens; heading list; product-code count = 0; git absent.
- Skills loaded/used: smartfix, logic-debugger, integration-logic, logic-gatekeeper, research, capability-auditor, auditor, forge, forgewright-lead.
- No web fetch, no DeepSeek API call, no key access, no install, no product/canonical-plan edit.
- No external source was read for this report; license/version claims are explicitly UNVERIFIED (D18).

---

## 8. Patch map (for the Lead’s integration)

| Plan section | Patches |
|---|---|
| §0.10 | D15 |
| §3 | D16 |
| §4 W01/W02 | D02, D16 |
| §5 | D15, D19 |
| §6.1 | D02, D03, D04, D05, D06, D13, D14 |
| §6.2 | D07, D08, D13, D14 |
| §6.3 | D06, D09, D13, D14 |
| §6.4 | D01, D10, D13, D14 |
| §6.5 | D11, D13, D14 |
| §6.6 | D06, D12, D13, D14 |
| §6.7 | D13, D14, D20 |
| §7.1/§7.5 | D19 |
| §8 | D13 |
| §10 | D01, D05, D09, D10, D11, D12, D13, D17 |
| §14 | D06 |
| §15 | D06, D15, D17 |
| §17 | D18 |
| §21 (stale) | D15 |
