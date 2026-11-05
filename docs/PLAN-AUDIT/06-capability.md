# 06 — Agent Capability & Traceability Audit (Seat 6)

**Wave:** PLAN-AUDIT-1 · **Seat:** `plan-agent-capability` · **Checkpoint:** `docs/PLAN-v2.md` (454 lines, 45,327 bytes) · **Repo:** empty except this audit workspace; **no product code**, no installs, no API calls, no key access.
**Verdict:** **EXECUTABLE WITH FIXES.** Release A can be built, but the “37 agents” and capability claims are not yet falsifiable or routable. Two P0 defects must be closed before P6a: (1) no v2 agent registry / capability matrix / count of record, and (2) CCR’s `AgentCapability[]` and `FileTask[]` inputs have no producer. The rest are P1/P2 and can be fixed inside the plan.

---

## 1. Defects

| ID | Sev | Plan section | Defect | Why it bites in code | RED probe / contradiction | Exact patch | GREEN verification |
|---|---|---|---|---|---|---|---|
| D1 | **P0** | §0.10, §5, §11 DoD #4, §15 | The 37-agent claim has **no registry, no capability matrix, no count of record**. §5 says “The full matrix is §21”; the file ends at §17 and the only matrix is §15, which has **zero agent rows** (20 feature rows + INFRA). | P0–P5 cannot be gated on “37 agents”; DoD #4 is unfalsifiable; the release staging in §3 can silently ship 4 mock-tested output kinds while claiming 37. | `PLAN-v2.md:24,114` cite §21; headings stop at §17; §15 rows 360–380 contain no AGENT row; `AGENT_ID_COUNT=37` is only from inherited v1 §6, not v2. | Replace both §21 refs with **§15**; add **§5.1 Agent registry & capability matrix** (37 rows, canonical IDs, output kind, W/R/T, languages/paths, verification support, prompt source/hash, schema, badge floor); add **§15.1 37-agent census** as the count of record; add `agent-registry.census.test.ts`. | Census test derives 37 from the registry (not a hard-coded number), asserts unique IDs, 37 prompt sources, 37 schemas, 37 engine-map entries, zero extras; plan-link test rejects any `§21` reference. |
| D2 | **P0** | §6.1, §5, v1 §7 plan schema | CCR requires `AgentCapability[]` (output kinds, languages, path patterns, canWrite/canReview/canTest, fallbackFor, maxOutputTokens, static prior, priorVersion) and `FileTask[]` (id, path, language, duty, deps, required, riskHints, requiredChecks, estimatedBytes). **No section defines either type or their producer.** The Architect’s plan schema has no `required`, `riskHints`, `requiredChecks`, `estimatedBytes`, or capability fields. | `route` node cannot be implemented without inventing data; CCR may select an agent that cannot read/write/test, or refuse every task because `requiredChecks` is unknown. This is the exact “claimed-but-uncallable” seam. | `PLAN-v2.md:126` requires both types; no `AgentCapability` definition elsewhere; v1 §7 Architect schema (inherited) lacks the fields. | Add canonical `AgentCapability` and `FileTask` types to §5.1; add deterministic `architectPlanToFileTasks(plan)` with conservative defaults (`required=true`, `riskHints=[]`, `requiredChecks` from RVS, `estimatedBytes` default 4096 marked `estimated:true`, `engineHint` optional); CCR must reject missing language/capability, never guess. Add fixture-based parity test. | `agent-contract.test.ts` validates every registry row against the types; `architect-to-filetask.test.ts` transforms a golden plan and CCR routes it; negative fixture with unsupported language yields `NO_CAPABLE_AGENT`, not a silent fallback. |
| D3 | **P1** | §4 W10, §13 capability-auditor row | Prompt transform is under-specified and incomplete: W10 strips only the literal `[RESPONSE FORMAT]`, but catalog prompts also contain “Deliver … instantly”, “Output raw JSON”, “Output exactly as follows”, `Execution Command`, `Use code with caution`, duplicate role blocks, and multiple variants (Master Router/Architect/Cleaner/Sentinel appear more than once). Six field workers have only short directives, not full prompts. | Golden fixtures cannot be authored; residual output-format prose conflicts with the appended runtime contract; duplicate prompts make “the catalog” ambiguous; the six field-worker fixtures would be fabricated. | §4 W10 line 85 vs catalog shapes; §5 line 112 names six field-worker agents; no prompt-source map exists; no per-agent fixtures. | Add `agents/prompt-source-map.json` (37 entries: agent, source file/line, source hash, `CATALOG` or `AUTHORED`); define transform: normalize LF, remove boilerplate (`Use code with caution`, `Try without personalization`, `Execution Command`), cut every output-format region (headings and prose, not just `[RESPONSE FORMAT]`), retain ROLE/OBJECTIVE/constraints, assert exactly one `[ROLE]`, append contract after a fixed delimiter, reject if forbidden output tokens remain; idempotent. Author and review the six missing prompts; label provenance. | `prompt-transform.golden.test.ts`: 37 golden fixtures; transform(input) = expected; transform twice = once; no `[RESPONSE FORMAT]`, `Execution Command`, `Use code with caution`, or raw-JSON-only directive in output; each runtime contract is last and hash-stable; authored prompts carry `AUTHORED` provenance. |
| D4 | **P1** | §4 W08, §11 DoD #4, §15 | Capability badges are named but not defined. No derivation source, no evidence table, no representative-live subset, no rule that “mock-run” means the **exact agent** (W08 says “mock invocation by output kind”, which can badge 4 agents, not 37). | The UI can show “37 agents” with false capability; a badge is not evidence; “representative-live” can be claimed without a named run; this contradicts the plan’s own anti-fake-green rule. | §11 DoD #4 says “37-agent capability badges; mock per output kind”; §15 has no badge/evidence rows; W08 lists four labels without a state machine. | Add `agent_evidence(agent_id, badge, provenance, run_id, evidence_hash, created_at)` and a derivation function: `registered` = registry + hash; `schema-valid` = valid+invalid fixture; `mock-run` = ad-hoc mock run **for that agent**; `representative-live` = fixed six-agent subset (`architect`, `python-engine`, `react-engine`, `cleaner`, `gatekeeper`, `powershell-core`) with a recorded live run; no UI mutation; no green from mock. | `agent-badge.test.ts` derives badges from DB evidence; one mock run upgrades only its agent; live subset is exactly six; an agent without a mock run never shows `mock-run`; no badge can be set by API. |
| D5 | **P1** | §15, §10, §11, §4 W01, §7 | Per-agent tests, ad-hoc runs, prompt overrides, and snapshot semantics are missing from the traceability matrix and API list. `POST /api/agents/:id/run` is stated only in inherited v1; v2 §11 excludes it. No test proves an override is pinned at intake or rejected mid-run. | “All 37 are runnable” is untested; prompts can be overridden after snapshot; ad-hoc runs can bypass budget/schema/path rules; the Agents page is a dead surface. | §15 rows 360–380: no AGENT rows; §11 P6a API list has `/api/runs/:id/...` but no `/api/agents`; W01 names prompt hashes but no override test. | Add §11 routes: `GET /api/agents`, `GET /api/agents/:id`, `PUT/DELETE /api/agents/:id/prompt`, `POST /api/agents/:id/run`; body `{input, mode:"mock"|"live", maxCostUsd, targetPath?, options?}`; use resolved override → lint → snapshot; unknown `404 E_UNSUPPORTED_AGENT`, output-kind mismatch `422 E_AGENT_OUTPUT_MISMATCH`, files without target `422 E_AGENT_TARGET_REQUIRED`; no badge upgrade unless live provenance. | `agent-adhoc.test.ts` runs one agent per output kind with mock, asserts step/artifact rows and budget; `agent-override-snapshot.test.ts` mutates prompt after intake, proves old hash used, next run new; empty/oversize/secret/format-conflicting override rejected; reset restores default; live ad-hoc does not auto-upgrade other agents. |
| D6 | **P1** | §6.4 RVS, v1 verifier list, §11 DoD #4 | Verification overclaim for PowerShell/CMD/Three.js. RVS says “syntax for T0/T1”, but the only defined checkers are Python AST, JS/TS/TSX transpile, JSON, YAML, SQLite SQL, HTML. `.ps1`/`.cmd` have no parser; Three.js is JS syntax only; `.css`/Dockerfile lack a checker. A badge or check can therefore say “verified” when only text was inspected. | Generated PowerShell/CMD/Three.js files can pass as verified; the UI’s green badge becomes a lie; a broken `.ps1` or `.cmd` ships. The plan says no execution, so behavior is unverifiable by design. | §6.4 RVS mandatory “syntax for T0/T1”; v1 verifier list has no PowerShell/CMD/CSS/Docker; no `verificationSupport` field in the registry. | Add `verificationSupport: "runtime"|"syntax"|"static-only"|"unverified"` per agent/language; `.ps1` `static-only` unless a parser is implemented (no execution), `.cmd` `unverified`, Three.js `syntax` (JS/TS only), CSS/Dockerfile `static-only`; RVS never turns `unverified` into `pass`; UI badge copy “static only / unverified”. | `agent-verification-honesty.test.ts`: fixtures for `.ps1`, `.cmd`, Three.js, `.css`, Dockerfile return `unverified`/`static-only`, never `pass`; gate/CCA cannot accept on unverified mandatory check; badge does not show green. |
| D7 | **P1** | §6.1 refusal codes, §14, v1 §6 IDs | Namespace collisions and duplicate/ambiguous IDs: `router` agent vs CCR `R1` vs graph node `route`; `gatekeeper` agent vs `gate-decision` vs verification gate; `cleaner/sentinel/watchman` vs FSN/repair; error codes mix `NO_CAPABLE_AGENT`, `REPAIR_STALLED`, `E_REPAIR_STALLED`, `E_UNSUPPORTED_AGENT`; `structural-engine` vs `python-engine`; `js-engine` vs `threejs-engine`; `react-engine` vs `nds-engine`. | Wrong component attribution in DB/UI; route decisions attributed to the LLM agent instead of CCR; refusal mapping breaks (one layer returns an unprefixed code the UI does not know); duplicate path precedence is nondeterministic. | `PLAN-v2.md:143` (unprefixed CCR codes) vs `:352` (`E_*`); §15 `R1` is CCR; v1 §6 has an agent named `router`; no canonical ID map. | Add a naming table: `agent.router` (LLM intent), `route.decision` (CCR), `route` (graph node), `agent.gatekeeper`, `logic.gate-decision`, `check.gate`; canonical error registry with aliases (`E_REPAIR_STALLED` canonical, `REPAIR_STALLED` alias; route codes get `E_` prefix); engine precedence: `engineHint` then duty/content marker then path pattern then `polyglot` only if language declared. | `agent-registry.census.test.ts` rejects duplicate IDs/aliases; `error-code.parity.test.ts` maps every route refusal to one canonical code and one UI message; `engine-precedence.test.ts` covers `.js` Three.js, `.tsx` NDS, `.py` algorithm, `.ps1` trio, `.sql` janitor. |
| D8 | **P1** | §7.1 L1 candidate generation, v1 §7 Metacognitive | P7’s candidate generator uses the Metacognitive agent, whose output contract (inherited v1) is a “Refined System Prompt Box” text block, but §7.1 requires a candidate with target, diff, schema validity, size ≤20k, no secrets, no escalation, non-empty diff. No adapter or schema exists. | `learn` cannot validate/lint/store the candidate; prose can be mistaken for a prompt version; the promotion path can read a non-candidate. | `PLAN-v2.md:207` requires candidate fields; v1 §7 metacognitive response is text; no `CandidateDraft` schema. | Add `CandidateDraft` Zod schema (`targetAgent`, `candidateType`, `before`, `after`, `diff`, `promptHash`, `evidenceRefs`, `lint`), a deterministic adapter from the Metacognitive response, and a negative fixture (prose/markdown-only) that fails lint. | `candidate-contract.test.ts`: valid candidate accepted; prose-only rejected; lint rejects secrets/escalation/empty diff; `learn diff` uses the same schema. |
| D9 | **P2** | §6.1 fallback, v1 §6 engine mapping | Engine/path precedence is not declared, and the two maps (v1 fallback path→agent, v2 CCR capability/path patterns) can disagree. Examples: `.js` Three.js scene vs JS engine; `.tsx` React vs NDS; `.py` Python vs algorithm vs structural; `.sql` schema vs DB janitor; `.ps1` core/api/diagnostics. | Same plan routes to different agents; CCR determinism claim fails; fallback and primary route disagree; duplicate capability. | v1 §6 fallback is extension-only; §6.1 `AgentCapability` requires `path patterns` but no table; no `engineHint`/content marker. | Use one `AgentCapability` source for both engine map and CCR; precedence `engineHint` → duty/content marker → path pattern → declared fallback → `polyglot` only if language declared; add the ambiguity fixtures. | `engine-precedence.test.ts` (D7) plus `ccr-engine-parity.test.ts`: every file in a 40-file fixture routes identically through the engine map and CCR; duplicates produce a warning/refusal, not a silent pick. |

---

## 2. Agent × capability matrix (minimum contract to add)

**Derived from inherited v1 §6 (37 IDs) and v2 §6.1. v2 supplies none of these fields today; `UNSPEC` means the plan does not declare it and the patch must author it. R/S/M = registered, schema-valid, mock-run; L = representative-live subset (6).**

| # | Agent ID | Out | W/R/T | Language / path | Verification support | Prompt provenance | Badge floor |
|---|---|---|---|---|---|---|---|
| 1 | `router` | plan | — | brief → plan; **not in P6a graph** (ad-hoc/intent only) | n/a | CATALOG (final variant) | R/S/M |
| 2 | `architect` | plan | — | all → `FileTask` | n/a | CATALOG | R/S/M/**L** |
| 3 | `metacognitive` | text | — | prompt text → `CandidateDraft` | n/a | CATALOG | R/S/M |
| 4 | `epic` | plan | — | feature matrix | n/a | CATALOG | R/S/M |
| 5 | `cartographer` | plan | — | DAG | n/a | CATALOG | R/S/M |
| 6 | `structural-engine` | files | W | general / `UNSPEC` | PY/JS/TS partial | CATALOG | R/S/M |
| 7 | `python-engine` | files | W | `.py` | PY-AST | CATALOG | R/S/M/**L** |
| 8 | `polyglot-engine` | files | W | top-10 languages; declared only | varies | CATALOG | R/S/M |
| 9 | `js-engine` | files | W | `.js/.mjs/.cjs` | TS transpile | CATALOG | R/S/M |
| 10 | `ts-engine` | files | W | `.ts` | TS transpile | CATALOG | R/S/M |
| 11 | `baremetal-engine` | files | W | `.rs/.cpp/.c/.h` | unverified | CATALOG | R/S/M |
| 12 | `algorithm-engine` | files | W | `.py/.js` etc.; duty=algorithm | PY/TS | CATALOG | R/S/M |
| 13 | `html-engine` | files | W | `.html` | parse5 | CATALOG | R/S/M |
| 14 | `react-engine` | files | W | `.jsx/.tsx` | TSX transpile | CATALOG | R/S/M/**L** |
| 15 | `tailwind-engine` | files | W | `.css/.jsx/.tsx` | static-only | CATALOG | R/S/M |
| 16 | `threejs-engine` | files | W | `.js/.ts` + `three` content hint | syntax-only (no runtime) | CATALOG | R/S/M |
| 17 | `nds-engine` | files | W | `.jsx/.tsx`; duty=NDS | TSX transpile | CATALOG | R/S/M |
| 18 | `powershell-core` | files | W | `.ps1`; filename hints | static-only (parser optional, no exec) | CATALOG | R/S/M/**L** |
| 19 | `powershell-api` | files | W | `.ps1`; api/network duty | static-only | CATALOG | R/S/M |
| 20 | `powershell-diagnostics` | files | W | `.ps1`; audit/diag duty | static-only | CATALOG | R/S/M |
| 21 | `cmd-engine` | files | W | `.cmd/.bat` | unverified | CATALOG | R/S/M |
| 22 | `bash-engine` | files | W | `.sh` | unverified (optional `bash -n` not in plan) | CATALOG | R/S/M |
| 23 | `schema-engine` | files | W | `.json` | JSON parse | CATALOG | R/S/M |
| 24 | `sql-engine` | files | W | `.sql`; SQLite default | SQLite parse | CATALOG | R/S/M |
| 25 | `yaml-engine` | files | W | `.yml/.yaml` | YAML parse (alias cap) | CATALOG | R/S/M |
| 26 | `symbolic-logic-engine` | files | W | `.yaml` state machine | YAML parse | CATALOG | R/S/M |
| 27 | `markdown-engine` | files | W | `.md` | none | CATALOG | R/S/M |
| 28 | `cleaner` | review | R/W | all code; revisions | n/a | CATALOG | R/S/M/**L** |
| 29 | `sentinel` | review | R/W | all code; revisions | n/a | CATALOG | R/S/M |
| 30 | `watchman` | review | R/W | failing file + deps | n/a | CATALOG | R/S/M |
| 31 | `gatekeeper` | tests | T/W | `tests/**`, `*.test.*`, `*.spec.*` | varies by language | CATALOG | R/S/M/**L** |
| 32 | `gitops-engine` | files | W | `.github/workflows/**` | YAML parse | **AUTHORED** (directive only) | R/S/M |
| 33 | `sandbox-engine` | files | W | `Dockerfile*`, `docker-compose*.yml` | YAML partial / static-only | **AUTHORED** | R/S/M |
| 34 | `package-engine` | files | W | build configs | JSON/JS | **AUTHORED** | R/S/M |
| 35 | `live-monitor-engine` | files | W | `.ps1/.sh/.py` | varies | **AUTHORED** | R/S/M |
| 36 | `db-janitor-engine` | files | W | `.sql` maintenance | SQLite parse | **AUTHORED** | R/S/M |
| 37 | `harvester-engine` | files | W | `.py/.ts` scraper | PY/TS | **AUTHORED** | R/S/M |

**Proposed live subset (6):** `architect`, `python-engine`, `react-engine`, `cleaner`, `gatekeeper`, `powershell-core`. The last is deliberately included to prove the UI labels static-only correctly. Three.js/CMD remain mock/schema-valid; **no live claim**. All 37 must be mock-run individually; “mock per output kind” is insufficient.

---

## 3. Exact patch text (plan insertions)

**D1 — §0.10 and §5:**
> Replace “The matrix in §21 is the count of record.” with “The matrix in §15 is the count of record; the 37-agent census is §15.1.”
> Replace “The full matrix is §21.” with “The full matrix is §15; the agent census is §15.1.”
> Insert §5.1: “**Agent registry & capability matrix.** 37 canonical IDs; each row declares output kind(s), canWrite/canReview/canTest, languages, path patterns, verificationSupport, schemaId, promptSource+hash, default model/thinking, maxOutputTokens, prior+priorVersion, fallbackFor. This table is the single source for the Agents UI, ad-hoc runs, CCR, engine mapping, and badges. `UNSPEC` is a plan defect, not a runtime default.”

**D2 — §5.1/§6.1:**
```ts
type AgentCapability = {
  agentId: string; outputKinds: ("plan"|"files"|"review"|"tests"|"text")[];
  canWrite: boolean; canReview: boolean; canTest: boolean;
  languages: string[]; pathPatterns: string[]; verificationSupport: "runtime"|"syntax"|"static-only"|"unverified";
  fallbackFor: string[]; maxOutputTokens: number; staticPrior: number; priorVersion: string;
  promptVersion: string; schemaId: string;
};
type FileTask = {
  id: string; path: string; language: string; duty: string; deps: string[];
  required: boolean; riskHints: string[]; requiredChecks: string[]; estimatedBytes: number;
  engineHint?: string;
};
```
> Add `architectPlanToFileTasks(plan)` with `required=true`, `riskHints=[]`, `requiredChecks` from RVS, `estimatedBytes` default 4096 marked `estimated:true`; CCR refuses if language/capability is absent. No silent defaults for capabilities.

**D3 — §4 W10:** replace the one-line transform with the 8-step algorithm in D3 above; add `agents/prompt-source-map.json`, `test/fixtures/agents/<id>/{catalog,runtime,hash}.txt`; mark six field-worker prompts `AUTHORED` with reviewer and date.

**D4 — §11 DoD #4:** replace “mock per output kind” with “mock-run **for each of the 37 agents**; representative live for exactly six named agents; badges derived only from `agent_evidence`; no API/UI can set a badge.”

**D5 — §11:** add the four agent routes and the ad-hoc body/refusals; **§15.1** add `AGENT` rows/tests: `agent-contract`, `agent-adhoc`, `agent-override-snapshot`, `agent-badge`, `agent-verification-honesty`, `agent-registry.census`, `prompt-transform.golden`, `candidate-contract`, `engine-precedence`.

**D6 — §6.4:** add `verificationSupport`; “unverified/static-only is never pass”; UI copy “static only / unverified”; tests for `.ps1`, `.cmd`, Three.js, CSS, Dockerfile.

**D7 — §6.1/§14:** canonical names and error registry; route refusals use `E_` prefix (`E_NO_CAPABLE_AGENT`, `E_BUDGET_INFEASIBLE`, `E_CONTEXT_INFEASIBLE`, `E_POLICY_BLOCKED`); retain aliases only for compatibility; one table in §14.

**D8 — §7.1:** add `CandidateDraft` schema and adapter; `learn` stores only validated candidates; prose-only output fails `E_LEARNING_CANDIDATE_INVALID`.

**D9 — §6.1:** add precedence and `engineHint` to `FileTask`; parity test with the engine map.

---

## 4. Cross-section contradictions (cannot be fixed inside this seat)

| ID | Sections | Contradiction | Requested action |
|---|---|---|---|
| X1 | §6.1 ↔ v1 §7 | CCR inputs have no producer in the Architect schema. | Lead/seat 5: adopt `FileTask` transform; seat 1: register schema. |
| X2 | §6.5 CCA ↔ agent outputs | CCA needs `review`, `schema`, `finish`, `routePrior` scores; agents return verdict/findings, not numeric scores. | Seat 5/3: define deterministic derivation; no self-scoring. |
| X3 | §7.1 ↔ v1 §7 | Metacognitive text output vs `CandidateDraft`. | Seat 4/5: adapter + schema (this report proposes it). |
| X4 | §0.10/§5 ↔ §15 | §21 referenced, §15 exists. | Lead: replace refs; Wave Sheet should cite §15. |
| X5 | §3/§6.1 ↔ v1 §6 | `router` agent is in the 37 but P6a graph routes via CCR; active vs ad-hoc undefined. | Lead: declare `router` ad-hoc/intent-only or remove from Release A active set. |
| X6 | §6.1 ↔ §14 | Unprefixed route codes vs `E_*` registry. | Lead: canonical code registry (D7). |

---

## 5. What I checked and found clean

- v2 W08 and DoD #4 **already reject “all 37 live-proven”**; representative live is the right intent. The defect is missing definition, not a false claim yet.
- v2 §17 “Unverified” list is honest about cache/seed/50-case/generalization; no invented agent metrics.
- v2 §12 Assumptions correctly excludes the 80+ prompt-less hive roles; the 37 count is the intended scope.
- The inherited v1 §6 agent table sums to **37 unique IDs** (verified by array count 37/37), with no exact duplicate slug.
- v2 §15 feature count is internally consistent: L1+L2+L4 = 3 loops, R1 = 1 router, A1–A5 = 5 algorithms, LG1–LG4 = 4 logic, S1–S7 = 7 scripts, plus INFRA; no double counting.
- v2 W01/W18 correctly require prompt/policy hashes and event-only replay; the missing piece is the override resolution and agent snapshot test (D5).

---

## 6. Claim strength

- **VERIFIED (tool):** `PLAN-v2.md` read; line references checked; 37-ID array count; skill files read.
- **READ:** inherited v1 §6/§7 (agent table and output schemas) from the Lead conversation; source catalog excerpts in the request/AgentProject; WAVE-SHEET.
- **INFERRED:** runtime consequences of missing types/routes; no product code exists, so no RED test was executed.
- **UNVERIFIED:** exact catalog line provenance for each prompt; whether the six field-worker directives are sufficient to author production prompts; live behavior of any agent. What would prove them: the fixture/source-map tests in §3 and one live representative run.

---

## 7. Skills applied (required lens)

| Skill | Finding produced |
|---|---|
| **smartfix** | Sized one seat; RED-probe/evidence discipline; no product edits; journal + receipt. |
| **logic-debugger** | D7 duplicate IDs/refusals; D5 snapshot/override state; D2 capability filter failure. |
| **integration-logic** | D2 architect→FileTask→CCR→generate seam; D5 ad-hoc route; D4 badge evidence seam. |
| **logic-gatekeeper** | Phase 1 (architecture/data flow/edge case/root cause) recorded before proposing any patch; no product mutation. |
| **research** | Section/file line evidence; separated v2 facts from inherited v1; no invented APIs. |
| **capability-auditor** | Manifest-vs-registry matrix; claimed-but-uncallable agents; badge truth; per-agent schema parity. |
| **auditor** | Claims register; no fake GREEN; unrun probes labeled; scope receipts. |
| **forge** | Root-cause (missing registry/contract) not symptom; minimal exact patch text. |
| **forgewright-lead** | Evidence-first, no product edits, disjoint scope, final handoff. |

---

## 8. Files read / sources

- `C:\Users\Riley\Desktop\HiveRouter\docs\PLAN-AUDIT\WAVE-SHEET.md` (read, 41 lines).
- `C:\Users\Riley\Desktop\HiveRouter\docs\PLAN-v2.md` (read, 454 lines; sections §0–§17).
- Inherited v1 plan §§6–7 (agent table/output schemas) from the Lead conversation; no v1 file exists in the repository.
- Skills: `smartfix`, `logic-debugger`, `integration-logic`, `forgewright-logic-gatekeeper` (`logic-gatekeeper`), `forgewright-research` (`research`), `capability-auditor`, `auditor`, `forge`, `forgewright-lead`.
- No product code, no installs, no API calls, no key access, no web fetches.

**Report status:** DONE (plan audit only). No product or canonical-plan edits.
