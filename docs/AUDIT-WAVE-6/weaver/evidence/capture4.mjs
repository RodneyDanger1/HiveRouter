// Read-only: exercise safe navigation links and Refresh buttons, capturing URL + API re-fetches.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'browser');
const BASE = 'http://127.0.0.1:8787';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const api = [];
page.on('response', (res) => { if (res.url().includes('/api/')) api.push({ method: res.request().method(), url: res.url(), status: res.status() }); });
const results = { navigations: [], refreshes: [] };

async function nav(startPath, linkName, exact = false) {
  await page.goto(BASE + startPath, { waitUntil: 'networkidle', timeout: 45000 });
  const before = page.url();
  const mark = api.length;
  try {
    await page.getByRole('link', { name: linkName, exact }).first().click({ timeout: 8000 });
    await page.waitForTimeout(900);
    results.navigations.push({ from: before, link: linkName, to: page.url(), h1: await page.locator('h1').first().innerText().catch(() => null), api: api.slice(mark) });
  } catch (error) {
    results.navigations.push({ from: before, link: linkName, error: String(error).slice(0, 200) });
  }
}

await nav('/', 'Agents');
await nav('/agents', 'Runs');
await nav('/runs', 'Vault');
await nav('/vault', 'Learning');
await nav('/learning', 'Settings');
await nav('/settings', 'Overview');
await nav('/', 'Run history');
await nav('/', 'Agent registry');
await nav('/settings', 'Open Learning status');
await nav('/learning', 'Open settings');
await nav('/no-such-page', 'Return to overview');
await nav('/runs', 'New run');

// Refresh buttons per page (all GET re-fetches)
async function refresh(pathName, name = 'Refresh') {
  await page.goto(BASE + pathName, { waitUntil: 'networkidle', timeout: 45000 });
  const mark = api.length;
  try {
    await page.getByRole('button', { name, exact: true }).first().click({ timeout: 8000 });
    await page.waitForTimeout(1200);
    results.refreshes.push({ page: pathName, button: name, api: api.slice(mark) });
  } catch (error) {
    results.refreshes.push({ page: pathName, button: name, error: String(error).slice(0, 200) });
  }
}
await refresh('/');
await refresh('/agents');
await refresh('/runs');
await refresh('/vault');
await refresh('/settings');

// Run row link opens run detail
await page.goto(BASE + '/runs', { waitUntil: 'networkidle', timeout: 45000 });
const mark = api.length;
await page.locator('tbody tr').first().locator('td').nth(1).locator('a').click();
await page.waitForTimeout(1200);
results.runRowClick = { url: page.url(), h1: await page.locator('h1').first().innerText().catch(() => null), api: api.slice(mark) };

fs.writeFileSync(path.join(OUT, 'navigation.json'), JSON.stringify(results, null, 2));
await browser.close();
console.log(JSON.stringify(results, null, 2));
