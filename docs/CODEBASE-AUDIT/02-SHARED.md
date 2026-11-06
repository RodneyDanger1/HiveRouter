# 02 Shared contracts — src/shared

Generated from the tracked tree and `CODE-INDEX.json`. Every row was read at least at head/target depth; full source path, imports, exports and role evidence are recorded.

| File | Lines | Role / first evidence | Imports (selected) |
|---|---:|---|---|
| `src/shared/algorithms.ts` | 724 | Convert a capability path glob to a deterministic workspace-relative matcher. | node:crypto, zod |
| `src/shared/chat.ts` | 164 | * Shared live-chat contracts. The server is the source of truth for every * projection; the web client consumes these shapes and never computes run/job * state locally. |  |
| `src/shared/features.ts` | 22 | (no extractable prose in first 64 KiB) | zod |
| `src/shared/prompt-analysis.ts` | 133 | Exact substring copied from the user prompt; required for source=user. | zod |
| `src/shared/refusals.ts` | 135 | (no extractable prose in first 64 KiB) |  |
| `src/shared/run-events.ts` | 109 | Every name the client registers a listener for. |  |
| `src/shared/types.ts` | 365 | Every input file the reviewer declares it inspected. Missing coverage is named by the gate. |  |