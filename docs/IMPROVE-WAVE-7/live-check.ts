import { chromium } from '@playwright/test';

const base = 'http://127.0.0.1:8787';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const requests: string[] = [];
page.on('request', (request) => {
  if (request.url().includes('/api/runs?')) requests.push(request.url());
});
await page.goto(`${base}/runs`, { waitUntil: 'networkidle' });
await page.locator('select').first().selectOption('failed');
await page.waitForTimeout(1200);
const runsText = await page.locator('main').innerText();
const failedRows = await page.locator('tbody tr').count();
const failedLinks = await page.locator('a[href^="/runs/run_"]').count();
await page.screenshot({ path: 'docs/IMPROVE-WAVE-7/runs-filtered-failed.png', fullPage: false });

await page.goto(`${base}/settings`, { waitUntil: 'networkidle' });
const settingsText = await page.locator('main').innerText();
const hasLimit = settingsText.includes('limits.maxRunCostUsd');
const hasReplay = settingsText.includes('limits.eventReplayWindow');
await page.screenshot({ path: 'docs/IMPROVE-WAVE-7/settings-limits.png', fullPage: false });

console.log(JSON.stringify({
  requests,
  failedRows,
  failedLinks,
  runsHasFailed: /Failed/i.test(runsText),
  hasLimit,
  hasReplay,
  settingsExcerpt: settingsText.match(/limits\.maxRunCostUsd[\s\S]{0,120}/)?.[0] ?? null,
}, null, 2));
await browser.close();
