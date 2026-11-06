# 03 Web console — web/src

Generated from the tracked tree and `CODE-INDEX.json`. Every row was read at least at head/target depth; full source path, imports, exports and role evidence are recorded.

## Page and control map

| Surface | Component | Client path | Main state / actions |
|---|---|---|---|
| Shell | `components/AppShell.tsx` | meta/health | nav, mobile toggle, status/stage chips |
| Overview | `pages/OverviewPage.tsx` | `getStats`, `listRuns`, key status | composer, stats/unknown notice, recent runs |
| Agents | `pages/AgentsPage.tsx` | `/api/agents`, prompt PUT/DELETE, agent run POST | filters, 37 cards, drawer edit/save/reset/run |
| Runs | `pages/RunsPage.tsx` | `/api/runs?status` | status filter, rows, links |
| Run detail | `pages/RunDetailPage.tsx` | snapshot/events/search/files/actions | 9 tabs, revise/audit/resume/stop/download |
| Chat | `pages/ChatPage.tsx` | threads/messages/cancel/SSE | thread select, agent fan-out cap, send, job state |
| Analysis | `pages/AnalysisPage.tsx` | `/api/analysis*` | dominators, scorecards, named refusal |
| Scripts | `pages/ScriptsPage.tsx` | `/api/scripts*` | catalog, read-only dry-runs, paid disabled |
| Vault | `pages/VaultPage.tsx` | `/api/vault*` | tree, preview, refresh |
| Settings | `pages/SettingsPage.tsx` | settings/key-status | key fingerprint, phase, refresh |
| Learning | `pages/LearningPage.tsx` | `/api/learning*` | disabled/refusal state, no promotion in this build |

| File | Lines | Role / first evidence | Imports (selected) |
|---|---:|---|---|
| `web/src/App.tsx` | 53 | (no extractable prose in first 64 KiB) | ./api, ./components/AppShell, ./context, ./hooks/useApi |
| `web/src/api-types.ts` | 371 | (no extractable prose in first 64 KiB) | @shared/prompt-analysis, @shared/types |
| `web/src/api.ts` | 699 | keep text | ./api-types, @shared/chat, @shared/refusals, @shared/run-events |
| `web/src/components/AppShell.tsx` | 217 | (no extractable prose in first 64 KiB) | ../context, ./ui, lucide-react, react |
| `web/src/components/CodeViewer.tsx` | 88 | (no extractable prose in first 64 KiB) | ./ui, lucide-react, prism-react-renderer |
| `web/src/components/PromptAnalysisCard.tsx` | 155 | (no extractable prose in first 64 KiB) | @shared/prompt-analysis, lucide-react |
| `web/src/components/RunComposer.tsx` | 292 | (no extractable prose in first 64 KiB) | ../api, ../api-types, ./PromptAnalysisCard, ./ui |
| `web/src/components/RunTable.tsx` | 52 | (no extractable prose in first 64 KiB) | ./ui, @shared/types, lucide-react, react-router-dom |
| `web/src/components/ui.tsx` | 693 | While a mutation is in flight the modal owns the outcome and cannot be dismissed. | ../api, @shared/types, lucide-react, react |
| `web/src/context.tsx` | 21 | (no extractable prose in first 64 KiB) | ./api, ./api-types, react |
| `web/src/hooks/useApi.ts` | 126 | retain raw text | ../api, ../api-types, @shared/run-events, react |
| `web/src/hooks/useChatStream.ts` | 65 | (no extractable prose in first 64 KiB) | @shared/chat, react |
| `web/src/main.tsx` | 16 | (no extractable prose in first 64 KiB) | ./App, react, react-dom/client |
| `web/src/pages/AgentsPage.tsx` | 534 | (no extractable prose in first 64 KiB) | ../api, ../api-types, ../components/CodeViewer, ../components/ui |
| `web/src/pages/AnalysisPage.tsx` | 319 | (no extractable prose in first 64 KiB) | ../api, ../api-types, ../components/ui, lucide-react |
| `web/src/pages/ChatPage.tsx` | 452 | (no extractable prose in first 64 KiB) | ../api, ../api-types, ../components/ui, ../context |
| `web/src/pages/LearningPage.tsx` | 733 | (no extractable prose in first 64 KiB) | ../api, ../api-types, ../components/ui, ../hooks/useApi |
| `web/src/pages/NotFoundPage.tsx` | 19 | (no extractable prose in first 64 KiB) | ../components/ui, react-router-dom |
| `web/src/pages/OverviewPage.tsx` | 282 | (no extractable prose in first 64 KiB) | ../api, ../components/RunComposer, ../components/RunTable, ../components/ui |
| `web/src/pages/RunDetailPage.tsx` | 1248 | (no extractable prose in first 64 KiB) | ../api, ../api-types, ../components/CodeViewer, ../components/ui |
| `web/src/pages/RunsPage.tsx` | 78 | (no extractable prose in first 64 KiB) | ../api, ../components/RunTable, ../components/ui, ../hooks/useApi |
| `web/src/pages/ScriptsPage.tsx` | 188 | (no extractable prose in first 64 KiB) | ../api, ../api-types, ../components/ui, ../hooks/useApi |
| `web/src/pages/SettingsPage.tsx` | 178 | (no extractable prose in first 64 KiB) | ../api, ../api-types, ../components/ui, ../context |
| `web/src/pages/VaultPage.tsx` | 136 | (no extractable prose in first 64 KiB) | ../api, ../api-types, ../components/ui, ../hooks/useApi |
| `web/src/styles.css` | 1075 | @import "tailwindcss"; @theme { --color-canvas: #FAF9F5; --color-ink: #0B1325; --color-ink-soft: #1B2740; --color-hairline: #E5E1D8; --color-amber: #B7791F; --color-paper: #FFFFFF; --font-display: "Instrument Serif", Geo |  |
| `web/src/vite-env.d.ts` | 2 | (no extractable prose in first 64 KiB) |  |