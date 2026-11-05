# TestDrive 20261103T2100Z — Driver account

**Driver:** `learning-loop` · **App:** `http://127.0.0.1:8787` · **Phase:** B2
**Profile:** `cua-driver browser_prepare` → isolated named profile `hive-testdrive`, `prepared_pid=17248`, browser window `15140156` (`HiveRouter — AI Agent Coding Router - Google Chrome`), native app window `9765866` (pid 11112).
**Posture:** CUA only; no Playwright, no shell-driven UI, no key read/print, no server restart, no destructive action.
**Artifacts:** `driver.jsonl` (37 records), 20 driver screenshots, this account.

## Card results

| Card | Result | Evidence |
|---|---|---|
| TD-01 launch/window/navigation | **UNVERIFIED** | Profile prepared and bound (`binding_quality=exact`); overview loaded; `/agents` shows 37; `/runs`, run detail, `/vault`, `/settings`, `/learning`, and `/missing-td` rendered (404 page visible). **Route pass is not claimed:** every post-navigation snapshot reported `page.title=about:blank`; per steering this downgrades the route assertions to UNVERIFIED. Native window is **1426×773**, not the wave baseline **1440×780** (14×7 px difference); on-screen and not minimized. No console evidence was exposed by the CUA state. |
| TD-02 composer validation | **PASS** | Empty brief → Start disabled; 5-char brief → Start disabled; 32-char brief + `Max run cost=0` → Start clicked; inline alert **“Max cost must be a positive number.”**; no POST/run (run count stayed 11, active null). Browser `browser_click` refused `route_unavailable` for the brief/preset; `browser_type` delivered the 32-char brief and cost `0`; `browser_click` delivered Start. Raw attempts recorded in `driver.jsonl`. |
| TD-03 blueprint live | **PASS** | Run `run_9b144184491ce0f41b`, preset blueprint, **COMPLETED**, cost **$0.00100005** < $0.05; `BLUEPRINT.md` artifact; run detail/report visible; no active run afterward. |
| TD-04 full-build live | **PASS** | Run `run_063580525bb149f98d`, preset full-build, **COMPLETED**, cost **$0.007642302** < $0.10; `src/math_td.py` + `tests/test_math_td.py`; Files tab shows both; 5 checks persisted, all pass, mandatory present; no gate fail. |
| TD-05 ad-hoc live | **PASS** | `python-engine` drawer; input `Write greet(name) returning Hello, name!`; target `src/td_adhoc.py`; live; max $0.03. Run `run_faf2600e5bf180b0dc`, **COMPLETED**, cost **$0.0003135**; artifact `src/td_adhoc.py`; run detail visible. |
| TD-06 revision live | **PASS** | Parent `run_063580525bb149f98d` → child `run_32b087305f87bfa8bf`, **COMPLETED**, cost **$0.00300495** < $0.05; feedback “Add a short module docstring, keep behavior”; parent `snapshotHash` unchanged (`19f380f5…`), parent still completed with 2 artifacts. |
| TD-07 security/learning refusal | **PASS** | Settings shows only Configured=Yes / Source=environment / Fingerprint=`c30cfdbc` / Balance (no key material); no `sk-` pattern in page text. Learning page tabs are disabled and shows **E_LEARNING_POOL_EXHAUSTED** + consent required. `POST /api/settings/key` → **403** `{"error":{"code":"FORBIDDEN_PROVIDER_KEY_ACCESS",...}}` (curl raw). `/api/learning/overview` → `enabled:false`, `E_LEARNING_POOL_EXHAUSTED`, `promotions:0`, `sealedBlocks:0`; `/api/learning/promotions` → `{"items":[]}`. No fake promotion. |
| TD-08 persistence/restart | **PARTIAL / BLOCKED** | Draft `TD-08 draft persistence test` + max cost `0.11` survived a full reload in the isolated profile. **Restart portion BLOCKED:** driver policy forbids server restart; Lead owns it. Therefore restart/DB-count/startup-interruption checks are UNVERIFIED. Run count before live cards = 11; after TD-03..TD-06 = 15, active null; no extra run. Native geometry remains 1426×773 vs 1440×780 baseline. |

## Backend cross-checks (read-only)

- Health `ok`, phase `B2`, DB `ok`, key configured/source environment (fingerprint only).
- 37 agents.
- Active run `null` before and after every live card; run count 11 → 15 exactly the four live-card runs.
- Live cost total **$0.011960802** across TD-03..TD-06 (per-card caps respected).
- No error/500 observed on the exercised route calls; no key ever printed or read by the driver.

## Stop / limitations

- TD-01 route assertions are **UNVERIFIED** because the post-navigation snapshot title stayed `about:blank`; headings showed the correct pages, but per steering title evidence is required for a pass. 404 content, 37-agent count, and screenshots are present.
- TD-08 restart is **BLOCKED by policy**, not failed; draft restoration passed.
- The isolated browser is 886×633 and the native app window is 1426×773, not the 1440×780 baseline. UI watchdog should decide whether this is a real layout defect or desktop scaling.
- `browser_click` returned `route_unavailable` for some page controls; `browser_type` and later `browser_click` worked. This is recorded as a CUA seam, not a product failure.

**phase_end** — 5 cards PASS (TD-02..TD-07), TD-01 UNVERIFIED, TD-08 PARTIAL/BLOCKED; no active run; no fake promotion.
