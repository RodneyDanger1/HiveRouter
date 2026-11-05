import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SHOTS = path.resolve('docs/UI-WAVE-1/shots');
fs.mkdirSync(SHOTS, { recursive: true });

const pageErrors: string[] = [];

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
}

async function noSecret(page: Page): Promise<void> {
  const text = await page.locator('body').innerText();
  expect(text, 'key material must never render').not.toMatch(/sk-[A-Za-z0-9]{20,}/);
}

test.beforeEach(({ page }) => {
  pageErrors.length = 0;
  page.on('pageerror', (error) => pageErrors.push(error.message));
});

test.afterEach(() => {
  expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toEqual([]);
});

test.describe('@ui-audit routes and visible contract', () => {
  test('all routed pages render a heading, console-clean', async ({ page }) => {
    const routes: Array<[string, RegExp, string]> = [
      ['/', /HiveRouter|routed factory|Start a run/i, 'overview'],
      ['/agents', /Agents/i, 'agents'],
      ['/runs', /Runs/i, 'runs'],
      ['/analysis', /Analysis/i, 'analysis'],
      ['/vault', /Vault/i, 'vault'],
      ['/settings', /Settings/i, 'settings'],
      ['/learning', /Learning/i, 'learning'],
    ];
    for (const [route, text, name] of routes) {
      await page.goto(route);
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('body')).toContainText(text, { timeout: 15_000 });
      await shot(page, `route-${name}`);
      await noSecret(page);
    }
    await page.goto('/does-not-exist');
    await expect(page.getByText(/not found|404/i).first()).toBeVisible();
    await shot(page, 'route-not-found');
  });

  test('analysis page drives the bounded static endpoints and shows real results', async ({ page }) => {
    await page.goto('/analysis');
    await expect(page.getByRole('heading', { name: 'Analysis', exact: true })).toBeVisible();
    await expect(page.getByText(/not a control-flow graph/i)).toBeVisible();

    await page.getByLabel(/Root file/i).fill('src/app.ts');
    await page.getByLabel(/Edges, one per line/i).fill('src/app.ts -> src/api.ts\nsrc/api.ts -> src/store.ts');
    await page.getByRole('button', { name: /Analyze graph/i }).click();
    await expect(page.getByText('src/api.ts', { exact: true })).toBeVisible();
    await expect(page.getByText('src/store.ts', { exact: true })).toBeVisible();
    await expect(page.getByText('Static only')).toBeVisible();
    await shot(page, 'analysis-dominators');

    for (const specialist of ['Architect', 'Risk auditor', 'Testability engineer', 'Clarity editor']) {
      await page.getByLabel(`${specialist} evidence references`).fill(`src/app.ts:1 (${specialist})`);
    }
    await page.getByRole('button', { name: /Evaluate disagreement/i }).click();
    await expect(page.getByText(/No debate trigger/i)).toBeVisible();
    await expect(page.getByText(/not a quality certificate/i)).toBeVisible();
    await shot(page, 'analysis-scorecards');
    await noSecret(page);
  });

  test('overview composer exposes every control and never submits in this audit', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel(/Project brief/i)).toBeVisible();
    const selects = page.locator('form select');
    await expect(selects).toHaveCount(3);
    const preset = selects.nth(0);
    const model = selects.nth(1);
    const thinking = selects.nth(2);
    await expect(preset).toBeVisible();
    await expect(model).toBeVisible();
    await expect(thinking).toBeVisible();
    await expect(page.getByLabel(/Max run cost/i)).toBeVisible();
    await expect(page.getByText('Prompt analyst', { exact: true })).toBeVisible();
    const analyze = page.getByRole('button', { name: /Analyze prompt/i });
    await expect(analyze).toBeDisabled();

    await expect(preset.locator('option')).toHaveCount(4);
    await expect(model.locator('option')).toHaveCount(2);
    await expect(thinking.locator('option')).toHaveCount(2);

    const start = page.getByRole('button', { name: /Start run/i });
    await expect(start).toBeDisabled();
    await page.getByLabel(/Project brief/i).fill('Audit-only composer check with a valid brief.');
    await expect(start).toBeEnabled();
    await expect(analyze).toBeEnabled();
    await thinking.selectOption('enabled');
    const effort = page.locator('form select').nth(3);
    await expect(effort).toBeVisible();
    await expect(effort.locator('option')).toHaveCount(3);
    await shot(page, 'overview-composer-filled');
    await noSecret(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Open navigation/i })).toBeVisible();
    await shot(page, 'overview-390');
    await page.getByRole('button', { name: /Open navigation/i }).click();
    await expect(page.getByRole('button', { name: /Close navigation/i }).first()).toBeVisible();
    await shot(page, 'overview-390-nav');
  });

  test('agents page: 37 cards, search, drawer contract, edit and run controls', async ({ page }) => {
    await page.goto('/agents');
    const cards = page.locator('button.agent-card');
    await expect(cards).toHaveCount(37, { timeout: 15_000 });
    await shot(page, 'agents-all');

    const search = page.getByPlaceholder(/Search agents/i);
    await search.fill('python');
    await expect.poll(async () => cards.count()).toBeLessThan(37);
    await shot(page, 'agents-filtered');
    await search.fill('');
    await expect.poll(async () => cards.count()).toBe(37);

    await cards.first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Contract/i).first()).toBeVisible();
    await expect(dialog.getByText(/Evidence/i).first()).toBeVisible();
    await expect(dialog.getByText(/Full prompt/i)).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Run agent/i })).toBeVisible();
    await expect(dialog.getByLabel(/^Input$/i)).toBeVisible();
    await expect(dialog.getByLabel(/^Mode$/i)).toBeVisible();
    await expect(dialog.getByLabel(/Max cost/i)).toBeVisible();
    await shot(page, 'agent-drawer');

    await dialog.getByRole('button', { name: /Edit prompt/i }).click();
    await expect(dialog.getByRole('button', { name: /Save/i })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Reset/i })).toBeVisible();
    await shot(page, 'agent-drawer-edit');
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).toBeHidden();
    await noSecret(page);
  });
});

test.describe('@ui-audit run detail contract', () => {
  test('terminal run tabs, file viewer, dialogs, actions and live stream state', async ({ page, request }) => {
    const response = await request.get('/api/runs?limit=20');
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as { runs: Array<{ id: string; status: string; artifacts?: unknown[] }> };
    const run = body.runs.find((candidate) => candidate.status === 'completed' || candidate.status === 'completed_with_warnings');
    expect(run, 'a terminal run must exist for this audit').toBeTruthy();
    const runId = run!.id;

    await page.goto('/runs');
    await expect(page.getByRole('heading', { name: /Runs/i }).first()).toBeVisible();
    await shot(page, 'runs-list');

    const streamRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.endsWith('/stream')) streamRequests.push(request.url());
    });
    await page.goto(`/runs/${runId}`);
    await expect(page.getByText(runId).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.badge').filter({ hasText: 'Complete · snapshot' }).first()).toBeVisible();
    await expect(page.locator('.badge').filter({ hasText: /^Live stream$/ })).toHaveCount(0);
    expect(streamRequests, 'a terminal run must not open an SSE stream').toHaveLength(0);
    await shot(page, 'run-detail-overview');

    for (const tab of ['Overview', 'Files', 'Search', 'Checks', 'Routing', 'Context', 'Repairs', 'Confidence', 'Events']) {
      const tabButton = page.getByRole('tab', { name: new RegExp(`^${tab}$`, 'i') }).first();
      await expect(tabButton).toBeVisible();
      await tabButton.click();
      await expect(page.getByRole('tabpanel')).toBeVisible();
      await page.waitForTimeout(120);
      await shot(page, `run-detail-${tab.toLowerCase()}`);
    }

    await page.getByRole('tab', { name: /^Search$/i }).click();
    const filesResponse = await request.get(`/api/runs/${runId}/files`);
    const filesBody = (await filesResponse.json()) as { artifacts?: Array<{ path: string }> };
    let searchTerm = 'function';
    if (filesBody.artifacts?.[0]?.path) {
      const contentResponse = await request.get(
        `/api/runs/${runId}/files/content?path=${encodeURIComponent(filesBody.artifacts[0].path)}`,
      );
      if (contentResponse.ok()) {
        const text = await contentResponse.text();
        searchTerm = /[A-Za-z]{8,}/.exec(text)?.[0] ?? searchTerm;
      }
    }
    await page.getByLabel(/Search terms/i).fill(searchTerm);
    await page.getByRole('button', { name: /^Search$/i }).click();
    await expect(page.getByText(/file[s]? indexed/i)).toBeVisible({ timeout: 10_000 });
    await shot(page, 'run-detail-search');

    await page.getByRole('tab', { name: /^Files$/i }).click();
    const firstFile = page.locator('.vault-row').first();
    if (await firstFile.count()) {
      await firstFile.click();
      await expect(page.getByText(/SHA-256/i).first()).toBeVisible();
      await expect(page.getByText(/Loading file/i)).toBeHidden({ timeout: 10_000 }).catch(() => undefined);
      await shot(page, 'run-detail-file-viewer');
    }

    await page.getByRole('tab', { name: /^Overview$/i }).click();
    await expect(page.getByRole('button', { name: /Refresh/i }).first()).toBeEnabled();
    await page.getByRole('button', { name: /Refresh/i }).first().click();

    const revise = page.getByRole('button', { name: /^Revise/i }).first();
    await expect(revise).toBeVisible();
    await revise.click();
    const reviseDialog = page.getByRole('dialog');
    await expect(reviseDialog.getByText(/Revise this run/i)).toBeVisible();
    await expect(reviseDialog.getByRole('button', { name: /Start revision/i })).toBeDisabled();
    await reviseDialog.getByLabel(/Revision feedback/i).fill('Audit-only feedback; do not submit.');
    await expect(reviseDialog.getByRole('button', { name: /Start revision/i })).toBeEnabled();
    await shot(page, 'run-detail-revise-dialog');
    await reviseDialog.getByRole('button', { name: /^Cancel$/i }).click();

    const audit = page.getByRole('button', { name: /^Audit/i }).first();
    await expect(audit).toBeVisible();
    await audit.click();
    const auditDialog = page.getByRole('dialog');
    await expect(auditDialog.getByText(/Start an audit run/i)).toBeVisible();
    await shot(page, 'run-detail-audit-dialog');
    await auditDialog.getByRole('button', { name: /^Cancel$/i }).click();

    await expect(page.getByRole('button', { name: /^Stop/i })).toHaveCount(0);
    const download = page.getByRole('link', { name: /Download/i }).first();
    if (await download.count()) await expect(download).toHaveAttribute('href', /\/download$/);
    await expect(page.getByRole('button', { name: /Open folder/i }).first()).toBeVisible();
    await noSecret(page);
  });

  test('missing run surfaces backend refusal in the UI', async ({ page, request }) => {
    const refused = await request.get('/api/runs/run_missing_ui_audit/download');
    expect(refused.status()).toBe(404);
    const refusedBody = (await refused.json()) as { error?: { code?: string } };
    expect(refusedBody.error?.code).toBe('E_RUN_NOT_FOUND');

    await page.goto('/runs/run_missing_ui_audit');
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible({ timeout: 15_000 });
    await expect(alert).toContainText(/E_RUN_NOT_FOUND/);
    await expect(alert).toContainText(/Run not found/i);
    await shot(page, 'run-missing-refusal');
  });
});

test.describe('@ui-audit learning, vault, settings and backend seam', () => {
  test('learning is honestly disabled with no pool and tabs are inert', async ({ page, request }) => {
    const overview = await request.get('/api/learning/overview');
    expect(overview.ok()).toBeTruthy();
    const payload = (await overview.json()) as { enabled: boolean; reason?: string; counts?: { sealedBlocks?: number } };
    expect(payload.enabled).toBe(false);
    expect(payload.reason).toBe('E_LEARNING_POOL_EXHAUSTED');
    expect(payload.counts?.sealedBlocks).toBe(0);

    await page.goto('/learning');
    await expect(page.getByText(/Learning is off|Learning is not part of this release stage|Learning is limited|Learning is unavailable/i).first()).toBeVisible();
    await expect(page.getByText(/E_LEARNING_POOL_EXHAUSTED|pool/i).first()).toBeVisible();
    const tabs = page.getByRole('tab');
    for (let index = 0; index < await tabs.count(); index += 1) {
      await expect(tabs.nth(index)).toBeDisabled();
    }
    await expect(page.getByText(/100\s*%|fake|promoted successfully/i)).toHaveCount(0);
    await shot(page, 'learning-disabled');
    await noSecret(page);
  });

  test('vault tree exposes a file preview or an honest empty state', async ({ page }) => {
    await page.goto('/vault');
    await expect(page.getByRole('heading', { name: /Vault/i }).first()).toBeVisible();
    await shot(page, 'vault-tree');
    const fileButton = page.locator('.vault-row').first();
    if (await fileButton.count()) {
      await fileButton.click();
      await expect(page.getByText(/Loading vault file/i)).toBeHidden({ timeout: 10_000 }).catch(() => undefined);
      await shot(page, 'vault-file');
    } else {
      await expect(page.getByText(/No vault entries/i)).toBeVisible();
      await shot(page, 'vault-empty');
    }
  });

  test('settings reports key source, stage and trust without key material', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: /Settings/i }).first()).toBeVisible();
    await expect(page.getByText(/Provider key/i).first()).toBeVisible();
    await expect(page.getByText(/Configured/i).first()).toBeVisible();
    await expect(page.getByText(/Fingerprint/i).first()).toBeVisible();
    await expect(page.getByText(/Factory stage/i).first()).toBeVisible();
    await expect(page.getByText('limits.maxRunCostUsd', { exact: true })).toBeVisible();
    await expect(page.getByText('limits.eventReplayWindow', { exact: true })).toBeVisible();
    await expect(page.getByText(/Safety posture/i).first()).toBeVisible();
    await shot(page, 'settings');
    await noSecret(page);
  });

  test('backend seam keeps named refusals and provider-key route closed', async ({ request }) => {
    const meta = await request.get('/api/meta');
    expect(meta.ok()).toBeTruthy();
    const metaBody = (await meta.json()) as { phase?: string; features?: { routing?: boolean; learning?: boolean } };
    expect(metaBody.phase).toBe('B2');
    expect(metaBody.features?.routing).toBe(true);
    expect(metaBody.features?.learning).toBe(true);

    const agents = await request.get('/api/agents');
    expect(agents.ok()).toBeTruthy();
    const agentBody = (await agents.json()) as unknown;
    const agentList = Array.isArray(agentBody) ? agentBody : (agentBody as { agents?: unknown[] }).agents;
    expect(agentList).toHaveLength(37);

    const missingAgent = await request.get('/api/agents/__ui_audit_missing__');
    expect(missingAgent.status()).toBe(404);
    expect(((await missingAgent.json()) as { error?: { code?: string } }).error?.code).toBe('E_UNSUPPORTED_AGENT');

    const noIdempotency = await request.post('/api/runs', {
      headers: { 'Content-Type': 'application/json' },
      data: { brief: 'This request must be refused before any provider call.' },
    });
    expect(noIdempotency.status()).toBe(422);
    expect(((await noIdempotency.json()) as { error?: { code?: string } }).error?.code).toBe('E_IDEMPOTENCY_KEY_REQUIRED');

    const providerKey = await request.post('/api/settings/key', {
      headers: { 'Content-Type': 'application/json' },
      data: { key: 'audit-placeholder-not-a-key' },
    });
    expect(providerKey.status()).toBe(403);
    expect(((await providerKey.json()) as { error?: { code?: string } }).error?.code).toBe('FORBIDDEN_PROVIDER_KEY_ACCESS');
  });

  test('composer draft survives a page reload (local persistent memory)', async ({ page }) => {
    const brief = 'Persistent draft: keep this brief after a reload.';
    await page.goto('/');
    await page.getByLabel(/Project brief/i).fill(brief);
    await page.getByLabel(/Max run cost/i).fill('0.07');
    await page.reload();
    await expect(page.getByLabel(/Project brief/i)).toHaveValue(brief);
    await expect(page.getByLabel(/Max run cost/i)).toHaveValue('0.07');
  });
});

test.describe('@ui-audit agent-facing blockers', () => {
  test('ad-hoc tests agents do not require a target path', async ({ page }) => {
    const captured: { body: Record<string, unknown> | null } = { body: null };
    await page.route('**/api/agents/gatekeeper/run', async (route) => {
      captured.body = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ runId: 'run_td_gatekeeper' }),
      });
    });

    await page.goto('/agents');
    await page.getByRole('button', { name: /Open The Gatekeeper/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/^Input$/i).fill('Write tests for add(a, b).');
    const runButton = dialog.getByRole('button', { name: /Run agent/i });
    await expect(runButton).toBeEnabled({ timeout: 10_000 });

    const requestPromise = page.waitForRequest(
      (request) => request.url().endsWith('/api/agents/gatekeeper/run') && request.method() === 'POST',
      { timeout: 5_000 },
    );
    await runButton.click();
    await requestPromise;
    expect(captured.body?.input).toBe('Write tests for add(a, b).');
    expect(captured.body?.targetPath).toBeUndefined();
    await expect(dialog.getByText(/A target path is required/i)).toHaveCount(0);
  });

  test('terminal run with no artifacts does not offer Audit', async ({ page, request }) => {
    const runsResponse = await request.get('/api/runs?limit=100');
    expect(runsResponse.ok()).toBeTruthy();
    const runs = ((await runsResponse.json()) as { runs: Array<{ id: string; status: string }> }).runs;
    const terminal = new Set(['completed', 'completed_with_warnings', 'failed', 'cancelled', 'interrupted', 'budget_exceeded']);
    let emptyRunId: string | null = null;
    for (const candidate of runs.filter((run) => terminal.has(run.status))) {
      const snapshot = await request.get(`/api/runs/${candidate.id}/snapshot`);
      if (!snapshot.ok()) continue;
      const body = (await snapshot.json()) as { artifacts?: unknown[] };
      if ((body.artifacts ?? []).length === 0) {
        emptyRunId = candidate.id;
        break;
      }
    }
    expect(emptyRunId, 'a terminal run with zero artifacts must exist for this audit').toBeTruthy();

    await page.goto(`/runs/${emptyRunId}`);
    await expect(page.getByText(emptyRunId!, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /^Audit/i })).toHaveCount(0);
    await expect(page.getByText(/Audit requires stored artifacts/i).first()).toBeVisible();
  });
});
