import { chromium } from '@playwright/test';
import fs from 'node:fs';

const base = 'http://127.0.0.1:8787';
const outDir = 'docs/IMPROVE-WAVE-7/trace';
fs.mkdirSync(outDir, { recursive: true });

const startedAt = new Date().toISOString();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const consoleErrors: string[] = [];
const failedRequests: string[] = [];
const runRequests: string[] = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('requestfailed', (req) => failedRequests.push(`${req.method()} ${req.url()} ${req.failure()?.errorText ?? ''}`));
page.on('request', (req) => {
  if (req.url().includes('/api/runs?')) runRequests.push(req.url());
});

const health = await (await fetch(`${base}/api/health`)).json();
const active = await (await fetch(`${base}/api/runs/active`)).json();
const allRunsResponse = await (await fetch(`${base}/api/runs?limit=100`)).json();
const completed = allRunsResponse.runs.filter((run: { status: string; artifacts?: unknown[] }) => run.status === 'completed');
const target = completed[0];

const pages: Record<string, unknown> = {};
for (const [name, route] of [
  ['overview', '/'],
  ['agents', '/agents'],
  ['runs', '/runs'],
  ['vault', '/vault'],
  ['learning', '/learning'],
  ['settings', '/settings'],
] as const) {
  await page.goto(base + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const heading = await page.locator('h1').first().textContent().catch(() => null);
  pages[name] = {
    route,
    url: page.url(),
    heading,
    bodyLength: (await page.locator('body').innerText()).length,
    screenshot: `${outDir}/${name}.png`,
  };
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: false });
}

// Runs status filter: prove the request is server-side and the visible rows change.
await page.goto(`${base}/runs`, { waitUntil: 'networkidle' });
const allRows = await page.locator('tbody tr').count();
await page.locator('select').first().selectOption('failed');
await page.waitForResponse((response) => response.url().includes('/api/runs?') && response.url().includes('status=failed'));
await page.waitForTimeout(300);
const failedRows = await page.locator('tbody tr').count();
const failedStatusCells = await page.locator('tbody tr').allInnerTexts();
await page.screenshot({ path: `${outDir}/runs-failed.png`, fullPage: false });
await page.locator('select').first().selectOption('queued');
await page.waitForResponse((response) => response.url().includes('/api/runs?') && response.url().includes('status=queued'));
await page.waitForTimeout(300);
const queuedRows = await page.locator('tbody tr').count();
const runsBody = await page.locator('body').innerText();
await page.screenshot({ path: `${outDir}/runs-queued.png`, fullPage: false });

// Settings nested limits: read rendered text, not the source payload.
await page.goto(`${base}/settings`, { waitUntil: 'networkidle' });
const settingsBody = (await page.locator('body').innerText()).toUpperCase();
const settings = {
  hasMaxRunCost: settingsBody.includes('LIMITS.MAXRUNCOSTUSD'),
  hasEventReplay: settingsBody.includes('LIMITS.EVENTREPLAYWINDOW'),
  hasMaxFiles: settingsBody.includes('LIMITS.MAXFILES'),
  hasObjectLeak: settingsBody.includes('[OBJECT OBJECT]'),
  hasKeyPrefix: /SK-[A-Z0-9]{16,}/.test(settingsBody),
};
await page.screenshot({ path: `${outDir}/settings-limits.png`, fullPage: false });

// Terminal run detail: all 8 tabs, active state and non-empty rendered content.
const tabs = ['Overview', 'Files', 'Checks', 'Routing', 'Context', 'Repairs', 'Confidence', 'Events'];
const tabResults: Record<string, unknown> = {};
await page.goto(`${base}/runs/${target.id}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const tabCount = await page.getByRole('tab').count();
for (const tab of tabs) {
  const locator = page.getByRole('tab', { name: new RegExp(`^${tab}$`) });
  await locator.click();
  await page.waitForTimeout(250);
  const selected = await locator.getAttribute('aria-selected');
  const body = await page.locator('body').innerText();
  tabResults[tab] = {
    selected,
    visible: await locator.isVisible(),
    bodyLength: body.length,
    containsTabName: body.toLowerCase().includes(tab.toLowerCase()),
    screenshot: `${outDir}/run-${tab.toLowerCase()}.png`,
  };
  await page.screenshot({ path: `${outDir}/run-${tab.toLowerCase()}.png`, fullPage: false });
}
const detailBody = await page.locator('body').innerText();
const terminalEvents = await (await fetch(`${base}/api/runs/${target.id}/events?limit=500`)).json();
const runRecord = await (await fetch(`${base}/api/runs/${target.id}`)).json();
const endActive = await (await fetch(`${base}/api/runs/active`)).json();

fs.writeFileSync(
  `${outDir}/trace.json`,
  JSON.stringify(
    {
      startedAt,
      finishedAt: new Date().toISOString(),
      health,
      activeAtStart: active.activeRunId,
      activeAtEnd: endActive.activeRunId,
      targetRun: {
        id: target.id,
        status: runRecord.run.status,
        phase: runRecord.run.phase,
        costUsd: runRecord.run.costUsd,
        artifactCount: runRecord.artifacts.length,
        eventCount: Array.isArray(terminalEvents.events) ? terminalEvents.events.length : terminalEvents.events?.length ?? null,
        bodyHasCompleted: /COMPLETED|Completed/i.test(detailBody),
      },
      pages,
      runsFilter: { allRows, failedRows, queuedRows, failedRowSamples: failedStatusCells.slice(0, 3), bodyHasServerFiltered: /server-filtered/i.test(runsBody) },
      settings,
      runTabs: { tabCount, tabs: tabResults },
      runRequests,
      consoleErrors,
      failedRequests,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    {
      targetRun: target.id,
      pageCount: Object.keys(pages).length,
      allRows,
      failedRows,
      queuedRows,
      settings,
      tabCount,
      tabs: Object.fromEntries(Object.entries(tabResults).map(([k, v]) => [k, { selected: (v as { selected: string | null }).selected, visible: (v as { visible: boolean }).visible }])),
      consoleErrors,
      failedRequests,
      runRequests,
    },
    null,
    2,
  ),
);
await browser.close();
