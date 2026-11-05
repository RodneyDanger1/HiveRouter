# UI / Visual Wave 1 — findings and fixes

**Lead completed the dropped seats solo.** Live app: `http://127.0.0.1:8787`. Evidence: `docs/UI-WAVE-1/shots/` (36 screenshots), `e2e/ui-audit.spec.ts` (9 tests, all passing), full E2E 16/16 after fixes.

| ID | Severity | Route / control | Expected | Actual (observed) | Fix | Owner |
|---|---|---|---|---|---|---|
| UI-001 | **P1** | `/agents`, every agent card | JSON array of 37 agents rendered as cards | Server returned `{"0":...}` object; page said "No agents registered"; cards = 0 | Removed Fastify `onRoute` **response-schema mutation** (it serialized arrays through an object schema); schemas are now added only to the OpenAPI document | backend (Lead) |
| UI-002 | **P2** | Agent drawer → Mode select | Accessible name `Mode` | `getByLabel(/^Mode$/i)` found 0; wrapping label name included both options | Added explicit `id`/`htmlFor` + `aria-label="Mode"` | UI (Lead) |
| UI-003 | P3 | 390px nav close | one visible Close control | strict-mode duplicate (topbar + scrim) | test uses `.first()`; product has two intentional close targets | test |
| UI-004 | P3 | `/learning` refusal copy | honest "unavailable" copy | copy says "Learning is unavailable" (accurate) while test expected "off/limited" | broadened the assertion; product copy unchanged | test |
| UI-005 | P3 | 390px Recent runs | no lost columns | table scrolls horizontally inside `.table-wrap`; full-page screenshot clips the scroll viewport | accepted: data is reachable by horizontal scroll; a card layout on mobile is a future enhancement | UI (accepted) |
| UI-006 | **P1** | `/openapi.json` | every operation has typed 2xx/4xx response schemas | components existed but 0/43 operations referenced them | `decorateOpenApiDocument` adds typed JSON responses; 43/43 operations now have content schemas | backend (Lead) |
| UI-007 | **P1** | Full-build React/TSX | valid TSX passes; invalid TSX fails | `availableChecks` omitted `syntax.tsx`/`syntax.jsx`, so RVS marked them unverified and the gate failed every TSX file | added both IDs; verifier fail-closed behavior retained; live `ui-build` run `run_b8a8e239a57052f146` completed with `syntax.all: pass`, `verification.plan: pass` | backend (Lead) |
| UI-008 | P2 | `assert-stage` | package-script allowlist enforced | UTF-8 BOM made `JSON.parse` throw; catch returned `[]`, so `scripts:0` fake-green | package.json rewritten without BOM; `assert-stage.mjs` strips BOM and fails closed; now `scripts:23`, violations `[]` | backend (Lead) |
| UI-009 | P2 | `/api/agents` badges | only evidence-backed badges | no producer mints `schema-valid` (so 0/37); `representative-live` evidence-backed | accepted honest absence; no fake badge. A future `agents:verify` can mint schema-valid evidence | accepted |
| UI-010 | P3 | Overview/Settings "Learning enabled" | phase-capability vs live readiness | stage says enabled while `/learning` refuses (pool empty) | the Learning page is explicitly refused; Overview/Settings label phase capability. Copy note is a future enhancement | accepted |
| UI-011 | **P2** | Desktop launch | an app window appears on the desktop, server starts if needed, layout fits screen | no shortcut existed; the first launcher hung before starting the server | added `scripts/launch-desktop.ps1` + `HiveRouter.lnk`; simplified `Start-Process npm start` with `-RedirectStandardOutput`; verified auto-start from a stopped server; window 1440×780 centered in the 1600×860 work area | UI (Lead) |
| UI-012 | P2 | Composer memory | brief/preset/model/thinking/effort/max-cost survive reload | blank composer after reload | persisted a validated draft in `localStorage` (`hive.composer.v1`); dedicated Chrome profile keeps it across desktop launches | UI (Lead) |
| UI-013 | P3 | Responsive sizing | no page-level horizontal overflow / clipped shell at common sizes | only 1440 was checked | layout matrix at 1920×1080, 1600×900, 1366×768, 1024×768, 768×1024, 390×844 × 6 routes = 36 checks, 0 failures; 390px run table scrolls inside its wrapper | UI (Lead) |

## UI/API seam verdicts

- All seven routes render a heading, no console/page errors, no key material (`sk-…`) in the DOM.
- Overview: composer has 3 selects + max-cost input; start disabled until a brief; effort select appears on thinking-enabled.
- Agents: 37 cards, search filters, drawer contract/evidence/full prompt, edit/reset, ad-hoc live/mock (mock disabled+refused), target/budget controls.
- Runs/detail: 8 tabs, file viewer, revise/audit dialogs, download, open-folder, terminal/running states, missing-run refusal.
- Learning: honest `E_LEARNING_POOL_EXHAUSTED`; tabs disabled; no fake metrics.
- Vault/Settings: tree/file preview, key status/fingerprint only, phase/trust.
- Backend seam: `/api/meta` B2; `/api/agents` array 37; missing agent 404 `E_UNSUPPORTED_AGENT`; missing idempotency 422 `E_IDEMPOTENCY_KEY_REQUIRED`; provider-key route 403; `/openapi.json` JSON 3.1.0.

## Unverified / accepted

- 390px table is horizontally scrollable rather than reflowed to cards.
- `schema-valid` badge has no producer; no badge is shown (honest).
- Live paid UI flows (revise/audit/ad-hoc) were exercised by the Lead in earlier sessions; this UI wave did not spend on them.
- Visual QA was headless system Chrome at 1440/1024/390; no human color/contrast tooling.
