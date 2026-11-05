# Wave 16 — client retry idempotency and chat fan-out evidence

Date: 2026-11-05
Baseline: `9e6fa21` (455 tests / 71 files; 36/36 E2E; 204 stage files / 51 tables)
Final: **455 tests / 71 files**, **38/38 E2E**, stage **204 files / 51 tables / 62 routes / 24 scripts**, `verify` exit 0, preflight PASS (free RAM 1.72 GB, disk 8.76 GB).

## Confirmed defects

1. **Retry duplicated paid work.** `startRun`/`runAgent` generated a fresh `Idempotency-Key` internally on every call. A server commit followed by a lost response, then a retry, created a duplicate run.
2. **Chat retry duplicated messages/jobs.** `ChatPage.send` generated a new key on every attempt. The UI also sent `agentIds: [single]` even though the backend accepts bounded multi-agent fan-out.
3. **Chat fan-out was claimed by the API/docs but absent from the UI.** The capability matrix now records the actual UI behavior.
4. **Revision/audit retries created duplicate paid child runs.** `reviseRun`/`auditRun` still generated a new key per call.
5. **The chat selector allowed more agents than the server limit of 3.** The UI had no visible cap and could submit an oversized set that the server refused.

## Fix

- `web/src/api.ts`: `startRun` and `runAgent` accept an optional caller key; default remains a new key.
- `web/src/components/RunComposer.tsx`: stable key per unchanged payload (`brief/preset/model/thinking/effort/maxCost`); new key after any edit.
- `web/src/pages/ChatPage.tsx`: stable send key per `thread + draft + selected agents`; native multi-select sends the selected `agentIds`; send disabled with zero agents; selection capped by `/api/meta.chatMaxAgents` (server limit 3).
- `web/src/pages/RunDetailPage.tsx`: stable revise key per run+feedback and audit key per run, so an unchanged retry replays.
- `web/src/pages/AgentsPage.tsx`: stable key per unchanged ad-hoc run payload.
- `/api/meta` exposes `chatMaxAgents` from `config.chat.maxAgentsPerMessage`; `MetaResponse` carries it.
- Server validation, budget, and replay behavior unchanged.

## Evidence

`e2e/ui-audit.spec.ts`:
- **composer reuses the idempotency key after a transport failure** — aborts both POST `/api/runs` attempts, captures both headers, asserts equality. No provider call.
- **chat exposes the backend multi-agent selection** — mocked thread/snapshot; 37 options; native multi-select; help shows `1 of 3 selected`; Ctrl/Cmd help visible.

```
38 passed
```

Focused/full:
- Full suite: **455 / 71**
- E2E: **38 / 38**
- Verify: exit 0; stub clean 104; secret clean 201
- Stage: 204 files / 51 tables / 62 routes / 24 scripts; violations []
- Preflight: PASS, RAM 1.72 GB, disk 8.76 GB

## Residual / unverified

- Browser test proves header reuse on a **transport abort**, not a live server commit-then-lost-response; backend idempotency unit tests cover replay.
- Chat multi-select is proof of control existence and option count, not a live multi-job send; sending would create durable jobs/provider calls.
- Ad-hoc `runAgent` and revision/audit key reuse are code-reviewed, not browser-tested.
- The chat cap is proven in the control text; a 4-agent selection refusal was not browser-driven.
- Thread creation remains non-idempotent (not a paid provider mutation); recorded as residual.
- No paid provider call; no generated-code execution.
