// Supplemental read-only probes: run-detail control census, a11y attributes, HTTP status edges.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'browser');
const BASE = 'http://127.0.0.1:8787';

const inventory = () => {
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const nameOf = (el) => {
    const label = el.labels && el.labels.length ? [...el.labels].map((l) => l.innerText).join(' ') : '';
    const raw = el.getAttribute('aria-label') || label || el.getAttribute('title') || el.innerText || el.value || el.getAttribute('placeholder') || '';
    return String(raw).replace(/\s+/g, ' ').trim().slice(0, 160);
  };
  const cssPath = (el) => {
    if (el.id) return `#${el.id}`;
    const parts = []; let cur = el;
    while (cur && cur.nodeType === 1 && parts.length < 6) {
      let p = cur.tagName.toLowerCase();
      if (cur.classList.length) p += '.' + [...cur.classList].slice(0, 2).join('.');
      const parent = cur.parentElement;
      if (parent) { const sibs = [...parent.children].filter((c) => c.tagName === cur.tagName); if (sibs.length > 1) p += `:nth-of-type(${sibs.indexOf(cur) + 1})`; }
      parts.unshift(p); cur = parent;
    }
    return parts.join(' > ');
  };
  const els = [...document.querySelectorAll('a,button,input,select,textarea,summary,[role="tab"],[role="link"],[role="button"]')];
  return els.map((el) => ({
    tag: el.tagName.toLowerCase(), type: el.getAttribute('type'), role: el.getAttribute('role'), name: nameOf(el),
    href: el.getAttribute('href'), disabled: Boolean(el.disabled), ariaDisabled: el.getAttribute('aria-disabled'),
    ariaSelected: el.getAttribute('aria-selected'), ariaExpanded: el.getAttribute('aria-expanded'),
    ariaControls: el.getAttribute('aria-controls'), tabIndex: el.tabIndex, visible: visible(el), selector: cssPath(el),
  })).filter((x) => x.visible);
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = {};
for (const [label, runId] of [['run-abf5', 'run_abf5fe78aab1e932ff'], ['run-95', 'run_95c11797b4923b4277']]) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/runs/${runId}`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(800);
  const overviewControls = await page.evaluate(inventory);
  const a11y = await page.evaluate(() => {
    const panel = document.querySelector('[role="tabpanel"]');
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    const skip = document.querySelector('.skip-link');
    const main = document.querySelector('#main-content');
    return {
      tabpanel: panel ? { role: panel.getAttribute('role'), id: panel.id || null, ariaLabelledby: panel.getAttribute('aria-labelledby'), ariaLabel: panel.getAttribute('aria-label') } : null,
      tabs: tabs.map((t) => ({ text: t.innerText.trim(), ariaControls: t.getAttribute('aria-controls'), ariaSelected: t.getAttribute('aria-selected'), tabIndex: t.tabIndex, disabled: t.disabled })),
      skipLink: skip ? { href: skip.getAttribute('href'), text: skip.innerText.trim() } : null,
      mainId: main?.id ?? null,
      tablistLabel: document.querySelector('[role="tablist"]')?.getAttribute('aria-label'),
    };
  });
  const controlsByTab = {};
  for (const name of ['Overview', 'Files', 'Checks', 'Routing', 'Context', 'Repairs', 'Confidence', 'Events']) {
    const tab = page.getByRole('tab', { name, exact: true });
    if (await tab.count()) {
      await tab.click().catch(() => {});
      await page.waitForTimeout(600);
      controlsByTab[name] = (await page.evaluate(inventory)).length;
    }
  }
  results[label] = { overviewControls, overviewControlCount: overviewControls.length, controlsByTab, a11y };
  await page.screenshot({ path: path.join(HERE, 'screens', `${label}-final.png`), fullPage: true });
  await context.close();
}

// HTTP edge probes (read-only GETs).
const probe = async (urlPath) => {
  const res = await fetch(BASE + urlPath, { redirect: 'manual', headers: { Accept: 'text/html' } });
  return { urlPath, status: res.status, contentType: res.headers.get('content-type'), frames: res.headers.get('x-frame-options'), csp: Boolean(res.headers.get('content-security-policy')) };
};
results.http = {
  favicon: await probe('/favicon.ico'),
  unknownHtml: await probe('/no-such-page'),
  unknownApi: await probe('/api/nope'),
  knownSpa: await probe('/runs'),
  openapi: await probe('/openapi.json'),
  docs: await probe('/api/docs'),
};
fs.writeFileSync(path.join(OUT, 'run-detail-controls.json'), JSON.stringify(results, null, 2));
await browser.close();
console.log(JSON.stringify(results, null, 2));
