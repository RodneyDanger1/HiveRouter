import { chromium } from '@playwright/test';

const api = 'http://127.0.0.1:8787';
const out: Record<string, unknown> = {};
const events = await fetch(`${api}/api/runs/run_abf5fe78aab1e932ff/events?after=0`).then((r) => r.json()) as { events: unknown[]; truncated: boolean; lastEventId: number };
const snapshot = await fetch(`${api}/api/runs/run_95c11797b4923b4277/snapshot`).then((r) => r.json()) as { run: { costUsd: number | null }; limits?: { maxCostUsd?: number } };
out.api = { abf5EventCount: events.events.length, abf5Truncated: events.truncated, abf5LastEventId: events.lastEventId, run95Cost: snapshot.run.costUsd, run95Cap: snapshot.limits?.maxCostUsd };

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('console', (message) => {
  if (message.type() === 'error') (out.consoleErrors as string[]).push(message.text());
});
out.consoleErrors = [];
await page.goto(`${api}/runs/run_abf5fe78aab1e932ff`);
await page.getByText(/TERMINAL · SNAPSHOT/i).waitFor({ timeout: 20_000 });
await page.getByRole('tab', { name: /^Events$/ }).click();
await page.getByText(/Persisted events/i).waitFor({ timeout: 10_000 });
out.abf5 = {
  statusText: await page.getByText(/FAILED/i).first().textContent(),
  stepText: await page.getByText(/20 STEPS/i).first().textContent(),
  eventHeading: await page.getByText(/Persisted events/i).first().textContent(),
  hasRunQueued: await page.getByText(/run\.queued/i).count(),
  hasRepairStalled: await page.getByText(/repair\.stalled/i).count(),
  hasAgentFailed: await page.getByText(/agent\.failed/i).count(),
  hasArtifactTruncated: await page.getByText(/Artifacts truncated/i).count(),
};
await page.screenshot({ path: 'docs/AUDIT-WAVE-6/verify-abf5-events.png', fullPage: false });

await page.goto(`${api}/runs/run_95c11797b4923b4277`);
await page.getByText(/COMPLETED/i).first().waitFor({ timeout: 20_000 });
out.run95 = {
  capText: (await page.locator('body').innerText()).match(/Estimated spend[\s\S]{0,80}/)?.[0] ?? null,
  hasContextTokensColumn: await page.getByText(/^Tokens$/).count(),
  hasContextCharsColumn: await page.getByText(/^Chars$/).count(),
};
await page.getByRole('tab', { name: /^Context$/ }).click();
out.run95.contextColumns = {
  tokens: await page.getByRole('columnheader', { name: /^Tokens$/ }).count(),
  chars: await page.getByRole('columnheader', { name: /^Chars$/ }).count(),
};
await page.getByRole('tab', { name: /^Checks$/ }).click();
out.run95.checksColumns = {
  time: await page.getByRole('columnheader', { name: /^Time$/ }).count(),
};
await page.getByRole('tab', { name: /^Routing$/ }).click();
out.run95.routingHasLiteral = await page.getByText(/static prior route/i).count();
out.run95.routingReasonSample = (await page.locator('body').innerText()).match(/prior[^\n]{0,100}|static[^\n]{0,100}/)?.[0] ?? null;
await page.screenshot({ path: 'docs/AUDIT-WAVE-6/verify-run95.png', fullPage: false });

await browser.close();
console.log(JSON.stringify(out, null, 2));
