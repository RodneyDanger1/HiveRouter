# UI/API seam audit — round 2 (Lead-completed dropped seat)

## Surface matrix

| Surface | Contract | Live evidence | Verdict |
|---|---|---|---|
| `GET /api/agents` | JSON array, 37 AgentView rows | `Object[]`, 37; browser cards 37 | PASS after UI-001 |
| `GET /api/agents/:id` | AgentView object or 404 named | 404 `E_UNSUPPORTED_AGENT` for missing | PASS |
| `POST /api/agents/:id/run` | 202 run id; 422 mock/target/idempotency refusals | UI test pins live/mock states; mock refused | PASS (seam) |
| `GET /api/learning/overview` | `enabled:false` + `E_LEARNING_POOL_EXHAUSTED` with 0 blocks | E2E asserts exact refusal | PASS |
| `GET /openapi.json` | OpenAPI 3.1.0, every operation typed 2xx/4xx | 43/43 operations have content schemas | PASS |
| UI routes | seven routes render, console-clean, no key material | 16/16 E2E | PASS |
| Run detail | tabs, files, checks, routing/context/repairs/confidence/events, actions | UI audit 9/9; screenshots | PASS |
| Vault/Settings | tree/file, key source/fingerprint, stage/trust | UI audit | PASS |
| Refusals | provider-key route closed, missing idempotency 422, missing run named | E2E API contract | PASS |

## Defects found and fixed

- **UI-001 P1** — array serialization through an object response schema; fixed by making OpenAPI schemas document-only.
- **UI-002 P2** — agent drawer Mode label; fixed with explicit label association + aria-label.
- **UI-006 P1** — OpenAPI operations had no response schemas; fixed with typed content on every operation.
- **UI-007 P1** — TSX/JSX RVS availability; fixed; live TSX build passed.

## Residual

- 390px table horizontal scroll (data reachable).
- `schema-valid` badge no producer (honest absence).
- Paid UI flows (revise/audit/ad-hoc) were validated as seams/UI states in this wave; live provider spend was limited to the TSX build and micro smoke.
