import { chromium } from '@playwright/test';
import fs from 'node:fs';

const base = 'http://127.0.0.1:8787';
const ids = ['run_8c4a59741cebc8c94f', 'run_bb9d241e1f94b6703a', 'run_12be61a462973c5d69', 'run_c41f1fb4779d302af7'];
const tabs = ['Overview', 'Files', 'Checks', 'Routing', 'Context', 'Repairs', 'Confidence', 'Events'];
fs.mkdirSync('docs/LIVE-WAVE-6/after', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors: Array<{ id: string; tab: string; text: string }> = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push({ id: 'console', tab: '', text: message.text() });
});
page.on('requestfailed', (request) => errors.push({ id: 'request-failed', tab: '', text: `${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}` }));
const result: Record<string, unknown> = { pages: {} };
for (const id of ids) {
  const run: Record<string, unknown> = { tabs: {} };
  await page.goto(`${base}/runs/${id}`, { waitUntil: 'networkidle' }).catch(() => undefined);
  await page.waitForTimeout(500);
  run.header = (await page.locator('body').innerText()).slice(0, 500);
  for (const tab of tabs) {
    const entry: Record<string, unknown> = {};
    try {
      await page.getByRole('tab', { name: new RegExp(`^${tab}$`) }).click({ timeout: 3000 });
      await page.waitForTimeout(350);
      entry.visible = true;
      entry.text = (await page.locator('main').innerText()).slice(0, 700);
      await page.screenshot({ path: `docs/LIVE-WAVE-6/after/${id}-${tab.toLowerCase()}.png`, fullPage: false });
    } catch (error) {
      entry.visible = false;
      entry.error = error instanceof Error ? error.message.slice(0, 200) : String(error);
    }
    (run.tabs as Record<string, unknown>)[tab] = entry;
  }
  result[id] = run;
}
for (const route of ['/', '/runs', '/agents', '/vault', '/learning', '/settings']) {
  await page.goto(base + route, { waitUntil: 'networkidle' }).catch(() => undefined);
  await page.waitForTimeout(400);
  (result.pages as Record<string, unknown>)[route] = {
    title: await page.locator('h1').first().textContent().catch(() => null),
    bodyLength: (await page.locator('body').innerText()).length,
  };
  await page.screenshot({ path: `docs/LIVE-WAVE-6/after/${route === '/' ? 'overview' : route.slice(1)}.png`, fullPage: false });
}
fs.writeFileSync('docs/LIVE-WAVE-6/after-runs.json', JSON.stringify({ result, errors }, null, 2));
console.log(JSON.stringify({ ids: ids.length, tabsPerRun: tabs.length, errors: errors.length, result }, null, 2));
await browser.close();
