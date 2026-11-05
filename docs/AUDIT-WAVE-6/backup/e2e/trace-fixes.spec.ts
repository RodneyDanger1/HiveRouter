import { test, expect } from '@playwright/test';

test.describe('@trace persisted event and agent-detail contracts', () => {
  test('terminal Events tab renders the persisted ledger instead of an empty live state', async ({ page, request }) => {
    const response = await request.get('/api/runs?limit=50');
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as { runs?: Array<{ id: string; status: string }> };
    const run = body.runs?.find((candidate) => candidate.status === 'completed' || candidate.status === 'completed_with_warnings');
    expect(run, 'a terminal run must exist').toBeTruthy();

    const events = await request.get(`/api/runs/${encodeURIComponent(run!.id)}/events`);
    expect(events.ok()).toBeTruthy();
    const ledger = (await events.json()) as { events?: Array<{ type?: string }> };
    expect((ledger.events ?? []).length).toBeGreaterThan(0);

    await page.goto(`/runs/${encodeURIComponent(run!.id)}`);
    await page.getByRole('tab', { name: /^Events$/i }).click();
    await expect(page.getByRole('heading', { name: /Persisted events/i })).toBeVisible();
    await expect(page.getByText(/No live events observed/i)).toHaveCount(0);
    const eventTypes = [...new Set((ledger.events ?? []).map((event) => event.type).filter((type): type is string => Boolean(type)))];
    expect(eventTypes.length).toBeGreaterThan(0);
    await expect(page.getByText(eventTypes[0]).first()).toBeVisible();
  });

  test('agent detail returns the same evidence surface as the list', async ({ request }) => {
    const list = await request.get('/api/agents');
    expect(list.ok()).toBeTruthy();
    const agents = (await list.json()) as Array<{ id: string; badges?: string[]; evidence?: unknown[] }>;
    const architect = agents.find((agent) => agent.id === 'architect');
    expect(architect).toBeTruthy();
    expect(architect?.badges?.length).toBeGreaterThan(0);

    const detail = await request.get('/api/agents/architect');
    expect(detail.ok()).toBeTruthy();
    const body = (await detail.json()) as { badges?: string[]; evidence?: unknown[] };
    expect(body.badges).toEqual(architect?.badges);
    expect(Array.isArray(body.evidence)).toBe(true);
  });
});
