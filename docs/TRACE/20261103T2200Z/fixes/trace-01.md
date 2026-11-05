# TRACE-01 receipt
Defect: agent detail lacked badges/evidence.
RED: 8787 detail badges empty, evidence 0; list registered,representative-live, 5 rows.
Fix: app.ts `toAgentView` shared by `/api/agents` and `/api/agents/:id`.
GREEN: unit trace-fixes detail parity; `e2e/trace-fixes.spec.ts` agent parity; 8788 detail badges=registered,representative-live evidence=5.
Files: `src/server/app.ts` sha256 4255EE3A00B6B1851C7C9ABDC5901B980626420CAA586DEEDD25435BED54D2E6.
