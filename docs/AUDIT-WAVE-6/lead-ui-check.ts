import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const out: Record<string, unknown> = {};
for (const [label, id] of [
  ['abf5', 'run_abf5fe78aab1e932ff'],
  ['95', 'run_95c11797b4923b4277'],
] as const) {
  await page.goto(`http://127.0.0.1:8787/runs/${id}`);
  await page.getByText(/Execution timeline|Running|Failed|Completed/i).first().waitFor({ timeout: 20_000 }).catch(() => undefined);
  out[label] = {
    url: page.url(),
    heading: await page.locator('h1').first().textContent().catch(() => null),
    bodyTop: (await page.locator('body').innerText()).slice(0, 900),
  };
  await page.screenshot({ path: `docs/AUDIT-WAVE-6/lead-ui-${label}.png`, fullPage: false });
}
console.log(JSON.stringify(out, null, 2));
await browser.close();
