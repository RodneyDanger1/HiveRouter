# QA WAVE 1 — Seat 6 `qa-learning`

**Verdict: PASS-WITH-NOTES (learning scope).** Two real defects found, RED-proven, minimally fixed, GREEN. No out-of-scope product edits. The accepted P7 outcome remains honest: no sealed 390-case pool/consent in this build, so `learn` refuses with `E_LEARNING_POOL_EXHAUSTED` and no promotion is possible.

**Scope:** `src/server/learning/**`, `scripts/learn.ts`, `scripts/eval-router.ts`, `scripts/live-smoke.ts`, new learning tests.
**No paid calls, no key access, no server restart, no installs, no git writes.**
**Claim strength:** VERIFIED = command output; READ = file; INFERRED = contract consequence; UNVERIFIED = not executed.

---

## 1. Defects and fixes

### QA-L1-01 — `learn` counted raw block rows, not complete 65-case blocks

- **File:** `scripts/learn.ts:16-38` (before), `:37-63` (after). **Severity:** P1.
- **Contract/invariant:** P7 requires **6 disjoint 65-case blocks (390 cases)** before an evaluation is possible; `learn` must report `E_LEARNING_POOL_EXHAUSTED` when the complete pool is absent. A block row with no cases is not a pool.
- **Why it bites:** The old code did `blocks < 6` using `COUNT(*) FROM sealed_pool_blocks`. Six empty/partial block rows plus ≥3 traces would pass the pool gate and return `refused:null`, falsely suggesting a candidate/evaluation is possible. With 0 traces it reported `E_LEARNING_INSUFFICIENT_SAMPLE`, hiding the real pool defect.
- **RED:** `npx vitest run test/unit/learning-cli.test.ts` → failed:
  `expected 'E_LEARNING_INSUFFICIENT_SAMPLE' to be 'E_LEARNING_POOL_EXHAUSTED'`.
- **Minimal fix:** count only `status='ready'` blocks whose `sealed_pool` row count is exactly 65; add active `case_to_provider_eval` consent check; report `completeBlocks` and `caseConsent`; refusal order pool → consent → traces. File: `scripts/learn.ts:37-63`.
- **GREEN:** `npx vitest run test/unit/learning-cli.test.ts` → **1 passed**; `npm run learn -- --json` → exit **6**, `refused.code = E_LEARNING_POOL_EXHAUSTED`, `counts.completeBlocks = 0`.
- **Note:** `npm run learn -- --apply` still exits **3** with `LEARN_APPLY_FORBIDDEN`; no auto-apply exists.

### QA-L1-02 — Approval token accepted an unparseable persisted expiry

- **File:** `src/server/learning/approval.ts:196-205` (after). **Severity:** P1.
- **Contract/invariant:** Approval tokens are single-use, bound, and expire after 10 minutes. A malformed persisted `expires_at` must fail closed.
- **Why it bites:** `Date.parse(row.expires_at) <= now` is `false` when the date is `NaN` (`NaN <= x` is false). A tampered/corrupt row with `expires_at='not-a-date'` passed the expiry check and was consumed. The HMAC was still valid because only the DB row changed.
- **RED:** `npx vitest run test/unit/learning-approval.test.ts` → failed:
  `expected [Function] to throw an error` for the unparseable-expiry case.
- **Minimal fix:** `const expiresAt = Date.parse(row.expires_at); if (!Number.isFinite(expiresAt)) refuse('E_LEARNING_APPROVAL_EXPIRED', 'approval token has an invalid expiry')`. File: `src/server/learning/approval.ts:199-205`.
- **GREEN:** `npx vitest run test/unit/learning-approval.test.ts` → **5 passed**; valid issue/consume, replay, expiry, tamper, wrong binding, malformed, invalid-expiry all green.

---

## 2. What I checked and found clean

| Area | Evidence | Verdict |
|---|---|---|
| Consent matrix / revoke tombstones | `learning-consent-trace.test.ts` (5 passed) | VERIFIED |
| Trace store redacts secret previews; refuses non-terminal run; one trace/run upsert; verdict/edit | same, 5 passed; preview JSON contains `[REDACTED_SYSTEM_SECRET]`, not the secret | VERIFIED |
| Sealed pool 6×65, 15 dev + 50 holdout, no case reuse, suite frozen | `learning-pool.test.ts` (4 passed); 5 blocks → `E_LEARNING_POOL_EXHAUSTED`; 6 → ready | VERIFIED |
| Single-use `suite_uses` claim before spend | same; second claim refused `E_LEARNING_SUITE_ALREADY_USED`; `suite_uses.suite_id` unique | VERIFIED |
| 50-pair gate / 25 insufficient / mock-synthetic refusal / tamper | `learning-stats.test.ts` (12 passed); 25 → `E_LEARNING_INSUFFICIENT_SAMPLE`; 50 strong synthetic unit fixture eligible only with `requireLive:false`; default live-required refuses synthetic | VERIFIED |
| Approval single-use/binding/expiry | `learning-approval.test.ts` (5 passed), including invalid-expiry fix | VERIFIED |
| Promotion/rollback/monitor | `learning-promotion.test.ts` (2 passed); no token → refusal; valid token → promote; active/LKG; monitor `paused_review`; rollback; tampered evidence refused | VERIFIED |
| Repair memory/guard | `learning-mining-repair-guard.test.ts` (9 passed); project/expiry/decay; L4 thresholds and 10-min timeout | VERIFIED |
| `learn` refusal / `--apply` | `npm run learn -- --json` exit 6 with pool refusal; `--apply` exit 3 | VERIFIED |
| `eval-router` read-only | `npm run eval:router -- --json` → exit 0, 7 decisions, no provider call | VERIFIED |
| `live-smoke` usage guard | `npm run test:live` (no `--yes`) → exit 2; no network/key use | VERIFIED |
| P7 stage manifest | `npm run assert-stage -- --stage=p7 --json` → `ok:true`, `violations:[]`, `fallback:false`, 45 tables, 46 routes, 22 scripts | VERIFIED |
| Typecheck | `npm.cmd run typecheck` → clean at 10:27 | VERIFIED |
| Learning tests | `npx vitest run learning` → **44 passed / 8 files** | VERIFIED |
| Sweeps | `npm run secret-scan` clean (122 files); `npm run stub-sweep` clean (77 files) | VERIFIED |

**No mock/synthetic promotion:** `evaluatePromotionGate` refuses mock/synthetic when `requireLive` is true; `promote` uses the default live requirement. The synthetic fixture is gate-unit-only, never a promotion claim.

**No promotion faked:** the live DB has no sealed pool/consent, so `learn` refuses and no `promotions` row is created. The P7 outcome is `P7_REFUSED`/mock-only, not a live promotion.

---

## 3. Out-of-scope / notes

- **P0-priority environment blocker (not learning):** `npm run preflight -- --port 0 --json` currently exits **7** with RAM `0.83 GB` vs required `1.5 GB` (`E_RESOURCE_INSUFFICIENT`). It was green at wave start; current host pressure changed. This is outside the learning scope and is not caused by these edits, but the Lead should re-run preflight on a quiet host before the final gate.
- **Schema/workarounds (READ, not fixed):** `traces.run_id UNIQUE` means one aggregate trace per run; redacted previews and sealed case payloads are mode-0600 JSON files under `data/learning/**` because the P7 tables have no content/preview columns; `eval_runs.mode` carries `live|mock|synthetic` because there is no provenance column; active/LKG version pointers live in `settings` keys; `promotions` stores `toVersionId` in `evidence_json`. These are existing schema constraints, not regressions.
- **UNVERIFIED:** a real live 50-pair learning promotion (no sealed pool, no consent, no paid call). The accepted outcome is refusal.
- **No out-of-scope edits:** changed only `scripts/learn.ts`, `src/server/learning/approval.ts`, `test/unit/learning-approval.test.ts`; added `test/unit/learning-cli.test.ts`. `eval-router.ts` and `live-smoke.ts` were read and exercised but not edited.

---

## 4. Skills applied (one line each)

- **logic-debugger** — found the `Date.parse(NaN)` expiry bypass and the block-vs-complete-pool logic defect; both RED-proven.
- **forge** — minimal diffs at the refusal boundary; no test weakening; GREEN re-run.
- **smartfix** — one seat/one scope; journal + RED/GREEN receipts; no swarm sprawl.
- **capability-auditor** — checked that `learn` claims "inspect-only" and cannot apply; `promote` requires a token; no live-promotion claim.
- **auditor** — independent probes: `learn`, `--apply`, `eval-router`, `live-smoke`, stage assert, typecheck, 44 learning tests, sweeps.
- **systems-validator** — checked P7 stage manifest, CLI exit codes, and P7 contract claims against `docs/PLAN-v3.md`/`AGENTS.md`; flagged unverified live promotion and the out-of-scope preflight RAM failure.

**Files read/sources:** `docs/QA-WAVE-1/WAVE-SHEET.md`, `AGENTS.md`, `docs/PLAN-v3.md` §9, `scripts/learn.ts`, `scripts/eval-router.ts`, `scripts/live-smoke.ts`, `src/server/learning/**`, `src/server/db/migrations.ts`, `src/server/security/redact.ts`, learning tests. No external calls.
