# td-fix-ui FIX2 — TD1-D09

**Status: DONE.** Scope: `web/src/pages/RunDetailPage.tsx`, `web/src/hooks/useApi.ts`, `e2e/ui-audit.spec.ts`. No server restart, key access, installs, or paid runs.

## Defect
A completed/terminal run detail still showed the **Live stream** badge and opened `/api/runs/:id/stream`; the stream stayed open even though terminal state is immutable.

## RED (live completed run)
Command: `node docs/TESTDRIVE/20261103T2100Z/fixes/td-fix2-probe.mjs` (temp probe, now removed).
```
RUN run_32b087305f87bfa8bf completed
LIVE_STREAM_VISIBLE true
COMPLETE_SNAPSHOT_VISIBLE false
STREAM_REQUESTS 1
```
Root cause: `RunDetailPage.tsx` called `useRunStream(runId ?? null, …)` before checking `terminal`, and the badge was derived from `streamStatus`, so a terminal run consumed the SSE and remained “Live stream”.

## Fix
- `web/src/pages/RunDetailPage.tsx:126–153` — compute `run`/`terminal` before the hook; `useRunStream(run && !terminal ? runId ?? null : null, …)`. Terminal runs never open an SSE; the existing hook cleanup closes any prior `EventSource` when the target becomes null.
- `web/src/pages/RunDetailPage.tsx:148–153,321–323` — terminal badge: completed → **Complete · snapshot**; other terminal states → **Terminal · snapshot**; no terminal path can render “Live stream”.
- `web/src/pages/RunDetailPage.tsx:474` — timeline copy now distinguishes active stream vs terminal snapshot-only.
- `web/src/hooks/useApi.ts` — no change required; its `!runId` branch sets `closed` and its cleanup closes the source.
- `e2e/ui-audit.spec.ts:135–143` — records `/stream` requests before navigation; asserts **Complete · snapshot** visible, **Live stream** badge absent, and `0` SSE requests for the completed run.

## GREEN
```
RUN run_32b087305f87bfa8bf completed
LIVE_STREAM_VISIBLE false
COMPLETE_SNAPSHOT_VISIBLE true
STREAM_REQUESTS 0
```
- `npx playwright test e2e/ui-audit.spec.ts` → **12/12 passed**.
- `npx playwright test e2e/app.spec.ts --grep=.` → **3/3 passed**.
- `npm.cmd run typecheck` → PASS.
- `npm.cmd run build` → PASS (2328 modules, 2.29 s).

## Residual
- Active runs still open the SSE after the initial snapshot proves non-terminal; terminal runs do not. This is the intended boundary.
- No server restart; Lead owns the final restarted-server gate.
- No paid run used to test; the completed run was read-only.
