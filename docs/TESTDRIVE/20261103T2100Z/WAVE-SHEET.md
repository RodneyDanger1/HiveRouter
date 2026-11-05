# Wave sheet — TestDrive 20261103T2100Z

**App:** `C:\Users\Riley\Desktop\HiveRouter` · `http://127.0.0.1:8787` · phase B2.
**Skill:** `C:\Users\Riley\.agents\skills\testdrive\SKILL.md` (mirror `.dsh`).
**Key:** supplied key fingerprint `c30cfdbc`, env source, balance `$19.04`; never print/repeat the key.
**Baseline:** verify PASS; 17/17 E2E; stage strict; no active run; CUA 0.28.2 doctor OK; window 1440×780 not zoomed/iconic.
**Hard rules:** one writer per file; no mocks/stubs/test weakening; no key/server/install/git access for fixers; Lead owns restarts; evidence or it did not happen.

## Phase 1 — four fixers

| Seat | Teammate | Primary skill | Owned paths |
|---|---|---|---|
| `td-fix-ui` | `agent-native-ux` | smartfix + forge + capability-auditor + research | `web/src/pages/OverviewPage.tsx`, `SettingsPage.tsx`, `VaultPage.tsx`, `web/src/components/RunComposer.tsx`, `AppShell.tsx`, `web/src/styles.css` |
| `td-fix-core` | `logic-scripts` | logic-debugger + forge + capability-auditor + research | `src/server/runs/**`, `db/**`, `security/**`, `logic/**`, `pipeline/**`, `llm/**` |
| `td-fix-native` | `integration-architect` | agent-native-design + forge + capability-auditor + research | `src/server/app.ts`, `routes/**`, `verify/**`, `shared/**`, `scripts/**`, `config/releases/**`, `e2e/api-contract.spec.ts` |
| `td-fix-experience` | `deepseek-mechanisms` | agent-experience + forge + capability-auditor + research | `web/src/pages/AgentsPage.tsx`, `RunDetailPage.tsx`, `LearningPage.tsx`, `web/src/api.ts`, `web/src/api-types.ts`, `e2e/app.spec.ts`, `e2e/ui-audit.spec.ts` |

Each seat: read this sheet, `AGENTS.md`, testdrive skill, `TEST-CARDS.md`; sweep test-start blockers first; fix owned blockers/defects with RED→GREEN; write `logs/td-*.md`; report ≤50 lines. Do not touch another seat's files.

## Phase 2 — observation (after FIX1_GATE)

| Role | Teammate | Output |
|---|---|---|
| Driver | `learning-loop` | `driver.jsonl`, screenshots |
| UI watchdog | `watchdog` | `ui-watch.jsonl`, `ui-narrative.md` |
| Backend watchdog | `plan-audit-core` | `backend-watch.jsonl`, `backend-narrative.md` |
| Matcher | `algorithm-forge` | `timeline.json`, `mapping.md`, `defects.md` |

## Phase 3 — respawn same four fixers

Read `defects.md`, fix only owned IDs, RED→GREEN + regression test, rerun affected cards, update `fixes/<seat>.md`. Audit by `watchdog`.

## Gates

- FIX1_GATE: 4 reports; typecheck/build/tests; blockers resolved/BLOCKED.
- DRIVE_GATE: 8 cards attempted; driver/UI/backend/matcher phase-end; no active run; defects present.
- FIX2_GATE: all defects fixed/accepted; regression tests; affected cards rerun; full gates; no key leak.
