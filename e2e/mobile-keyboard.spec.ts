import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SHOTS = path.resolve('docs/UI-WAVE-1/shots');
fs.mkdirSync(SHOTS, { recursive: true });

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
}

async function documentOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

async function completedRun(request: APIRequestContext): Promise<string> {
  const response = await request.get('/api/runs?limit=50');
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { runs: Array<{ id: string; status: string }> };
  const run = body.runs.find((candidate) => candidate.status === 'completed' || candidate.status === 'completed_with_warnings');
  expect(run, 'a completed run is required for the mobile search trial').toBeTruthy();
  return run!.id;
}

test.describe('@mobile-keyboard', () => {
  test('analysis is usable at 390px without document overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/analysis');
    await expect(page.getByRole('heading', { name: 'Analysis', exact: true })).toBeVisible();
    await page.getByLabel(/Root file/i).fill('src/app.ts');
    await page.getByLabel(/Edges, one per line/i).fill('src/app.ts -> src/api.ts\nsrc/api.ts -> src/store.ts');
    await page.getByRole('button', { name: /Analyze graph/i }).click();
    await expect(page.getByText('src/api.ts', { exact: true })).toBeVisible({ timeout: 10_000 });
    expect(await documentOverflow(page)).toBeLessThanOrEqual(1);
    await shot(page, 'mobile-analysis');
  });

  test('run search is usable at 390px without document overflow', async ({ page, request }) => {
    const runId = await completedRun(request);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/runs/${runId}`);
    await expect(page.getByText(runId).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('tab', { name: /^Search$/i }).click();
    await page.getByLabel(/Search terms/i).fill('function');
    await page.getByRole('button', { name: /^Search$/i }).click();
    await expect(page.getByText(/file[s]? indexed/i)).toBeVisible({ timeout: 15_000 });
    expect(await documentOverflow(page)).toBeLessThanOrEqual(1);
    await shot(page, 'mobile-run-search');
  });

  test('run-detail tabs move selection and focus with arrow keys', async ({ page, request }) => {
    const runId = await completedRun(request);
    await page.goto(`/runs/${runId}`);
    await expect(page.getByText(runId).first()).toBeVisible({ timeout: 15_000 });

    const overview = page.getByRole('tab', { name: /^Overview$/i });
    const files = page.getByRole('tab', { name: /^Files$/i });
    await overview.focus();
    await page.keyboard.press('ArrowRight');
    await expect(files).toHaveAttribute('aria-selected', 'true');
    await expect(files).toBeFocused();

    await page.keyboard.press('ArrowLeft');
    await expect(overview).toHaveAttribute('aria-selected', 'true');
    await expect(overview).toBeFocused();
  });

  test('closed mobile navigation does not receive keyboard focus', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const menu = page.getByRole('button', { name: /Open navigation/i });
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await menu.focus();
    await page.keyboard.press('Tab'); // brand link
    await page.keyboard.press('Tab'); // must not land in the closed sidebar
    const insideNav = await page.evaluate(() => {
      const nav = document.querySelector('#primary-navigation');
      return Boolean(nav && document.activeElement && nav.contains(document.activeElement));
    });
    expect(insideNav).toBe(false);

    await menu.click();
    await expect(page.getByRole('button', { name: /Close navigation/i }).first()).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: /Open navigation/i })).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('button', { name: /Open navigation/i })).toBeFocused();
  });
});
