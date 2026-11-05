// Supplemental interaction probes (safe/read-only): agents search/filter, shell nav toggle, skip link, run refresh.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'browser');
const BASE = 'http://127.0.0.1:8787';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = {};

// Agents search + group/output filters
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto(BASE + '/agents', { waitUntil: 'networkidle', timeout: 45000 });
  const total = await page.locator('button.agent-card').count();
  const shownBefore = await page.locator('.toolbar span').last().innerText();
  const search = page.locator('input[placeholder="Search agents, roles, IDs…"]');
  await search.fill('python');
  await page.waitForTimeout(300);
  const pythonCards = await page.locator('button.agent-card').count();
  const shownPython = await page.locator('.toolbar span').last().innerText();
  await search.fill('zzzz-no-match');
  await page.waitForTimeout(300);
  const emptyText = await page.locator('.empty-state').innerText().catch(() => null);
  await search.fill('');
  const selects = page.locator('.toolbar select');
  await selects.nth(0).selectOption('Control');
  await page.waitForTimeout(300);
  const controlCards = await page.locator('button.agent-card').count();
  const shownControl = await page.locator('.toolbar span').last().innerText();
  await selects.nth(0).selectOption('all');
  await selects.nth(1).selectOption('files');
  await page.waitForTimeout(300);
  const filesCards = await page.locator('button.agent-card').count();
  const shownFiles = await page.locator('.toolbar span').last().innerText();
  results.agents = { total, shownBefore, pythonCards, shownPython, emptyText, controlCards, shownControl, filesCards, shownFiles };
  await context.close();
}

// Shell nav toggle + skip link focus
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 });
  const menu = page.locator('button.topbar-menu');
  const before = { expanded: await menu.getAttribute('aria-expanded'), sidebarClass: await page.locator('#primary-navigation').getAttribute('class') };
  await menu.click();
  await page.waitForTimeout(250);
  const opened = { expanded: await menu.getAttribute('aria-expanded'), label: await menu.getAttribute('aria-label'), sidebarClass: await page.locator('#primary-navigation').getAttribute('class') };
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  const afterEscape = { expanded: await menu.getAttribute('aria-expanded'), sidebarClass: await page.locator('#primary-navigation').getAttribute('class') };
  // Skip link: focus it and activate, then inspect focus target.
  await page.keyboard.press('Tab');
  const firstFocus = await page.evaluate(() => ({ tag: document.activeElement?.tagName, text: document.activeElement?.innerText?.trim(), href: document.activeElement?.getAttribute?.('href') }));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const afterSkip = await page.evaluate(() => ({
    hash: location.hash,
    activeTag: document.activeElement?.tagName,
    activeId: document.activeElement?.id ?? null,
    mainTabIndex: document.querySelector('#main-content')?.getAttribute('tabindex'),
    scrolled: window.scrollY,
  }));
  results.shell = { before, opened, afterEscape, firstFocus, afterSkip };
  await context.close();
}

// Run detail Refresh button (GET only)
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const responses = [];
  page.on('response', (res) => { if (res.url().includes('/api/')) responses.push({ method: res.request().method(), url: res.url(), status: res.status() }); });
  await page.goto(BASE + '/runs/run_abf5fe78aab1e932ff', { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(600);
  const before = responses.length;
  await page.getByRole('button', { name: 'Refresh', exact: true }).first().click();
  await page.waitForTimeout(900);
  results.runRefresh = { requested: responses.slice(before), totalResponses: responses.length };
  await context.close();
}

fs.writeFileSync(path.join(OUT, 'interactions.json'), JSON.stringify(results, null, 2));
await browser.close();
console.log(JSON.stringify(results, null, 2));
