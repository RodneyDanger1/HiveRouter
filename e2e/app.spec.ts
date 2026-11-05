import { test, expect } from '@playwright/test';

const pageErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  pageErrors.length = 0;
  page.on('pageerror', (error) => pageErrors.push(error.message));
});

test.afterEach(async () => {
  expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toEqual([]);
});

test('overview, agents, runs, learning, vault and settings render against the live API', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/HiveRouter/i);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

  await page.getByRole('link', { name: /agents/i }).first().click();
  await expect(page).toHaveURL(/\/agents$/);
  await expect(page.getByText(/37/).first()).toBeVisible();

  await page.getByRole('link', { name: /runs/i }).first().click();
  await expect(page).toHaveURL(/\/runs$/);
  await expect(page.getByText(/run_/).first()).toBeVisible();

  await page.getByRole('link', { name: /learning/i }).first().click();
  await expect(page).toHaveURL(/\/learning$/);
  await expect(page.getByRole('heading', { name: /Learning/i }).first()).toBeVisible();

  await page.getByRole('link', { name: /vault/i }).first().click();
  await expect(page).toHaveURL(/\/vault$/);
  await expect(page.getByText(/HiveControl|000_Hive_Control|Blueprints|Production/i).first()).toBeVisible();

  await page.getByRole('link', { name: /settings/i }).first().click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByText(/DeepSeek|key/i).first()).toBeVisible();
});

test('run detail shows live steps, checks, files and P6a tabs', async ({ page }) => {
  const runs = await page.request.get('/api/runs?limit=20');
  expect(runs.ok()).toBeTruthy();
  const body = (await runs.json()) as { runs: Array<{ id: string; status: string }> };
  const run = body.runs.find((candidate) => candidate.status === 'completed' || candidate.status === 'completed_with_warnings') ?? body.runs[0];
  expect(run, 'a run must exist for the E2E smoke').toBeTruthy();

  await page.goto(`/runs/${run.id}`);
  await expect(page.getByText(run.id).first()).toBeVisible();
  await expect(page.getByText(/completed|failed|cancelled|running/i).first()).toBeVisible();
  for (const tab of ['Routing', 'Context', 'Repairs', 'Checks', 'Confidence', 'Files']) {
    const button = page.getByRole('tab', { name: new RegExp(tab, 'i') }).first();
    if (await button.count()) {
      await button.click();
      await page.waitForTimeout(150);
    }
  }
  await expect(page.getByText(/RUN_REPORT|manifest|artifact|file/i).first()).toBeVisible();
});

test('approval controls refuse honestly when no candidate exists', async ({ page }) => {
  await page.goto('/learning');
  const promote = page.getByRole('button', { name: /approve|promote/i }).first();
  if (await promote.count()) {
    await expect(promote).toBeDisabled();
  }
  await expect(page.getByText(/Screening-grade|no promotion|insufficient|pool/i).first()).toBeVisible();
});
