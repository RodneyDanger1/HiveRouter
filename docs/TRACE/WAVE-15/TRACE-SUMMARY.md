# Wave 15 — UI, capability, and truth audit evidence

Date: 2026-11-05
Baseline: `d2a4293` (451 tests / 70 files; 34/34 E2E; 202 stage files / 51 tables / 62 routes / 24 scripts)
Final: **455 tests / 71 files**, **36/36 E2E**, stage **204 files / 51 tables / 62 routes / 24 scripts**, `verify` exit 0, preflight PASS (free RAM 2.31 GB, disk 9.05 GB).

## Live UI audit

Chrome/Playwright at 1440×1000 and 390×844, on `/`, `/agents`, `/runs`, `/chat`, `/analysis`, `/scripts`, `/vault`, `/learning`, `/settings`, and one completed run detail.

- All nine routes returned HTTP 200; headings/controls rendered.
- Run detail: Overview, Files, Search, Checks, Routing, Context, Repairs, Confidence, Events; Refresh, Revise, Audit, Download, Open folder.
- Agents: 37 cards; drawer controls present.
- Mobile: `aria-expanded` false→true; document horizontal overflow **0**.
- Console: **one 404 on `/`** before the fix (browser favicon probe); **zero** after adding `web/public/favicon.svg` + `<link rel="icon">`; no page errors; no failed requests.

## Confirmed defects and fixes

| # | Defect | Root cause | Fix | Evidence |
|---|---|---|---|---|
| 1 | UI instructed `hive key import --from-env`; no `hive` binary, script lacked `--from-env` | Copy/contract drifted from the actual npm script | `Settings`/`Overview` now show `npm.cmd run key:import -- --from-env`; script implements it | Manual command, source env, exit 0; secret file in temp; key never printed |
| 2 | Settings claimed “DSH credential store is read only after explicit consent” | Stale plan claim; runtime never reads DSH | UI says “DSH is not read at runtime; env or local app-secret only”; PLAN updated; dead `E_DSH_*` codes and `dshCredentialsPath` removed | E2E text assertions; no DSH reader in code |
| 3 | Every page load logged a favicon 404 | No icon declared or served | Added SVG and `<link rel="icon">` | E2E root console check passes; `/favicon.svg` 200 |
| 4 | Local key input trusted symlinks/oversized files | Only `readFileSync`; no file bounds | `--file` requires regular non-symlink ≤64 KiB; `--stdin` bounded; runtime `readAppSecret` same bound/shape | `test/unit/key-ingress.test.ts` 4/4 |
| 5 | Unused LangChain/LangGraph dependencies | Never imported after architecture settled | Removed both from `package.json`/lockfile (21 packages) and from PLAN stack/pins | `rg` zero imports; build/tests pass |

## Capability audit — can / cannot

**Can:** bounded project planning; 37-agent registry with real contracts; file routing; generation; static verification; staged artifact retention; run ledger/events; FTS5 run search; static analysis API/page; scripts dry-run catalog; durable B2 chat with SSE; vault read; local key ingress via env or app-secret; honest P7 refusal.

**Cannot / absent:** repo read/search tools; autonomous tool-call loop; generated-code or test execution; approval/`needs_review` producer; mid-run checkpoints; bounded parallel generation; external repository index; P7 evaluator/promotion; native GUI/CUA driver; MCP/tool runtime; skills registry; multi-user/cloud; native `.exe`.

## Truth corrections

- Current docs no longer claim a DSH consent-gated read, `hive key import`, or LangChain/LangGraph in the stack.
- `STOP-WORK-FLAWS` P1-10/P1-11 updated to delivered review coverage and schema byte bound.
- `CAPABILITY-MATRIX` adds local key ingress with real bounds and no HTTP key route.
- `PLAN-v3` §5 key command/path and DSH status corrected; §5 SEC-02 marked not implemented.

## Verification

| Gate | Result |
|---|---|
| Focused key ingress | 4/4 |
| Full suite | 455 / 71 |
| E2E | 36 / 36 |
| Verify | exit 0; stub clean 104; secret clean 201 |
| Stage | 204 files / 51 tables / 62 routes / 24 scripts; violations [] |
| Preflight | PASS, RAM 2.31 GB, disk 9.05 GB |
| Key command | `npm.cmd run key:import -- --from-env` exit 0; temp app-secret written; output contained no key |

## Unverified / residual

- No paid live provider call; no live generation.
- No native CUA/GUI driver proof; Playwright + HTTP/DB is the interaction evidence.
- `npm audit --omit=dev` is **0 vulnerabilities** after upgrading `@fastify/static` to 10.1.10; no accepted-risk register exists yet.
- DSH consent/reader remains unimplemented and is now documented as such; the unused `dsh_key` consent scope is reserved P7 scaffolding.
- Key import saves an app-secret but the process environment still wins while set; the operator must clear `DEEPSEEK_API_KEY` to observe `source:"app-secret"`.
