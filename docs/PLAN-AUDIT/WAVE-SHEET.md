# HiveRouter — Plan Bug-Fix Wave Sheet

**Wave:** PLAN-AUDIT-1
**Checkpoint:** approved plan v2 (in the Lead conversation); repository is empty except for this audit workspace. No product code exists. No installs, no API spend, no key access.
**Mode:** plan audit only. Fixers write reports and patch text; only the Lead edits the canonical plan or product code.
**Skills required for every seat (all of them):** smartfix, logic-debugger, integration-logic, logic-gatekeeper, research, capability-auditor, auditor, forge, forgewright-lead. Label which lens produced each finding.
**Budget:** 15 min work + 5 min check per seat; auditor runs 2× (30 min) after reports are relayed.
**Forbidden:** editing product code, editing the canonical plan, editing another seat's report, installs, git writes, paid API calls, reading/printing the DeepSeek key.
**Gate:** every defect must have (a) exact plan section, (b) why it will cause a bug when enacted, (c) a RED probe/test or contradiction, (d) exact patch text, (e) GREEN verification. Findings without evidence are UNVERIFIED, not accepted.

## Seats and exclusive report scopes

| Seat | Target | Plan sections | Report |
|---|---|---|---|
| 1 `plan-core-state` | Lifecycle, snapshots, state machine, repair, SSE, persistence core | §0, §3, §4, §8, §9, §10, §14, §17, §21 | `docs/PLAN-AUDIT/01-core-state.md` |
| 2 `plan-api-ui-seams` | API/UI/SSE/CLI/control wiring, refusals, dead controls | §5, §11, §12, §14, §16 | `docs/PLAN-AUDIT/02-api-ui.md` |
| 3 `plan-security-authority` | Secrets, authority, budget, approval, eval isolation, consent | §2, §4 W02/W05/W15, §7.7, §13, §14, §17 | `docs/PLAN-AUDIT/03-security.md` |
| 4 `plan-learning-stats` | L1/L2/L4, datasets, eval, promotion, provenance, statistics | §7, §15, §17 | `docs/PLAN-AUDIT/04-learning.md` |
| 5 `plan-routing-math` | CCR/CPO/FSN/RVS/CCA/CRA, math, determinism, budget DP | §6, §10, §15, §17, §21 | `docs/PLAN-AUDIT/05-algorithms.md` |
| 6 `plan-agent-capability` | 37-agent registry, prompts, capability badges, traceability | §5, §7.1, §15, §17, §21 | `docs/PLAN-AUDIT/06-capability.md` |
| 7 `plan-delivery-gates` | Phases, team, tests, tooling, exact pins, disk/RAM, acceptance | §3, §9, §10, §18, §19, §20 | `docs/PLAN-AUDIT/07-delivery.md` |
| 8 `plan-independent-auditor` | Independent audit of the plan + verification of seats 1–7 | All | `docs/PLAN-AUDIT/08-auditor.md` |

## Required report format

Each fixer writes:
1. **Verdict** — plan is executable / executable with fixes / not executable.
2. **Defects** — table: ID, severity (P0/P1/P2), plan section, defect, why it bites in code, RED probe, exact patch text, GREEN verification.
3. **Cross-section contradictions** — anything that cannot be fixed inside the seat's own sections (requested from Lead).
4. **What I checked and found clean** — with evidence, so the Lead knows coverage.
5. **Claim strength** — VERIFIED / READ / INFERRED / UNVERIFIED.
6. **Skills applied** — one line per skill with the finding it produced (or "no finding").
7. **Files read / sources** — paths and URLs actually read.

No product fixes. No test weakening. No invented evidence. A `P0` is a defect that would make the plan produce a broken, unsafe, or unfalsifiable system.

## Auditor protocol

- First pass: independently audit the plan with all skills; record initial P0/P1 candidates.
- The Lead relays the seven seat reports. Second pass: verify every claimed defect and patch; reject claims without evidence; check coverage gaps and double counting; issue GO / GO-WITH-FIXES / NO-GO and the exact remaining blockers.
- The auditor never edits product code or other reports; its only output is `docs/PLAN-AUDIT/08-auditor.md`.
