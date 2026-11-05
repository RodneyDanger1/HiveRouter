import { chromium } from 'playwright';
import fs from 'node:fs';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const api = [];
page.on('response', (r) => { if (r.url().includes('/api/')) api.push({ method: r.request().method(), url: r.url(), status: r.status() }); });
await page.goto('http://127.0.0.1:8787/runs/run_582bf88992c0ee98ae', { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForTimeout(900);
const info = await page.evaluate(() => {
  const header = document.querySelector('header.page-header');
  const parent = [...document.querySelectorAll('dl div')].find((d) => d.innerText.startsWith('PARENT'));
  return {
    eyebrow: header?.querySelector('.eyebrow')?.textContent ?? null,
    description: header?.querySelector('.page-description')?.textContent ?? null,
    actions: [...document.querySelectorAll('.page-header .btn, .page-header a.btn')].map((a) => ({ tag: a.tagName.toLowerCase(), text: a.innerText.trim(), href: a.getAttribute('href'), disabled: Boolean(a.disabled) })),
    parentText: parent?.innerText ?? null,
    parentHref: parent?.querySelector('a')?.getAttribute('href') ?? null,
    badges: [...document.querySelectorAll('.card .badge')].slice(0, 6).map((b) => b.innerText.trim()),
  };
});
let parentNav = null;
if (info.parentHref) {
  await page.locator(`dl a[href="${info.parentHref}"]`).first().click();
  await page.waitForTimeout(900);
  parentNav = { url: page.url(), eyebrow: await page.locator('header.page-header .eyebrow').innerText().catch(() => null) };
}
fs.writeFileSync('docs/AUDIT-WAVE-6/weaver/evidence/browser/run-audit-parent.json', JSON.stringify({ info, parentNav, api }, null, 2));
await page.screenshot({ path: 'docs/AUDIT-WAVE-6/weaver/evidence/screens/run-audit-parent.png', fullPage: true });
console.log(JSON.stringify({ info, parentNav, api }, null, 2));
await browser.close();
