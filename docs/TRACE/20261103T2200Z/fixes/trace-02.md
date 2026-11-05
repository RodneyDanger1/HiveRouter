# TRACE-02 receipt
Defect: `/api/runs/:id/routing` hardcoded candidates empty.
RED: 8787 candidatesTotal absent, firstCandidates=0; DB route_candidates had 4 rows.
Fix: app.ts queries route_candidates, maps fields, candidatesTotal and chosen.
GREEN: 8788 decisions=4 candidatesTotal=4 firstCandidates=1; unit routing test.
Files: `src/server/app.ts` sha256 4255EE3A00B6B1851C7C9ABDC5901B980626420CAA586DEEDD25435BED54D2E6.
