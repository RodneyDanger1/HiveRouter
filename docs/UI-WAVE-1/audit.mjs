import { chromium } from '@playwright/test';
import fs from 'node:fs';

const base = 'http://127.0.0.1:8787';
const shots = 'docs/UI-WAVE-1/shots';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(`PAGEERROR ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`CONSOLE ${message.text()}`); });

const runsResponse = await page.request.get(`${base}/api/runs?limit=100`);
const runsBody = await runsResponse.json();
const runs = runsBody.runs ?? [];
let target = null;
let failedNoArtifacts = null;
for (const run of runs) {
  const detail = await (await page.request.get(`${base}/api/runs/${run.id}`)).json();
  const artifacts = detail.artifacts ?? [];
  if (!target && artifacts.length > 0) target = { run, detail };
  if (!failedNoArtifacts && ['failed', 'cancelled', 'budget_exceeded', 'interrupted'].includes(run.status) && artifacts.length === 0) {
    failedNoArtifacts = { run, detail };
  }
}
if (!target) throw new Error('No completed run with artifacts');

function summarize(name, body) {
  const text = body.replace(/\s+/g, ' ');
  console.log(`${name}: ${text.slice(0, 220)}`);
}

async function shot(name) {
  await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
}

async function overflow(name) {
  const data = await page.evaluate(() => {
    const width = window.innerWidth;
    const offenders = [...document.querySelectorAll('body *')]
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return style.position !== 'fixed' && rect.width > 0 && rect.right > width + 1;
      })
      .slice(0, 5)
      .map((el) => `${el.tagName}.${String(el.className).slice(0, 60)} right=${Math.round(el.getBoundingClientRect().right)}`);
    return { scrollWidth: document.documentElement.scrollWidth, width, offenders };
  });
  console.log(`OVERFLOW ${name}: ${JSON.stringify(data)}`);
  return data;
}

async function visit(path, name, width = 1440) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  const before = errors.length;
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await shot(name);
  await overflow(name);
  const title = await page.locator('h1').first().innerText().catch(() => 'NO H1');
  summarize(`ROUTE ${name}`, `${title}`);
  console.log(`ERRORS ${name}: ${JSON.stringify(errors.slice(before))}`);
  return title;
}

await visit('/', 'overview-1440');
await visit('/agents', 'agents-1440');
await visit('/runs', 'runs-1440');
await visit(`/runs/${target.run.id}`, 'run-detail-1440');

for (const tab of ['Routing', 'Context', 'Repairs', 'Checks', 'Confidence', 'Files', 'Events']) {
  await page.getByRole('tab', { name: tab, exact: true }).click();
  await page.waitForTimeout(250);
  await shot(`run-tab-${tab.toLowerCase()}-1440`);
  summarize(`TAB ${tab}`, await page.locator('body').innerText());
}

await visit('/learning', 'learning-1440');
for (const tab of ['Overview', 'Traces', 'Failures', 'Datasets', 'Candidates', 'Evaluations', 'Promotions', 'Audit']) {
  const button = page.getByRole('tab', { name: tab, exact: true });
  if (await button.count()) {
    await button.click();
    await page.waitForTimeout(150);
  }
}
await shot('learning-tabs-1440');
await visit('/vault', 'vault-1440');
const fileButton = page.locator('.vault-row').filter({ hasText: '.md' }).first();
if (await fileButton.count()) {
  await fileButton.click();
  await page.waitForTimeout(400);
  await shot('vault-file-1440');
}
await visit('/settings', 'settings-1440');

// Agent drawer and prompt/edit/reset/ad-hoc states.
await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto(`${base}/agents`, { waitUntil: 'networkidle' });
await page.locator('.agent-card').first().click();
await page.getByRole('dialog').waitFor();
await page.waitForTimeout(250);
await shot('agent-drawer-1440');
const unnamed = await page.locator('button').evaluateAll((buttons) => buttons.filter((button) => {
  const label = button.getAttribute('aria-label') || button.getAttribute('title') || button.textContent || '';
  return label.trim().length === 0;
}).length);
console.log(`UNNAMED_BUTTONS ${unnamed}`);
const focusInside = await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')));
console.log(`MODAL_FOCUS_INSIDE ${focusInside}`);
await page.getByRole('button', { name: 'Edit prompt', exact: true }).click();
await page.waitForTimeout(150);
await shot('agent-prompt-edit-1440');
const hasReset = await page.getByRole('button', { name: 'Reset', exact: true }).count();
console.log(`PROMPT_RESET_VISIBLE ${hasReset}`);
await page.getByRole('button', { name: 'Reset', exact: true }).click();
await page.getByRole('dialog').last().waitFor();
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
console.log(`RESET_ESCAPE_CLOSED ${(await page.getByText('Reset prompt override').count()) === 0}`);
await page.getByRole('button', { name: 'Close', exact: true }).click();

// Run actions: revise, audit, download, open folder.
await page.goto(`${base}/runs/${target.run.id}`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Revise', exact: true }).click();
await page.getByRole('dialog').waitFor();
await page.waitForTimeout(150);
const revisionTextarea = page.getByRole('dialog').locator('textarea');
await revisionTextarea.fill('x');
const revisionDisabled = await page.getByRole('button', { name: 'Start revision', exact: true }).isDisabled();
console.log(`REVISE_SHORT_FEEDBACK_DISABLED ${revisionDisabled}`);
await page.keyboard.press('Escape');
await page.getByRole('button', { name: 'Audit', exact: true }).click();
await page.getByRole('dialog').waitFor();
await page.waitForTimeout(150);
await shot('audit-confirm-1440');
await page.keyboard.press('Escape');
await page.waitForTimeout(150);
const downloadHref = await page.getByRole('link', { name: 'Download', exact: true }).getAttribute('href').catch(() => null);
console.log(`DOWNLOAD_HREF ${downloadHref}`);
const openFolder = page.getByRole('button', { name: 'Open folder', exact: true });
if (await openFolder.count()) {
  await openFolder.click();
  await page.waitForTimeout(700);
  const feedback = (await page.locator('body').innerText()).match(/opened|folder|error/i)?.[0] ?? 'none';
  console.log(`OPEN_FOLDER_FEEDBACK ${feedback}`);
  await shot('open-folder-after-1440');
}

if (failedNoArtifacts) {
  await page.goto(`${base}/runs/${failedNoArtifacts.run.id}`, { waitUntil: 'networkidle' });
  const links = await page.getByRole('link', { name: 'Download', exact: true }).count();
  const disabled = await page.getByRole('button', { name: 'Download', exact: true }).isDisabled();
  console.log(`NO_ARTIFACT_DOWNLOAD links=${links} disabled=${disabled}`);
  await shot('run-no-artifact-1440');
}

// Learning disabled state via route interception (test double at boundary).
const disabledPage = await context.newPage();
await disabledPage.route('**/api/learning/overview', (route) => route.fulfill({
  status: 403,
  contentType: 'application/json',
  body: JSON.stringify({ error: { code: 'E_LEARNING_DISABLED', message: 'Learning is disabled.' } }),
}));
await disabledPage.goto(`${base}/learning`, { waitUntil: 'networkidle' });
await disabledPage.waitForTimeout(200);
await disabledPage.screenshot({ path: `${shots}/learning-disabled-1440.png`, fullPage: true });
const disabledText = (await disabledPage.locator('body').innerText()).replace(/\s+/g, ' ');
console.log(`LEARNING_DISABLED ${disabledText.includes('Learning is off')} ${disabledText.includes('E_LEARNING_DISABLED')}`);
await disabledPage.close();

// Responsive pass.
await visit('/', 'overview-390', 390);
await page.getByRole('button', { name: /open navigation/i }).click().catch(() => {});
await page.waitForTimeout(150);
await shot('nav-mobile-390');
await page.keyboard.press('Escape');
await visit('/agents', 'agents-390', 390);
await page.locator('.agent-card').first().click();
await page.getByRole('dialog').waitFor();
await page.waitForTimeout(150);
await shot('agent-drawer-390');
await page.keyboard.press('Escape');
await visit(`/runs/${target.run.id}`, 'run-detail-390', 390);
await page.getByRole('tab', { name: 'Context', exact: true }).click();
await page.waitForTimeout(200);
await shot('run-context-390');
await visit('/learning', 'learning-390', 390);
await visit('/vault', 'vault-390', 390);
await visit('/settings', 'settings-390', 390);

// Keyboard: first focus is skip link; Escape closes modal and returns focus.
await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto(`${base}/`, { waitUntil: 'networkidle' });
await page.keyboard.press('Tab');
const firstFocus = await page.evaluate(() => `${document.activeElement?.tagName}:${document.activeElement?.textContent?.trim().slice(0, 30)}`);
console.log(`FIRST_TAB ${firstFocus}`);

// Secret leakage in rendered storage.
const secrets = await page.evaluate(() => {
  const blob = `${document.documentElement.innerText}\n${JSON.stringify(localStorage)}\n${JSON.stringify(sessionStorage)}`;
  return /sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{30,}/.test(blob);
});
console.log(`SECRET_IN_PAGE_OR_STORAGE ${secrets}`);

console.log(`PAGE_ERRORS_TOTAL ${JSON.stringify(errors)}`);
await browser.close();
