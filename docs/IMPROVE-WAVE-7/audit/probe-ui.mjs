// Wave 7 audit probe: live Runs status filter + Settings flattening.
// Read-only against the running server (127.0.0.1:8787); screenshots go to the audit dir.
import { chromium } from '@playwright/test';
import path from 'node:path';

const BASE = 'http://127.0.0.1:8787';
const AUDIT = path.resolve('docs/IMPROVE-WAVE-7/audit');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const requests = [];
page.on('request', (request) => {
  const url = request.url();
  if (url.includes('/api/runs?')) requests.push(url.slice(BASE.length));
});

const out = {};

// --- Runs filter -------------------------------------------------------------
await page.goto(`${BASE}/runs`, { waitUntil: 'networkidle' });
out.initialRequest = requests.slice(-1)[0] ?? null;
out.initialRows = await page.locator('tbody tr').count();
out.initialCountLabel = (await page.locator('span.ml-auto').last().innerText()).trim();

await page.locator('select').first().selectOption('failed');
await page.waitForTimeout(1000);
out.failedRequest = requests.slice(-1)[0] ?? null;
out.failedRows = await page.locator('tbody tr').count();
out.failedLinks = await page.locator('a[href^="/runs/run_"]').count();
out.failedCountLabel = (await page.locator('span.ml-auto').last().innerText()).trim();
out.failedStatusCells = await page.locator('tbody tr td:nth-child(2)').allInnerTexts().catch(() => []);
await page.screenshot({ path: path.join(AUDIT, 'live-runs-failed.png'), fullPage: false });

await page.locator('select').first().selectOption('queued');
await page.waitForTimeout(800);
out.queuedRequest = requests.slice(-1)[0] ?? null;
out.queuedRows = await page.locator('tbody tr').count();
out.queuedEmptyState = (await page.locator('body').innerText()).includes('No runs recorded')
  ? 'No runs recorded'
  : (await page.locator('body').innerText()).includes('No runs match')
    ? 'No runs match'
    : 'other';
await page.screenshot({ path: path.join(AUDIT, 'live-runs-queued.png'), fullPage: false });

// --- Settings ----------------------------------------------------------------
await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
const settingsText = await page.locator('main').evaluate((el) => el.textContent ?? '');
const settingsRendered = await page.locator('main').innerText();
out.settings = {
  hasMaxRunCost: settingsText.includes('limits.maxRunCostUsd'),
  hasEventReplay: settingsText.includes('limits.eventReplayWindow'),
  hasBriefChars: settingsText.includes('limits.briefChars'),
  hasRetentionEvents: settingsText.includes('limits.retentionDays.events'),
  hasFeatureRouting: settingsText.toLowerCase().includes('features.routing'),
  hasFeatureLearning: settingsText.toLowerCase().includes('features.learning'),
  hasObjectLeak: settingsText.includes('[object Object]'),
  hasKeyPattern: /sk-[A-Za-z0-9_-]{20,}/.test(settingsText),
  limitLabelCount: (settingsText.match(/limits\.[A-Za-z]+/g) ?? []).length,
  excerpt: settingsText.match(/limits\.maxRunCostUsd[\s\S]{0,80}/)?.[0] ?? null,
};
out.settingsTextTail = settingsRendered.slice(-1200);
await page.screenshot({ path: path.join(AUDIT, 'live-settings.png'), fullPage: false });

out.allRequests = requests;
await browser.close();
console.log(JSON.stringify(out, null, 2));
