# Wave 16 — client retry idempotency and chat fan-out evidence

Date: 2026-11-05
Baseline: `9e6fa21` (455 tests / 71 files; 36/36 E2E; 204 stage files / 51 tables)
Final: **455 tests / 71 files**, **38/38 E2E**, stage **204 files / 51 tables / 62 routes / 24 scripts**, `verify` exit 0, preflight PASS (free RAM 2.46 GB, disk 8.86 GB).

## Confirmed defects

1. **Retry duplicated paid work.** `startRun`/`runAgent` generated a fresh `Idempotency-Key` internally on every call. A server commit followed by a lost response, then a retry, created a duplicate run.
2. **Chat retry duplicated messages/jobs.** `ChatPage.send` generated a new key on every attempt. The UI also sent `agentIds: [single]` even though the backend accepts bounded multi-agent fan-out.
3. **Chat fan-out was claimed by the API/docs but absent from the UI.** The capability matrix now records the actual UI behavior.

## Fix

- `web/src/api.ts`: `startRun` and `runAgent` accept an optional caller key; default remains a new key.
- `web/src/components/RunComposer.tsx`: stable key per unchanged payload (`brief/preset/model/thinking/effort/maxCost`); new key after any edit.
- `web/src/pages/ChatPage.tsx`: stable send key per `thread + draft + selected agents`; native multi-select sends the selected `agentIds`; send disabled with zero agents.
- `web/src/pages/AgentsPage.tsx`: stable key per unchanged ad-hoc run payload.
- Server validation, budget, and replay behavior unchanged.

## Evidence

`e2e/ui-audit.spec.ts`:
- **composer reuses the idempotency key after a transport failure** — aborts both POST `/api/runs` attempts, captures both headers, asserts equality. No provider call.
- **chat exposes the backend multi-agent selection** — mocked thread/snapshot; 37 options; multi-select and Ctrl/Cmd help visible.

```
38 passed
```

Focused/full:
- Full suite: **455 / 71**
- E2E: **38 / 38**
- Verify: exit 0; stub clean 104; secret clean 201
- Stage: 204 files / 51 tables / 62 routes / 24 scripts; violations []
- Preflight: PASS, RAM 2.46 GB, disk 8.86 GB

## Residual / unverified

- Browser test proves header reuse on a **transport abort**, not a live server commit-then-lost-response; backend idempotency unit tests cover replay.
- Chat multi-select is proof of control existence and option count, not a live multi-job send; sending would create durable jobs/provider calls.
- Ad-hoc `runAgent` key reuse is code-reviewed, not browser-tested.
- Thread creation remains non-idempotent (not a paid provider mutation); recorded as residual.
- No paid provider call; no generated-code execution.
