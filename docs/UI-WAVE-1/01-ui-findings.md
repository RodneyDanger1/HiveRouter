# UI / visual audit — seat 1 report (Lead-completed)

**Live app:** `http://127.0.0.1:8787` in system Chrome, 36→42 screenshots under `docs/UI-WAVE-1/shots/`.
**Primary finding:** `/api/agents` was an object (`{"0":...}`), so the Agents page correctly showed “No agents registered” and zero cards. Root cause was an OpenAPI response schema installed as a Fastify **serializer**; an object schema coerced the array. Fixed document-only; cards now 37.
**Other UI fixes:** agent-drawer Mode now has an explicit label/id + aria-label; composer draft persists in localStorage; desktop launcher `HiveRouter.lnk` starts the server and opens a 1440×780 Chrome app window centered in the 1600×860 work area (not zoomed/iconic); responsive matrix 42 checks across 1920/1600/1440×780/1366/1024/768/390 widths and six routes has zero failures.
**Evidence:** `docs/UI-WAVE-1/FINDINGS.md`, `docs/UI-WAVE-1/02-ui-api.md`, 10/10 UI audit E2E, 17/17 total E2E, screenshots `route-*`, `run-detail-*`, `overview-390`, `desktop-window.png`.
**Residual accepted:** 390px Recent runs table scrolls horizontally inside its wrapper; `schema-valid` badge has no evidence producer; the desktop window uses standard Chrome/Windows title-bar controls (not a frameless native executable).
