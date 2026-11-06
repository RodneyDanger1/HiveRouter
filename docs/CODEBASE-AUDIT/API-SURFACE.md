# API surface — all route registrations

Route handler registrations: **57**; unique API path strings: 53; stage route strings: 62 (53 API + 9 SPA).

| Line | Method | Path | Handler shape |
|---:|---|---|---|
| 157 | GET | `/openapi.json` | route composed in `src/server/app.ts` |
| 209 | GET | `/api/health` | route composed in `src/server/app.ts` |
| 221 | GET | `/api/meta` | route composed in `src/server/app.ts` |
| 231 | GET | `/api/settings` | route composed in `src/server/app.ts` |
| 239 | POST | `/api/settings/key` | route composed in `src/server/app.ts` |
| 240 | PUT | `/api/settings/key` | route composed in `src/server/app.ts` |
| 242 | GET | `/api/settings/key-status` | route composed in `src/server/app.ts` |
| 244 | POST | `/api/prompt/analyze` | route composed in `src/server/app.ts` |
| 280 | GET | `/api/agents` | route composed in `src/server/app.ts` |
| 290 | GET | `/api/agents/:id` | route composed in `src/server/app.ts` |
| 301 | PUT | `/api/agents/:id/prompt` | route composed in `src/server/app.ts` |
| 326 | DELETE | `/api/agents/:id/prompt` | route composed in `src/server/app.ts` |
| 334 | POST | `/api/agents/:id/run` | route composed in `src/server/app.ts` |
| 391 | GET | `/api/chat/threads` | route composed in `src/server/app.ts` |
| 398 | POST | `/api/chat/threads` | route composed in `src/server/app.ts` |
| 413 | GET | `/api/chat/threads/:id` | route composed in `src/server/app.ts` |
| 420 | POST | `/api/chat/threads/:id/messages` | route composed in `src/server/app.ts` |
| 448 | GET | `/api/chat/threads/:id/events` | route composed in `src/server/app.ts` |
| 456 | GET | `/api/chat/threads/:id/stream` | route composed in `src/server/app.ts` |
| 496 | POST | `/api/chat/jobs/:id/cancel` | route composed in `src/server/app.ts` |
| 508 | GET | `/api/runs/:id/routing` | route composed in `src/server/app.ts` |
| 601 | GET | `/api/runs/:id/context` | route composed in `src/server/app.ts` |
| 648 | GET | `/api/runs/:id/failures` | route composed in `src/server/app.ts` |
| 657 | GET | `/api/runs/:id/retries` | route composed in `src/server/app.ts` |
| 664 | GET | `/api/runs/:id/checks` | route composed in `src/server/app.ts` |
| 670 | GET | `/api/runs/:id/confidence` | route composed in `src/server/app.ts` |
| 678 | GET | `/api/stats/router` | route composed in `src/server/app.ts` |
| 688 | GET | `/api/analysis` | route composed in `src/server/app.ts` |
| 698 | POST | `/api/analysis/dominators` | route composed in `src/server/app.ts` |
| 710 | POST | `/api/analysis/scorecards` | route composed in `src/server/app.ts` |
| 722 | GET | `/api/ops/reports/:kind` | route composed in `src/server/app.ts` |
| 731 | GET | `/api/scripts` | route composed in `src/server/app.ts` |
| 746 | POST | `/api/scripts/:id/dry-run` | route composed in `src/server/app.ts` |
| 753 | GET | `/api/learning/overview` | route composed in `src/server/app.ts` |
| 758 | GET | `/api/learning/:kind` | route composed in `src/server/app.ts` |
| 775 | POST | `/api/learning/approvals` | route composed in `src/server/app.ts` |
| 847 | POST | `/api/learning/promotions` | route composed in `src/server/app.ts` |
| 874 | POST | `/api/learning/rollback` | route composed in `src/server/app.ts` |
| 896 | GET | `/api/vault/tree` | route composed in `src/server/app.ts` |
| 897 | GET | `/api/vault/file` | route composed in `src/server/app.ts` |
| 910 | GET | `/api/runs/:id/download` | route composed in `src/server/app.ts` |
| 934 | POST | `/api/runs/:id/search` | route composed in `src/server/app.ts` |
| 958 | POST | `/api/runs/:id/open-folder` | route composed in `src/server/app.ts` |
| 985 | GET | `/api/runs` | route composed in `src/server/app.ts` |
| 999 | POST | `/api/runs` | route composed in `src/server/app.ts` |
| 1061 | GET | `/api/runs/active` | route composed in `src/server/app.ts` |
| 1063 | GET | `/api/runs/:id` | route composed in `src/server/app.ts` |
| 1076 | GET | `/api/runs/:id/snapshot` | route composed in `src/server/app.ts` |
| 1093 | GET | `/api/runs/:id/events` | route composed in `src/server/app.ts` |
| 1125 | GET | `/api/runs/:id/stream` | route composed in `src/server/app.ts` |
| 1157 | POST | `/api/runs/:id/cancel` | route composed in `src/server/app.ts` |
| 1170 | POST | `/api/runs/:id/revise` | route composed in `src/server/app.ts` |
| 1208 | POST | `/api/runs/:id/resume` | route composed in `src/server/app.ts` |
| 1239 | GET | `/api/runs/:id/files` | route composed in `src/server/app.ts` |
| 1245 | GET | `/api/runs/:id/files/content` | route composed in `src/server/app.ts` |
| 1266 | GET | `/api/stats` | route composed in `src/server/app.ts` |
| 1335 | GET | `/api/ops/system` | route composed in `src/server/app.ts` |

## SPA paths — `web/src/App.tsx`

`/`, `/agents`, `/chat`, `/runs`, `/runs/:runId`, `/analysis`, `/scripts`, `/vault`, `/settings`, `/learning`, plus `*` NotFound.

The stage scanner counts 53 unique API paths + 9 SPA paths = 62. The 57 handler registrations include four paths with two HTTP methods:
- `/api/settings/key`: POST + PUT
- `/api/agents/:id/prompt`: PUT + DELETE
- `/api/chat/threads`: GET + POST
- `/api/runs`: GET + POST