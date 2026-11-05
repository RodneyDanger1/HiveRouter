# plan-audit-capability — Seat 6 journal

**HEAD/checkpoint:** `docs/PLAN-v2.md` (454 lines, 45,327 bytes; read 2026-11-03 09:23–09:27 -06:00). Repository contains audit workspace only; no product code. WAVE-SHEET read.
**Scope:** PLAN-AUDIT-1 seat 6: §5, §6.1, §7.1, §15, §17; inherited v1 §6/§7 for the 37-agent registry, prompt transforms, output schemas, engine mapping, capability badges, tests, representative live, overrides/snapshots, ad-hoc runs, duplicate IDs, PowerShell/CMD/Three.js verification, traceability.
**Mode:** plan audit only. No product edits, no installs, no API calls, no key access, no web fetches. Only assigned files written.
**STATUS: DONE.**

## 09:22 — research
- Read `WAVE-SHEET.md`, `PLAN-v2.md` (all 454 lines), and required skills: smartfix, logic-debugger, integration-logic, logic-gatekeeper (`forgewright-logic-gatekeeper`), research (`forgewright-research`), capability-auditor, auditor, forge, forgewright-lead.
- Contract extracted: 37 agents get capability badges (registered/schema-valid/mock-run/representative-live); per-agent prompt-transform fixtures; no false live claims; no product code exists.

## 09:26 — probes (read-only)
Command:
`$ids | Measure-Object` over the inherited 37-agent ID list
Output: `AGENT_ID_COUNT=37`, `UNIQUE_ID_COUNT=37`.
Command:
`Select-String PLAN-v2.md -Pattern '§21|§15|AgentCapability|FileTask|capability badge|representative-live|mock-run|prompt transform|ad-hoc|override'`
Observed: §0.10 and §5 cite §21 as the matrix; the file has no §21 (matrix is §15); §15 has 20 feature rows + INFRA and zero agent rows; §6.1 requires `AgentCapability[]`/`FileTask[]`; W08/W10 name badges/transform but no table; no `/api/agents` route; no override test.
No RED test executed: no product code exists. REDs are plan contradictions + proposed tests, labeled as such in the report.

## 09:27 — defects recorded
- D1 P0: no v2 agent registry/capability matrix/count of record; §21 dangling reference.
- D2 P0: CCR `AgentCapability[]`/`FileTask[]` have no producer; Architect schema lacks required fields.
- D3 P1: prompt transform strips only `[RESPONSE FORMAT]`; residual output-format prose, duplicate variants, six field-worker prompts missing.
- D4 P1: capability badges undefined; “mock per output kind” can badge 4, not 37; representative-live subset unnamed.
- D5 P1: per-agent tests, ad-hoc route, overrides/snapshot semantics absent.
- D6 P1: PowerShell/CMD/Three.js verification overclaim; no `verificationSupport`.
- D7 P1: router/CCR/node and error-code/ID collisions.
- D8 P1: Metacognitive text vs P7 `CandidateDraft`.
- D9 P2: engine/path precedence ambiguity.

## 09:28 — report
- Wrote `docs/PLAN-AUDIT/06-capability.md` (24,492 bytes): verdict, 9-defect table with RED/patch/GREEN, 37-row agent × capability matrix, exact plan insertions, cross-section contradictions, clean checks, claim strength, skills lens, sources.
- Wrote this journal.

**Files changed:** `docs/PLAN-AUDIT/06-capability.md`, `logs/plan-audit-capability.md` only.
**Missed / limits:** no product code exists, so no runtime RED/GREEN could be run; exact catalog line provenance for the 37 prompts is inherited from the Lead conversation, not a repo file; live agent behavior unverified. The report labels these UNVERIFIED and gives the fixtures/tests that would prove them.
