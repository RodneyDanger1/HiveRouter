import { chromium } from '@playwright/test';
import fs from 'node:fs';

const base = 'http://127.0.0.1:8787';
const outDir = 'docs/LIVE-WAVE-6/evidence';
fs.mkdirSync(outDir, { recursive: true });
const pages = ['/', '/agents', '/runs', '/vault', '/learning', '/settings'];
const tabs = ['Overview', 'Files', 'Checks', 'Routing', 'Context', 'Repairs', 'Confidence', 'Events'];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const log: Array<Record<string, unknown>> = [];
page.on('console', (message) => {
  if (message.type() === 'error') (log[log.length - 1] ??= {}).consoleError = message.text();
});
page.on('requestfailed', (request) => {
  (log[log.length - 1] ??= {}).requestFailed = `${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`;
});
for (const route of pages) {
  const entry: Record<string, unknown> = { route };
  log.push(entry);
  await page.goto(base + route, { waitUntil: 'networkidle' }).catch(() => undefined);
  await page.waitForTimeout(800);
  entry.title = await page.locator('h1').first().textContent().catch(() => null);
  entry.textLength = (await page.locator('body').innerText()).length;
  entry.screenshot = `${outDir}/${route === '/' ? 'overview' : route.slice(1)}.png`;
  await page.screenshot({ path: entry.screenshot as string, fullPage: false });
}
for (const id of ['run_abf5fe78aab1e932ff', 'run_95c11797b4923b4277']) {
  const entry: Record<string, unknown> = { route: `/runs/${id}` };
  log.push(entry);
  await page.goto(`${base}/runs/${id}`, { waitUntil: 'networkidle' }).catch(() => undefined);
  await page.waitForTimeout(700);
  entry.tabs = {};
  for (const tab of tabs) {
    const tabEntry: Record<string, unknown> = {};
    try {
      await page.getByRole('tab', { name: new RegExp(`^${tab}$`) }).click({ timeout: 3000 });
      await page.waitForTimeout(400);
      tabEntry.visible = true;
      tabEntry.bodyContains = (await page.locator('body').innerText()).slice(0, 160);
      await page.screenshot({ path: `${outDir}/${id}-${tab.toLowerCase()}.png`, fullPage: false });
    } catch (error) {
      tabEntry.visible = false;
      tabEntry.error = error instanceof Error ? error.message.slice(0, 160) : String(error);
    }
    (entry.tabs as Record<string, unknown>)[tab] = tabEntry;
  }
}
fs.writeFileSync('docs/LIVE-WAVE-6/tab-audit.json', JSON.stringify(log, null, 2));
console.log(JSON.stringify({ pages: pages.length, runTabs: 2 * tabs.length, log }, null, 2));
await browser.close();
