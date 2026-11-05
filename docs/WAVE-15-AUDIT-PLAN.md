# Wave 15 decision plan — UI/capability/truth audit and key ingress repair

Date: 2026-11-05
Owner: HiveRouter lead
Baseline: `d2a4293` (451 tests / 70 files; 34/34 E2E; 202 stage files / 51 tables / 62 routes / 24 scripts)
Scope: user-requested full UI inspection, root-cause repair, capability audit, and truthful documentation.

## Execution status

Implemented and verified. Live UI audit found one console 404 and two false key-ingress/DSH claims; fixed with a favicon, real `--from-env` import, bounded key inputs, corrected UI/PLAN copy, and removed unused LangChain deps. Final: **455 tests / 71 files**, **36/36 E2E**, stage **204**, preflight PASS. Evidence: `docs/TRACE/WAVE-15/TRACE-SUMMARY.md`.

## 1. Outcome

Every rendered route is inspected in a real browser; confirmed defects are fixed at the true seam; the local key-ingress instruction matches a real command; the browser console has no favicon 404; unused dependency baggage is removed if provably unused; and current docs/capability matrix describe only what the code does.

## 2. Confirmed defects from this audit

1. **False key-ingress instruction.** `SettingsPage.tsx:69` and `OverviewPage.tsx:121` tell the operator to run `hive key import --from-env`. There is no `hive` binary or bin entry; the real path is `npm.cmd run key:import -- ...`. `scripts/key-import.ts` does not implement `--from-env` despite the docs/plan.
2. **False DSH read claim.** `SettingsPage.tsx:120` says “DSH credential store is read only after explicit consent.” The runtime never reads DSH; `AGENTS.md`, README, and the code agree. This is a lying safety claim.
3. **Console 404.** A live Playwright pass on `/` logs `Failed to load resource: 404`; `web/index.html` declares no favicon and `web/public/` has no icon. The browser probes `/favicon.ico`.
4. **Unverified key-input hardening.** `scripts/key-import.ts` reads `--file` without regular-file/symlink/size checks; the plan promises `lstat` regular file ≤64 KiB. `readAppSecret()` also follows symlinks and has no size bound.
5. **Unused dependencies.** `@langchain/core` and `@langchain/langgraph` have zero imports in `src/`, `scripts/`, `test/`, or `web/` while the plan lists them as stack pins. This is install/code baggage and a truthful-stack claim mismatch.

## 3. UI audit evidence

Live Playwright pass (Chrome, 1440×1000, 390×844) on `/`, `/agents`, `/runs`, `/chat`, `/analysis`, `/scripts`, `/vault`, `/learning`, `/settings`, and one completed run detail:

- All routes returned HTTP 200; headings and controls rendered; mobile menu toggled `aria-expanded=false→true`; document overflow at 390 px was **0**.
- Console: one 404 on `/`; no page errors; no failed network requests.
- Run detail tabs: Overview, Files, Search, Checks, Routing, Context, Repairs, Confidence, Events; actions Refresh/Revise/Audit/Download/Open folder.
- Agents: 37 cards; no missing drawer/card controls observed.
- Settings/Overview: the false command and DSH copy above.

## 4. Decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Implement `--from-env` in the real script and show `npm.cmd run key:import -- --from-env` | Only change the UI to `--file/--stdin` | The plan promises env ingress; env is already the primary source and the operator expects it |
| Require regular non-symlink key files ≤64 KiB | Trust `readFileSync` | Matches the plan’s local-ingress safety contract and avoids device/symlink reads |
| Add the same bound to `readAppSecret` | Validate only at import | Runtime must not follow a swapped symlink or read an unbounded file |
| Add a real SVG favicon + link | Ignore the 404 | A console error on every page load is a defect |
| Remove unused LangChain deps | Keep for future | Zero imports; installed packages are attack/install surface and the plan’s stack claim is false |
| Correct current docs/UI to DSH-not-read | Implement DSH consent | AGENTS and code say DSH is not a runtime source; adding a DSH reader would be new scope |
| Keep capabilities absent where absent | Implement repo tools/tool loop/etc. | Explicitly out of scope; docs must say absent |

## 5. File-by-file change

### `scripts/key-import.ts`

- Add `--from-env`: read `process.env.DEEPSEEK_API_KEY`, trim, fail 4 `E_KEY_NOT_CONFIGURED` when absent.
- `readBoundedInput()` for file/stdin: `lstat` regular file, not symlink, size ≤65_536; stdin read as Buffer and byte-bounded.
- Keep key out of stdout; print configured/source/fingerprint only.
- Update usage text.

### `src/server/security/keys.ts`

- `readAppSecret()`: `lstat`, regular file, not symlink, size ≤65_536; return null otherwise.
- Keep 5s cache and no key logging.

### UI

- `SettingsPage.tsx` / `OverviewPage.tsx`: replace `hive key import --from-env` with `npm.cmd run key:import -- --from-env`; replace the DSH-read bullet with “DSH is not read at runtime; env or local app-secret only.”
- `web/index.html`: add SVG favicon link.
- `web/public/favicon.svg`: add a simple brand icon.

### Dependencies

- Confirm zero imports for `@langchain/core` / `@langchain/langgraph`; remove both from `package.json`/lockfile; update PLAN stack/pins and any docs that still name them as live stack.

### Docs

- `docs/PLAN-v3.md` §5: real key command, actual `data/secrets/deepseek.json` path, DSH-not-read; remove false DSH consent gate claim or mark it unimplemented.
- `docs/CAPABILITY-MATRIX.md`, `docs/STOP-WORK-FLAWS.md`, `README.md`: current key ingress, dependency set, and audit findings.
- `docs/TRACE/WAVE-15/`: control inventory, capability audit, defect table, evidence.

### Tests

- New `test/unit/key-ingress.test.ts`:
  - `--from-env` saves a dummy shape-valid test key to a temp `HIVE_DATA_DIR` and reports `app-secret`, not the key.
  - absent env refuses.
  - symlink/oversized file refuses.
  - `readAppSecret` ignores symlink/oversized.
  - clean up temp dir.
- E2E: Settings/Overview text does not contain `hive key import` or the DSH-read claim; `/favicon.svg` returns 200; console has no 404 on `/`.

## 6. Failure modes

| Failure | Expected |
|---|---|
| No env key | exit 4 `E_KEY_NOT_CONFIGURED`, no file written |
| Malformed key | exit 4 `E_KEY_INVALID`, no file write |
| Symlink / non-regular / oversize | named refusal, no read |
| App-secret swapped to symlink | `configured:false`, no key material |
| Missing favicon | no 404 console error after link/asset |
| Unused dependency still imported | removal blocked; keep and record |
| DSH file present | runtime still does not read it |
| No provider key | UI explains real local command; no HTTP key route |

## 7. Rollback

Restore the previous UI copy, remove `--from-env`/bounds, remove icon, re-add deps. No DB migration or API shape change.

## 8. Out of scope

- Repo tools, tool-call loop, approval, checkpoints, parallel generation, P7 evaluator, external repo index.
- Any paid provider call; any generated-code execution; any DSH reader.
