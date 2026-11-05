import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/server/app.js';
import { closeDb, initDb } from '../../src/server/db/database.js';
import { config } from '../../src/server/config.js';

let app: Awaited<ReturnType<typeof buildApp>>;
const host = `127.0.0.1:${config.port}`;

beforeAll(async () => {
  initDb(':memory:', 'B2');
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
  closeDb();
});

describe('runs list boundary', () => {
  it('returns a named 422 for an unknown status instead of an empty 200', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/runs?status=not-a-status', headers: { host } });
    expect(response.statusCode).toBe(422);
    const body = response.json() as { error: { code: string; details?: { field?: string } } };
    expect(body.error.code).toBe('E_INVALID_RUN_FILTER');
    expect(body.error.details?.field).toBe('status');
  });

  it('accepts every canonical status value', async () => {
    for (const status of ['queued', 'running', 'paused', 'needs_review', 'completed', 'completed_with_warnings', 'failed', 'cancelled', 'budget_exceeded', 'interrupted']) {
      const response = await app.inject({ method: 'GET', url: `/api/runs?status=${status}`, headers: { host } });
      expect(response.statusCode).toBe(200);
      expect(Array.isArray((response.json() as { runs: unknown[] }).runs)).toBe(true);
    }
  });
});
