# Wave 18 — visual findings

Date: 2026-11-05
Surface: HiveRouter at `http://127.0.0.1:8787` (B2), Chrome pid 11636. Native CUA visible proof + Playwright headless interaction evidence.

## Result

**No confirmed product defect in 15 live trials + 10-route console/network sweep.** Three initial test-probe errors were corrected before rerun; they are not product defects and no source changed for them.

| Finding | Severity | Evidence | Status |
|---|---|---|---|
| CUA background click on Chromium content returned `unverifiable` and did not navigate; foreground delivery navigated correctly | Tooling | CUA click response + `/runs` screenshot | Accepted tooling constraint; not app defect |
| Existing-profile `browser_prepare` refused with `browser_consent_required` | Tooling | CUA refusal JSON | Did not override; Playwright used as separate headless harness |
| Test expected uppercase `COMPLETED`; UI renders `Completed` | Test probe | `error-context.md` | Corrected probe; reran PASS |
| Test locator `ARTIFACTS` matched two elements | Test probe | strict-mode error context | Corrected exact locator; reran PASS |
| Test scripts row regex assumed start-of-row text | Test probe | Playwright locator failure | Corrected row locator; reran PASS |
| Mobile nav screenshot shows open drawer overlay; no horizontal overflow (390 px document) | None | `pw-t11-mobile.png`; assertion | PASS |
| Unknown spend shown as `—`/partial, measured spend `$1.1888`, counts visible | None | `pw-t15-stats-truth.png`; API | PASS |

## Evidence

- CUA: `live/overview-visible.png`, `live/t02-runs-failed-final.png`, `live/t03-completed.png`.
- Playwright initial 5 + designed 10: `live/pw-t01..t15`. **15 passed**.
- Console/network sweep: `live/sweep-*.png`; **10 passed**, no page/console errors, no failed non-stream requests.
- Test probe corrections were confined to `e2e/_wave18-live.spec.ts` (temporary; removed after use).

## Unverified

Paid submits, live Stop/cancel, live SSE mid-run, resume success, `E_ZIP_EMPTY`, and existing-profile CUA browser automation remain unverified. No provider call was made.
