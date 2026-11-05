# Wave 16 decision plan — client retry idempotency and chat fan-out wiring

Date: 2026-11-05
Owner: HiveRouter lead
Baseline: `9e6fa21` (455 tests / 71 files; 36/36 E2E; 204 stage files / 51 tables / 62 routes / 24 scripts)
Scope: user-requested integration-logic repair of paid retry paths and the incomplete chat UI.

## Execution status

Implemented and verified. Composer/agent/chat submissions bind one idempotency key to one unchanged payload; chat exposes multi-agent selection and sends the selected `agentIds`. E2E: transport abort reuses the header; chat multi-select shows 37 options. Final: **455 tests / 71 files**, **38/38 E2E**, stage **204**, preflight PASS. Evidence: `docs/TRACE/WAVE-16/TRACE-SUMMARY.md`.

## 1. Outcome

A failed run/agent/chat submission that is retried unchanged sends the **same** `Idempotency-Key`, so the server returns the original resource instead of creating a duplicate. The chat UI exposes the backend’s multi-agent fan-out directly. A successful submission or edited payload gets a new key.

## 2. Current behavior (evidence)

- `web/src/api.ts:startRun` calls `newIdempotencyKey()` internally; `RunComposer.submit` calls it again per click. A transport failure after server commit, followed by a retry, sends a new key and creates a duplicate run.
- `web/src/api.ts:runAgent` and `reviseRun`/`auditRun`/`resumeRun` have the same per-call key pattern; the drawer run path can duplicate a paid ad-hoc run on retry.
- `web/src/pages/ChatPage.tsx:194-207` sends `{ content: draft, agentIds: [sendAgentId] }` with a fresh key each attempt. It never exposes `config.chat.maxAgentsPerMessage` fan-out.
- Backend already enforces idempotency (`POST /api/runs`, `/agents/:id/run`, chat messages) and validates fan-out (`src/server/chat/store.ts:267-279`).
- Tests: API idempotency unit tests exist; no browser network proof that the UI reuses a key, and no UI fan-out test.

## 3. Decisions

| Decision | Alternative rejected | Why |
|---|---|---|
| Add optional `idempotencyKey` to `startRun`/`runAgent` and let the caller own retry identity | Keep generating inside API and retry blindly | Only the caller knows whether the payload changed |
| Generate the key from a stable payload signature in the component | Persist a key indefinitely | A key is valid once per body; success must produce a fresh key |
| Reuse the same key after a transport failure | Disable retry | Retry is desirable but must be single-effect |
| Use a native multi-select in Chat (`multiple`) | 37 checkboxes / separate fan-out API | Compact, accessible, matches existing control vocabulary |
| Keep the server as the validator of max agents, budget, and idempotency | Reimplement limits in React | Avoid drifted client-side policy |
| Test retry with Playwright request interception | Spend real money | Route abort captures headers without provider spend |
| Leave create-thread idempotency out of scope | Add a new backend contract this wave | Not a paid mutation; record it as residual |

## 4. File-by-file change

### `web/src/api.ts`

- `startRun(input, signal?, idempotencyKey = newIdempotencyKey())`.
- `runAgent(agentId, input, signal?, idempotencyKey = newIdempotencyKey())`.
- Existing callers keep working; caller-supplied keys override.
- No server/API shape change.

### `web/src/components/RunComposer.tsx`

- Import `useMemo` and `newIdempotencyKey`.
- `const requestKey = useMemo(() => newIdempotencyKey(), [brief, preset, model, thinking, effort, maxCostUsd]);`
- Pass `requestKey` to `startRun`.
- On successful start, navigate; on failure, keep the key so an unchanged retry replays.
- Editing any field regenerates the key.

### `web/src/pages/ChatPage.tsx`

- Replace `sendAgentId` with `sendAgentIds: string[]` (at least one required).
- On thread change, default to `[selectedThread.agentId]`.
- Render `<select multiple size={5}>` under “Answer as (Ctrl/Cmd-click for multiple)”; selected values map to `sendAgentIds`.
- `send()` posts `agentIds: sendAgentIds` and `useMemo` key over `[selectedId, draft, sendAgentIds]`.
- Disable send when no agent selected; show selected count.
- Do not alter backend fan-out/limits.

### `web/src/pages/AgentsPage.tsx`

- `runKey = useMemo(..., [agentId, runInput, runMode, runTarget, runBudget])`; pass to `runAgent`.
- New key after a successful navigation or payload edit.

### E2E

- `composer retry reuses the idempotency key`: intercept `POST /api/runs`, abort the first attempt, capture both headers after a second click, assert equal. No provider call.
- `chat fan-out control is reachable`: intercept thread/snapshot GETs with a minimal projection and assert the multi-select and its help text; no message send.
- Keep the suite at 36+ tests.

### Docs

- `docs/TRACE/WAVE-16/TRACE-SUMMARY.md`.
- `docs/PLAN-v3.md` §35, `docs/CAPABILITY-MATRIX.md` chat row, `docs/BACKLOG.md`, README counts/fan-out note.

## 5. Failure modes

| Failure | Expected |
|---|---|
| First request aborts before commit | Retry same key creates one run |
| First request commits then transport fails | Retry same key replays original run |
| User edits brief between attempts | New key; new run allowed |
| No agent selected in chat | Send disabled; no empty `agentIds` request |
| Two agents selected | Server queues one job per agent |
| More than max agents | Server `E_CHAT_INVALID_INPUT`; UI shows refusal |
| Successful send | Draft clears; next send gets a new key |
| Success but response lost | Same key replay returns original job ids |

## 6. Tests and commands

```powershell
npx playwright test e2e/ui-audit.spec.ts
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run e2e
npm.cmd run assert-stage -- --stage=p7 --json
npm.cmd run preflight -- --port 0 --json
```

Acceptance: browser capture proves key reuse on unchanged retry; multi-agent control renders and sends the selected set; full gates unchanged.

## 7. Rollback

Remove optional key parameters, restore single-agent selection, delete the new E2E tests. No DB migration or server API change.

## 8. Out of scope

- Thread-creation idempotency (not paid; no key route currently).
- Generic automatic retry/backoff; approval, repo tools, tool loop, checkpoints, P7.
- Any paid provider call.
