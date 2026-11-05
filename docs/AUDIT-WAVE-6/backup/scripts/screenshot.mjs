/**
 * screenshot.mjs — evidence-only UI capture. Not part of the product runtime.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = process.cwd();
const outDir = path.join(root, 'docs', 'verification');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto('http://127.0.0.1:8787/', { waitUntil: 'networkidle' });
await page.screenshot({ path: path.join(outDir, 'ui-overview.png'), fullPage: true });

const runs = await page.request.get('http://127.0.0.1:8787/api/runs?limit=10');
const body = await runs.json();
const run = body.runs.find((r) => r.status === 'completed' || r.status === 'completed_with_warnings') ?? body.runs[0];
if (run) {
  await page.goto(`http://127.0.0.1:8787/runs/${run.id}`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(outDir, 'ui-run-detail.png'), fullPage: true });
}
await page.goto('http://127.0.0.1:8787/learning', { waitUntil: 'networkidle' });
await page.screenshot({ path: path.join(outDir, 'ui-learning.png'), fullPage: true });
await browser.close();
console.log(`screenshots written to ${outDir}`);
