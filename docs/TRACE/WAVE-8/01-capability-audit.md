# Wave 8 capability audit — scripts surface

## Inventory

| Surface | Control / route | Render | Handler | Client | Route | Service | Verdict |
|---|---|---|---|---|---|---|---|
| `/scripts` | page heading, 8 rows | `web/src/pages/ScriptsPage.tsx` | page loader | `getScripts` → `GET /api/scripts` | `src/server/app.ts:711` | static catalog; no execution | WIRED-AND-WORKS |
| `/scripts` | Dry-run button per read script | `ScriptsPage.tsx` | `runDry` | `dryRunScript` → `POST /api/scripts/:id/dry-run` | `src/server/app.ts:726` | returns command string; no spawn | WIRED-AND-WORKS |
| `/scripts` | Bench/learn "Not dry-runnable" | `ScriptsPage.tsx` | disabled | none | server refuses if called directly | `E_SCRIPT_DRY_RUN_UNSUPPORTED` 422 | WIRED-AND-REFUSED |
| `/scripts` | nav entry | `AppShell.tsx` NAV | router link | n/a | SPA route `/scripts` | `app.ts` known SPA list | WIRED-AND-WORKS |
| API | `GET /api/scripts` | n/a | n/a | n/a | allowlisted in `config/releases/p7.json` | 8 entries | WIRED-AND-WORKS |
| API | `POST /api/scripts/:id/dry-run` | n/a | n/a | n/a | allowlisted | 6 allow / 2 refuse / unknown refuse | WIRED-AND-WORKS |

## Capability gaps found

1. **No scripts UI existed** — the route and API were present but unreachable from the console (P1-10). Fixed in this wave.
2. **The phrase "dry-run" could be read as execution** — the API returns only `Run locally: …`; the new page labels this explicitly and has a "What this page does not do" panel. No code execution added.
3. **Paid scripts had no visible explanation** — now listed with `paid` badge and disabled action; direct POST is still refused.

## Not claimed

- Typed script inputs and schema-driven argument forms are not implemented.
- The page does not expose arbitrary script execution.
- CUA native click proof for Chromium content is **UNVERIFIED**; see `02-live-trials.md`.

## Census

- SPA routes: 10 (`/`, `/agents`, `/chat`, `/runs`, `/runs/:id`, `/analysis`, `/scripts`, `/vault`, `/settings`, `/learning`).
- Server routes in P7 manifest: 62.
- Stage files: 195.
