import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto('http://127.0.0.1:8787/chat', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Live chat proof/ }).click();
await page.locator('pre').filter({ hasText: 'I convert briefs into file matrices' }).waitFor();
await page.waitForTimeout(800);
await page.screenshot({ path: 'docs/CHAT-WAVE-1/live-chat-final.png', fullPage: false });
console.log(JSON.stringify({
  url: page.url(),
  live: await page.getByText('live', { exact: true }).count(),
  jobFields: await page.getByText('Job fields', { exact: true }).count(),
  succeeded: await page.getByText(/succeeded · attempt 1\/3/).count(),
}, null, 2));
await browser.close();
