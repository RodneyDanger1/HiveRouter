/**
 * Forge W6 read-only Checks-tab probe: duplicate React keys from repeated check ids,
 * and the snapshot/artifact truncation badge label.
 * Writes only under docs/AUDIT-WAVE-6/forge/evidence/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FORGE = path.resolve(HERE, '..');
const EVIDENCE = path.join(FORGE, 'evidence');
const BASE = process.env.HIVE_BASE ?? 'http://127.0.0.1:8787';
const RUN = 'run_abf5fe78aab1e932ff';

const api = await (await fetch(`${BASE}/api/runs/${RUN}/checks`)).json();
const snapshot = await (await fetch(`${BASE}/api/runs/${RUN}/snapshot`)).json();
const checkIds = (api.checks ?? []).map((check) => check.id);
const distinct = [...new Set(checkIds)];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
let result;
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const consoleMessages = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) consoleMessages.push({ type: message.type(), text: message.text() });
  });
  await page.goto(`${BASE}/runs/${RUN}`, { waitUntil: 'load' });
  await page.getByRole('tab', { name: /^Checks$/i }).click();
  await page.waitForTimeout(800);
  const rows = page.locator('table.data-table tbody tr');
  const rowCount = await rows.count();
  const domIds = [];
  for (let index = 0; index < rowCount; index += 1) {
    domIds.push((await rows.nth(index).locator('td').first().innerText()).trim());
  }
  const badgeTexts = await page.locator('main .badge').allInnerTexts();
  result = {
    capturedAt: new Date().toISOString(),
    api: {
      checkRows: (api.checks ?? []).length,
      distinctCheckIds: distinct.length,
      checkIdCounts: checkIds.reduce((acc, id) => { acc[id] = (acc[id] ?? 0) + 1; return acc; }, {}),
      snapshotTruncated: snapshot.truncated,
      artifacts: (snapshot.artifacts ?? []).length,
    },
    dom: {
      rowCount,
      domIds,
      domDistinctIds: [...new Set(domIds)].length,
      badgeTexts: badgeTexts.map((text) => text.trim()),
    },
    consoleMessages,
    duplicateKeyWarnings: consoleMessages.filter((message) => /same key|duplicate key/i.test(message.text)),
  };
  await page.screenshot({ path: path.join(EVIDENCE, 'ui-abf5-checks.png'), fullPage: false });
} finally {
  await browser.close();
}

fs.mkdirSync(EVIDENCE, { recursive: true });
fs.writeFileSync(path.join(EVIDENCE, 'checks-tab-probe.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
