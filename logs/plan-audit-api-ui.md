# plan-audit-api-ui — journal

HEAD: `C:\Users\Riley\Desktop\HiveRouter\docs\PLAN-v2.md` SHA256 `8AD841C5F572A23DAFCF5254A98F9E81B37F6D8BC7AE0B806D6BDEC146B518F2`
WAVE-SHEET SHA256 `C5724D2F51671E74DC840F415EC3234CFF3405AA5E726D615CE973A8D23316FA`
Scope: §5, §11, §12, §14, §16 (seat 2), interpreted against v2 §8 amendments, §6.9, §7.6, §14. No product edits.
Budget: 15 min work + 5 min check. Start 09:22:36; journal 09:27-09:36 America/Chicago.
Status: WORKING -> DONE.

## Phase 1 (logic-gatekeeper, before document mutation)
```json
{"phase1":{"architecture":"Plan v2 is text; the API/UI seam is the contract layer between UI controls, Fastify routes, services, node:sqlite/SSE, and rendered state.","dataFlow":"UI control -> client -> /api route -> service -> SQLite/SSE -> render; plan v2 defines named routes, an envelope, and UI tabs but omits several binding primitives.","edgeCases":["promotion without an approval-token issuance route","SSE reconnect after the 500-event window with no snapshot route","Release A build containing a P6a/P7 route","duplicate paid evaluation retry without Idempotency-Key semantics"],"rootCause":"The plan names UI actions and API surfaces but does not pin the authority-issuance, replay, feature-gating, idempotency, and control-precondition contracts, so enactment produces unreachable controls, unverifiable stages, and duplicate side effects."}}
```

## 09:22 — research / compare
- Read `docs/PLAN-AUDIT/WAVE-SHEET.md` (41 lines) and `docs/PLAN-v2.md` (454 lines); repo is empty except audit workspace.
- Cross-checked v1 §11/§12 (from Lead context) against v2 §8 patches, §6.9, §7.6, §14.
- Confirmed WAVE-SHEET scope numbering does not match v2: v2 §11=DoD, §12=assumptions, §16=diagrams, while API/UI content is v2 §8 patches + §6.9/§7.6/§14. Recorded as cross-section contradiction.

## 09:27 — findings (RED probes are plan-level contract tests; no runtime exists)
- A1 P0: no approval-token issuance route; promotion/rollback unreachable or authority is fabricated.
- A2 P0: no SSE snapshot route/envelope; 500-event replay window not enforceable; `/events` vs `/stream` undefined.
- A3 P0: no feature gating for Release A "zero P6/P7 artifacts"; staging gate untestable.
- A4 P1: `/api/scripts` "read-only/dry-run" has no method or allowlist; dry-run is execution.
- A5 P1: Idempotency-Key required but no TTL/replay/conflict contract; duplicate paid eval/promotion possible.
- A6 P1: `hive.api.v1` vs v1 envelope parity and OpenAPI schema coverage absent.
- A7 P1: file/download/open-folder control preconditions and refusal matrix absent.
- A8 P1: learning-off response, disabled states, and `datasets` vs `eval_suites` naming drift.
- A9 P1: named refusals not mapped to HTTP status/CLI exit codes.
- A10 P2: report `:kind`, context, and trace read endpoints lack projection/traversal rules.

## RED evidence (plan contradictions, quoted)
- W05 §4 requires a signed single-use approval token; §7.6 lists only `/promotions`/`/rollback`, no `/approvals`.
- §4 W06 says "snapshot endpoint"; §8/§14 define no snapshot route or SSE data envelope.
- §3 says Release A contains "zero P6/P7 ... routes, pages, or scripts"; §8 adds a P6a `route` node and P7 hooks with no flag/build split.
- §6.9 says `/api/scripts` is "list/schema/dry-run, read-only"; no method for dry-run and §6.8 scripts can `--write --yes`.
- §14 requires `Idempotency-Key` for paid/destructive actions; no storage/TTL/replay rule despite `idempotency_keys` table name in §6.9.

## 09:32 — verification of report
- Re-read every finding against PLAN-v2 lines; removed no evidence-free claims.
- Exact patch text written in `docs/PLAN-AUDIT/02-api-ui.md`; no product plan edits.
- Check window: final report path only; no other files touched.

## Files changed
- `docs/PLAN-AUDIT/02-api-ui.md` (new, seat report)
- `logs/plan-audit-api-ui.md` (this journal)

## Missed / limits
- No code exists, so RED probes are executable test specifications, not runs. Claim strength READ/INFERRED.
- Did not verify npm pins or external APIs (out of seat scope, no network).
- Scope numbering mismatch requires Lead decision (see report §3).

## STATUS: DONE
