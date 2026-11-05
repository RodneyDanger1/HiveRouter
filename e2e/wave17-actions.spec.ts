import { test, expect } from '@playwright/test';

/**
 * Wave 17 wave-2 pins for the two adjacent run/agent control defects found in
 * the wave-2 audit. Each test fails on the integrated tree before its fix and
 * passes after it. The HTTP doubles keep the probes offline; no provider call
 * or paid run is made by this suite.
 */

const BUDGET_RUN_ID = 'run_wave17_actions_budget';
const FAILED_RUN_ID = 'run_wave17_actions_failed';

function runSnapshot(input: {
  id: string;
  status: string;
  artifacts: Array<Record<string, unknown>>;
}) {
  const now = new Date().toISOString();
  return {
    run: {
      id: input.id,
      parentRunId: null,
      brief: 'Wave 17 wave-2 action availability probe; no provider call is made by this test.',
      preset: 'full-build',
      status: input.status,
      phase: 'done',
      model: 'deepseek-flash',
      thinking: 'disabled',
      effort: null,
      createdAt: now,
      startedAt: now,
      finishedAt: now,
      costUsd: 0.2,
      promptTokens: 100,
      completionTokens: 100,
      errorCode: input.status === 'failed' ? 'E_PROVIDER_TEST' : 'E_BUDGET_EXCEEDED',
      errorMessage: input.status === 'failed' ? 'probe' : 'E_BUDGET_EXCEEDED',
      workspacePath: `C:\\probe\\workspace\\${input.id}`,
      summary: null,
      snapshotHash: 'a'.repeat(64),
      policyVersionId: 'pol_probe',
      traceComplete: true,
      runKind: 'user',
    },
    steps: [],
    checks: [],
    artifacts: input.artifacts,
    lastEventId: 1,
    truncated: false,
    limits: { maxCostUsd: 0.2 },
  };
}

function acceptedArtifact(runId: string) {
  return {
    id: `art_${runId}`,
    runId,
    path: 'src/probe.py',
    kind: 'source',
    language: 'python',
    sha256: 'b'.repeat(64),
    bytes: 42,
    agentId: 'python-engine',
    revisedFrom: null,
    createdAt: new Date().toISOString(),
    redactionStatus: 'clean',
    redactorVersion: '1.0.0',
    status: 'accepted',
    mime: null,
  };
}

test.describe('@wave17 action availability', () => {
  test('run actions match the backend terminal-status eligibility', async ({ page }) => {
    await page.route(`**/api/runs/${BUDGET_RUN_ID}/snapshot`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          runSnapshot({ id: BUDGET_RUN_ID, status: 'budget_exceeded', artifacts: [acceptedArtifact(BUDGET_RUN_ID)] }),
        ),
      });
    });
    await page.route(`**/api/runs/${FAILED_RUN_ID}/snapshot`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          runSnapshot({ id: FAILED_RUN_ID, status: 'failed', artifacts: [acceptedArtifact(FAILED_RUN_ID)] }),
        ),
      });
    });

    // The server accepts revise/audit only for completed, completed_with_warnings
    // and failed parents (src/server/app.ts:1037 and :1175). A budget-exceeded run
    // with a retained accepted artifact must not offer those actions.
    await page.goto(`/runs/${BUDGET_RUN_ID}`);
    await expect(page.getByText(BUDGET_RUN_ID).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /^Revise/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Audit/i })).toHaveCount(0);
    await expect(page.getByText('Revision requires a completed or failed run with accepted artifacts.')).toBeVisible();
    await expect(page.getByText('Audit requires a completed or failed run with stored artifacts.')).toBeVisible();

    // A failed run with an accepted artifact stays eligible; the fix must not
    // over-hide actions the server would accept.
    await page.goto(`/runs/${FAILED_RUN_ID}`);
    await expect(page.getByText(FAILED_RUN_ID).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /^Revise/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Audit/i }).first()).toBeVisible();
  });

  test('agent drawer cannot drop a failed run while the request is in flight', async ({ page }) => {
    await page.route('**/api/agents/gatekeeper/run', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'E_PROBE_RUN_FAILED',
            message: 'probe run failed after the drawer closed',
            retryable: true,
          },
        }),
      });
    });

    await page.goto('/agents');
    await page.getByRole('button', { name: /Open The Gatekeeper/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/^Input$/i).fill('Probe: this request fails after a dismissal attempt.');
    await dialog.getByRole('button', { name: /Run agent/i }).click();

    // The in-flight mutation owns the drawer: both dismissal paths are closed.
    await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Close dialog' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    await expect(dialog).toBeVisible();

    // The failure is rendered in the drawer instead of being discarded.
    await expect(dialog.getByText(/probe run failed after the drawer closed/)).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).toBeHidden();
  });

  test('run-detail confirmation dialogs stay open while their request is in flight', async ({ page }) => {
    await page.route(`**/api/runs/${FAILED_RUN_ID}/snapshot`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          runSnapshot({ id: FAILED_RUN_ID, status: 'failed', artifacts: [acceptedArtifact(FAILED_RUN_ID)] }),
        ),
      });
    });
    await page.route('**/api/runs', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'E_PROBE_AUDIT_FAILED', message: 'probe audit failed while the dialog was dismissed' },
        }),
      });
    });

    await page.goto(`/runs/${FAILED_RUN_ID}`);
    await expect(page.getByText(FAILED_RUN_ID).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Audit this run/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/Start an audit run/i)).toBeVisible();
    await dialog.getByRole('button', { name: /Start audit/i }).click();

    await expect(dialog.getByRole('button', { name: 'Close dialog' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    await expect(dialog).toBeVisible();

    await expect(dialog.getByText(/probe audit failed while the dialog was dismissed/)).toBeVisible({ timeout: 10_000 });
    await dialog.getByRole('button', { name: /^Cancel$/i }).click();
    await expect(dialog).toBeHidden();
  });
});
