# 02 — API / UI / SSE / CLI seam audit

**Seat:** 2 `plan-api-ui-seams` · **Plan:** `docs/PLAN-v2.md` (SHA256 `8AD8…18F2`) · **Wave:** PLAN-AUDIT-1 · **Date:** 2026-11-03 09:22–09:36 America/Chicago
**Scope:** §5, §11, §12, §14, §16 as assigned; audited against v2 §8 (patches to v1 §11/§12), §6.9, §7.6, §14. No product edits.

## 1. Verdict

**Executable with fixes.** The route/page inventory is broad and the named-refusal vocabulary is unusually good, but the plan does not pin six binding seams: approval-token issuance, SSE snapshot/replay, release-stage feature gating, idempotency, envelope/OpenAPI parity, and control preconditions. As written, promotion/rollback are unreachable or authority is fabricated; reconnect can silently lose events; Release A cannot prove it contains no P6/P7 artifacts; duplicate paid evaluation is possible. **A1–A3 are P0.** A4–A9 are P1 contract defects. A10 is P2.

**Claim strength:** VERIFIED = file read (paths/hashes/lines). READ = plan text. INFERRED = enactment behavior. No runtime exists, so every RED is a **planned contract test or direct plan contradiction**, not an executed failure. No UNVERIFIED product claims are made.

## 2. Scope-numbering note (not a defect)

WAVE-SHEET assigns seat 2 to “§5, §11, §12, §14, §16,” but in PLAN-v2 §11 is Definition of Done, §12 is Assumptions, and §16 is Mermaid diagrams. The API/UI/CLI material lives in **§8 (explicit patches to v1 §11/§12), §6.9, §7.6, §14, and §10**. I audited that material. The Lead should renumber the WAVE-SHEET or state that seat 2 targets v2 §8/§6.9/§7.6/§14/§10; otherwise seats 1/3/7 will also audit the wrong §11/§12.

## 3. Defect summary

| ID | Sev | Plan section | Defect | Why it bites | RED probe |
|---|---|---|---|---|---|
| A1 | **P0** | §7.6, §7.1, §14 (W05) | No route issues the approval token required by promotion/rollback | UI cannot obtain authority; promotion is dead or token is self-fabricated | Route-inventory test: no `/api/learning/approvals`; W05 requires signed single-use token |
| A2 | **P0** | §8 patch v1 §11; §14 (W06) | No SSE snapshot route or event envelope; `/events` vs `/stream` undefined; 500-event replay gap has no refusal | Reconnect loses events silently; W06 “snapshot endpoint” unverifiable | Contract test: `/api/runs/:id/snapshot` absent; SSE `data` schema undefined |
| A3 | **P0** | §3 vs §8/§6.9/§7.6 | Release A “zero P6/P7 artifacts” has no feature flag/route registration mechanism | A build ships later-phase routes/pages; staging gate cannot be proven | Phase-gate test cannot assert zero P6/P7 routes because all are registered unconditionally |
| A4 | P1 | §6.9, §6.8, §14 | “`/api/scripts` list/schema/dry-run, read-only” names no method and dry-run is execution | Dead control or arbitrary script execution; “read-only” is false | OpenAPI test: no `POST /api/scripts/:id/dry-run`; §6.8 scripts allow `--write` |
| A5 | P1 | §14, §6.9, §10 | `Idempotency-Key` required but no TTL/replay/conflict contract | Duplicate paid evaluation/promotion; retry doubles spend | Duplicate POST test has no defined response |
| A6 | P1 | §8 patch v1 §11; §14 | `hive.api.v1` and legacy v1 envelopes mix; no response schemas/OpenAPI coverage rule | Client parser fails on one family; OpenAPI docs lie | OpenAPI test: routes lack `response` schemas; client has two shapes |
| A7 | P1 | v1 §11/§12 via §8; §14 (W12) | File content/download/open-folder control preconditions and refusals missing | Dead buttons; XSS/path traversal; partial zip while running | Download empty/running has no refusal; open-folder on non-Windows undefined |
| A8 | P1 | §7.6, §7.1, §14 | Learning-off has no response shape; `/datasets` vs `eval_suites`; no cases route | Learning page errors/dead tabs; case provenance unreachable | `GET /overview` when disabled undefined; no `/datasets/:id/cases` |
| A9 | P1 | §14 | Named refusals not mapped to HTTP status or CLI exit code | CLI automation cannot branch; scripts return wrong class | Exit-code table test cannot be written from a code list |
| A10 | P2 | §6.9, §7.6, §13, §14 | `:kind`, context and trace read endpoints lack projection/traversal rules | Arbitrary report read; raw generated content/secret exposure | `GET /api/ops/reports/..%2f..` has no refusal; trace response schema absent |

## 4. Detailed findings

### A1 — P0 — Approval token issuance is absent
**Sections:** §7.6 API list; §7.1 promotion gate; §4 W05; §14 refusal list.
**Defect:** W05 requires a signed, single-use token bound to candidate+eval hash, 10-min TTL, hashed storage, audit. The UI requires typed confirmation. The API lists `POST /promotions` and `POST /rollback` but **no route issues the token**. The only two enactment outcomes are (a) the Promote/Rollback buttons are permanently refused, or (b) the client invents a token and the service cannot verify authority. Both are DoD failures (“no dead controls”).
**Why it bites:** authority becomes decorative; the promotion packet cannot be exercised; the security requirement cannot be tested end-to-end.
**RED (plan contradiction):** enumerate §7.6 routes → no approval issuance; W05 says token is required and signed. Planned test `promotion requires a token issued by the server` has no server path to 201/200.
**Patch:** insert in §7.6 API:
```ts
POST /api/learning/approvals
body: z.object({
  action: z.enum(['promote','rollback']),
  candidateId: z.string().uuid(),
  evaluationId: z.string().uuid(),
  typedPhrase: z.literal('APPROVE'),
})
// 201 hive.api.v1 { approvalToken: string, expiresAt: string, tokenId: string }
// token: 32 random bytes, SHA-256 stored, candidate+eval+action bound, TTL 600s, single-use
```
UI §12: promotion/rollback drawer gets an explicit **“Issue approval token”** step after typed phrase; token held in memory only; `POST /promotions`/`/rollback` consume it; refresh discards it; no auto-retry. Add `E_LEARNING_APPROVAL_REQUIRED` 403 and `E_LEARNING_APPROVAL_EXPIRED` 403 to the refusal registry.
**GREEN:** integration: issue → promote 200 → reuse 403; expired 403; wrong candidate 409; `GET /approvals` 405; audit row; E2E token step. **Lens:** integration-logic + capability-auditor.

### A2 — P0 — SSE snapshot/envelope/replay contract missing
**Sections:** §8 patch to v1 §11; §4 W06; §14; §10 test list (“10k replay”).
**Defect:** W06 promises “snapshot endpoint” and a 500-event replay window; no snapshot route or shape exists. v1 has both `/api/runs/:id/events?after=` and `/api/runs/:id/stream`; the plan never states which is canonical, what `data` contains, how `Last-Event-ID` maps, or what happens when the requested ID is outside the window. The UI’s reconnect path is therefore undefined; a 10k-event replay test cannot assert a contract.
**Why it bites:** after a reconnect, the UI silently misses events or replays duplicates; bounded SSE is claimed but unverifiable; run state can render stale.
**RED:** OpenAPI/route test asserts `GET /api/runs/:id/snapshot`; plan has no such path. SSE schema test has no `data` shape. W06 vs §8 contradiction.
**Patch:** insert in §8/v1 §11:
```ts
GET /api/runs/:id/snapshot -> 200 { schema:'hive.api.v1', ok:true,
  data:{ run, lastEventId, steps, checks, artifacts, truncated:boolean } }
GET /api/runs/:id/stream -> text/event-stream
// id: <seq>
// event: run.started|phase.started|...|learning...
// data: {"schema":"hive.api.v1","ok":true,"type":"...","data":{...},
//        "meta":{"seq":n,"runId":"...","replay":true|false}}
// Last-Event-ID optional. If seq is outside the 500-event window:
// 410 { error:{code:'E_REPLAY_WINDOW_EXCEEDED', details:{snapshotUrl,lastEventId}} }
```
`/events` becomes a deprecated alias; both must return the same sequence. UI: initial load calls `/snapshot`, then opens `/stream` from `lastEventId`; on 410, re-fetch snapshot and resume. Heartbeats `: ping` do not consume sequence IDs.
**GREEN:** `sse-replay.test.ts`: 600 events; reconnect from id 0 → 410 + snapshot; reconnect from id 550 → seq monotonic, no duplicate IDs; UI E2E reconnect banner. **Lens:** logic-debugger + integration-logic.

### A3 — P0 — Release-stage feature gating is not implementable
**Sections:** §3 staging vs §8/§6.9/§7.6.
**Defect:** §3 says Release A contains **zero** P6/P7 tables, routes, pages, or scripts. §8 adds a P6a `route` node and P7 hooks to the same product; §6.9/§7.6 describe routes/pages unconditionally. There is no compile-time or runtime feature flag, no route registry, and no `/api/meta.features`. The gate “no P6/P7 artifacts” cannot be tested.
**Why it bites:** A build ships later-phase surfaces; P7 “off by default” pages leak; a user can hit unready endpoints; delivery gate is prose-only.
**RED:** phase-gate test cannot assert absence; route inventory has all phases. §3 vs §8 contradiction.
**Patch:** add to §3/§8:
```ts
// src/shared/features.ts
export const PHASE = z.enum(['A','B1','B2']).parse(process.env.HIVE_PHASE ?? 'A');
export const FEATURES = {
  routing: PHASE !== 'A',
  learning: PHASE === 'B2',
} as const;
```
Register P6a/P7 routes and UI nav only when the flag is true. `GET /api/meta` returns `{phase,features}`. Tests: A OpenAPI has zero `/api/learning*` and zero `/api/runs/:id/routing`; B1 has routing, no learning; B2 both. §3 gate command runs each phase.
**GREEN:** `phase-gating.test.ts` (three OpenAPI snapshots); E2E nav absence in A; no P7 table migration in A. **Lens:** integration-logic + forgewright-lead.

### A4 — P1 — Scripts API is contradictory and unsafe
**Sections:** §6.9 (“`/api/scripts` (list/schema/dry-run), read-only”), §6.8 (scripts can `--write --yes`), §14 (no arbitrary shell).
**Defect:** “list/schema/dry-run” is not a method. A dry run executes script logic; calling the surface “read-only” is false. There is no allowlist, no request schema, and no rule for `--write`/`--live` from HTTP. UI “Scripts read-only/dry-run” therefore has no honest control.
**Why it bites:** either a dead button or an arbitrary execution surface; capability audit flags a claimed-but-uncallable/unsafe tool.
**RED:** OpenAPI test expects `POST /api/scripts/:id/dry-run`; plan defines no method; §6.9 vs §6.8 contradiction.
**Patch:** replace §6.9 bullet:
```ts
GET /api/scripts -> {id,title,description,argsSchema,readOnly,requiresWrite,liveCapable}[]
GET /api/scripts/:id/schema -> JSON Schema
POST /api/scripts/:id/dry-run -> only allowlisted pure ids; in-process function;
  no shell, no env/key, no writes; 422 E_SCRIPT_DRY_RUN_UNSUPPORTED otherwise
```
UI: list + schema + **Copy CLI command**; dry-run button only for `readOnly` scripts; result panel shows `dryRun:true`; no Run button for `requiresWrite`/`liveCapable`.
**GREEN:** `scripts-api.test.ts`: unknown 404, write-capable dry-run 422, pure dry-run no writes, envelope/exit contract; E2E no dead Run. **Lens:** capability-auditor + forge.

### A5 — P1 — Idempotency-Key has no contract
**Sections:** §14 (“paid/destructive require … Idempotency-Key”), §6.9 `idempotency_keys` table, §7.6 mutations.
**Defect:** no required header schema, no TTL, no body-hash binding, no replay response, no conflict code. A retried evaluation or promotion can double-spend or double-apply; the `idempotency_keys` table is named but undefined.
**Why it bites:** exactly-once is impossible; budget ledger may reserve twice; UI retries produce 409/500 or duplicate work.
**RED:** planned duplicate-POST test has no defined expected response; table has no columns.
**Patch:** add to §14/§10:
```ts
const IdempotencyKey = z.string().min(16).max(128);
// required on POST /api/learning/evaluations, /promotions, /rollback, /api/runs when live/paid/destructive
// store: key_hash, method, path, body_sha256, status, response_json, expires_at (24h)
// replay: return original envelope with meta.replayed=true
// body mismatch: 409 E_IDEMPOTENCY_KEY_REUSED
// missing: 422 E_IDEMPOTENCY_KEY_REQUIRED
```
**GREEN:** same key → same evalId + replayed; different body → 409; missing → 422; concurrent same key one insert. **Lens:** logic-debugger.

### A6 — P1 — Envelope and OpenAPI parity are not pinned
**Sections:** §8 patch to v1 §11 (“existing routes keep v1 error envelope”), §14 (`hive.api.v1`).
**Defect:** new routes use `hive.api.v1`; old routes keep v1. No route-scope table, no shared `ApiEnvelope<T>` union, no client parser rule, and no response schemas for `@fastify/swagger`. OpenAPI is claimed but will be empty or lie.
**Why it bites:** one client cannot parse both families reliably; docs drift; contract tests cannot pin.
**RED:** OpenAPI inventory test: routes lack response schemas; client `parse` has no union. §8 vs §14 contradiction.
**Patch:** add:
```ts
type ApiEnvelope<T> =
 | { schema:'hive.api.v1'; ok:true; data:T; warnings:Warning[]; meta:ApiMeta }
 | { schema:'hive.api.v1'; ok:false; error:ApiError; meta:ApiMeta };
// Scope: /api/meta, /api/ops, /api/scripts, /api/learning, P6a run subroutes.
// Legacy core routes retain v1 shape; client parseApiResponse() branches on 'schema'.
// Every route gets Fastify JSON Schema request/response; OpenAPI test asserts no schema-less 2xx.
```
**GREEN:** `openapi.test.ts` route inventory + schema refs; `client-envelope.test.ts` parses both; E2E core + learning. **Lens:** research + integration-logic.

### A7 — P1 — File/download/open-folder control matrix missing
**Sections:** v1 §11/§12 via §8; §4 W12 (`E_ZIP_PATH`, `E_UNSAFE_PATH`); §14.
**Defect:** no precondition/refusal for content, download, or open-folder. Download while running/empty is undefined; Explorer on non-Windows is undefined; content-type/disposition/path schema are unspecified. UI buttons can be dead or unsafe.
**Why it bites:** partial zip presented as complete; generated HTML served as HTML (XSS); path traversal; false “opened” success.
**RED:** contract test: empty run `GET /download` has no expected 409; open-folder has no platform refusal; content route has no schema.
**Patch:** add to v1 §11/§12:
```ts
GET /api/runs/:id/files/content?path= -> path z.string().min(1).max(512);
  normalize, reject absolute/.. /ADS; text/plain; charset=utf-8; nosniff;
  422 E_UNSAFE_PATH; 404 E_FILE_NOT_FOUND
GET /api/runs/:id/download -> 409 E_RUN_NOT_TERMINAL while running;
  422 E_ZIP_EMPTY if artifacts=0; 200 application/zip; safe `hive-<runId>.zip`
POST /api/runs/:id/open-folder -> 501 E_OPEN_FOLDER_UNSUPPORTED if platform!=='win32';
  422 E_UNSAFE_PATH; 200 {opened:true}; no shell
```
UI ControlState: download disabled if `artifacts===0 || status==='running'`; open-folder hidden/disabled with reason off-Windows; file viewer read-only.
**GREEN:** API denial tests; content-type assertion; E2E disabled tooltips. **Lens:** integration-logic + auditor.

### A8 — P1 — Learning-off and dataset UI/API drift
**Sections:** §7.6, §7.1, §14.
**Defect:** P7 is “off by default,” but no disabled response shape. `E_LEARNING_DISABLED` exists but is not mapped. API says `/datasets`; DB tables are `eval_suites`/`eval_cases`; no `/datasets/:id/cases` route. Learning tabs can dead-end.
**Why it bites:** page errors or fake empty data; candidates cannot inspect cases/provenance; “no dead controls” fails.
**RED:** E2E disabled state absent; route inventory lacks cases endpoint; naming contradiction.
**Patch:**
```ts
GET /api/learning/overview -> 200 {enabled:false, reason:'E_LEARNING_DISABLED', consentRequired:true}
mutations -> 403 E_LEARNING_DISABLED {hint:'Enable learning in Settings'}
GET /api/learning/datasets/:id/cases -> 200 paginated {cases:[{id,hash,split,provenance,redactedPreview}]}
// persistence name eval_suites maps to DTO `dataset`; no dual names in API
```
UI: setup card with consent/enable; disabled tabs; no enabled Evaluate/Promote when off.
**GREEN:** E2E off/on; 403/200; cases endpoint; no enabled action. **Lens:** capability-auditor + weaver.

### A9 — P1 — Refusal→HTTP→exit mapping absent
**Sections:** §14.
**Defect:** exit code classes and named refusals are listed independently. No mapping; CLI scripts can choose wrong code (`E_ACTIVE_RUN_EXISTS` 4 vs 6; `E_PROMPT_TOO_LARGE` 2 vs 6; `E_BUDGET_EXCEEDED` 8 vs 6). Automation cannot branch.
**Why it bites:** scripts lie; tests can’t assert; UI cannot map refusals consistently.
**RED:** exit-code table test cannot be written from a code list without mapping.
**Patch:** add `src/shared/refusals.ts` registry:
```ts
const REFUSALS = {
  E_ACTIVE_RUN_EXISTS:{http:409,exit:4,retryable:false},
  E_INVALID_PARENT:{http:409,exit:4,retryable:false},
  E_PROMPT_TOO_LARGE:{http:422,exit:2,retryable:false},
  E_UNSAFE_PATH:{http:422,exit:2,retryable:false},
  E_ZIP_PATH:{http:422,exit:2,retryable:false},
  E_DSH_CONSENT_REQUIRED:{http:403,exit:5,retryable:false},
  E_BUDGET_EXCEEDED:{http:409,exit:8,retryable:false},
  E_LEARNING_SUITE_ALREADY_USED:{http:409,exit:4,retryable:false},
  E_LEARNING_APPROVAL_REQUIRED:{http:403,exit:5,retryable:false},
  E_LEARNING_APPROVAL_EXPIRED:{http:403,exit:5,retryable:false},
  E_LEARNING_PROMOTION_REFUSED:{http:422,exit:6,retryable:false},
  FORBIDDEN_PROVIDER_KEY_ACCESS:{http:403,exit:5,retryable:false},
} // full table required; unknown -> 500/9
```
**GREEN:** table test per code; CLI exit tests; API status tests. **Lens:** logic-debugger + integration-logic.

### A10 — P2 — Read endpoints lack projection/traversal rules
**Sections:** §6.9 `/api/ops/reports/:kind`, `/api/runs/:id/context`; §7.6 `/traces`; §13; §14.
**Defect:** `:kind` is a free path parameter; context/trace projections are unspecified; raw generated content or secrets may leak; path traversal possible.
**Why it bites:** arbitrary report read; secret exposure; DoD violation.
**RED:** `GET /api/ops/reports/..%2f..` has no defined refusal; trace response schema absent.
**Patch:**
```ts
kind: z.enum(['bench','context','integrity','repo-map'])
// resolve basename under data/reports; reject '.', '..', separators, extensions;
// 404 E_REPORT_NOT_FOUND; 422 E_UNSAFE_PATH
// run context: item metadata {path,kind,chars,hash,reason}; no raw content
// learning traces: redacted preview <=2KB; full outputs stay artifacts; redactionStatus required
```
**GREEN:** traversal requests 422; context/trace schemas contain no `content`; secret fixture scan. **Lens:** auditor + capability-auditor.

## 5. Cross-section contradictions (requested from Lead)

1. **WAVE-SHEET vs PLAN-v2 numbering:** seat 2 scope §5/§11/§12/§14/§16 does not match v2’s §11 DoD, §12 assumptions, §16 diagrams. The audited API/UI content is §8 patch + §6.9/§7.6/§14/§10. Renumber or state the mapping; otherwise seats 1/3/7 audit the wrong sections.
2. **§3 “zero P6/P7 artifacts” vs §8/§6.9/§7.6 unconditional additions:** needs A3 feature gating; this is also a delivery seat dependency.
3. **§14 “existing routes keep v1 error envelope” vs new `hive.api.v1`:** needs a route-scope table and client parser (A6); security/learning seats must use the same mapping.
4. **§7.6 `/datasets` vs §7.1/DB `eval_suites`:** choose one DTO/persistence naming (A8).
5. **§6.9 “read-only/dry-run” vs §6.8 write-capable scripts:** A4 resolution required before Scripts UI is built.

## 6. What I checked and found clean

- Named refusal vocabulary covers budget, DSH consent, learning suites/approval, zip/path, provider key, shell, and auto-promotion; the list is broad and internally consistent as a vocabulary.
- CLI/API envelope includes `schema`, `ok`, `data`/`error`, `warnings`, `meta` with `requestId`, `durationMs`, `dryRun`, `idempotencyKey`, `replayed`, `provenance`; exit-code classes 0/2–10 are defined.
- W06 states bounded summaries ≤8 KB, 500-event replay, 90-day retention; W12 names unsafe zip/open-folder refusals; W05 states single-use signed approval token requirements.
- P6a/P7 route names are grouped and read-only/dry-run intent is stated; UI tabs, Evidence badges, typed confirmation, refusal/empty/insufficient states, and “no dead controls” are named in DoD.
- Test matrix calls for SSE 10k replay, script negative+success, E2E no dead controls, old-DB migration, and approval/rollback — the missing pieces are the binding contracts above, not intent.

## 7. Skills applied (lens → finding)

- **smartfix:** evidence-first defect format; dead-control scan → A1, A7, A8.
- **logic-debugger:** state/precondition/retry matrix → A5 idempotency, A9 exit mapping, A2 reconnect.
- **integration-logic:** UI→client→route→service→DB/SSE→render trace → A1, A6, A7, A10.
- **logic-gatekeeper:** Phase 1 JSON before document mutation; mutation gated to the two assigned files.
- **research:** read PLAN-v2 and WAVE-SHEET; no external API claims; OpenAPI surface audit → A6.
- **capability-auditor:** claimed vs callable script/dry-run/learning controls → A4, A8.
- **auditor:** contradiction evidence, no product edits, claim-strength split → §1/§5.
- **forge:** boundary-level patches (issuance, snapshot, flags, idempotency) → A1–A5.
- **forgewright-lead:** no fake green; exact gates; report structure → whole report.

## 8. Files read / sources

- `C:\Users\Riley\Desktop\HiveRouter\docs\PLAN-AUDIT\WAVE-SHEET.md` (41 lines, SHA256 `C572…16FA`)
- `C:\Users\Riley\Desktop\HiveRouter\docs\PLAN-v2.md` (454 lines, SHA256 `8AD8…18F2`)
- Lead context: v1 §11/§12 (API/UI tables) as amended by PLAN-v2 §8; no external URLs used.

**Status:** DONE. No product/canonical-plan edits; only the two assigned audit files written.
