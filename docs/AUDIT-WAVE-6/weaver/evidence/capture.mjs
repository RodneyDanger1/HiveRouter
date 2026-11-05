// Weaver W6 read-only browser audit. Writes only under docs/AUDIT-WAVE-6/weaver/evidence/.
// No Start/Stop/cancel/revise/audit/approval/download/open-folder/paid action is clicked.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCREENS = path.join(HERE, 'screens');
const BROWSER_OUT = path.join(HERE, 'browser');
const LOGS = path.join(HERE, 'logs');
fs.mkdirSync(SCREENS, { recursive: true });
fs.mkdirSync(BROWSER_OUT, { recursive: true });
fs.mkdirSync(LOGS, { recursive: true });

const BASE = 'http://127.0.0.1:8787';
const RUN_ABF5 = 'run_abf5fe78aab1e932ff';
const RUN_DONE = 'run_95c11797b4923b4277';

const inventory = () => {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const nameOf = (el) => {
    const label = el.labels && el.labels.length ? [...el.labels].map((l) => l.innerText).join(' ') : '';
    const raw = el.getAttribute('aria-label') || label || el.getAttribute('title') || el.innerText || el.value || el.getAttribute('placeholder') || '';
    return String(raw).replace(/\s+/g, ' ').trim().slice(0, 160);
  };
  const cssPath = (el) => {
    if (el.id) return `#${el.id}`;
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && parts.length < 6) {
      let p = cur.tagName.toLowerCase();
      if (cur.classList.length) p += '.' + [...cur.classList].slice(0, 2).join('.');
      const parent = cur.parentElement;
      if (parent) {
        const sibs = [...parent.children].filter((c) => c.tagName === cur.tagName);
        if (sibs.length > 1) p += `:nth-of-type(${sibs.indexOf(cur) + 1})`;
      }
      parts.unshift(p);
      cur = parent;
    }
    return parts.join(' > ');
  };
  const els = [...document.querySelectorAll('a,button,input,select,textarea,summary,[role="tab"],[role="link"],[role="button"],[role="switch"],[role="checkbox"]')];
  return els
    .map((el, i) => ({
      i,
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type'),
      role: el.getAttribute('role'),
      name: nameOf(el),
      href: el.getAttribute('href'),
      disabled: Boolean(el.disabled),
      ariaDisabled: el.getAttribute('aria-disabled'),
      ariaSelected: el.getAttribute('aria-selected'),
      ariaExpanded: el.getAttribute('aria-expanded'),
      tabIndex: el.tabIndex,
      visible: visible(el),
      selector: cssPath(el),
    }))
    .filter((x) => x.visible);
};

const summarizeControls = (controls) => {
  const byTag = {};
  for (const c of controls) byTag[c.tag] = (byTag[c.tag] || 0) + 1;
  return { total: controls.length, byTag };
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });

async function capturePage(id, urlPath, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const consoleMsgs = [];
  const pageErrors = [];
  const failedRequests = [];
  const responses = [];
  page.on('console', (msg) => consoleMsgs.push({ type: msg.type(), text: msg.text().slice(0, 1000) }));
  page.on('pageerror', (err) => pageErrors.push(String(err).slice(0, 1000)));
  page.on('requestfailed', (req) => failedRequests.push({ url: req.url(), method: req.method(), failure: req.failure()?.errorText ?? null }));
  page.on('response', (res) => {
    if (res.url().includes('/api/')) responses.push({ method: res.request().method(), url: res.url(), status: res.status() });
  });

  const started = new Date().toISOString();
  await page.goto(BASE + urlPath, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(options.settleMs ?? 800);

  const state = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    h1: document.querySelector('h1')?.innerText?.trim() ?? null,
    headings: [...document.querySelectorAll('h1,h2,h3')].map((h) => h.innerText.replace(/\s+/g, ' ').trim()).slice(0, 60),
    notices: [...document.querySelectorAll('.inline-notice,.empty-state,.card[role="alert"]')].map((n) => n.innerText.replace(/\s+/g, ' ').trim().slice(0, 300)).slice(0, 20),
    badges: [...document.querySelectorAll('.badge,.code-chip,.stage-chip,.status-pill')].map((b) => ({ text: b.innerText.replace(/\s+/g, ' ').trim(), className: b.className })).slice(0, 80),
    navLinks: [...document.querySelectorAll('.nav-link')].map((a) => ({ text: a.innerText.replace(/\s+/g, ' ').trim(), href: a.getAttribute('href'), active: a.className.includes('nav-link-active') })),
    links: [...document.querySelectorAll('a')].filter((a) => a.offsetParent !== null).map((a) => ({ text: a.innerText.replace(/\s+/g, ' ').trim().slice(0, 100), href: a.getAttribute('href') })).slice(0, 80),
    text: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 6000),
  }));
  const controls = await page.evaluate(inventory);
  const shot = path.join(SCREENS, `${id}.png`);
  await page.screenshot({ path: shot, fullPage: true });

  let aria = null;
  try {
    aria = await page.locator('body').ariaSnapshot();
  } catch (error) {
    aria = `ariaSnapshot unavailable: ${String(error).slice(0, 200)}`;
  }

  const record = {
    id,
    urlPath,
    startedAt: started,
    state,
    controls,
    controlSummary: summarizeControls(controls),
    console: consoleMsgs,
    pageErrors,
    failedRequests,
    apiResponses: responses,
    screenshot: path.relative(HERE, shot).replaceAll('\\', '/'),
    ariaSnapshot: aria,
  };
  await context.close();
  return record;
}

const pages = [];
pages.push(await capturePage('overview', '/'));
pages.push(await capturePage('agents', '/agents'));
pages.push(await capturePage('runs', '/runs'));
pages.push(await capturePage('vault', '/vault'));
pages.push(await capturePage('learning', '/learning'));
pages.push(await capturePage('settings', '/settings'));
pages.push(await capturePage('not-found', '/no-such-page'));

// ---------- Runs page filter interaction (safe, local state only) ----------
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const responses = [];
  page.on('response', (res) => { if (res.url().includes('/api/')) responses.push({ method: res.request().method(), url: res.url(), status: res.status() }); });
  await page.goto(BASE + '/runs', { waitUntil: 'networkidle', timeout: 45000 });
  const before = await page.locator('tbody tr').count();
  const select = page.locator('select').first();
  await select.selectOption('failed');
  await page.waitForTimeout(400);
  const after = await page.locator('tbody tr').count();
  const shown = await page.locator('.toolbar span').last().innerText();
  const rowStatuses = await page.locator('tbody tr td:nth-child(3)').allInnerTexts();
  await page.screenshot({ path: path.join(SCREENS, 'runs-filter-failed.png'), fullPage: true });
  await select.selectOption('budget_exceeded');
  await page.waitForTimeout(300);
  const budgetRows = await page.locator('tbody tr').count();
  const budgetStatuses = await page.locator('tbody tr td:nth-child(3)').allInnerTexts();
  fs.writeFileSync(path.join(BROWSER_OUT, 'runs-filter.json'), JSON.stringify({ before, after, shown, rowStatuses, budgetRows, budgetStatuses, responses }, null, 2));
  await context.close();
}

// ---------- Agents drawer + dialog (GET only; no save/reset/run) ----------
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const responses = [];
  const consoleMsgs = [];
  page.on('console', (m) => consoleMsgs.push({ type: m.type(), text: m.text().slice(0, 500) }));
  page.on('response', (res) => { if (res.url().includes('/api/')) responses.push({ method: res.request().method(), url: res.url(), status: res.status() }); });
  await page.goto(BASE + '/agents', { waitUntil: 'networkidle', timeout: 45000 });
  const cards = await page.locator('button.agent-card').count();
  const firstCardName = await page.locator('button.agent-card').first().getAttribute('aria-label');
  await page.locator('button.agent-card').first().click();
  await page.waitForTimeout(900);
  const drawer = {
    title: await page.locator('[role="dialog"] h2').first().innerText().catch(() => null),
    dialogVisible: await page.locator('[role="dialog"]').first().isVisible().catch(() => false),
    controls: await page.evaluate(inventory),
    text: (await page.locator('[role="dialog"]').first().innerText().catch(() => '')).slice(0, 5000),
    focusAfterOpen: await page.evaluate(() => ({ tag: document.activeElement?.tagName, label: document.activeElement?.getAttribute('aria-label'), id: document.activeElement?.id })),
  };
  await page.screenshot({ path: path.join(SCREENS, 'agents-drawer.png'), fullPage: true });

  // Open prompt edit then Reset confirm dialog; do NOT confirm.
  await page.getByRole('button', { name: /Edit prompt/i }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /^Reset$/ }).click();
  await page.waitForTimeout(500);
  const dialogs = await page.locator('[role="dialog"]').count();
  const confirmText = await page.locator('[role="dialog"]').last().innerText().catch(() => '');
  const confirmControls = await page.locator('[role="dialog"]').last().evaluate(inventory).catch(() => []);
  await page.screenshot({ path: path.join(SCREENS, 'agents-reset-confirm.png'), fullPage: true });
  // Escape should close only the confirm dialog, not both layers.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const dialogsAfterEscape = await page.locator('[role="dialog"]').count();
  const drawerStillVisible = await page.locator('[role="dialog"]').first().isVisible().catch(() => false);
  // Close the drawer if still open (Escape again or Close button).
  if (drawerStillVisible) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
  const drawerAfterEsc = await page.locator('[role="dialog"]').count();

  fs.writeFileSync(path.join(BROWSER_OUT, 'agents-drawer.json'), JSON.stringify({
    cards, firstCardName, drawer, dialogs, confirmText: confirmText.slice(0, 2000), confirmControls,
    dialogsAfterEscape, drawerStillVisible, drawerAfterEsc, responses, consoleMsgs,
  }, null, 2));
  await context.close();
}

// ---------- Vault file selection (GET only) ----------
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const responses = [];
  page.on('response', (res) => { if (res.url().includes('/api/')) responses.push({ method: res.request().method(), url: res.url(), status: res.status() }); });
  await page.goto(BASE + '/vault', { waitUntil: 'networkidle', timeout: 45000 });
  const rows = await page.locator('button.vault-row').count();
  const fileRows = page.locator('button.vault-row').filter({ hasText: /\.md$/i });
  const fileRowCount = await fileRows.count();
  const firstFileText = fileRowCount ? await fileRows.first().innerText() : null;
  let preview = null;
  if (fileRowCount > 0) {
    await fileRows.first().click();
    await page.waitForTimeout(900);
    preview = await page.evaluate(() => ({
      path: document.querySelector('.prose-nds p')?.innerText ?? null,
      articleText: document.querySelector('.prose-nds')?.innerText?.slice(0, 1200) ?? null,
      heading: document.querySelector('.prose-nds h1')?.innerText ?? null,
    }));
    await page.screenshot({ path: path.join(SCREENS, 'vault-file-preview.png'), fullPage: true });
  }
  fs.writeFileSync(path.join(BROWSER_OUT, 'vault.json'), JSON.stringify({ rows, fileRowCount, firstFileText, preview, responses }, null, 2));
  await context.close();
}

// ---------- Learning + Settings refresh (GET) ----------
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const responses = [];
  page.on('response', (res) => { if (res.url().includes('/api/')) responses.push({ method: res.request().method(), url: res.url(), status: res.status() }); });
  await page.goto(BASE + '/learning', { waitUntil: 'networkidle', timeout: 45000 });
  const learning = await page.evaluate(() => ({
    tabs: [...document.querySelectorAll('[role="tab"]')].map((t) => ({ text: t.innerText.trim(), disabled: t.disabled, ariaDisabled: t.getAttribute('aria-disabled') })),
    codes: [...document.querySelectorAll('.code-chip')].map((c) => c.innerText.trim()),
    text: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 3000),
  }));
  fs.writeFileSync(path.join(BROWSER_OUT, 'learning.json'), JSON.stringify({ learning, responses }, null, 2));

  await page.goto(BASE + '/settings', { waitUntil: 'networkidle', timeout: 45000 });
  const settingsBefore = await page.evaluate(() => ({
    fields: [...document.querySelectorAll('.kv-row')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()),
    runtime: [...document.querySelectorAll('dl.grid > div')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()),
    text: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 3000),
  }));
  await page.getByRole('button', { name: /Refresh/i }).click();
  await page.waitForTimeout(1200);
  fs.writeFileSync(path.join(BROWSER_OUT, 'settings.json'), JSON.stringify({ settingsBefore, responses }, null, 2));
  await context.close();
}

// ---------- Run detail (abf5 = failed, done = completed) ----------
async function captureRunDetail(id, runId, label) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const consoleMsgs = [];
  const pageErrors = [];
  const failedRequests = [];
  const responses = [];
  page.on('console', (m) => consoleMsgs.push({ type: m.type(), text: m.text().slice(0, 500) }));
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 500)));
  page.on('requestfailed', (r) => failedRequests.push({ url: r.url(), failure: r.failure()?.errorText }));
  page.on('response', (res) => { if (res.url().includes('/api/')) responses.push({ method: res.request().method(), url: res.url(), status: res.status() }); });

  await page.goto(`${BASE}/runs/${runId}`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(1200);

  const header = await page.evaluate(() => {
    const badges = [...document.querySelectorAll('.card .badge, .card .badge-success, .card .badge-error, .card .badge-warn, .card .badge-muted, .card .badge-info')].map((b) => ({ text: b.innerText.replace(/\s+/g, ' ').trim(), cls: b.className }));
    const actions = [...document.querySelectorAll('.page-header .btn, .page-header a.btn')].map((a) => ({ tag: a.tagName.toLowerCase(), text: a.innerText.replace(/\s+/g, ' ').trim(), disabled: Boolean(a.disabled), title: a.getAttribute('title'), href: a.getAttribute('href') }));
    const facts = [...document.querySelectorAll('dl')].slice(0, 3).map((dl) => dl.innerText.replace(/\s+/g, ' ').trim().slice(0, 800));
    const costMeter = [...document.querySelectorAll('.meter')].map((m) => m.parentElement?.innerText.replace(/\s+/g, ' ').trim() ?? '');
    const tabs = [...document.querySelectorAll('[role="tab"]')].map((t) => ({ text: t.innerText.trim(), disabled: t.disabled, ariaDisabled: t.getAttribute('aria-disabled'), selected: t.getAttribute('aria-selected') }));
    const raw = document.body.innerText.replace(/\s+/g, ' ').trim();
    return { badges, actions, facts, costMeter, tabs, h1: document.querySelector('h1')?.innerText ?? null, rawStart: raw.slice(0, 4000) };
  });

  const apiSnapshot = await page.evaluate(async (rid) => {
    const [snap, ev] = await Promise.all([
      fetch(`/api/runs/${rid}/snapshot`).then((r) => r.json()),
      fetch(`/api/runs/${rid}/events`).then((r) => r.json()),
    ]);
    return {
      status: snap.run?.status, phase: snap.run?.phase, steps: snap.steps?.length, checks: snap.checks?.length,
      artifacts: snap.artifacts?.length, costUsd: snap.run?.costUsd, promptTokens: snap.run?.promptTokens,
      completionTokens: snap.run?.completionTokens, snapshotHash: snap.run?.snapshotHash,
      lastEventId: snap.lastEventId, truncated: snap.truncated, hasLimits: Object.hasOwn(snap, 'limits'),
      eventsCount: ev.events?.length, eventsTruncated: ev.truncated, eventsLastId: ev.lastEventId,
    };
  }, runId);

  await page.screenshot({ path: path.join(SCREENS, `${label}-overview.png`), fullPage: true });

  const tabResults = [];
  const tabNames = ['Overview', 'Files', 'Checks', 'Routing', 'Context', 'Repairs', 'Confidence', 'Events'];
  for (const name of tabNames) {
    const tab = page.getByRole('tab', { name, exact: true });
    const exists = (await tab.count()) > 0;
    if (!exists) { tabResults.push({ name, exists: false }); continue; }
    if (await tab.isDisabled().catch(() => true)) {
      tabResults.push({ name, exists: true, disabled: true, hint: await tab.getAttribute('title') });
      continue;
    }
    await tab.click();
    await page.waitForTimeout(name === 'Events' ? 1200 : 900);
    const panel = await page.evaluate(() => {
      const p = document.querySelector('[role="tabpanel"]');
      const tables = [...(p?.querySelectorAll('table') ?? [])].map((t) => ({
        headers: [...t.querySelectorAll('thead th')].map((h) => h.innerText.trim()),
        rows: [...t.querySelectorAll('tbody tr')].map((r) => [...r.querySelectorAll('td')].map((c) => c.innerText.replace(/\s+/g, ' ').trim().slice(0, 160))).slice(0, 12),
        rowCount: t.querySelectorAll('tbody tr').length,
      }));
      const details = [...(p?.querySelectorAll('details') ?? [])].map((d) => d.innerText.replace(/\s+/g, ' ').trim().slice(0, 400)).slice(0, 6);
      return { text: (p?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 3500), tables, details, tableCount: tables.length };
    });
    const panelShot = path.join(SCREENS, `${label}-tab-${name.toLowerCase()}.png`);
    await page.locator('[role="tabpanel"]').screenshot({ path: panelShot }).catch(() => {});
    tabResults.push({ name, exists: true, disabled: false, panel, screenshot: path.relative(HERE, panelShot).replaceAll('\\', '/') });
    if (name === 'Events') {
      // Expand the first Inspect details and capture the raw payload text.
      const firstInspect = page.locator('[role="tabpanel"] details summary').first();
      if (await firstInspect.count()) {
        await firstInspect.click().catch(() => {});
        await page.waitForTimeout(300);
        tabResults[tabResults.length - 1].rawInspect = await page.locator('[role="tabpanel"] pre').first().innerText().catch(() => null);
        await page.screenshot({ path: path.join(SCREENS, `${label}-events-inspect.png`), fullPage: true });
      }
    }
  }

  // Keyboard probe on the tablist (safe): focus active tab, ArrowRight moves selection.
  const activeTabBefore = await page.locator('[role="tab"][aria-selected="true"]').first().innerText().catch(() => null);
  await page.locator('[role="tab"][aria-selected="true"]').first().focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(500);
  const activeTabAfterArrow = await page.locator('[role="tab"][aria-selected="true"]').first().innerText().catch(() => null);

  // Re-load convergence probe: page must render the same terminal state after a hard reload.
  await page.reload({ waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(1500);
  const afterReload = await page.evaluate(() => {
    const badges = [...document.querySelectorAll('.card .badge')].slice(0, 8).map((b) => b.innerText.replace(/\s+/g, ' ').trim());
    return { badges, h1: document.querySelector('h1')?.innerText ?? null, bodyHasLiveStream: document.body.innerText.includes('Live stream'), bodyHasTerminalSnapshot: document.body.innerText.includes('Terminal · snapshot'), rawStart: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 1200) };
  });

  await context.close();
  return { id, runId, header, apiSnapshot, tabResults, keyboard: { activeTabBefore, activeTabAfterArrow }, afterReload, consoleMsgs, pageErrors, failedRequests, responses };
}

const abf5 = await captureRunDetail('run-abf5', RUN_ABF5, 'run-abf5');
const done = await captureRunDetail('run-95', RUN_DONE, 'run-95');
fs.writeFileSync(path.join(BROWSER_OUT, 'run-abf5-detail.json'), JSON.stringify(abf5, null, 2));
fs.writeFileSync(path.join(BROWSER_OUT, 'run-95-detail.json'), JSON.stringify(done, null, 2));

// ---------- Focus order probe on Overview ----------
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 45000 });
  const order = [];
  for (let i = 0; i < 10; i += 1) {
    await page.keyboard.press('Tab');
    order.push(await page.evaluate(() => {
      const el = document.activeElement;
      return { tag: el?.tagName, id: el?.id ?? null, label: el?.getAttribute?.('aria-label') ?? null, text: (el?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 80) };
    }));
  }
  fs.writeFileSync(path.join(BROWSER_OUT, 'focus-order.json'), JSON.stringify({ order }, null, 2));
  await context.close();
}

fs.writeFileSync(path.join(BROWSER_OUT, 'pages.json'), JSON.stringify(pages, null, 2));
await browser.close();
console.log(JSON.stringify({
  pages: pages.map((p) => ({ id: p.id, url: p.state.url, h1: p.state.h1, controls: p.controlSummary, consoleErrors: p.console.filter((c) => c.type === 'error').length, pageErrors: p.pageErrors.length, failedRequests: p.failedRequests.length, apiCount: p.apiResponses.length })),
  abf5: { status: abf5.apiSnapshot.status, steps: abf5.apiSnapshot.steps, tabs: abf5.tabResults.map((t) => ({ name: t.name, disabled: t.disabled })), afterReload: abf5.afterReload.badges },
  done: { status: done.apiSnapshot.status, steps: done.apiSnapshot.steps, tabs: done.tabResults.map((t) => ({ name: t.name, disabled: t.disabled })) },
}, null, 2));
