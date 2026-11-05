import { test, expect } from '@playwright/test';

const key = (suffix: string) => `qa-api-${suffix}-${Date.now().toString(36)}`;

test.describe('@qa-api API contract pins', () => {
  test('openapi.json is JSON and advertises /api/health', async ({ request }) => {
    const response = await request.get('/openapi.json');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type'] ?? '').toContain('application/json');
    const doc = (await response.json()) as { openapi?: string; paths?: Record<string, unknown> };
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.paths?.['/api/health']).toBeTruthy();
  });

  test('every OpenAPI operation has typed 2xx and 4xx response content', async ({ request }) => {
    const response = await request.get('/openapi.json');
    expect(response.ok()).toBeTruthy();
    const doc = (await response.json()) as {
      paths: Record<string, Record<string, { responses?: Record<string, { content?: unknown; schema?: unknown }> }>>;
    };
    const methods = new Set(['get', 'post', 'put', 'delete', 'patch']);
    const violations: string[] = [];
    for (const [pathName, pathItem] of Object.entries(doc.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (!methods.has(method)) continue;
        const responses = operation.responses ?? {};
        const typed = (pattern: RegExp) =>
          Object.entries(responses).some(([code, item]) => pattern.test(code) && Boolean(item.content ?? item.schema));
        if (!typed(/^2\d\d$/)) violations.push(`${method.toUpperCase()} ${pathName}: no typed 2xx`);
        if (!typed(/^4\d\d$/)) violations.push(`${method.toUpperCase()} ${pathName}: no typed 4xx`);
      }
    }
    expect(violations).toEqual([]);
  });

  test('agent list is the documented 37-item array shape', async ({ request }) => {
    const response = await request.get('/api/agents');
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as unknown;
    expect(Array.isArray(body)).toBe(true);
    expect((body as unknown[]).length).toBe(37);
  });

  test('unknown HTML routes return 404 while known SPA routes stay 200', async ({ request }) => {
    const missing = await request.get('/missing-td', { headers: { Accept: 'text/html' } });
    expect(missing.status()).toBe(404);
    expect(missing.headers()['content-type'] ?? '').toContain('text/html');
    expect(await missing.text()).toContain('id="root"');

    for (const route of ['/', '/agents', '/runs', '/vault', '/settings', '/learning']) {
      const response = await request.get(route, { headers: { Accept: 'text/html' } });
      expect(response.status(), `${route} must stay a 200 SPA route`).toBe(200);
      expect(response.headers()['content-type'] ?? '').toContain('text/html');
    }

    const runs = await request.get('/api/runs?limit=1');
    const runId = ((await runs.json()) as { runs?: Array<{ id?: string }> }).runs?.[0]?.id;
    expect(runId).toBeTruthy();
    const detail = await request.get(`/runs/${encodeURIComponent(runId!)}`, { headers: { Accept: 'text/html' } });
    expect(detail.status()).toBe(200);

    const apiMissing = await request.get('/api/not-a-route');
    expect(apiMissing.status()).toBe(404);
    expect(((await apiMissing.json()) as { error?: { code?: string } }).error?.code).toBe('E_RUN_NOT_FOUND');
  });

  test('run list normalizes invalid limits instead of 500 or unbounded reads', async ({ request }) => {
    for (const limit of ['abc', '-5', '0', '1.9', '1000']) {
      const response = await request.get(`/api/runs?limit=${encodeURIComponent(limit)}`);
      expect(response.status(), `limit=${limit}`).toBe(200);
      const body = (await response.json()) as { runs?: unknown[] };
      expect(Array.isArray(body.runs), `limit=${limit} must return a runs array`).toBe(true);
      expect((body.runs ?? []).length, `limit=${limit} must be bounded`).toBeLessThanOrEqual(100);
    }
  });

  test('planned checks subresource is wired and names a missing run', async ({ request }) => {
    const missing = await request.get('/api/runs/run_missing_checks/checks');
    expect(missing.status()).toBe(404);
    expect(((await missing.json()) as { error?: { code?: string } }).error?.code).toBe('E_RUN_NOT_FOUND');

    const runsResponse = await request.get('/api/runs?limit=1');
    expect(runsResponse.ok()).toBeTruthy();
    const runs = (await runsResponse.json()) as { runs?: Array<{ id?: string }> };
    const runId = runs.runs?.[0]?.id;
    expect(runId).toBeTruthy();
    const checks = await request.get(`/api/runs/${encodeURIComponent(runId!)}/checks`);
    expect(checks.status()).toBe(200);
    const body = (await checks.json()) as { checks?: unknown };
    expect(Array.isArray(body.checks)).toBe(true);
  });

  test('bodyless DELETE mutation is not rejected as a JSON content-type error', async ({ request }) => {
    const response = await request.delete('/api/agents/__missing_agent__/prompt', {
      headers: { 'Idempotency-Key': key('delete') },
    });
    expect(response.status()).toBe(404);
    const body = (await response.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe('E_UNSUPPORTED_AGENT');
  });

  test('learning overview refuses honestly when the sealed pool is absent', async ({ request }) => {
    const response = await request.get('/api/learning/overview');
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as { enabled?: boolean; reason?: string; consentRequired?: boolean };
    expect(body.enabled).toBe(false);
    expect(body.reason).toBe('E_LEARNING_POOL_EXHAUSTED');
    expect(body.consentRequired).toBe(true);
  });

  test('provider-key HTTP route refuses by name', async ({ request }) => {
    const response = await request.post('/api/settings/key', {
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key('key') },
      data: { key: 'not-a-real-key' },
    });
    expect(response.status()).toBe(403);
    const body = (await response.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe('FORBIDDEN_PROVIDER_KEY_ACCESS');
  });
});
