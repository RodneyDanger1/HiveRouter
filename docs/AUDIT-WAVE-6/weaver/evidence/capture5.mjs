// Micro probes: vault directory toggle and run-detail tab Refresh buttons (all read-only GETs).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'browser');
const BASE = 'http://127.0.0.1:8787';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = { vault: {}, tabRefresh: [] };

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto(BASE + '/vault', { waitUntil: 'networkidle', timeout: 45000 });
  const rowsBefore = await page.locator('button.vault-row').count();
  const root = page.locator('button.vault-row').filter({ hasText: '^000_Hive_Control$' }).first();
  await page.locator('button.vault-row', { hasText: '000_Hive_Control' }).first().click();
  await page.waitForTimeout(300);
  const rowsCollapsed = await page.locator('button.vault-row').count();
  await page.locator('button.vault-row', { hasText: '000_Hive_Control' }).first().click();
  await page.waitForTimeout(300);
  const rowsExpanded = await page.locator('button.vault-row').count();
  results.vault = { rowsBefore, rowsCollapsed, rowsExpanded };
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const api = [];
  page.on('response', (res) => { if (res.url().includes('/api/')) api.push({ method: res.request().method(), url: res.url(), status: res.status() }); });
  await page.goto(BASE + '/runs/run_abf5fe78aab1e932ff', { waitUntil: 'networkidle', timeout: 45000 });
  for (const tabName of ['Routing', 'Context', 'Repairs', 'Confidence']) {
    await page.getByRole('tab', { name: tabName, exact: true }).click();
    await page.waitForTimeout(600);
    const mark = api.length;
    const refresh = page.locator('[role="tabpanel"]').getByRole('button', { name: 'Refresh', exact: true }).first();
    const count = await refresh.count();
    if (count) {
      await refresh.click();
      await page.waitForTimeout(700);
    }
    results.tabRefresh.push({ tabName, refreshButtons: count, api: api.slice(mark) });
  }
  await context.close();
}

fs.writeFileSync(path.join(OUT, 'micro.json'), JSON.stringify(results, null, 2));
await browser.close();
console.log(JSON.stringify(results, null, 2));
