# Upstream quality — W6-AUD-04 assessment of the three audit seats

Scope: read-only review of `docs/AUDIT-WAVE-6/{weaver,logic,forge}`, every claim re-tested against source, the live read-only API, and `data/hive.db` opened read-only. Verdicts are in `findings-verdicts.json`; the implementation queue is in `FORGEWRIGHT-DIRECTIVE.md`.

**Baseline fact that frames everything:** all 150 files in `docs/AUDIT-WAVE-6/baseline.sha256` still match (`evidence-baseline.txt`). All three seats audited the same tree this directive targets. The unit suite is green (38 files / 249 tests, `evidence-test-baseline.txt`).

## 1. Weaver — W6-AUD-01 (front-to-back UI/value audit)

**Did right**
- The control census is genuine live-DOM work (398 control instances, 34 traces, screenshots for every tab), not prose. Selectors, roles, and counts are reproducible.
- **R-1 classification is correct and important**: it resisted the brief's "UI stuck at Running / 7 steps" framing and proved a stale mid-run capture. My independent DB check reproduces the exact window (step 7 ends `03:09:52.440Z`, step 8 starts `03:09:52.479Z`, run ends `03:15:46.742Z`; `evidence-steps.txt`). This prevented a phantom convergence "fix".
- F1/F2/F4/F5/F6/F12/F13 all land on real `file:line` seams. F2's spend table matches my read-only census to the micro-dollar ($0.606852192 unreported across 7 runs).
- It separated observations (O1–O5) from defects and kept an honest "not exercised" table. O5 (dead reviews) and O3 (filter) are real static findings.

**Did wrong / weak**
- **F3's fix seam is wrong (CA-04).** It says the cap is persisted in `run_snapshots.snapshot_json.limits.maxRunCostUsd` and suggests serving "limits from run_limit:<id>/run snapshot". Those are different numbers: for `run_23af…` the snapshot says **0.5** (global config) while the per-run `settings.run_limit:run_23af…` says **0.05** (`evidence-limits.txt`). Implementing its seam literally would display a cap three times too high. The directive (AF-05) uses `runBudgetUsd(id)`.
- **F4's item count is scoped silently.** "129 context items across 29 packs" is the abf5 slice; the global census is 84 packs / 343 items / 0 tokens / 0 non-empty excluded. Both numbers are true, but the report reads as a global census. No impact on the fix.
- **F5 is over-rated at Medium.** `ccr.ts` always persists `qualitySource:'prior', sampleSize:0`, so the literal is currently *true*. It is a latent lie (P3), not a present one. Sending a writer to "derive the real reason" without that nuance invites fabricating a reason field.
- It did not test route/event parity statically (it counted subscriptions by hand) and did not check whether the empty-context route can ever render excluded rows (it cannot — `excluded_json` is unread; its F4 says "the route can never render one", which is right, but the fix seam understates that the data is already persisted).
- Its "34 control families / 24 wired" totals are DOM-scoped and not reproducible without its capture script; acceptable for a UI seat, but they should not be quoted as product invariants.

**Left unproven:** the live→terminal Events transition (no live run), the 410 loop, cancel, prompt save/reset, agent ad-hoc run, and all paid paths. It says so.

## 2. Logic — W6-AUD-02 (logic/debugger probes)

**Did right**
- This is the strongest artifact in the wave: 15 deterministic probes on a throwaway DB that import the **real** modules (`createRun`, `updateRun`, `markStartupInterrupted`, `budget`, the real Fastify app via `app.inject`). I re-ran the suite unchanged and got the same **6/15 RED** with identical values (`evidence-peer-probe-rerun.txt`). That is reproducibility, not assertion.
- `state-machines.md` is the single most valuable document for the state-guard decision: it proves the declared phase matrix contradicts four reachable production edges (`intake→cleaning`, `intake→generating`, `any→done` in catch and startup interrupt). That is exactly why this audit **defers** wiring the guard (D-15/D-21) instead of approving it — a naive fix would have broken every revise/audit/adhoc/failed run.
- `event-payload-truth.md` correctly separates emitted vs subscribed vs delivered (three different sets) and identifies that the UI consumes **no** payload fields — which is why terminal convergence survives the drops.
- It labels its own limits honestly (no provider-failure specimen, no multi-process test, historical trace cause unknown).

**Did wrong / weak**
- **Minor census discrepancy.** It reports "103 distinct `E_*` literals in `src/`, 30 unregistered". My scan of `src/**.ts` finds **104 / 31** (`E_AGENT_AMBIGUOUS` is the extra; the set otherwise matches, including all 22 `E_LLM_*`). The difference is scan scope/method, not substance — but the directive says "31".
- **W6-L-06's fix seam is ambiguous** ("emit a `run.failed`/`run.interrupted` event"). A writer cannot tell whether to add a new event type, and the client vocabulary is the thing AF-02 is fixing. The directive resolves it: add `run.interrupted` to the shared registry.
- **W6-L-12's fix seam proposes a `terminalEvent()` refactor** with `run.budget_exceeded` as a new type. That is a vocabulary change with consumer implications, and it overlaps the P1 spend fix. The directive folds only the `costUsd`/message part into AF-01 and defers the vocabulary (D-18).
- **W6-L-08's historical cause is speculative** (it admits this). The invariant is real (7 flagged runs with no trace row, my census) but the cause is not established, so no fix is approved.
- **W6-L-01's second-order HTTP claim** (routes re-raise unregistered codes → 500) is right but under-scoped: `E_LLM_*` are provider-internal codes with no natural HTTP mapping, so "register them" is not automatically correct. The directive fixes only persistence identity.

**Left unproven:** provider failure in a live run (probe-only), multi-process DB races, the 410 browser loop, `cancel` race, `paused`/`needs_review` product intent.

## 3. Forge — W6-AUD-03 (root-cause)

**Did right**
- Independent corroboration with *different* probes: the three-way spend contradiction (`/api/stats` 0.924624168 vs `sum(runs.cost_usd)` 0.317771976 vs `traces` 0.299980656 for abf5) is the cleanest statement of RC-1, and it reproduces exactly (`evidence-db-probe.txt`).
- RC-2's static truth table is correct and falsifiable: live buffer (≤100) vs persisted (108) under a "Persisted events" title. I verified every referenced line. Its observation that the prior fix receipt (`docs/TRACE/20261103T2200Z/03-forgewright-fixes.md:82`) claims a merge that does not exist is a genuine regression-history finding.
- RC-3's delivery measurement (app-list source vs missing-list source vs `onmessage`) is the right experiment; my static parity probe and its counts agree (5 emitted-not-subscribed, 16 subscribed-not-emitted).
- RC-4's 24/25 census and RC-5's field audit are both reproducible against the production rows.
- The "excluded false positives" section is exactly what a root-cause seat should produce (no persisted-event failure on fresh load; never-emitted types are not "lost"; zero-call completed run is honest unknown).

**Did wrong / weak — including missing deliverables**
- **`patch-proposals.json` is missing.** `root-causes.md` references P-1…P-5 at `:82, :116, :153, :184, :192`; the file does not exist in `docs/AUDIT-WAVE-6/forge/` (only `root-causes.md`, `red-evidence.md`, `evidence/`, `probes/`). A handoff file is also absent. This audit reconstructed the intent from prose; a writer must not look for that file.
- **P-4's recipe is not implementable as written (CA-05).** "Ask for window + 1 rows after the cursor … return the newest window rows": `getEvents` is `ORDER BY seq ASC LIMIT ?` (`recorder.ts:58-69`), so `window+1` yields the **oldest** window after the cursor. For a >window run you cannot return the newest rows from that query. AF-04 specifies `countEventsAfter` + `DESC LIMIT` + reverse.
- **RC-1's "smallest fix" misses the executor and interrupted paths.** It says add usage to `markTerminal` and route the catch through it; the executor rejection (`manager.ts:150-156`) and `markStartupInterrupted` (`:192-204`) are separate writers, and the cancelled branch (`run.ts:884`) is the catch it did name. AF-01 covers all of them.
- **Same cap conflation as the weaver** (RC-5 repeats that `run_snapshots` has `limits` as if that were the run cap). AF-05 corrects it.
- **RC-2 is labelled P1 but its impact is bounded** to a page that watched a run live; on a fresh terminal load the ledger is correct (it says so). I keep P1 because the title/description actively claim the persisted ledger while showing a truncated live buffer — a user-visible lie — but a writer should not merge it with RC-1 into one giant change.
- It did not check the e2e pin on `E_RUN_NOT_FOUND` (CA-03) before suggesting route-code changes; nor did it notice the agent-contract drift (CA-01), which is outside its UI/cost remit.

**Left unproven:** live→terminal transition (its H3 is static only), 410 loop, cancel race, >200 artifacts / >500 events, historical trace gap cause, two-server concurrency.

## 4. Capability auditor (this seat) — self-assessment

**Did right**
- Verified the audit premise (150/150 hashes) before trusting any upstream line.
- Reproduced every material finding independently: DB census, live `/events`/`/snapshot`/`/settings`, static route/client/OpenAPI/manifest census, event parity, agent matrix, agent-use telemetry, stub-scan re-test, and a full re-run of the logic probe suite.
- Found six things the three seats did not: the agent-contract drift (CA-01), the mixed route census (CA-02), the e2e pin on the unknown-route code (CA-03), the cap provenance error (CA-04), the P-4 recipe error (CA-05), and the unexercised fleet breadth (CA-06).
- Kept the batch to 11 items with a reproduced root cause and a testable seam, and deferred 24 items with explicit reasons — including the two that looked most "fixable" (state guard, 410 loop) because they are unsafe or unreproducible.

**Limits**
- No browser launch: UI-only defects (F7/F8/F9) are static + the weaver's browser captures; I did not re-run Playwright.
- No live run, no paid call, no server restart: the live→terminal transition, provider-failure specimen, 410 loop, and >window boundaries remain unproven.
- I did not re-read the P7 learning modules (L-09) — out of capability scope; marked unverified.

## 5. Cross-seat reconciliations (what a writer should believe)

| Question | Weaver | Logic | Forge | This audit's ruling |
|---|---|---|---|---|
| How many runs lose measured spend? | 7 / $0.606852192 | 6 rows + probe | 7 / $0.606852192 | **7 runs, $0.606852192** (read-only census) |
| Context items? | 129 / 29 packs (abf5) | — | — | **Global: 343 items / 84 packs / 0 tokens**; weaver's is an abf5 slice |
| Unregistered `E_*` codes? | — | 30 of 103 | — | **31 of 104** (incl. `E_AGENT_AMBIGUOUS`, `GATE_FAILED`, 22 `E_LLM_*`) |
| Where is the run cap? | "run_limit and snapshot limits" | — | "snapshot has limits" | **Only `settings.run_limit:<id>` is per-run**; snapshot limits = global 0.5 |
| `/events` truncation? | false positive | 24/25 | 24/25 | **24/25**, live 108/108 `true` |
| Is the state guard fixable now? | — | "wire it" (but phase matrix diverges) | "wire or delete" | **Defer** — unsafe (D-15) |
| Is the stub-scan a defect? | — | — | refuted | **Refuted as current defect**; 0 findings reproduced |
| Unknown-route code? | P3 fix suggestion | — | — | **Pinned by e2e** → defer |

## 6. Directive traceability

| Finding | Directive | Why this shape |
|---|---|---|
| F2 / L-02 / RC-1 | AF-01 | one helper, five writers, `usageTotals` contract preserved |
| F1 / L-04 / RC-3 | AF-02 | one shared vocabulary + static parity pin; keep reserved names |
| RC-2 / L-13 | AF-03 | pure selector + truth table; no live run faked |
| F6 / L-05 / L-15 / RC-4 | AF-04 | count + `DESC` window (fixes CA-05); badge rename |
| F3 / RC-5 / CA-04 | AF-05 | `runBudgetUsd`, not snapshot limits |
| L-01 | AF-06 | `codeOfError`, precedence preserved, no registry expansion |
| L-06 | AF-07 | new `E_RUN_INTERRUPTED` + event + log + usage |
| F4 | AF-08 | excluded rows + drop unproduced columns/claim |
| CA-01 | AF-09 | `AgentPlanSchema` for adhoc plan; exact UI claim |
| F12 / L-14 | AF-10 | row identity + drop dead columns; no migration |
| F5 | AF-11 | derived reason; omit when unknown |
| F7/F8/F9/F10/F11/F13/O1–O5/L-07…L-12/U-1/U-2 | deferred/rejected | §5 of the directive, with reasons |

## 7. Evidence to preserve (do not delete; the writer's receipt should cite these)

1. `docs/AUDIT-WAVE-6/baseline.sha256` + `capability/evidence-baseline.txt` — the 150/150 integrity proof.
2. `capability/evidence-db-probe.txt` — the before-state: 7 NULL-cost runs, $0.606852192, 24/25 truncation, 0-token context, 45 tables.
3. `capability/evidence-peer-probe-rerun.txt` — the 6/15 RED reproduction that justifies AF-01/AF-06/AF-07 and the deferrals.
4. `capability/evidence-stubscan.txt` — proves R-3 must not be "fixed" back into a failure.
5. `capability/evidence-events.txt` — the 16/27/11/5/16 parity census that AF-02 must keep true.
6. `capability/evidence-steps.txt` — the abf5 timing window that refutes R-1 and the three `run.failed` shapes that AF-01 normalises.
7. `capability/evidence-limits.txt` — the cap-provenance correction that AF-05 depends on.
8. `capability/evidence-agent-matrix.txt` / `evidence-agent-use.txt` — the 37-agent chain and its unexercised breadth.
9. `docs/AUDIT-WAVE-6/logic/probe-routes.ts` + `probe-db.mjs` — reusable throwaway-DB probes; the new tests should mirror them.
10. `docs/AUDIT-WAVE-6/forge/root-causes.md` — the cost/event/truncation narrative; note that `patch-proposals.json` is absent, so P-1…P-5 are prose-only.

## 8. What remains unproven after this audit (do not claim otherwise)

- The live→terminal Events transition (no live run; AF-03 is proven statically with a pure selector and a fresh-load e2e).
- The SSE 410 reconnect loop (route half proven, loop unobserved; no run >500 events).
- A provider-failure specimen in production (AF-06 is proven by a real `LlmError` through the real executor on a throwaway DB).
- The cancel acknowledgement race (sub-millisecond; source-only).
- The `/events` and artifact boundaries at >500 / >200 (no such run; AF-04 tests them with a patched window).
- The historical cause of the 7 missing `traces` rows (invariant proven; cause not).
- Two processes on one SQLite file (active-run guard is process-local).
- Runtime behaviour of `router`/`epic`/`cartographer` after AF-09 (schema acceptance is unit-proven; an actual provider call is prohibited).
- Whether the 25-run fleet's 12-agent usage is representative of anything (CA-06) — it is not a claim of coverage.
