import { chromium } from '@playwright/test';

const routes = ['/', '/agents', '/runs', '/vault', '/settings', '/learning'];
const viewports = [
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '1600x900', width: 1600, height: 900 },
  { name: '1440x780', width: 1440, height: 780 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
for (const viewport of viewports) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const route of routes) {
    await page.goto(`http://127.0.0.1:8787${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(350);
    const metrics = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      h1: Boolean(document.querySelector('h1')),
    }));
    results.push({
      viewport: viewport.name,
      route,
      ...metrics,
      horizontalOverflow: metrics.scrollWidth > metrics.innerWidth + 1,
      pageErrors: errors.slice(),
    });
  }
  await context.close();
}
await browser.close();
const failures = results.filter((row) => row.horizontalOverflow || !row.h1 || row.pageErrors.length > 0);
console.log(JSON.stringify({ checked: results.length, failures }, null, 2));
process.exit(failures.length === 0 ? 0 : 1);
