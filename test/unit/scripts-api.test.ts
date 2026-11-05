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

function dryRun(id: string) {
  return app.inject({
    method: 'POST',
    url: `/api/scripts/${encodeURIComponent(id)}/dry-run`,
    headers: { host, 'content-type': 'application/json' },
    payload: {},
  });
}

describe('scripts catalog API', () => {
  it('returns the eight catalog entries with safety and dry-run availability', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/scripts', headers: { host } });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      scripts: Array<{ id: string; safety: string; dryRun: boolean; description: string }>;
    };
    expect(body.scripts).toHaveLength(8);
    expect(body.scripts.map((script) => script.id)).toEqual([
      'preflight',
      'stub-sweep',
      'secret-scan',
      'assert-stage',
      'bench',
      'replay',
      'integrity',
      'learn',
    ]);
    expect(body.scripts.filter((script) => script.dryRun).map((script) => script.id)).toEqual([
      'preflight',
      'stub-sweep',
      'secret-scan',
      'assert-stage',
      'replay',
      'integrity',
    ]);
    expect(body.scripts.find((script) => script.id === 'bench')?.safety).toBe('paid');
    expect(body.scripts.find((script) => script.id === 'preflight')?.safety).toBe('read');
    expect(body.scripts.every((script) => script.description.trim().length > 0)).toBe(true);
  });

  it('returns a local command hint without executing the script', async () => {
    const response = await dryRun('preflight');
    expect(response.statusCode).toBe(200);
    const body = response.json() as { script: string; dryRun: boolean; message: string };
    expect(body).toEqual({
      script: 'preflight',
      dryRun: true,
      message: 'Run locally: npm.cmd run preflight -- --json',
    });
  });

  it('refuses paid scripts by name instead of pretending to dry-run them', async () => {
    for (const id of ['bench', 'learn']) {
      const response = await dryRun(id);
      expect(response.statusCode).toBe(422);
      expect((response.json() as { error: { code: string } }).error.code).toBe('E_SCRIPT_DRY_RUN_UNSUPPORTED');
    }
  });

  it('refuses an unknown script id with the same named code', async () => {
    const response = await dryRun('not-a-script');
    expect(response.statusCode).toBe(422);
    expect((response.json() as { error: { code: string } }).error.code).toBe('E_SCRIPT_DRY_RUN_UNSUPPORTED');
  });
});
