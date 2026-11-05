# W6-AUD-04 — Capability audit (HiveRouter Wave 6, task-4)

- **Seat:** independent read-only Capability Auditor. Skill: `capability-auditor` (loaded before acting).
- **Repo:** `C:\Users\Riley\Desktop\HiveRouter` — phase **B2**, routing+learning features on, no active run, 25 runs.
- **Server probed:** `http://127.0.0.1:8787` (`GET /api/health` → `status:ok, phase:B2, db:ok, key.configured:true, source:environment, fingerprint:c30cfdbc`).
- **Write scope:** only `docs/AUDIT-WAVE-6/capability/**`. No `src/`, `web/src/`, `test/`, `e2e/`, config, package.json, skills, production DB, `workspace/runs`, or logs were modified. No git. No subagents. No paid calls. No server restart. No `data/hive.db` write: every DB access is `new DatabaseSync('data/hive.db', { readOnly: true })`.
- **Timestamp:** 2026-11-03 22:25–22:50 America/Chicago (2026-11-04T04:25–04:50Z).
- **Evidence rule:** every verdict below cites `file:line`, or a command plus its observed output, or a captured payload under `docs/AUDIT-WAVE-6/capability/`. Anything not reproduced is labelled **UNVERIFIED** and excluded from the approved batch.

## 1. Baseline integrity — the premise of this audit

`node docs/AUDIT-WAVE-6/capability/probe-baseline.mjs` (evidence `evidence-baseline.txt`):

```
baseline entries: 150
match: 150
mismatched: 0
missing: 0
```

All 150 files in `docs/AUDIT-WAVE-6/baseline.sha256` still hash to the recorded values, including every file the upstream seats audited. **No product file changed between the baseline capture and this audit**, so the source lines cited below are the lines the seats saw.

## 2. Verdict summary

| Verdict | Count | Items |
|---|---|---|
| SUPPORTED | **38** | weaver F1–F13 (13); logic L-00…L-08 + L-12…L-15 (13); forge RC-1…RC-5 + U-2 (6); auditor CA-01…CA-06 (6) |
| SUPPORTED observation (not a defect) | 4 | O1, O3, O4, O5 |
| REFUTED | 3 | R-1, R-2, R-3 |
| UNVERIFIED | 5 | O2, U-1 (loop), L-09, L-10, L-11 |
| Approved fixes | **11** | AF-01…AF-11 (see §9 and `FORGEWRIGHT-DIRECTIVE.md`) |
| Deferred / rejected | 24 | §10 |

Severity used here (aligned with the upstream seats): **P1** a user-visible value/event/terminal record is wrong; **P2** a rendered claim or state path cannot be backed by its data; **P3** contract/observability drift with no current user-visible break.

## 3. Weaver findings (`docs/AUDIT-WAVE-6/weaver/findings.md`)

| ID | Claim | Verdict | P | Independent evidence |
|---|---|---|---|---|
| **F1** | Live SSE drops 5 server-emitted types (`run.queued`, `agent.failed`, `phase.skipped`, `context.skipped`, `repair.stalled`) | **SUPPORTED** | P1 | `web/src/hooks/useApi.ts:72-100` list lacks all five; `:143` registers only listed names; `:144` `onmessage` is dead because every frame is named (`src/server/app.ts:854`). My static parity probe (`evidence-events.txt`): emitted 16, subscribed 27, overlap 11, `emittedNotSubscribed` = exactly those 5. DB: 25 `run.queued`, 5 `agent.failed`, 1 `repair.stalled` rows (`evidence-db-probe.txt`). |
| **F2** | Failed/cancelled/budget runs keep `cost_usd`/tokens NULL although usage was measured | **SUPPORTED** | P1 | `evidence-db-probe.txt`: `measuredWithNullRunCost: 7`, `unreportedMeasuredCostUsd: 0.606852192`; `sumRunCost 0.317771976` vs `sumUsageCost 0.924624168`; all 161 usage rows `source='provider'`, 0 unknown. Only `finalize()` writes usage (`src/server/pipeline/run.ts:1075-1084`); failure branches write status/error only (`run.ts:853-861`, `:868-888`), `markTerminal` has no usage fields (`src/server/runs/manager.ts:250-258`). Live `GET /api/runs/run_abf5…/snapshot` → `run.costUsd: null` while `/api/stats` → `totalCostUsd 0.924624168`. |
| **F3** | Run cost cap persisted twice, served nowhere; UI can never show it | **SUPPORTED (provenance corrected — CA-04)** | P2 | `GET /snapshot` keys are exactly `run,lastEventId,steps,checks,artifacts,truncated` (live probe) — no `limits`. UI reads `snapshot.limits.maxCostUsd` (`web/src/pages/RunDetailPage.tsx:199-201`); `CostMeter` appends the cap only when numeric (`web/src/components/ui.tsx:607`). `/api/settings` returns `limits` as an object and `SettingsView` filters objects out (`web/src/pages/SettingsPage.tsx:135-138`). **Correction:** `run_snapshots.snapshot_json.limits.maxRunCostUsd` is the **global** 0.5 cap for both `run_23af…` and `run_abf5…`, while the per-run cap is `settings.run_limit:run_23af… = 0.05` (`evidence-limits.txt`). Showing the snapshot value would display the wrong cap. |
| **F4** | Context tab renders 4 never-produced columns and claims excluded items it never fetches | **SUPPORTED (scope corrected)** | P2 | `context_packs` has an `excluded_json` column (`evidence-db-probe.txt`); the route reads only `included_json` and maps only `{id,path,kind,tokens,mandatory}` (`src/server/app.ts:449-469`). Global census: 84 packs / 343 items / **0 with tokens** / **0 non-empty excluded**. UI advertises 7 columns and the claim at `web/src/pages/RunDetailPage.tsx:768,827`. (Weaver's "129 items / 29 packs" is the abf5 slice; both are true at different scopes.) |
| **F5** | Every routing decision shows hardcoded `reason: 'static prior route'` | **SUPPORTED, severity downgraded to P3** | P3 | Literal at `src/server/app.ts:423`, rendered at `web/src/pages/RunDetailPage.tsx:731`. But `ccr.ts` always persists `qualitySource:'prior', sampleSize:0` (`src/server/routing/ccr.ts:263-264,566-567`), so the constant is *currently true*. It is a latent lie, not a present one → P3. |
| **F6** | Two `truncated` flags are wrong/mislabeled | **SUPPORTED** | P2 | Live `GET /events?after=0` → `count=108 truncated=True`; my census replicates the route math: **24 of 25 runs** report truncation while returning every row (`evidence-db-probe.txt`). Root cause `src/server/app.ts:825-830`. Snapshot `truncated` = artifact-list cap (`app.ts:806-814`), labelled "Replay truncated" (`RunDetailPage.tsx:330`). |
| **F7** | One Escape closes both dialog layers | **SUPPORTED (static)** | P3 | Every mounted `Modal` registers a document-level `keydown` handler that calls `onClose()` on Escape (`web/src/components/ui.tsx:404-408`); the nested `ConfirmDialog` is rendered inside the outer `Modal` (`web/src/pages/AgentsPage.tsx:495-505`), so both handlers fire. Upstream browser capture (`weaver` `agents-drawer.json`: dialogs 2→0) matches. |
| **F8** | Skip link scrolls but does not move focus | **SUPPORTED (static + upstream browser probe)** | P3 | `<main id="main-content">` has no `tabIndex` (`web/src/components/AppShell.tsx:140`); a fragment navigation to a non-focusable element moves `activeElement` to `BODY`. Independent browser probe not repeated by this seat (no browser launch in scope). |
| **F9** | Tab widgets lack `aria-controls`/`aria-labelledby` | **SUPPORTED (static)** | P3 | `role="tab"`, `aria-selected`, roving `tabIndex`, Arrow handling all present (`web/src/components/ui.tsx:333-374`); no `aria-controls` and no panel id/labelledby anywhere in the component. |
| **F10** | Every page logs a 404 for `/favicon.ico` | **SUPPORTED** | P3 | `curl.exe -s -o NUL -w "%{http_code} %{content_type}" http://127.0.0.1:8787/favicon.ico` → `404 text/plain; charset=utf-8`. |
| **F11** | Unknown API routes return `E_RUN_NOT_FOUND` | **SUPPORTED but PINNED — do not "fix" blindly (CA-03)** | P3 | `src/server/app.ts:969-970`; live `GET /api/nope` (weaver capture). **However** `e2e/api-contract.spec.ts:62-64` asserts exactly this code. Changing it is a contract change, not a wiring repair. |
| **F12** | Checks "Time" can never populate; `check.code` fallback can never fire | **SUPPORTED** | P3 | `checks` table columns are `id,run_id,check_id,status,detail,mandatory,file,line,created_at` (`evidence-db-probe.txt`); `insertCheck` persists exactly those (`src/server/runs/recorder.ts:284-291`); `getChecks` returns no `code`/`durationMs` and maps `id = check_id` (`recorder.ts:293-303`). UI `web/src/pages/RunDetailPage.tsx:656,658`. |
| **F13** | `E_PROMPT_TOO_LARGE` used for short/empty/too-many inputs | **SUPPORTED** | P3 | `src/shared/refusals.ts:16`; reused at `src/server/app.ts:229,232,288,289,313,890`, `src/server/pipeline/run.ts:479`, `src/server/runs/manager.ts:81-82`. |

**Weaver observations**

| ID | Verdict | Note |
|---|---|---|
| O1 learning inspect hidden in refusal state | **SUPPORTED** | `/api/learning/overview` returns `enabled:false, reason:E_LEARNING_POOL_EXHAUSTED`; the refusal is truthful and P7-honest. No fix. |
| O2 stale `vault/qa-api-temp/` root | **UNVERIFIED by this seat** | Not re-walked (data hygiene, not a code path). Deferred. |
| O3 runs filter client-side over 100 rows; omits `interrupted` | **SUPPORTED (static)** | `web/src/pages/RunsPage.tsx:16,19` (`FILTERS` has no `interrupted`; `listRuns(100)`); legal status set at `src/shared/types.ts:1-12`. |
| O4 "Accepted tree" label on a failed run | **SUPPORTED (static)** | `web/src/pages/RunDetailPage.tsx:385-386`. |
| O5 dead review write path | **SUPPORTED (static)** | `insertReview`/`getUserFeedback` have no callers outside their definitions (`src/server/runs/recorder.ts:326,380`; grep). |

## 4. Logic findings (`docs/AUDIT-WAVE-6/logic/findings.md`)

I re-ran the peer probe on a throwaway DB (`node_modules\.bin\tsx.cmd docs\AUDIT-WAVE-6\logic\probe-routes.ts`), output `evidence-peer-probe-rerun.txt`: **6/15 RED, byte-identical invariants** to the seat's report.

| ID | Verdict | P | Independent evidence |
|---|---|---|---|
| **L-00** abf5 stale capture | **SUPPORTED (not a defect)** | — | DB (`evidence-steps.txt`): step 7 `03:09:33.029Z→03:09:52.440Z`, step 8 starts `03:09:52.479Z`, run ends `03:15:46.742Z`, 20 steps, `status=failed`. A "Running / 7 steps" screen is truthful only in that ~19.5 s window. Live `/snapshot` now: `status=failed`, 20 steps, terminal. |
| **L-01** provider error code → `E_INTERNAL` | **SUPPORTED** | P1 | My re-run: `RED | error propagation … actual: run.errorCode=E_INTERNAL, event.code=E_INTERNAL`. `LlmError.code` exists (`src/server/llm/client.ts:63-80`) but mappers read `message.startsWith('E_')`: `run.ts:233-234`, `run.ts:871-875`, `manager.ts:146-148`. Registry census: 104 `E_*` literals in `src/`, 85 `REFUSALS` keys, **31 unregistered** (incl. all 22 `E_LLM_*`, `GATE_FAILED`, `E_RUN_TIMEOUT`, `E_CANCELLED`). |
| **L-02** failed runs lose spend | **SUPPORTED** | P1 | Same as F2/RC-1. |
| **L-03** state machine dead code | **SUPPORTED** | P3 (narrowed) | `transitionRun`/`assertStatusTransition` have zero non-test call sites (recursive grep over `src/`); my re-run: `RED | state guard … actual: status persisted as running`. Not wired: see U-2. |
| **L-04** SSE type drift | **SUPPORTED** | P1 | Same as F1/RC-3. |
| **L-05** `/events` false truncation | **SUPPORTED** | P2 | Same as F6/RC-4; 24/25 census. |
| **L-06** `interrupted` is silent | **SUPPORTED** | P2 | My re-run: `RED | startup interrupt … actual: status=interrupted, error_code=null, error_message=null, events=0`. `manager.ts:192-204` has no error/emit/log. DB has **0** interrupted rows → no production specimen. |
| **L-07** gate failure: no log, unregistered code, message-less event | **SUPPORTED** | P3 | DB `run.failed` gate payload = `{"code":"GATE_FAILED","checks":[…]}` with no `message` (`evidence-steps.txt`); `errors.jsonl` has no gate record (weaver/forge log capture); `GATE_FAILED` not in `REFUSALS` (my census). |
| **L-08** `trace_complete=1` without a trace row | **SUPPORTED (invariant); historical cause UNVERIFIED** | P3 | `evidence-db-probe.txt`: 18 runs `trace_complete=1`, **7 of them have no `traces` row**; `recordRunTrace` swallows (`run.ts:108-140`) and the flag is written unconditionally (`run.ts:1083,1085`). Cause of the historical gap is not established — do not backfill. |
| **L-09** learning variant machine unguarded | **UNVERIFIED by this seat** | P3 | Not re-read (P7 out of capability scope). No impact on the approved batch. |
| **L-10** 410 reconnect loop | **UNVERIFIED** | P3 | Route half reproduced: my re-run `green | stream: stale Last-Event-ID … HTTP 410, code=E_REPLAY_WINDOW_EXCEEDED`. No run in this DB exceeds 500 events (max 108), so the loop was never observed. |
| **L-11** cancel ack race | **UNVERIFIED** | P3 | Source-only; not reproduced. |
| **L-12** failure payload/type drift | **SUPPORTED** | P3 | DB shapes (`evidence-steps.txt`): gate `{code,checks}`, catch `{code,message}` with `message === code` for `E_BUDGET_*`; executor shape unobserved. No `run.budget_exceeded` type. |
| **L-13** live vs persisted shape/timestamp/cap | **SUPPORTED (static)** | P3 | `useApi.ts:126-139` stores the whole envelope and browser time; `src/shared/run-events.ts:19-25` stores `row.payload` and server `createdAt`; `RunDetailPage.tsx:133` prefers live. |
| **L-14** `ChecksTab` duplicate React key | **SUPPORTED** | P3 | `evidence-db-probe.txt` `checkDupes`: abf5 `stub.scan`×4, `plan.coverage`×3, `secret.scan`×3, `syntax.all`×3, `verification.plan`×3; `getChecks` returns `id = check_id` and drops the row id (`recorder.ts:293-303`); UI key at `RunDetailPage.tsx:650`. |
| **L-15** "Replay truncated" badge means artifacts | **SUPPORTED** | P3 | `app.ts:806-814` + `RunDetailPage.tsx:330`. |

## 5. Forge root causes (`docs/AUDIT-WAVE-6/forge/root-causes.md`)

| ID | Verdict | P | Note |
|---|---|---|---|
| **RC-1** failure terminals drop spend | **SUPPORTED** | P1 | Independent numbers match: 7 runs, $0.606852192 unreported. Forge's three-way contradiction (stats vs `sum(runs.cost_usd)` vs `traces`) reproduced (`evidence-db-probe.txt`). |
| **RC-2** Events tab never switches to the ledger | **SUPPORTED (static truth table)** | P1 | `RunDetailPage.tsx:116-119,129-133,136,1009-1013`; live cap `slice(-99)` = 100 rows; abf5 has 108 persisted rows. The prior fix receipt's "merges local/live vs persisted" claim is not in the code. Fresh terminal load is correct — the existing e2e only covers that path (`e2e/trace-fixes.spec.ts:4-23`). |
| **RC-3** emitted ≠ subscribed + payload shape | **SUPPORTED** | P1 | Same as F1; plus `useApi.ts:126-139` vs `src/shared/run-events.ts:19-25`. |
| **RC-4** `/events` truncation in global seq space | **SUPPORTED** | P2 | 24/25 census; live 108/108 `truncated=true`. |
| **RC-5** UI reads fields no route provides | **SUPPORTED** | P3 | `snapshot.limits` + `checks.code/durationMs`; split across AF-05 and AF-10. |
| **R-1** abf5 stale capture | **REFUTED (as a convergence defect)** | — | §6. |
| **R-2** "cancelled" part of the brief is false | **REFUTED** | — | §6. |
| **R-3** Wave-5 stub-scan false positive no longer reproduces | **REFUTED (as a current defect)** | — | §6. |
| **U-1** 410 loop | **UNVERIFIED** | P3 | §6. |
| **U-2** state guard dead | **SUPPORTED (dead guard); fix DEFERRED as unsafe** | P3 | §6. |

### Missing forge deliverables (required by the task prompt)

`docs/AUDIT-WAVE-6/forge/` contains only `root-causes.md`, `red-evidence.md`, `evidence/`, `probes/`. **`patch-proposals.json` and a handoff file are absent.** `root-causes.md` references `patch-proposals.json` P-1…P-5 (`:82`, `:116`, `:153`, `:184`, `:192`) and a "prior fix receipt" at `docs/TRACE/20261103T2200Z/03-forgewright-fixes.md:82`. I therefore treated `root-causes.md` + `evidence/*` as the forge record and reconstructed the P-1…P-5 intent from the prose. The risk of that gap is real: P-4's prose ("ask for window + 1 rows … return the newest window rows") is internally inconsistent for a run with more than `window` events (an ASC `LIMIT window+1` yields the *oldest* window after the cursor, not the newest) — see **CA-05**.

## 6. R-1 / R-2 / R-3 / U-1 / U-2 — explicit adjudication

**R-1 — `run_abf5` "Running / 7 steps / Live" → REFUTED as a convergence defect.**
`/snapshot` now returns `status=failed`, `phase=done`, 20 steps, `truncated=false`, and `GET /events` returns 108 rows (seq 552–659). DB step rows (`evidence-steps.txt`) put step 7's finish at `03:09:52.440Z` and step 8's start at `03:09:52.479Z`; the run finished at `03:15:46.742Z`. A 7-step screen is truthful only inside that ~19.5 s window — i.e. a mid-run capture. No code path pins `running` after a terminal transition: the poll is gated on `!terminal` (`RunDetailPage.tsx:141-145`), the stream on `run && !terminal` (`:135`), and `run.failed` is subscribed. **Residual:** the stale-capture claim itself cannot be attributed to an artifact (no capture in the repo at that timestamp), but the value is only consistent with mid-run.

**R-2 — "cancelled" is not subscribed → REFUTED.**
`'run.cancelled'` is the 4th entry of `STREAM_EVENT_TYPES` (`web/src/hooks/useApi.ts:76`) and is emitted at `src/server/pipeline/run.ts:885` (ternary) and `src/server/runs/manager.ts:186`. Both sides exist. No `run.cancelled` rows exist in this DB (0), so the pair is unexercised — that is an evidence gap, not a contract gap.

**R-3 — Wave-5 stub-scan false positive → REFUTED as a current defect.**
I re-ran the **current** scanner over the stored abf5 staging tree (`node_modules\.bin\tsx.cmd docs/AUDIT-WAVE-6\capability\probe-stubscan.mjs`, `evidence-stubscan.txt`):

```
README.md -> 0
src/main.py -> 0
src/probes/identity.py -> 0
src/probes/learning_loop.py -> 0
src/probes/memory.py -> 0
src/probes/tool_access.py -> 0
...
TOTAL_FINDINGS=0
FILES=15
tool_access.py:121 = "    \"not implemented\","
```

The historical gate failure (`run.failed` seq 659: `stub.scan` fail at `src/probes/tool_access.py:121`) is real and is preserved honestly in the ledger, but the current rule does not flag a bare quoted `"not implemented",` tuple element. The historical failure is **not reproducible** with current code; do not "fix" the scanner to re-flag it.

**U-1 — SSE 410 reconnect loop → UNVERIFIED; deferred.**
Route half reproduced: `HTTP 410, code=E_REPLAY_WINDOW_EXCEEDED` (`app.ts:843-845`). Client half is readable from code: `EventSource.onerror` only sets `status='reconnecting'` (`useApi.ts:148-150`), and a browser `EventSource` reconnects with the same `Last-Event-ID`. But **no run in this DB exceeds 500 events** (max 108), so the permanent loop was not observed, and status convergence still comes from the 5 s poll. Not in the approved batch.

**U-2 — run state guard is dead code → SUPPORTED; wiring the guard is DEFERRED as unsafe.**
Reproduced: production `updateRun` persisted `completed → running`; the pure `transitionRun` rejects the same edge (`evidence-peer-probe-rerun.txt`). `E_ILLEGAL_RUN_TRANSITION` is registered (`src/shared/refusals.ts:90`) but unreachable. **Why not fix now:** the declared phase matrix (`src/server/logic/run-state.ts:56-68`) contradicts four reachable productions — `intake → cleaning` (`run.ts:292`), `intake → generating` (`run.ts:366`), `any → done` in the catch (`run.ts:884`) and in `markStartupInterrupted` (`manager.ts:198`) — so wiring `PHASE_TRANSITIONS` would reject every revise/audit/adhoc/failed run. A status-only guard in `updateRun` is narrower, but `updateRun` is also called from the executor rejection handler (`manager.ts:150-156`), where a thrown guard becomes an unhandled rejection; and no production row contains an illegal transition (DB scan). Deferred with a design sketch (§9, D-15). This is a deliberate **unsafe → defer** call, not an oversight.

## 7. The 37-agent capability chain

**Derivation.** `AGENT_IDS` has 37 entries (`src/shared/types.ts:42-80`); `REGISTRY` enforces exactly those 37 at module load (`src/server/agents/registry.ts:446-466`); `AgentDefinition` has **no tool/allowlist field** (`types.ts:93-114`). The capability surface is therefore: `outputKind`, `canWrite/canReview/canTest`, `languages`, `pathGlobs`, `verificationSupport`, `maxOutputTokens`, `staticPrior`, `fallbackFor`, `schemaId` — and the enforced chain is *registry → routing eligibility → pipeline call site → zod schema*.

Matrix generated from the registry itself by `probe-agent-matrix.mjs` (full table in `evidence-agent-matrix.txt`, reproduced in the directive appendix):

```
total: 37 | routable: 28 | plan 4 · text 1 · files 28 · review 3 · tests 1
verificationSupport: syntax 20 · static-only 5 · unverified 12
```

| Link | Enforced? | Evidence |
|---|---|---|
| Registry completeness / prompt hygiene | yes | 37 exact ids, unique, `assertPromptClean` at boot (`registry.ts:56-58,446-466`); `test/unit/agents.registry.test.ts:19-24` |
| Routing eligibility (`files` + `canWrite` + language + pathGlob) | yes | `src/server/routing/ccr.ts:94-110,461-477`; only these 28 can be chosen |
| `engineHint` fallback via `fallbackFor` | yes | `ccr.ts:464-477`; `fallbackFor` consumed (only `python-engine`/`js-engine` declare it, `registry.ts:156,171`) |
| `staticPrior` used as routing quality | yes | `ccr.ts:249,263-264` |
| `maxOutputTokens` cap | yes | `src/server/pipeline/agent-runner.ts:61,134` |
| File output schema | yes | `FileEmissionSchema` at `run.ts:691`; path/complete/content guards at `:699-702` |
| Review output schema | yes | `ReviewSchema` at `run.ts:297,307,410,727,738,828` |
| Tests output schema | yes | `TestsSchema` at `run.ts:319,373,414,753` |
| **Plan output schema for `router`/`epic`/`cartographer`** | **NO — CA-01** | `AgentPlanSchema` (the advertised union, `registry.ts:753-788`) has **zero production callers** (recursive grep: only `prompts.ts:48` mentions it and `registry.ts:753` defines it). The only plan consumer validates `ProjectPlanSchema` (`run.ts:406`), whose required keys (`projectName/coreParadigm/storageTarget/files`) a `kind:'router'` payload does not have. The runtime contract explicitly instructs those three agents to return the kind shape (`prompts.ts:48`). |
| **`candidate-draft` for `metacognitive`** | **NO — CA-01** | `schemaId:'candidate-draft'` (`registry.ts:53,75`), but the adhoc `text` path calls `callAgentText` with no schema (`run.ts:392-401`), and the registry's own `CandidateDraftSchema` (`registry.ts:819-826`) is unused (learning uses its own copy, `src/server/learning/contracts.ts:58`). The Agents page promises "Output is schema-validated before it is stored" (`web/src/pages/AgentsPage.tsx:477`) — false for this agent. |

**Invocation paths (derived, not a hand-written table):**

- **28 routable file engines** → routed generation (`run.ts:690-698`) + adhoc (`/api/agents/:id/run` → `executeAdhocRun`).
- **4 hard-coded phase agents**: `architect` (planning, `run.ts:470-471`), `cleaner` (cleaning `run.ts:726-727`, revise/audit `:296-297`), `sentinel` (hardening `:737-738`, revise/audit `:306-307`), `watchman` (repair `:827-828`), `gatekeeper` (testing `:752-753`, audit tests `:318-319`) + adhoc.
- **4 adhoc-only**: `router`, `epic`, `cartographer` (plan) and `metacognitive` (text). None is routable (`outputKind`/`canWrite`).
- All 37 are accepted by `POST /api/agents/:id/run` (`app.ts:306-357`) — the drawer's `Run agent` control, with `mock` disabled in the UI (`AgentsPage.tsx:448`) and refused by name server-side (`app.ts:314`).

**Callable-but-unshown (server capability with no UI path):** `/api/scripts`, `/api/scripts/:id/dry-run`, `/api/stats/router`, `/api/ops/system`, `/api/ops/reports/:kind`, `/api/runs/:id/checks`, `/api/runs/:id/files`, `/api/runs/active`. None is claimed in the UI; they are API-only (the scripts routes are honest: dry-run returns a local command string and refuses the two paid scripts, `app.ts:531-536`). Informational, no fix.

**Claimed-but-uncallable:** the three `agent-plan` kind contracts (CA-01) and the unvalidated `candidate-draft` claim (CA-01). No other registry claim is unbacked: languages/pathGlobs/canWrite/fallbackFor/staticPrior/maxOutputTokens are all consumed.

**Agent-use telemetry (what the fleet actually did)** — `evidence-agent-use.txt`:

```
steps by agent: python-engine 87, architect 20, sentinel 17, cleaner 17, gatekeeper 14,
                react-engine 5, package-engine 3, markdown-engine 3, watchman 2,
                tailwind-engine 1, schema-engine 1, html-engine 1
route_decisions (chosen): python-engine 82, react-engine 5, markdown-engine 5,
                package-engine 3, schema-engine 2, tailwind-engine 1, html-engine 1
agent_evidence distinct agents: 9 | artifacts by agent: 4 distinct
```

So 12 of 37 agents have ever stepped, 7 of 28 routable agents have ever been chosen, and 9 have evidence badges. The fleet's breadth is **declared and wired but unexercised** (CA-06) — not a defect, and not something to fake with seed data.

## 8. Route / client / OpenAPI / stage census

`node docs/AUDIT-WAVE-6/capability/probe-census.mjs` (`evidence-census.txt`) + `probe-stage-census.mjs` (`evidence-stage-census.txt`) + live `/openapi.json`:

| Census | Value | Verdict |
|---|---|---|
| `app.ts` route registrations | **45** (42 distinct paths; `agents/:id/prompt`, `settings/key`, `runs` have 2 methods) | derived |
| OpenAPI paths / operations | **42 / 45** | matches code exactly |
| p7 manifest `routes` | **48** = 42 server path strings + 6 UI path strings (`/agents,/learning,/runs,/runs/:runId,/settings,/vault`) | no drift: `inCodeNotManifest=[]`, `inManifestNotCode=[]` |
| Manifest `uiRoutes` | 7, including `/` | but `routes` omits `/` |
| `assert-stage --stage=p7 --json` | `ok:true, files:150, tables:45, routes:48, scripts:24, violations:[]` | reproduced |
| DB tables vs p7 | 45 vs 45, zero diff each way | matches |
| `package.json` scripts vs p7 | 24 vs 24 | matches |
| README | "37-agent registry", "Agents (37)" | matches registry |
| Client call sites | 30 in `web/src/api.ts` covering 28 server paths | see gaps below |

**CA-02 — the "48 routes" count is a mixed census, not a server-route count.** `scripts/assert-stage.mjs:181-197` derives route strings from `src/server/app.ts` *and* `web/src` with `/(?:\.(?:get|post|put|delete|patch)|route)\(\s*['"`](\/[^'"`]+)/` and `path="(/...)"`; a bare `path="/"` does not match because the pattern needs ≥1 character after `/`. So the 48 counts 42 server paths + 6 UI paths and silently excludes the `/` overview SPA route (which is served by the SPA fallback, `app.ts:979-988`, and pinned as 200 by `e2e/api-contract.spec.ts:50-54`). No drift, but the number must not be read as "48 server endpoints".

**Route/client gaps (missing/extra/unimplemented):**

- *Server routes with no client call site:* `GET /api/runs/:id/checks`, `GET /api/runs/:id/files`, `GET /api/runs/active`, `GET /api/scripts`, `POST /api/scripts/:id/dry-run`, `GET /api/stats/router`, `GET /api/ops/system`, `GET /api/ops/reports/:kind`. (The UI shows checks/artifacts from the snapshot instead.)
- *Client paths all exist server-side:* no client call resolves to a 404 route (`clientPathsNotInCode=[]`).
- *Unimplemented / refusing by design:* `POST|PUT /api/settings/key` → `FORBIDDEN_PROVIDER_KEY_ACCESS` (`app.ts:220-221`); `mock` agent mode → `E_AGENT_MOCK_UNAVAILABLE` (`app.ts:314`); paid scripts → `E_SCRIPT_DRY_RUN_UNSUPPORTED` (`app.ts:531-536`). All named, none silent.
- *Statuses:* terminal run set `queued|running|paused|needs_review|completed|completed_with_warnings|failed|cancelled|budget_exceeded|interrupted` (`src/shared/types.ts:1-22`); DB only ever holds `completed|failed|budget_exceeded`; `cancelled`/`interrupted`/`paused`/`needs_review` have no rows → unexercised.

**Event-type parity (static + persisted)**

`probe-events.mjs` (`evidence-events.txt`):

```
emitted 16: agent.completed agent.failed agent.started context.packed context.skipped
            file.written phase.completed phase.skipped phase.started repair.stalled
            route.decided run.cancelled run.completed run.failed run.queued run.started
subscribed 27 | overlap 11
emitted-not-subscribed 5: agent.failed context.skipped phase.skipped repair.stalled run.queued
subscribed-not-emitted 16: run.updated run.paused run.needs_review step.started step.completed
            agent.delta file.revised check.completed review.completed failure.clustered
            repair.completed confidence.recorded learning.trace learning.eval learning.promotion heartbeat
```

DB (972 events): 13 of the 16 emitted types actually occur; `phase.skipped`/`context.skipped` have 0 rows (routing enabled in B2). The client's `onmessage` fallback never fires because every frame carries `event: <type>` (`app.ts:854`).

**Payload field consumption:** the only run-event consumer reads `type`, `receivedAt`, and `data` (raw JSON preview) — `web/src/pages/RunDetailPage.tsx:1035-1046`; `useApi.ts:126-139` writes the whole SSE envelope into `data`, `src/shared/run-events.ts:19-25` writes `payload` for persisted rows. No UI field is driven by an event payload, which is why terminal convergence survives the dropped events — and why the Events tab is the only place the drift shows.

## 9. Decision — what is fixed now

**Approved: 11 fixes (AF-01…AF-11).** Detail, exact lines, semantics, edge cases and tests are in `FORGEWRIGHT-DIRECTIVE.md`. Summary in priority order:

| ID | P | Fix | Root cause |
|---|---|---|---|
| AF-01 | P1 | Terminal usage aggregation on every terminal path + `run.failed` carries `costUsd` and a human message | F2 / L-02 / RC-1 |
| AF-02 | P1 | One event-type registry; subscribe to all emitted types; unwrap SSE payload; static parity test | F1 / L-04 / RC-3 |
| AF-03 | P1 | Terminal Events tab renders the persisted ledger; pure selector + truth table test | RC-2 / L-13 |
| AF-04 | P2 | `/events` truncation computed from this run's rows (count/`DESC` window); rename artifact badge | F6 / L-05 / L-15 / RC-4 |
| AF-05 | P2 | Snapshot serves the **per-run** cap via `runBudgetUsd(id)` | F3 / RC-5 (CA-04) |
| AF-06 | P2 | Preserve `LlmError.code` through run/step/event terminals | L-01 |
| AF-07 | P2 | `interrupted` gets a code, message, event and error-log record | L-06 |
| AF-08 | P2 | Context route returns excluded items with `included:false` + reason; drop unproduced columns/claim | F4 |
| AF-09 | P2 | Plan-family adhoc validation accepts the advertised `AgentPlanSchema`; make the UI validation claim exact | CA-01 |
| AF-10 | P3 | Checks rows key on DB row identity; remove the dead Time column and `code` fallback | F12 / L-14 |
| AF-11 | P3 | Routing `reason` derived from the decision's own features, never a literal | F5 |

**Why this is the minimal batch.** Every approved item has (a) a reproduced root cause at file:line, (b) a single narrow seam, (c) no schema migration, (d) no new route, (e) a regression test that can be written without paid calls or fake data. Items that fail one of those tests were deferred even when real (see below).

## 10. Deferred / rejected / unverified (excluded from the batch)

| ID | Item | Reason |
|---|---|---|
| D-01 | F7 nested-modal Escape | Needs a dialog-stack/topmost design; no data truth; overlapping focus traps. |
| D-02 | F8 skip-link focus | A11y; needs focus management plus an e2e focus assertion; no data impact. |
| D-03 | F9 tab `aria-controls` | A11y across tab widgets and Learning; multi-component churn. |
| D-04 | F10 favicon 404 | Cosmetic console noise; needs an asset or a 204 route. |
| D-05 | F11 unknown-route `E_RUN_NOT_FOUND` | **Pinned** by `e2e/api-contract.spec.ts:62-64`; changing it is a contract decision, not a wiring repair. |
| D-06 | F13 refusal-code split | New codes + HTTP/copy semantics across 6 sites; the composer pre-validates, so no routine user lie. |
| D-07 | O1 learning inspect hidden | Refusal is truthful and named; P7 honesty must be preserved. |
| D-08 | O2 stale vault root | Data hygiene; removing it deletes user data. |
| D-09 | O3 runs filter >100 / missing `interrupted` | No live impact at 25 runs; needs server-side filter and a status-list decision. |
| D-10 | O4 "Accepted tree" label | Cosmetic adjective; no data path. |
| D-11 | O5 dead reviews path | Dead code, no claim; removal is a cleanup ticket. |
| D-12 | L-07 gate-error logging + `GATE_FAILED` registration | Observability/registry design; the UI already shows `GATE_FAILED` + message truthfully; renaming invalidates historical rows. (The message part is folded into AF-01.) |
| D-13 | L-08 `trace_complete` invariant | Requires reordering `finalize`; the 7 historical rows cannot be repaired without a backfill, which is out of scope. |
| D-14 | L-09 learning variant machine | P7, unreachable (no eval rows, pool exhausted); no UI path. |
| D-15 | U-2 full state guard | Unwiring the declared matrix would reject revise/audit/adhoc/failed runs; a status-only guard in the executor rejection path risks an unhandled rejection; no production illegal transition exists. Design sketch: guard in `markTerminal` only, with an explicit `already-terminal → log E_ILLEGAL_RUN_TRANSITION and skip` policy, plus extending `PHASE_TRANSITIONS` to the four real edges first. |
| D-16 | U-1 / L-10 410 loop | Loop unobserved; no run >500 events; needs stream-recovery design. |
| D-17 | L-11 cancel ack race | Unreproduced; sub-millisecond window. |
| D-18 | L-12 full failure-payload unification / `run.budget_exceeded` type | AF-01 fixes `costUsd`/message on the paths it touches; a vocabulary change needs a consumer decision. |
| D-19 | L-13 timestamp semantics + 100-row live cap disclosure | AF-03 fixes array selection; unifying `receivedAt` needs `meta.createdAt` in the frame. |
| D-20 | Settings nested-`limits` display | AF-05 makes the run-detail cap truthful; the settings page is a display enhancement. |
| D-21 | Wire `PHASE_TRANSITIONS` | **REJECTED** — the matrix contradicts four production edges; would break live presets. |
| D-22 | Historical cost/trace backfill | **REJECTED** — rewriting terminal audit records is out of scope; the rows stay honestly NULL and are documented. |
| D-23 | Seed runs/events to exercise the fleet or live stream | **REJECTED** — fake data is forbidden as proof. |
| D-24 | Delete the 16 reserved event listeners | Deferred cleanup; harmless, and deleting risks future surface. |

**Unverified:** U-1 (loop), L-09, L-10, L-11, O2, L-08's historical cause. Also unproven by anyone: live→terminal transition end-to-end (no live run permitted), provider-failure specimen in production, >200 artifacts / >500 events boundaries, two-server concurrency, runtime behaviour of the three plan agents (static only).

## 11. Upstream quality

See `upstream-quality.md` — per-seat right/wrong/`unproven`, the missing forge files, and what the directive tells the writer about each seat's evidence.

## 12. Evidence index (all under `docs/AUDIT-WAVE-6/capability/`)

| File | Contents |
|---|---|
| `probe-baseline.mjs` / `evidence-baseline.txt` | 150/150 baseline hashes match |
| `probe-db-readonly.mjs` / `evidence-db-probe.txt` | read-only DB census: runs, cost-vs-usage, events, truncation, checks, context, limits, traces, steps |
| `probe-census.mjs` / `evidence-census.txt` | route registrations, manifest diff, client paths, live OpenAPI |
| `probe-events.mjs` / `evidence-events.txt` | emitted vs subscribed sets, payload field consumption |
| `probe-limits.mjs` / `evidence-limits.txt` | run-snapshot limits vs `run_limit:*` (cap provenance correction) |
| `evidence-peer-probe-rerun.txt` | independent re-run of the logic seat's 15 throwaway-DB probes (6 RED) |
| `probe-stubscan.mjs` / `evidence-stubscan.txt` | R-3 re-test on the stored abf5 staging tree (0 findings) |
| `probe-agent-matrix.mjs` / `evidence-agent-matrix.txt` | 37-agent matrix derived from the registry |
| `probe-agent-use.mjs` / `evidence-agent-use.txt` | steps/decisions/evidence/artifacts per agent |
| `probe-steps.mjs` / `evidence-steps.txt` | abf5 step timing window, run row, `run.failed` payload shapes, cancelled/interrupted counts |
| `probe-stage-census.mjs` / `evidence-stage-census.txt` | tables/scripts/manifest equality |
| `evidence-test-baseline.txt` | baseline unit-suite run (see sentinel note in `upstream-quality.md`) |
| `findings-verdicts.json` | machine-readable verdicts |
| `FORGEWRIGHT-DIRECTIVE.md` | the implementation directive |
| `upstream-quality.md` | seat-by-seat assessment |
