import { test, expect } from '@playwright/test';

/**
 * Wave 17 regression pins for the three confirmed control/wiring defects.
 * Each test fails on the pre-fix tree and passes on the repaired tree.
 */

const RUN_ID = 'run_wave17_resume_probe';

function stagedRunSnapshot() {
  const now = new Date().toISOString();
  return {
    run: {
      id: RUN_ID,
      parentRunId: null,
      brief: 'Wave 17 resume idempotency probe; no provider call is made by this test.',
      preset: 'full-build',
      status: 'failed',
      phase: 'finalizing',
      model: 'deepseek-flash',
      thinking: 'disabled',
      effort: null,
      createdAt: now,
      startedAt: now,
      finishedAt: now,
      costUsd: 0.01,
      promptTokens: 10,
      completionTokens: 10,
      errorCode: 'E_PROVIDER_TEST',
      errorMessage: 'probe',
      workspacePath: 'C:\\probe\\workspace\\run_wave17_resume_probe',
      summary: null,
      snapshotHash: 'a'.repeat(64),
      policyVersionId: 'pol_probe',
      traceComplete: true,
      runKind: 'resume',
    },
    steps: [],
    checks: [],
    artifacts: [
      {
        id: 'art_wave17_staged',
        runId: RUN_ID,
        path: 'src/probe.py',
        kind: 'source',
        language: 'python',
        sha256: 'b'.repeat(64),
        bytes: 42,
        agentId: 'python-engine',
        revisedFrom: null,
        createdAt: now,
        redactionStatus: 'clean',
        redactorVersion: '1.0.0',
        status: 'staged',
        mime: null,
      },
    ],
    lastEventId: 1,
    truncated: false,
    limits: { maxCostUsd: 0.5 },
  };
}

test.describe('@wave17 control wiring', () => {
  test('desktop chrome does not expose the mobile navigation toggle', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/');
    const menu = page.locator('.topbar-menu');
    await expect(menu).toBeHidden();
    await expect(page.locator('#primary-navigation')).toBeVisible();
    const box = await page.locator('#primary-navigation').boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(200);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#primary-navigation')).toBeVisible();
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
  });

  test('chat names an agent-registry failure and recovers on retry', async ({ page }) => {
    let failing = true;
    await page.route('**/api/agents', async (route) => {
      if (!failing) {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'E_AGENT_REGISTRY_UNAVAILABLE',
            message: 'The agent registry is unavailable for this probe.',
            retryable: true,
          },
        }),
      });
    });

    await page.goto('/chat');
    await expect(page.getByRole('heading', { name: 'Chat', exact: true })).toBeVisible({ timeout: 15_000 });
    const alert = page.getByRole('alert').filter({ hasText: 'E_AGENT_REGISTRY_UNAVAILABLE' });
    await expect(alert).toBeVisible({ timeout: 10_000 });
    await expect(alert).toContainText(/agent registry is unavailable/i);
    await expect(page.getByRole('button', { name: /New conversation/ })).toBeDisabled();

    failing = false;
    await alert.getByRole('button', { name: /Retry/ }).click();
    const selector = page.getByRole('combobox', { name: 'Agent', exact: true });
    await expect(selector.locator('option')).toHaveCount(37, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: /New conversation/ })).toBeEnabled();
    await expect(alert).toHaveCount(0);
  });

  test('resume retry reuses the idempotency key', async ({ page }) => {
    await page.route(`**/api/runs/${RUN_ID}/snapshot`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(stagedRunSnapshot()),
      });
    });

    const keys: string[] = [];
    await page.route(`**/api/runs/${RUN_ID}/resume`, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      const key = route.request().headers()['idempotency-key'];
      if (key) keys.push(key);
      await route.abort('failed');
    });

    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto(`/runs/${RUN_ID}`);
    await expect(page.getByText(RUN_ID).first()).toBeVisible({ timeout: 15_000 });
    const resume = page.getByRole('button', { name: /Resume from staged/ });
    await expect(resume).toBeVisible();

    await resume.click();
    await expect(page.getByText('Resume failed.').first()).toBeVisible({ timeout: 10_000 });
    await expect(resume).toBeEnabled();
    await resume.click();
    await expect.poll(() => keys.length).toBe(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1], 'an unchanged resume retry must replay the same key').toBe(keys[0]);
    expect(pageErrors).toEqual([]);
  });
});
