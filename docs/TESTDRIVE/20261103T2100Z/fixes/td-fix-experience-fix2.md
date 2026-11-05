# td-fix-experience — TestDrive FIX2 (evidence/harness)

**Status: DONE** — six harness defects (TD1-D02, D03, D04, D06, D07, D08) closed in TestDrive v1.1.1. **No product code edited.**

## RED probe (before)
TestDrive `v1.1.0`, SHA-256 `7F47604DC7FB49D1DEB6114FD1ACF9E83B69E8227497225932114881D07E414F` at both roots.
`Select-String` over `SKILL.md`:
- action-time flush/no batching = **0**
- field-value assertion = **0**
- exactly one phase_end = **0**
- backend contiguous min/max/count = **0**
- client-area tolerance (explicit ±20) = **1** (only generic “bounds”)
- CUA title false-negative = **0**

This explains the observed 36/37 correlation failures, premature UI `phase_end` seq 176, tail-sampled TD-04 337–368 / TD-05 371–379, the 0/8000 short-brief capture, and the `about:blank` title false-negative.

## Fixes (all in harness/rules, not product)
- **D03 (driver flush):** v1.1.1 rule 1 (`SKILL.md:30`) — flush one JSONL line per action before the next action; no card-end batching; record `snapshotId`, intended `value`, observed `fieldValue`, action-time `ts`/screenshot.
- **D07 (field assertion):** rule 2 (`:31`) — read back after type/select; wrong/missing value = `UNVERIFIED`; TEST-CARDS TD-02 now requires `5/8000` visible at action time.
- **D04 (phase_end):** rule 3 (`:32`) and log schema (`:128`) — exactly one `phase_end` after the driver terminal; premature marker quarantined/superseded; cannot claim absence of later evidence.
- **D06 (backend range):** rule 4 (`:33`) — terminal record must contain contiguous `eventRange {min,max,count,contiguous}`; tail sample re-read before verdict.
- **D02 (window geometry):** rule 5 (`:34`), preflight (`:84`) — client-area tolerance **±20 px** around 1440×780; record outer/inner; 1426×773 accepted; no product change.
- **D08 (CUA title):** rule 6 (`:35`), CUA policy (`:98`) — route pass requires heading + URL/path + visible tab/heading; `about:blank` with matching content is `tooling-title-false-negative`, not a product failure.
- Log schema (`:122-128`) now includes `value`, `fieldValue`, `snapshotId`, `eventRange`; acceptance (`:162`) and changelog (`:166`) updated.

## Clarifications
`FIX2-DEFECTS.md` now records the D02/D03/D04/D06/D07/D08 disposition and cites the skill rules. `TEST-CARDS.md` now carries v1.1.1 evidence rules and geometry/title/field assertions for TD-01/02/03/04/05/06/08.

## GREEN / hashes
- Skill v1.1.1, mirrored **byte-identically**:
  - `C:\Users\Riley\.agents\skills\testdrive\SKILL.md` — `0AD6E6A5676D6609C468C005EA0DC26942CF81B508D90E07268B2E5E8B4E44A4` (11,383 B)
  - `C:\Users\Riley\.dsh\skills\testdrive\SKILL.md` — same hash, same size.
- `docs/TESTDRIVE/20261103T2100Z/TEST-CARDS.md` — `CE0CCD33913B7BAD0EFEB54253F58B33A43096D591F1150F9A33E0C61C391EE3` (5,201 B).
- `docs/TESTDRIVE/20261103T2100Z/FIX2-DEFECTS.md` — `0B4771BCC6ECF88E8BD820B8A165F2356C85F69A73FFF9476137B9340C1F6556` (4,576 B).
- Rule presence after edit: flush 4, fieldValue 3, exactly-one-phase_end 3, eventRange 5, ±20 px 4, about:blank 3, tooling-title-false-negative 1.

## Limits / residuals
- Prior drive outcomes remain **UNVERIFIED/PARTIAL**; no cards were rerun and no product behavior was changed. The next drive must use v1.1.1 to produce clean temporal evidence.
- TD1-D05 (server restart/persistence) remains Lead-owned; TD1-D09 (UI live-stream copy) `td-fix-ui`; TD1-D10 (reservation repair storm) `td-fix-core`.
- No key access, paid run, server restart, install, git write, or product edit. Evidence is redacted; no secret material in this report or skill.
