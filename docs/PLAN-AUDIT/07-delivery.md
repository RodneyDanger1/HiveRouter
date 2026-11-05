# Seat 7 — Delivery, Gates, and Tooling Audit (`plan-audit-delivery`)

**Plan audited:** `docs/PLAN-v2.md`, SHA-256 `8AD841C5F572A23DAFCF5254A98F9E81B37F6D8BC7AE0B806D6BDEC146B518F2` (454 lines).
**Wave sheet:** `docs/PLAN-AUDIT/WAVE-SHEET.md`, SHA-256 `C5724D2F51671E74DC840F415EC3234CFF3405AA5E726D615CE973A8D23316FA`.
**Time:** 2026-11-03 09:27–09:31 America/Chicago. **Mode:** plan audit only. No installs, no paid calls, no key access.
**Scope:** §3, §9, §10, §18, §19, §20. The canonical file has **no top-level §18/§19/§20**; those are referenced inside §0/§8/§11 or inherited from v1. This is itself **D01**.
**Verdict:** **EXECUTABLE WITH FIXES — NO-GO until D01–D05 are closed.** The core staging intent is sound; the current file cannot be handed to a builder as the sole contract, and three gates are currently impossible or leak phases.

## 1. Defects

Format: **section — why it bites in code — RED probe/contradiction — exact patch — GREEN verification.**

### D01 — P0 — Canonical plan is not self-contained; §18/§19/§20 and several refs do not exist

- **Sections:** §0 items 9–10; §8 “**§18 Assumptions**”; §11 DoD #1; whole file.
- **Why it bites:** a builder is told “disjoint write scopes in §19” (§0 line 23) and “matrix in §21” (§0 line 24), but the file’s headings stop at §17. §18 appears only as a patch bullet in §8, §19/§20/§21 are absent, and DoD #1 points at “v1 criteria” not in the file. Team ownership, command obligations, and final-report obligations are therefore unverifiable and can be interpreted differently by Lead/catalog/web/qa.
- **RED probe:** `Select-String '^## '` on `PLAN-v2.md` returns only §0–§17. `Select-String '§19|§20|§21|§18'` matches only line 23 (§19), line 24 (§21), line 268 (§18 patch note), and ambiguity at line 114. There is no §20 heading.
- **Exact patch:** append/restore three top-level sections, and fix refs:
  1. Rename current §12 to **§18 Assumptions, risks, and non-goals** (keep text), or append a §18 that is the v1 §18 verbatim.
  2. Add **§19 Team, write scopes, and merge order** with the file-level table in D13.
  3. Add **§20 Commands, gate receipts, and final-report obligations** with the command table in D08 and report template in D15.
  4. Change §0.9 to “§19”; §0.10 to “§15”; §8’s “**§18 Assumptions:**” to “**§18:**”; §11 DoD #1 to “Release A v1 §17 + §4 fixes, with the v1 DoD copied into §18/§20”.
- **GREEN:** headings `## 18`, `## 19`, `## 20` exist; every `§N` reference resolves to a heading; a link/reference check (grep + whitelist) returns zero dangling refs.

### D02 — P0 — Release A stage leakage is prescribed by the plan and cannot be tested

- **Sections:** §0 item 3 (“Release A = P0–P5 only; zero P6/P7 tables, routes, pages, scripts”); §3; §8 “§5 Layout” (adds `src/server/{routing,context,repair,quality,retry,logic,learning}/**`, `web/src/pages/Learning*`, `scripts/**`, `eval/suites/**`); §6.9 (“New tables” includes A tables `run_snapshots`, `budget_reservations`); §10 (lists `npm run learn`/`eval:router` in the acceptance matrix).
- **Why it bites:** the layout/API/script/DB additions are not stage-scoped. A P0 scaffold following §8 will create `learning/`, `learning` UI, `scripts/`, `eval/suites/`, `learn`, and `/api/learning` inside Release A, directly contradicting §0.3 and §3. Conversely, a P6a migration that reuses “new tables” including A tables can fail as duplicate. There is no executable allowlist or stage test, so “no P6/P7 artifacts” is prose-only.
- **RED probe/contradiction:** §0.3 says zero P6/P7 tables/routes/pages/scripts; §8’s layout patch says add `src/server/learning/**`, `web/src/pages/Learning*`, `scripts/**`, `eval/suites/**` with only “P7 files are not in Release A” as a comment; §10 lists P7 commands without a phase column. A file-tree test cannot tell which files are allowed because the plan never publishes the allowlist.
- **Exact patch:** add `config/releases/a.json`, `p6a.json`, `p7.json`: `{paths, dbTables, apiRoutes, uiRoutes, packageScripts, migrations}`. Add `scripts/assert-stage.mjs --stage=a` to the A gate and `--stage=p6a` to P6a. Name migrations `001_a_*`, `010_p6a_*`, `020_p7_*`; register API/UI/package scripts from the stage manifest only. A gate command: `node scripts/assert-stage.mjs --stage=a --json`; P6a adds its allowlist; P7 is not built in A.
- **GREEN:** A stage tree has zero P6/P7 paths/routes/tables/scripts; `assert-stage` fails when a P6a route is present in A; P6a passes with exactly its six tables and five scripts; P7 not referenced in A.

### D03 — P0 — The 7 GB disk guard contradicts the 5.8 GB assumption and this host’s measured 5.78 GB

- **Sections:** §4 W14 (“7 GB disk guard”); §8 “§18 Assumptions” (“5.8 GB disk/~1.4 GB RAM”); §12 assumptions.
- **Why it bites:** if W14 is implemented literally as `free < 7 GB ⇒ refuse`, the plan cannot start on the machine it is written for. The measured host at audit time is **5.78 GB free** (`Get-PSDrive C`, 2026-11-03 09:27), already below 7 GB before `npm ci`, Vite build, Playwright, or any run artifacts. Either the guard or the assumption must change; as written, P0 is unsatisfiable.
- **RED probe:** `Get-PSDrive C` → free 5.78 GB; a guard `if (free < 7) throw E_RESOURCE_INSUFFICIENT` refuses immediately. The plan states both “5.8 GB” and “7 GB guard” without reconciliation.
- **Exact patch:** replace W14’s 7 GB with a measured budget: preflight `requiredFreeGB = 4.5` (node_modules + build + test-results + 2 GB reserve), refuse below `4.5` with `E_RESOURCE_INSUFFICIENT`; or, if 7 GB is required, add a mandatory cleanup task that frees to ≥7 GB before P0 and records it as a gate prerequisite. The plan must choose one; do not claim the host meets a threshold it does not.
- **GREEN:** preflight on this host passes at 5.78 ≥ 4.5 (or cleanup reaches ≥7); `E_RESOURCE_INSUFFICIENT` fixture below threshold refuses by name; no install starts before the check.

### D04 — P0 — Logic-module phase ownership contradicts Release A and P6a

- **Sections:** §5 inventory (“4 logic scripts”); §6.7 (“P6a Logic modules (4, pure)”); §9 P6a deliverable (“4 logic modules”); §15 matrix (`LG1 gate-decision P1/P6a`, `LG2 run-state P1`, `LG3 repair-plan P6a`, `LG4 budget-policy P1`).
- **Why it bites:** Release A cannot gate or budget without gate-decision/run-state/budget-policy, but §6.7/§9 assign all four to P6a. If LG3 is the only new P6a module, P6a’s “4 logic modules” deliverable is false; if all four are P6a, A’s gate and budget are missing. The traceability matrix already disagrees with the phase table, so the count of record is inconsistent.
- **RED probe/contradiction:** §6.7 heading says 4 in P6a; §15 phases say LG1/LG2/LG4 are P1 and LG3 P6a. `npm test` A cannot exercise LG3 if it is P6a; A gate uses gate/budget/state, so those three must exist in A.
- **Exact patch:** set **LG1, LG2, LG4 = P1; LG3 = P6a**. Change §6.7 to “P6a adds LG3; LG1/LG2/LG4 are P1 primitives already exercised by A.” Change §9 P6a to “P6a adds 1 logic module (LG3); total 4 across A+P6a.” Keep §15’s phase column and add a “first phase” assertion.
- **GREEN:** §6.7/§9/§15 agree; A tests run LG1/LG2/LG4; P6a tests add LG3; traceability count remains 4 with no double counting.

### D05 — P0/P1 — P7 gate requires 50 cases while §3/§7 allow `refused`; DoD has no refused outcome

- **Sections:** §3 (P7 stops at `refused` if pool/provenance/budget cannot be produced; A/B1 still ship); §9 P7 gate (“50 paired cases + screening gate”); §7.1 (“<12 ⇒ refused”, “12–49 ⇒ shadow-only”); §11 DoD #3 (P7 must implement single-use frozen 50-case suites).
- **Why it bites:** a P7 gate that requires 50 cases marks an honest `refused` as red, contradicting the shipping rule. A builder cannot tell whether P7 is “must pass 50” or “must be attempted and may refuse.” DoD #3 then makes a refused P7 a failure of the whole plan even though §3/§7 say A/B1 ship. This is a circular acceptance condition.
- **RED probe/contradiction:** fixture with an empty sealed pool: §7.1 says record `refused`; §9 gate says 50 cases required ⇒ gate fails; §11 DoD #3 says P7 implemented ⇒ whole DoD fails. Three different outcomes for the same evidence.
- **Exact patch:** replace §9 P7 gate with an outcome matrix:
  - `P7_PASS` = full implementation, frozen 50 paired cases, screening result `promotion` **or** `no_promotion` with evidence.
  - `P7_REFUSED` = implementation + sealed-pool/provenance/budget refusal artifact; **also a green P7-stage outcome for Release A/B1**.
  - `P7_INVALID` = missing single-use/provenance/approval gates; red.
  Split §11 DoD #3 into **3a (P7 implemented; either PASS or REFUSED)** and **3b (promotion path only if 50-case evidence exists)**.
- **GREEN:** empty-pool fixture yields `P7_REFUSED`, A/B1 gate stays green, no promotion; 50-case fixture yields PASS/no_promotion; 12–49 fixture cannot promote and is recorded shadow-only.

### D06 — P1 — The “five no-effect candidates cannot reuse a suite” test has no pool size and is arithmetically unbuildable

- **Sections:** §3 P7 (“single-use frozen evaluation suites … re-freeze from a sealed pool after every evaluation”); §7.1 (“50 paired cases”, “five synthetic no-effect candidates cannot reuse a suite”); §10 integration test.
- **Why it bites:** five candidates × one 50-case suite per evaluation = at least 250 cases, plus a baseline/dev set; the plan never states the sealed-pool size or whether cases can be disjoint across suites. The acceptance test therefore cannot be constructed without inventing a pool, and a finite pool can silently run out mid-test.
- **RED probe:** calculate 5 × 50 = 250; `sealed pool size` is nowhere in the plan; `suite_uses` unique constraint alone does not provide 250 cases. A test that evaluates five candidates either reuses a suite (must be refused) or runs out of cases (`E_LEARNING_DATASET_EMPTY`), so it cannot pass as written.
- **Exact patch:** in §7.1 add: “`maxCandidates = 5`; sealed pool size ≥ `50 × (maxCandidates + 1) = 300` paired cases, pre-registered before any candidate; suites are disjoint 50-case folds; if pool < 300, P7 refuses before candidate generation (`P7_REFUSED`) and the five-candidate test is skipped with that reason.” Add the 300-case fixture to §10.
- **GREEN:** a 300-case fixture supports five candidate evaluations plus baseline; a 250-case fixture refuses by name; the same suite cannot be used twice; no test claims a pass on a 250-case pool.

### D07 — P1 — Exact pins are incomplete, and P0’s `npm ci` gate precedes the lockfile

- **Sections:** §0 item 2 (“Exact pins include …”); §9 P0–P5 gate (`npm ci`); §10 commands.
- **Why it bites:** the plan lists six pins, not the full runtime graph (Fastify/plugins, React/ReactDOM, Vite, Tailwind, Vitest, Playwright, React Router, etc.). A scaffold can float these, defeating “exact pins.” Separately, the repo is empty; the first P0 gate is `npm ci`, but `npm ci` fails without `package-lock.json`. The build cannot start from the stated gate order.
- **RED probe:** registry check confirms `parse5@8.1.0`, `diff@9.0.0`, `@langchain/langgraph@1.6.0`, `@langchain/core@1.3.4`, `zod@4.6.7`, `typescript@5.9.3` resolve; Fastify 5.12.8/plugin 10.1.8, Vite 8.3.5/plugin-react 6.2.1, Vitest 5.1.0, Playwright 1.64.1 are unpinned in plan. Empty repo + `npm ci` = `EUSAGE`/no lockfile.
- **Exact patch:** add a full exact-pin table; `package.json` uses exact versions (no `^`/`~`), `packageManager: "npm@11.19.0"`, `engines.node: ">=26.7.0 <27"`, `.node-version` `26.7.0`. Change P0 to **P0a: `npm install --save-exact`, commit lockfile; P0 gate: clean `npm ci`**.
- **GREEN:** clean-clone `npm ci` succeeds from lockfile; `npm ls --depth=0` matches the pin table; `node -v`/`npm -v` match engines; no floating range in `package.json`.

### D08 — P1 — Gate commands are not executable as written; package scripts and args are undefined

- **Sections:** §9 gates; §10 commands; §7.5 (`learn` requires dataset/candidate); §6.8 (script envelope).
- **Why it bites:** §10 lists `npm run learn`, `eval:router`, `replay`, `repo-map`, `context:report`, `integrity`, `bench`, `test:live` with no required args. `learn` without `--dataset/--candidate` must refuse; `replay` without `--run` must refuse; `test:live` has no definition; `verify` is cited as a gate in v1 but not defined in v2. A CI script copying §10 will get usage errors, not gates.
- **RED probe:** package.json does not exist (repo empty); `npm run learn` resolves to nothing; even after scripts, `learn`'s required inputs are absent. §10 has no exit-code assertions.
- **Exact patch:** add §20 command table: `verify`, `verify:a`, `verify:p6a`, `test:live -- --yes --max-cost 0.50`, `bench -- --mock`, `eval:router -- --fixture`, `replay -- --run <id>`, `repo-map -- --run <id>`, `context:report -- --run <id>`, `integrity -- --run <id>`, `learn -- --dataset <f> --candidate <f>`. Every row names phase, required args, expected exit 0/refusal, and whether it spends money. Wire scripts into `package.json` only in the owning stage.
- **GREEN:** each command with a fixture succeeds; missing-arg invocation exits 2/6 by name; A stage `package.json` contains no P6a/P7 scripts; P6a adds its five; P7 adds its two.

### D09 — P1 — Playwright/system-Chrome configuration, isolation, and browser preflight are missing

- **Sections:** §9 P0–P5 gate (“E2E mock”); §10 E2E; §12 assumptions (Windows).
- **Why it bites:** “E2E mock” does not specify `channel: "chrome"`, a temp `DATA_DIR`, a mock provider URL, or a preflight check. Playwright may look for its bundled Chromium (not installed), or the app may use the developer DB/real key. The plan claims system Chrome support but never configures it; a run can fail before the first assertion or test the wrong environment.
- **RED probe/READ:** Chrome exists at `C:\Program Files\Google\Chrome\Application\chrome.exe` (156.0.8078.75); headless probe `chrome --headless=new --dump-dom about:blank` exited 0. No `playwright.config` exists in the plan; no `use.channel`, no `webServer` env, no `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD`. Registry shows no `playwright@1.64.1` install scripts (READ), so a browser download is not automatic, but an explicit `playwright install` or missing-channel failure remains.
- **Exact patch:** `playwright.config.ts`: `use: { channel: 'chrome', headless: true }`, `workers: 1`; `webServer` array: app on 8788 with `DATA_DIR` temp, `DEEPSEEK_API_KEY=test`, `DEEPSEEK_BASE_URL=http://127.0.0.1:8899`, mock on 8899; `reuseExistingServer: false`; preflight `E2E_BROWSER_MISSING` if Chrome path absent; if any install step exists, set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`. Gate: E2E only against mock; no live key.
- **GREEN:** E2E launches installed Chrome, app uses temp DB, no real key/network, and `E2E_BROWSER_MISSING` is exercised by a fake path. The headless Chrome probe above is the environment evidence; the full E2E is UNVERIFIED until built.

### D10 — P1 — No RAM/build-resource gate; the stated 1.4 GB RAM is below a safe build floor

- **Sections:** §8 “§18 Assumptions” (5.8 GB/1.4 GB); §9 gates; §10 build command.
- **Why it bites:** the plan measures disk but not RAM, and 1.4 GB free is below a typical Vite/Vitest/Chrome build footprint. Running `npm ci` → `vitest` → `vite build` → Playwright sequentially is mandatory; without flags, Vitest workers and Chrome can OOM and turn the gate red for environmental reasons. At audit time free RAM is **2.12 GB**, so the stated 1.4 GB is stale/conservative, but no gate enforces either number.
- **RED probe:** `Get-CimInstance Win32_OperatingSystem` → FreePhysicalMemory 2.12 GB at 09:27; plan assumes 1.4 GB; no `NODE_OPTIONS`, `maxWorkers`, or `workers` setting appears. A 1.4 GB build is an unverified OOM risk.
- **Exact patch:** add `scripts/preflight.mjs` requiring `freeDiskGB >= 4.5` (D03) and `freeRamGB >= 1.5`, Node/npm exact, Chrome present, port free; set `NODE_OPTIONS=--max-old-space-size=1024`, Vitest `maxWorkers: 1`, Playwright `workers: 1`, run build after tests and close Chrome; add `E_RESOURCE_INSUFFICIENT`. Gate records measured values.
- **GREEN:** preflight passes at 5.78 GB/2.12 GB; a simulated 1.0 GB RAM / 4.0 GB disk fixture refuses by name; build completes sequentially. **UNVERIFIED** until installed and run.

### D11 — P1 — Stub/secret sweeps are only in the Release A gate, not P6a/P7

- **Sections:** §9 P0–P5 gate (stub/secret sweep); §9 P6a/P7 gates (omit); §10 test matrix (no sweep); §11 DoD #5 (no secret).
- **Why it bites:** P6a adds scripts/modules and P7 adds learning/dataset code; either can introduce a `TODO` or a secret that passes P6a/P7 because only A gate mentions sweeps. DoD #5 then becomes aspirational for later phases.
- **RED probe:** §9 P6a gate text: “A gate + P6a unit/property/integration + refusal matrix + no P7 artifacts” — no stub/secret. §9 P7 gate: no sweep. §10 has no `stub`/`secret` command.
- **Exact patch:** define `npm run stub-sweep` and `npm run secret-scan`; add both to **every** gate (A, P6a, P7) and `verify`; classify test doubles under `test/`/`e2e/`; add `E_STUB_SWEEP`/`E_SECRET_SCAN`; plant a TODO/secret fixture to prove red.
- **GREEN:** planting one TODO in `src/server/routing` makes P6a gate red; planting `sk-` in a dataset makes P7 gate red; removal restores green.

### D12 — P1 — Migration/retention/crash/stage-table gates are missing

- **Sections:** §4 W14 (additive migrations, crash consistency, retention/prune, disk guard); §8 “§10 Persistence” (retention intervals); §10 integration (“old-DB migration” only); §9 gates.
- **Why it bites:** old-DB migration is listed, but no crash-after-write, retention clock, stage-table allowlist, or no-P6/P7-table test is in any gate. Additive migrations without crash reconciliation can leave a run marked complete with a missing artifact; retention can delete active eval evidence. The plan promises W14 but does not gate it.
- **RED probe:** §10 has “old-DB migration” only; §9 P6a/P7 gates have no migration/retention step; no fixture names. A P7 migration can create learning tables in A and no test catches it.
- **Exact patch:** add gate tests: `migrations/001_a` → `010_p6a` → `020_p7` on an old DB; crash injection after artifact insert before run update; retention with injected clock (events 90d, context 30d, traces 180d, eval 365d) never deletes active suite/evidence; stage allowlist test (D02). Add to §10 and each gate.
- **GREEN:** old-DB fixture upgrades; crash injection reconciles `interrupted`/ledger; retention prune leaves active eval; A DB has zero P6/P7 tables; P6a/P7 migrations are additive and idempotent.

### D13 — P1 — Team/write scopes are undefined and collide across phases

- **Sections:** §0 item 9 (missing §19); §9 “Team write scopes” (Lead `src/server/{core,...}`, scripts integration, final tests; catalog prompts; web UI; qa tests); §8 layout.
- **Why it bites:** “core,…” is not a path; P6a adds `routing,context,repair,quality,retry,logic`, which are not assigned; `logic` is split P1/P6a; `scripts` is P6a/P7; qa “tests” overlaps Lead’s “final tests”; catalog may need prompt fixtures that qa owns. Two writers can edit the same test or module, violating the plan’s own disjoint-scope rule.
- **RED probe:** §0.9 points to missing §19; §9 has one prose sentence; no file ownership table exists; `src/server/logic` appears in both P1 and P6a plans; test paths are unassigned.
- **Exact patch:** add §19 table: Lead owns `src/shared/**`, `src/server/{core,db,llm,pipeline,runs,routes,security,verify,vault,logic,context,routing,repair,quality,retry,learning}/**`, `scripts/**`, root configs, final tests; catalog owns `src/server/agents/**`; web owns `web/**`; qa owns `test/**`, `e2e/**`, `test-results/**`; merge order A → P6a → P7; no overlapping writes without Lead mediation.
- **GREEN:** an ownership checker maps every path to exactly one owner; no P6a/P7 file exists in A; no unowned path appears in a diff.

### D14 — P2 — Gate layering re-runs the expensive live A gate at every phase; no receipt reuse or balance preflight

- **Sections:** §9 P6a/P7 gates (“A gate + …”); §10 live tests; §4 W02 (global budget); §7 cost.
- **Why it bites:** literal “A gate +” at P6a and P7 can re-run the live micro-suite and E2E every phase, spending money repeatedly and re-testing untouched paths; with a modest balance, P7 live eval (≤$3.00) plus repeated A live smokes can hit 402 mid-gate. There is no frozen gate receipt or balance floor.
- **RED probe:** §9 gates do not say “prior receipt” or “only affected tests”; §10 live micro-suite ≤$0.50 and P7 eval ≤$3.00; balance is not part of any gate; no `min(cap, balance - reserve)` rule.
- **Exact patch:** add `gate_receipts` artifact `{commit, stage, gate, evidenceHash, timestamp}`; P6a/P7 re-use A receipt if provider/pipeline paths unchanged; re-run only affected mock/unit gates; add live preflight `balance >= cap + reserve` else `E_BUDGET_EXCEEDED`; live gates require `--live --yes` and human consent; CI runs mock only.
- **GREEN:** P6a with unchanged A paths reuses receipt and spends $0; changed provider path forces one live smoke; low-balance fixture refuses before any paid call; CI has zero live calls.

### D15 — P2 — Final-report obligations are reduced to “three tables” with no evidence contract

- **Sections:** §11 DoD #7; missing §20; §0 item 8 (evidence); §4 W18 (provenance).
- **Why it bites:** DoD #7 names Done/Not done/Unverified but not command+output, run IDs, hashes, mock/live/human provenance, RED/GREEN, coverage, or the unresolved list. A report can claim completion without evidence, violating the plan’s own “no fake green” rule. The scope explicitly assigns final-report obligations to this seat, but the section is absent.
- **RED probe:** §11 DoD #7 has no template; no §20 heading; §0 item 8 only says “quote command and output.” A report with empty evidence passes the letter of #7.
- **Exact patch:** add §20 “Final report” with: per item `claim | command | observed output | path:line | artifact hash | run ID | provenance(mock/live/human) | RED/GREEN | residual risk`; mandatory Done/Not done/Unverified tables; coverage matrix per phase; claim-strength labels VERIFIED/READ/INFERRED/UNVERIFIED; report rejected if any Done row lacks command+output.
- **GREEN:** a template with one unsupported Done row fails the report lint; a complete row passes; final gate reads §20.

## 2. Cross-section contradictions (for Lead, cannot be fixed inside seat 7)

1. **D02 stage leakage** spans §0.3, §3, §8 layout, §6.9 tables, §10 commands; needs one stage manifest owned by Lead.
2. **D03 disk threshold** spans §4 W14 and §18/§12; Lead must choose 7 GB cleanup vs 4.5 GB guard.
3. **D04 logic phases** spans §5, §6.7, §9, §15; traceability matrix must be authoritative.
4. **D05/D06 P7 outcomes/pool** spans §3, §7.1, §9, §10, §11; seat 4 (learning) should confirm the 300-case pool and statistical multiplicity before Lead fixes.
5. **D07/D08 pins/commands** spans §0, §9, §10, §20; one version/command table.
6. **D09–D12** test-harness/resource/migration gates need §15/§16 additions; seat 1 (persistence) and seat 2 (API/UI) may duplicate migration/E2E checks — avoid double counting.

## 3. What I checked and found clean

- **Plan hashes / line count:** `PLAN-v2.md` 454 lines, SHA-256 recorded; `WAVE-SHEET.md` hash recorded.
- **Exact pins resolve (registry READ, not installed):** `parse5@8.1.0`, `diff@9.0.0`, `@langchain/langgraph@1.6.0`, `@langchain/core@1.3.4`, `zod@4.6.7`, `typescript@5.9.3`. Engines are compatible with Node 26.7.0: Vite 8.3.5 (`^20.19 || >=22.12`), Vitest 5.1.0 (`^22.12 || ^24 || >=26`), LangGraph `>=18`, Playwright `>=20`.
- **`@vitejs/plugin-react@6.2.1` peers `oxc-transform-react`, `@rolldown/plugin-babel`, `babel-plugin-react-compiler` are all optional** (`peerDependenciesMeta`), so their absence is not a specific build blocker.
- **Chrome/system probe:** installed Chrome 156.0.8078.75 at the documented path; headless `--dump-dom about:blank` exited 0. System-Chrome E2E is feasible (config still missing, D09).
- **No Playwright install scripts** in `playwright@1.64.1` registry metadata; browser download is not automatic in `npm ci` (READ), so do not claim it as a disk failure.
- **No product code exists**; repo contains only audit directories. No audit contamination.
- **Release A “no P6/P7” intent is correct**; the defect is enforceability, not the intent.
- **P7 “no fake learning / no promotion expected”** is clear and honest; the defect is gate arithmetic (D05/D06).
- **No installs, no paid calls, no key reads** occurred in this audit.

## 4. Claim strength

- **VERIFIED:** plan text/hash/headings; `§18/§19/§20` absence and dangling refs; disk 5.78 GB and RAM 2.12 GB; Chrome headless exit 0; registry existence/engine/peer metadata for pins.
- **READ:** plan sections; npm registry metadata; Chrome path/version.
- **INFERRED:** build OOM risk at low RAM; 4.5 GB disk threshold; E2E isolation failure modes. Not executed.
- **UNVERIFIED:** `npm ci`, typecheck, tests, Vite build, Playwright E2E, live smoke, migration/crash/retention tests — no installs or paid calls permitted in this audit.

## 5. Skills applied

- **smartfix:** RED/GREEN receipt per defect; report/patch discipline; no patch without probe.
- **logic-debugger:** D04 phase/state contradiction; D05/D06 gate outcome arithmetic.
- **integration-logic:** D02 stage → layout/DB/API/script seam; D08/D09 install→build→E2E chain.
- **logic-gatekeeper:** D01–D05 as pre-mutation blockers; stage allowlist before code.
- **research:** registry pin/engine/peer reads; Chrome probe; no memory-based versions.
- **capability-auditor:** D02 claimed “zero P6/P7” vs actual prescribed artifacts; D07 pin claims vs full graph.
- **auditor:** independent evidence, measured resources, hash recording, no trust in plan prose.
- **forge:** root cause (missing canonical sections + no stage manifest) instead of cosmetic wording.
- **forgewright-lead:** final gate/DoD review; no fake green; evidence obligations D15.

## 6. Files read / sources

- `docs/PLAN-v2.md` — full read, 454 lines, hash above.
- `docs/PLAN-AUDIT/WAVE-SHEET.md` — full read, hash above.
- Local: `Get-PSDrive C` (5.78 GB free), `Get-CimInstance Win32_OperatingSystem` (2.12 GB free), `chrome.exe --headless=new --dump-dom about:blank` (exit 0), file hashes.
- npm registry metadata (`npm view`): `parse5@8.1.0`, `diff@9.0.0`, `@langchain/langgraph@1.6.0`, `@langchain/core@1.3.4`, `zod@4.6.7`, `typescript@5.9.3`, `vite@8.3.5`, `@vitejs/plugin-react@6.2.1`, `tailwindcss@4.3.4`, `@tailwindcss/vite@4.3.4`, `fastify@5.12.8`, `@fastify/static@10.1.8`, `@fastify/swagger@9.9.3`, `@fastify/swagger-ui@6.1.2`, `vitest@5.1.0`, `@playwright/test@1.64.1`, `playwright@1.64.1`.
- No external web source was needed; no borrowed mechanism. No DeepSeek API call or key access.
