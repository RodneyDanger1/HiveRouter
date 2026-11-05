/**
 * INDEPENDENT Wave 7 auditor probe — live UI truth without writing artifacts.
 * Launches an isolated headless Chrome against the already-running server,
 * reads /settings and /runs, and prints JSON. No screenshots, no traces, no DB writes.
 *
 * Run: node docs\IMPROVE-WAVE-7\audit2\probe-ui.mjs
 */
import { chromium } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8787';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

const report = {};

// ---- Settings: nested limits/features flatten ------------------------------
await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' });
await page.getByText('limits.maxRunCostUsd', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 });
await page.waitForTimeout(250);

const settings = await page.evaluate(async () => {
  const response = await fetch('/api/settings');
  return response.json();
});

function flatten(prefix, value, depth, out) {
  if (depth > 2 || value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    const label = `${prefix}.${key}`;
    if (nested !== null && nested !== undefined && typeof nested !== 'object') out.push([label, String(nested)]);
    else flatten(label, nested, depth + 1, out);
  }
}

const expected = [];
for (const key of ['model', 'thinking', 'effort', 'maxRunCostUsd', 'workspaceRoot', 'vaultRoot', 'dataRoot', 'retentionDays', 'phase', 'version']) {
  const value = settings[key];
  if (value !== undefined && value !== null && typeof value !== 'object') expected.push([key, String(value)]);
}
flatten('limits', settings.limits, 0, expected);
flatten('features', settings.features, 0, expected);

const rendered = await page.evaluate(() => {
  const card = [...document.querySelectorAll('section.card')].find((section) => section.textContent?.includes('Runtime settings'));
  const rows = card ? [...card.querySelectorAll('dl dt')].map((dt) => ({ label: dt.textContent ?? '', value: dt.parentElement?.querySelector('dd')?.textContent ?? '' })) : [];
  return { rows, body: document.body.innerText };
});
report.settings = {
  expectedCount: expected.length,
  renderedCount: rendered.rows.length,
  expected,
  renderedRows: rendered.rows,
  labelsMatchExpected: JSON.stringify(rendered.rows.map((r) => r.label)) === JSON.stringify(expected.map((e) => e[0])),
  valuesMatchExpected: rendered.rows.every((r, i) => expected[i] && r.value === expected[i][1]),
  maxRunCostUsd: rendered.rows.find((r) => r.label === 'limits.maxRunCostUsd'),
  eventReplayWindow: rendered.rows.find((r) => r.label === 'limits.eventReplayWindow'),
  retentionDaysEvents: rendered.rows.find((r) => r.label === 'limits.retentionDays.events'),
  objectStrings: (rendered.body.match(/\[object Object\]/g) ?? []).length,
  secretPatternHits: (rendered.body.match(/sk-[A-Za-z0-9]{20,}/g) ?? []).length,
  containsEnvVarName: rendered.body.includes('DEEPSEEK_API_KEY'),
  renderedKeyRows: rendered.rows.filter((r) => r.label === 'key' || r.label.startsWith('key.')),
  bodyHasKeyMaterialSection: /Provider key/i.test(rendered.body),
};

// ---- Runs: server-side status filter, all statuses ------------------------
const runRequests = [];
page.on('request', (request) => {
  const url = new URL(request.url());
  if (url.pathname === '/api/runs') runRequests.push(url.pathname + url.search);
});

await page.goto(`${BASE}/runs`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.querySelectorAll('table.data-table tbody tr').length > 0, { timeout: 20_000 });
await page.waitForTimeout(200);

const select = page.locator('.toolbar select').first();
const options = await select.locator('option').evaluateAll((nodes) => nodes.map((n) => ({ value: n.value, label: n.textContent })));
const initial = {
  rows: await page.locator('table.data-table tbody tr').count(),
  countText: await page.locator('.toolbar .ml-auto').innerText(),
  statuses: await page.locator('table.data-table tbody tr td:nth-child(3)').allInnerTexts(),
};

async function selectStatus(status) {
  const before = runRequests.length;
  const responsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === '/api/runs' && url.searchParams.get('status') === status;
  }, { timeout: 20_000 });
  await select.selectOption(status);
  const response = await responsePromise;
  const body = await response.json();
  await page.waitForTimeout(300);
  return {
    request: runRequests.slice(before),
    apiRows: body.runs?.length ?? null,
    apiStatuses: [...new Set((body.runs ?? []).map((r) => r.status))],
    uiRows: await page.locator('table.data-table tbody tr').count(),
    uiCountText: await page.locator('.toolbar .ml-auto').innerText(),
    uiStatuses: await page.locator('table.data-table tbody tr td:nth-child(3)').allInnerTexts(),
    emptyState: await page.getByText(/No runs recorded/i).count(),
    emptyBody: (await page.getByText(/The API has no runs for this status/i).count()) > 0,
  };
}

report.runs = {
  options,
  initial,
  failed: await selectStatus('failed'),
  queued: await selectStatus('queued'),
  completedWithWarnings: await selectStatus('completed_with_warnings'),
  requests: runRequests,
};

report.pageErrors = pageErrors;
await browser.close();
console.log(JSON.stringify(report, null, 2));
