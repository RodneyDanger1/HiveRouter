# TRACE-03 receipt
Defect: revision files[] stored but ignored; write raced createRun.
RED: static grep found `revision_files` only as a write; pipeline read all parentFiles.
Fix: app validates selection and passes `metadata.revisionFiles`; pipeline `revisionFilesForRun` filters.
GREEN: unit filters A from [A,B], no-scope all, invalid selection throws E_INVALID_REVISION_SCOPE.
Files: `src/server/app.ts` 4255…D2E6; `src/server/pipeline/run.ts` 88E0…D97B.
