# TRACE-06 receipt
Defect: terminal run Events tab ignored persisted events.
RED: completed run had 322 persisted events; UI showed “No live events observed”, no `/events` request.
Fix: `getRunEvents` + shared mapper; RunDetailPage loads persisted events for terminal and renders loading/error/rows.
GREEN: `e2e/trace-fixes.spec.ts` 2 passed on rebuilt 8788; mapper unit test passed; build exit 0.
Files: `web/src/api.ts` 476D…D908; `web/src/pages/RunDetailPage.tsx` 56C7…A435; `src/shared/run-events.ts` 23C0…C602E.
