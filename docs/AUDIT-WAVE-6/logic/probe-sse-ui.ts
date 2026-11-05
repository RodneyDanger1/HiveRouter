/**
 * W6-AUD-02 — browser-level SSE truth probe (read-only GETs, no provider calls).
 *
 * Part A reloads the run detail page for a terminal run and records what the
 * current UI renders plus whether it opens an event stream.
 * Part B opens the server stream from inside a real browser and compares:
 *   - "server": listeners for every event type the server actually emits
 *   - "client": listeners exactly matching web/src/hooks/useApi.ts
 *   - "onmessage": the browser's default unnamed handler
 *
 * Run: node_modules\.bin\tsx.cmd docs\AUDIT-WAVE-6\logic\probe-sse-ui.ts
 */
import { chromium } from '@playwright/test';

const BASE = 'http://127.0.0.1:8787';
const RUN = 'run_abf5fe78aab1e932ff';

const SERVER_EMITTED = [
  'run.queued', 'run.started', 'run.failed', 'run.cancelled', 'run.completed',
  'phase.started', 'phase.completed', 'phase.skipped',
  'agent.started', 'agent.completed', 'agent.failed',
  'file.written', 'route.decided', 'context.packed', 'context.skipped', 'repair.stalled',
];
const CLIENT_SUBSCRIBED = [
  'run.started', 'run.updated', 'run.paused', 'run.cancelled', 'run.completed', 'run.failed',
  'run.needs_review', 'phase.started', 'phase.completed', 'step.started', 'step.completed',
  'agent.started', 'agent.delta', 'agent.completed', 'file.written', 'file.revised',
  'check.completed', 'review.completed', 'route.decided', 'context.packed', 'failure.clustered',
  'repair.completed', 'confidence.recorded', 'learning.trace', 'learning.eval', 'learning.promotion',
  'heartbeat',
];
const ONLY_ON_SERVER = SERVER_EMITTED.filter((type) => !CLIENT_SUBSCRIBED.includes(type));
const ONLY_ON_CLIENT = CLIENT_SUBSCRIBED.filter((type) => !SERVER_EMITTED.includes(type));

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const streamRequests: string[] = [];
page.on('request', (request) => {
  if (request.url().includes('/stream')) streamRequests.push(request.url());
});

// ---------------------------------------------------------------- Part A -----
await page.goto(`${BASE}/runs/${RUN}`);
await page.getByText(/Execution timeline/i).first().waitFor({ timeout: 20_000 }).catch(() => undefined);
await page.waitForTimeout(1500);
const ui = await page.evaluate(() => {
  const text = document.body.innerText;
  return {
    badges: Array.from(document.querySelectorAll('.badge')).map((node) => node.textContent?.trim()).filter(Boolean).slice(0, 12),
    terminalBadge: (text.match(/TERMINAL · SNAPSHOT|COMPLETE · SNAPSHOT|LIVE STREAM/i) ?? [null])[0],
    timelineItems: document.querySelectorAll('.timeline-item').length,
    hasStreamBadge: /LIVE STREAM/i.test(text),
    errorLine: (text.match(/GATE_FAILED[^\n]*/) ?? [null])[0],
  };
});

// Snapshot *before* Part B opens its own EventSource on the same page.
const streamRequestsAfterLoad = [...streamRequests];

// ---------------------------------------------------------------- Part B -----
// Passed as a source string on purpose: the page must execute the browser spec,
// not a bundler-transformed copy of it.
const streamCode = `(async () => {
  const base = ${JSON.stringify(BASE)};
  const run = ${JSON.stringify(RUN)};
  const serverTypes = ${JSON.stringify(SERVER_EMITTED)};
  const clientTypes = ${JSON.stringify(CLIENT_SUBSCRIBED)};
  return await new Promise((resolve) => {
    const source = new EventSource(base + '/api/runs/' + run + '/stream');
    const server = {};
    const client = {};
    let onmessage = 0;
    for (const type of serverTypes) {
      server[type] = 0;
      source.addEventListener(type, function () { server[type] += 1; });
    }
    for (const type of clientTypes) {
      client[type] = 0;
      source.addEventListener(type, function () { client[type] += 1; });
    }
    source.onmessage = function () { onmessage += 1; };
    setTimeout(function () {
      source.close();
      resolve({ server, client, onmessage });
    }, 4000);
  });
})()`;
const stream = await page.evaluate(streamCode);

// ---------------------------------------------------------------- report ----
console.log(JSON.stringify({
  ui,
  streamRequestsAfterLoad,
  onlyEmittedNotSubscribed: ONLY_ON_SERVER,
  onlySubscribedNeverEmitted: ONLY_ON_CLIENT,
  browserStream: stream,
}, null, 2));
await browser.close();
