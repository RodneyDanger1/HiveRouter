# LIVE-WAVE-6 — live HiveRouter test

## What was run

| # | Request | Run | Preset | Result | Cost |
|---|---|---|---|---|---|
| 1 | Evaluate HiveRouter itself, inspect all Runs records/app tabs, do not fabricate UI observations | `run_8c4a59741cebc8c94f` | adhoc `sentinel` | completed, 1 step, 1 artifact | $0.000263 |
| 2 | Small Word-like Python/Tkinter desktop app + tests + PyInstaller README | `run_bb9d241e1f94b6703a` | full-build | completed, 21 steps, 19 artifacts, 5 checks pass | $0.078417 |
| 3 | Safe Python/Tkinter calculator + tests + PyInstaller README | `run_12be61a462973c5d69` | full-build | completed, 17 steps, 14 artifacts, 5 checks pass | $0.035412 |
| 4 | Three.js Veemon tamagotchi browser prototype + chat/local key warning + README limitations | `run_c41f1fb4779d302af7` | full-build | completed, 14 steps, 14 artifacts, 5 checks pass | $0.051059 |

The app now has **30 persisted runs** (23 completed, 4 budget_exceeded, 3 failed), no active run, and no P7 data.

## Self-evaluation result

The `sentinel` prompt returned a structured `AGENT_OUTPUT.json` with a crucial honest answer:

- It had **no source, Runs records, or app-tab content supplied** in the ad-hoc invocation.
- It stated it **cannot perform UI observations or click-through verification** and that claiming those would be fabrication.
- Recommended routing UI/browser verification to an agent with browser/runtime access.

This confirms HiveRouter's agents are text-generation agents, not browser/computer-use agents. The Lead performed the actual UI inspection with Playwright: 7 app pages and all 8 tabs for 4 new runs (32 run-tab views), plus screenshots. All visible; the only console error was the known `/favicon.ico` 404.

## Generated apps

### Word-like app — source generated, no exe

`run_bb9d…` produced 19 artifacts: `README.md`, `src/main.py`, `src/app.py`, editor/document/file I/O/search/stats/formatting/dialogs/menubar/statusbar modules, and 5 unittest files. The README documents `python -m src.main` and a **PyInstaller one-file build command**:

```powershell
pip install pyinstaller
pyinstaller --onefile --windowed --name tk-wordpad --paths . src/main.py
```

The README explicitly says no executable was built. HiveRouter static checks passed (`syntax.all`, `stub.scan`, `secret.scan`, plan coverage). **No generated code was executed**, so runtime correctness and the claimed exe are not proven.

### Calculator app — source generated, no exe

`run_12be…` produced 14 artifacts: a Tkinter UI, AST allowlist parser, safe recursive evaluator (no `eval`/`exec`), history, keypad state machine, 5 test modules including edge cases, and a PyInstaller README. Static checks passed. Again, no executable was built and no generated tests were executed.

### Veemon Tamagotchi — browser prototype only

`run_c41f…` produced 14 artifacts: `index.html`, `styles/main.css`, Three.js scene/creature/input/stats/chat/UI modules, and 4 test files. It is a **procedural low-poly blue/white Veemon-like creature** using Three.js primitives, movement, status decay, a chat panel, and a user-supplied DeepSeek key in `localStorage` with a prominent security warning.

Its own README correctly lists what is **not implemented**:

- Windows `.exe`
- Accurate Digimon reference art
- Desktop overlay
- Crossing in front of all windows
- Icon manipulation
- Computer-use permissions

It also warns that browser key storage is not production-safe. The request for an accurate, reference-based Veemon, native overlay, computer use, and a Windows exe is beyond HiveRouter's static generation/verification boundary.

## What "works" means here

| Claim | Evidence |
|---|---|
| HiveRouter accepted and completed all 4 prompts | Run API statuses + artifacts above |
| UI tabs/pages render | Playwright: 22 baseline screenshots + 38 post-run screenshots; all 7 routes and 8 run tabs visible |
| Generated files are syntactically valid by static verifier | 5 checks pass on each; `syntax.all` covers 18/13/12 files |
| Source structure matches README claims | Files/tests inspected; README per app |
| An `.exe` was produced or executed | **No** — HiveRouter does not compile/execute generated code |
| Word/calculator/Veemon actually run correctly | **Unverified** — no generated-code execution by rule |
| Veemon art is accurate to Digimon World 2/ref images | **No** — no reference images/assets; procedural approximation only |
| Native overlay/computer use/icon manipulation | **No** — explicitly out of scope and listed missing in README |

## Evidence

- Baseline tabs: `docs/LIVE-WAVE-6/tab-audit.json`, `docs/LIVE-WAVE-6/evidence/` (22 screenshots).
- Post-run tabs: `docs/LIVE-WAVE-6/after-runs.json`, `docs/LIVE-WAVE-6/after/` (38 screenshots).
- Generated workspaces: `workspace/runs/run_bb9d241e1f94b6703a/`, `workspace/runs/run_12be61a462973c5d69/`, `workspace/runs/run_c41f1fb4779d302af7/`, `workspace/runs/run_8c4a59741cebc8c94f/`.
- Run API: `http://127.0.0.1:8787/api/runs/<id>`.

## Residual

- The `run_c41f…` prototype uses a CDN import map and browser key storage; it is a demo, not a production exe.
- No generated test suite was executed; static checks prove syntax/structure only.
- P7 learning remains refused; no promotion.
- The app's own agent cannot inspect the app; external browser evidence is the only valid UI proof.
