import { chromium } from '@playwright/test';
import fs from 'node:fs';

const base = 'http://127.0.0.1:8787';
const out = 'docs/CHAT-WAVE-1';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors: string[] = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (err) => errors.push(err.message));

await page.goto(`${base}/chat`, { waitUntil: 'networkidle' });
await page.getByRole('heading', { name: 'Chat', exact: true }).waitFor();
const liveThread = page.getByRole('button', { name: /Live chat proof/ });
await liveThread.click();
await page.locator('pre').filter({ hasText: 'I convert briefs into file matrices' }).waitFor();
const liveJob = await page.getByText('Job fields', { exact: true }).count();
const liveStatus = await page.getByText('succeeded', { exact: false }).count();
await page.screenshot({ path: `${out}/live-chat.png`, fullPage: false });

// New conversation through the real UI. The first agent is the server's
// default selection; the select is not forced by a guessed display label.
await page.locator('input[placeholder="New conversation"]').fill('UI chat proof');
await page.getByRole('button', { name: /New conversation/ }).click();
await page.getByRole('heading', { name: 'UI chat proof' }).waitFor();
const newThreadVisible = await page.getByRole('button', { name: /UI chat proof/ }).first().isVisible();

// Send one small real message from the UI and wait for the durable answer.
await page.locator('textarea').fill('Reply with exactly: UI proof received.');
await page.getByRole('button', { name: /Send & queue job/ }).click();
await page.locator('pre').filter({ hasText: 'UI proof received' }).waitFor({ timeout: 90_000 });
const assistantCount = await page.locator('pre').filter({ hasText: 'UI proof received' }).count();
const pendingCount = await page.getByText(/Waiting for .* to answer/).count();
await page.screenshot({ path: `${out}/live-chat-message.png`, fullPage: false });

const state = {
  liveThreadVisible: await liveThread.isVisible().catch(() => false),
  liveJobFields: liveJob,
  liveStatusMentions: liveStatus,
  newThreadVisible,
  assistantCount,
  pendingCount,
  consoleErrors: errors,
};
fs.writeFileSync(`${out}/live-chat.json`, JSON.stringify(state, null, 2));
console.log(JSON.stringify(state, null, 2));
await browser.close();
