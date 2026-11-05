# TRACE-04 receipt
Defect: schema-valid badge had no producer.
RED: live agent_evidence only representative-live 27; schema-valid 0; grep no producer.
Fix: pipeline `recordAgentEvidence` always inserts schema-valid; representative-live additionally when applicable.
GREEN: unit records a router step and asserts `['schema-valid']`.
Files: `src/server/pipeline/run.ts` sha256 88E027C82E7C4B201883EAC6C67CE993E3C74C0CFB653B78A91ADB8AC3F9D97B.
