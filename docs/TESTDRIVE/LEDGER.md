# TestDrive ledger

Append-only. One block per run: start → seats → cards → defects → fixes → gates → lesson.

## 2026-11-03 — TestDrive v1.1 / HiveRouter B2

- Start: 2026-11-03T21:00Z. Skill v1.1.0 hashes equal at both roots.
- Key: supplied key fingerprint `c30cfdbc`, same as installed; source environment; balance $19.04; `/models` lists deepseek-flash and deepseek-v4-pro.
- Window: HiveRouter 1440×780 at 80,40 in 1600×860 work area; not zoomed/iconic.
- Baseline: verify PASS; 17/17 E2E; stage strict; no active run.
- Cards: TD-01 UNVERIFIED (CUA title false-negative; 404 fixed), TD-02..TD-07 PASS outcome, TD-08 PARTIAL then Lead restart verified 15 runs persisted.
- Defects: D01 unknown HTML 404 (fixed), D09 terminal Live stream (fixed), D10 repair reservation (fixed); D02/D03/D04/D06/D07/D08 fixed in testdrive v1.2.0; D05 Lead restart done.
- Final: 214 unit / 28 files; 24/24 E2E; strict stage 47 routes; preflight; live smoke; skill v1.2.0 hash `51643FD9…A9A3`.
- Lesson: driver must flush at action time and assert field values; observer must write one phase_end after driver; CUA page.title can be false-negative—use URL/heading/visible title; window geometry is client vs outer.

