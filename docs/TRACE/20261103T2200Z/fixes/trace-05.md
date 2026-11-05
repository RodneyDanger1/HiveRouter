# TRACE-05 receipt
Defect: invalid preset/model/thinking accepted and queued.
RED: trace temp-DB probe created queued row with bogus enums (202).
Fix: shared constants + `E_INVALID_RUN_INPUT`; app.ts validates before createRun.
GREEN: unit invalid enums 422, no row; 8788 probe 422.
Files: `src/server/app.ts` 4255…D2E6; `src/shared/types.ts` 5F54…4790; `src/shared/refusals.ts` 0BF6…E7EA.
