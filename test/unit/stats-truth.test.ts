import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/server/app.js';
import { closeDb, initDb } from '../../src/server/db/database.js';
import { createRunRow, insertUsage } from '../../src/server/runs/recorder.js';
import { config } from '../../src/server/config.js';

let app: Awaited<ReturnType<typeof buildApp>>;
const host = `127.0.0.1:${config.port}`;

function usage(costUsd: number, source: 'provider' | 'unknown') {
  return {
    promptTokens: 10,
    completionTokens: 4,
    cacheHitTokens: 0,
    cacheMissTokens: 10,
    reasoningTokens: 0,
    costUsd,
    source,
    model: 'deepseek-flash',
  };
}

beforeAll(async () => {
  initDb(':memory:', 'B2');
  createRunRow({
    id: 'run_stats_truth',
    brief: 'stats truth',
    preset: 'docs',
    model: 'deepseek-flash',
    thinking: 'disabled',
    effort: null,
    workspacePath: process.cwd(),
  });
  insertUsage('run_stats_truth', null, 'architect', usage(0.01, 'provider'));
  insertUsage('run_stats_truth', null, 'architect', usage(0, 'unknown'));
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
  closeDb();
});

describe('P0 stats truth', () => {
  it('does not present unknown usage as measured zero', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/stats', headers: { host } });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      totalCostUsd: number | null;
      measuredCostUsd: number;
      unknownUsageRows: number;
      partial: boolean;
    };
    expect(body.partial).toBe(true);
    expect(body.totalCostUsd).toBeNull();
    expect(body.measuredCostUsd).toBeCloseTo(0.01, 6);
    expect(body.unknownUsageRows).toBe(1);
  });
});
