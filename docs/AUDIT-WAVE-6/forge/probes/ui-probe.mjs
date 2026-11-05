/**
 * Forge W6 read-only UI probe against the live production server (127.0.0.1:8787).
 * - Real built app (web/dist), no source edits, no mocks, no writes to app data.
 * - Compares terminal run-detail DOM to route truth (status/steps/events/lastEventId).
 * - Verifies EventSource named-event delivery in the same browser for the exact
 *   STREAM_EVENT_TYPES list read from web/src/hooks/useApi.ts vs the missing names.
 * Writes only under docs/AUDIT-WAVE-6/forge/evidence/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { chromium } from '@playwright/test';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FORGE = path.resolve(HERE, '..');
const EVIDENCE = path.join(FORGE, 'evidence');
const REPO = path.resolve(FORGE, '..', '..', '..');
const BASE = process.env.HIVE_BASE ?? 'http://127.0.0.1:8787';

fs.mkdirSync(EVIDENCE, { recursive: true });

const useApiSource = fs.readFileSync(path.join(REPO, 'web/src/hooks/useApi.ts'), 'utf8');
const listMatch = /const STREAM_EVENT_TYPES = \[([\s\S]*?)\];/.exec(useApiSource);
const appTypes = [...listMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
const missingTypes = ['agent.failed', 'context.skipped', 'phase.skipped', 'repair.stalled', 'run.queued'];

const normalize = (text) => text.replace(/\s+/g, ' ').trim();
const sameCounts = (a, b) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => (a[key] ?? 0) === (b[key] ?? 0));
};

async function api(pathname) {
  const response = await fetch(`${BASE}${pathname}`);
  return { status: response.status, body: await response.json() };
}

const out = { capturedAt: new Date().toISOString(), base: BASE, appTypes, missingTypes, runs: {} };

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const requests = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) requests.push(url.pathname);
  });

  for (const [label, id] of [
    ['abf5', 'run_abf5fe78aab1e932ff'],
    ['2bb2', 'run_2bb2f8edf3043fe89e'],
    ['95', 'run_95c11797b4923b4277'],
  ]) {
    const snapshot = await api(`/api/runs/${id}/snapshot`);
    const events = await api(`/api/runs/${id}/events`);
    const expected = {
      status: snapshot.body.run.status,
      steps: snapshot.body.steps.length,
      events: events.body.events.length,
      lastEventId: snapshot.body.lastEventId,
    };

    requests.length = 0;
    await page.goto(`${BASE}/runs/${id}`, { waitUntil: 'load' });
    await page.getByRole('tab', { name: /^Overview$/i }).waitFor({ timeout: 20_000 });
    await page.waitForTimeout(1200);
    const initialRequests = [...requests];

    // Header badges are the first four .badge nodes in the run-summary card.
    const badges = (await page.locator('main .badge').allInnerTexts()).map(normalize).slice(0, 4);
    const statusBadge = badges[0] ?? null;
    const phaseBadge = badges[1] ?? null;
    const stepsBadge = badges[2] ?? null;
    const streamBadge = badges[3] ?? null;

    // Observation window: terminal pages must not poll or open SSE.
    const beforeWait = requests.length;
    await page.waitForTimeout(6000);
    const observed = requests.slice(beforeWait);

    // Read the Events tab.
    await page.getByRole('tab', { name: /^Events$/i }).click();
    await page.waitForTimeout(800);
    const eventsHeading = normalize((await page.locator('main').innerText()).match(/(Persisted events|Live events)/i)?.[0] ?? '');
    const rows = page.locator('table.data-table tbody tr');
    const rowCount = await rows.count();
    const domTypes = [];
    for (let index = 0; index < rowCount; index += 1) {
      domTypes.push(normalize(await rows.nth(index).locator('td').first().innerText()));
    }
    const domTypeCounts = {};
    for (const type of domTypes) domTypeCounts[type] = (domTypeCounts[type] ?? 0) + 1;

    const apiTypeCounts = {};
    for (const event of events.body.events) apiTypeCounts[event.type] = (apiTypeCounts[event.type] ?? 0) + 1;

    await page.screenshot({ path: path.join(EVIDENCE, `ui-${label}-events.png`), fullPage: false });

    const expectedStatusLabel = expected.status.replace(/_/g, ' ').toUpperCase();
    out.runs[label] = {
      id,
      expected,
      dom: {
        badges,
        statusBadge,
        phaseBadge,
        stepsBadge,
        streamBadge,
        eventsHeading,
        rowCount,
        domTypeCounts,
        containsUnsubscribedTypes: Object.fromEntries(missingTypes.map((type) => [type, domTypes.includes(type)])),
      },
      convergence: {
        statusMatches: statusBadge === expectedStatusLabel,
        stepsMatches: stepsBadge === `${expected.steps} STEPS`,
        eventRowsMatch: rowCount === expected.events,
        typesMatch: sameCounts(domTypeCounts, apiTypeCounts),
      },
      observation: {
        initialRequests,
        initialSnapshotRequests: initialRequests.filter((pathname) => pathname.endsWith('/snapshot')).length,
        initialStreamRequests: initialRequests.filter((pathname) => pathname.endsWith('/stream')).length,
        windowMs: 6000,
        windowRequests: observed,
        windowStreamRequests: observed.filter((pathname) => pathname.endsWith('/stream')).length,
        windowSnapshotRequests: observed.filter((pathname) => pathname.endsWith('/snapshot')).length,
      },
    };

    // Browser-level named-event delivery test on the same real SSE endpoint.
    const delivery = await page.evaluate(
      async ({ runId, appTypes, missingTypes }) => {
        const url = `/api/runs/${encodeURIComponent(runId)}/stream`;
        const collect = (types) =>
          new Promise((resolve) => {
            const source = new EventSource(url);
            const counts = {};
            let messages = 0;
            let errors = 0;
            source.onmessage = () => { messages += 1; };
            source.onerror = () => { errors += 1; };
            for (const type of types) source.addEventListener(type, () => { counts[type] = (counts[type] ?? 0) + 1; });
            setTimeout(() => { source.close(); resolve({ counts, messages, errors, total: Object.values(counts).reduce((sum, n) => sum + n, 0) }); }, 1800);
          });
        const appList = await collect(appTypes);
        const missingList = await collect(missingTypes);
        return { appList, missingList };
      },
      { runId: id, appTypes, missingTypes },
    );
    out.runs[label].delivery = delivery;
    out.runs[label].deliveryDiff = {
      appReceived: delivery.appList.total,
      apiFrames: expected.events,
      appMissed: expected.events - delivery.appList.total,
      unsubscribedReceivedWhenRegistered: delivery.missingList.total,
      onmessageFrames: delivery.appList.messages,
    };
  }

  // Static window when run_abf5 could have displayed "Running / 7 steps".
  const database = new DatabaseSync(path.join(REPO, 'data', 'hive.db'), { readOnly: true });
  try {
    const steps = database.prepare("SELECT seq, status, started_at, finished_at FROM steps WHERE run_id = 'run_abf5fe78aab1e932ff' ORDER BY seq").all();
    const run = database.prepare("SELECT status, created_at, started_at, finished_at FROM runs WHERE id = 'run_abf5fe78aab1e932ff'").get();
    out.staleCaptureWindow = {
      run,
      sevenRowsExistFrom: steps[6]?.started_at ?? null,
      eightRowsExistFrom: steps[7]?.started_at ?? null,
      windowSeconds: steps[6] && steps[7]
        ? Math.round((Date.parse(steps[7].started_at) - Date.parse(steps[6].started_at)) / 100) / 10
        : null,
      terminalAt: run?.finished_at ?? null,
      steps: steps.map((step) => ({ seq: step.seq, status: step.status, startedAt: step.started_at })),
    };
  } finally {
    database.close();
  }
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(EVIDENCE, 'probe-ui.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
