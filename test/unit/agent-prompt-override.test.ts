import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/server/app.js';
import { closeDb, initDb } from '../../src/server/db/database.js';
import { config } from '../../src/server/config.js';

let app: Awaited<ReturnType<typeof buildApp>>;
const host = `127.0.0.1:${config.port}`;
const agentId = 'markdown-engine';
const override = '[ROLE] Test override role.\n[OBJECTIVE] Test override objective.';

beforeAll(async () => {
  initDb(':memory:', 'B2');
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
  closeDb();
});

function getAgent(id = agentId) {
  return app.inject({ method: 'GET', url: `/api/agents/${id}`, headers: { host } });
}

describe('agent prompt overrides', () => {
  it('returns the effective override from the detail and list projections', async () => {
    const base = (await getAgent()).json() as { prompt: string; promptSource: string; systemPrompt: string };
    expect(base.promptSource).toBe('registry');
    expect(base.systemPrompt).toContain('--- HIVE RUNTIME CONTRACT ---');

    const saved = await app.inject({
      method: 'PUT',
      url: `/api/agents/${agentId}/prompt`,
      headers: { host, 'content-type': 'application/json' },
      payload: { prompt: override },
    });
    expect(saved.statusCode).toBe(200);
    expect((saved.json() as { promptSource: string }).promptSource).toBe('override');

    const detail = (await getAgent()).json() as { prompt: string; promptSource: string; systemPrompt: string };
    expect(detail.prompt).toBe(override);
    expect(detail.promptSource).toBe('override');
    expect(detail.systemPrompt).toContain('Test override role.');
    expect(detail.systemPrompt).toContain('Agent: markdown-engine');
    expect(detail.systemPrompt).toContain('Contract: files');
    expect(detail.systemPrompt).toContain('--- HIVE RUNTIME CONTRACT ---');

    const list = (await app.inject({ method: 'GET', url: '/api/agents', headers: { host } })).json() as Array<{
      id: string;
      prompt: string;
      promptSource: string;
    }>;
    const projected = list.find((agent) => agent.id === agentId);
    expect(projected?.prompt).toBe(override);
    expect(projected?.promptSource).toBe('override');
  });

  it('refuses an override that would break the role/objective contract', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: `/api/agents/${agentId}/prompt`,
      headers: { host, 'content-type': 'application/json' },
      payload: { prompt: 'no role or objective markers' },
    });
    expect(response.statusCode).toBe(422);
    expect((response.json() as { error: { code: string } }).error.code).toBe('E_PROMPT_OVERRIDE_INVALID');
    const detail = (await getAgent()).json() as { prompt: string };
    expect(detail.prompt).toBe(override);
  });

  it('removes the override and returns the registry prompt', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/agents/${agentId}/prompt`,
      headers: { host },
    });
    expect(response.statusCode).toBe(200);
    const reset = (await getAgent()).json() as { prompt: string; promptSource: string };
    expect(reset.promptSource).toBe('registry');
    expect(reset.prompt).not.toBe(override);
    expect(reset.prompt).toContain('[ROLE]');
  });
});
