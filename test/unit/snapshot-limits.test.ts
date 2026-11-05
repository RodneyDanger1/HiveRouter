import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/server/app.js';
import { config } from '../../src/server/config.js';
import { closeDb, getDb, initDb, nowIso } from '../../src/server/db/database.js';
import { createRunRow } from '../../src/server/runs/recorder.js';

const HOST = `127.0.0.1:${config.port}`;

let app: Awaited<ReturnType<typeof buildApp>>;

function seedRun(runId: string): string {
  createRunRow({
    id: runId,
    brief: 'snapshot limits test',
    preset: 'docs',
    model: 'deepseek-flash',
    thinking: 'disabled',
    effort: null,
    workspacePath: path.join(config.workspaceDir, 'runs', runId),
  });
  return runId;
}

function setRunLimit(runId: string, valueJson: string): void {
  getDb()
    .prepare('INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)')
    .run(`run_limit:${runId}`, valueJson, nowIso());
}

async function snapshot(runId: string) {
  return app.inject({ method: 'GET', url: `/api/runs/${runId}/snapshot`, headers: { host: HOST } });
}

beforeAll(async () => {
  initDb(':memory:', 'B2');
  seedRun('run_limit_small');
  seedRun('run_limit_none');
  seedRun('run_limit_above');
  seedRun('run_limit_malformed');
  setRunLimit('run_limit_small', JSON.stringify({ maxCostUsd: 0.03 }));
  setRunLimit('run_limit_above', JSON.stringify({ maxCostUsd: 99 }));
  setRunLimit('run_limit_malformed', '{"maxCostUsd":');
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
  closeDb();
});

describe('AF-05 snapshot per-run cost cap', () => {
  it('serves the per-run run_limit instead of the global cap', async () => {
    const response = await snapshot('run_limit_small');
    expect(response.statusCode).toBe(200);
    const body = response.json() as { limits?: { maxCostUsd?: number } };
    expect(body.limits?.maxCostUsd).toBe(0.03);
  });

  it('falls back to the global cap when the run has no run_limit row', async () => {
    const response = await snapshot('run_limit_none');
    expect(response.statusCode).toBe(200);
    const body = response.json() as { limits?: { maxCostUsd?: number } };
    expect(body.limits?.maxCostUsd).toBe(config.limits.maxRunCostUsd);
  });

  it('clamps a run_limit above the global cap', async () => {
    const response = await snapshot('run_limit_above');
    expect(response.statusCode).toBe(200);
    const body = response.json() as { limits?: { maxCostUsd?: number } };
    expect(body.limits?.maxCostUsd).toBe(config.limits.maxRunCostUsd);
  });

  it('falls back to the global cap for a malformed run_limit row', async () => {
    const response = await snapshot('run_limit_malformed');
    expect(response.statusCode).toBe(200);
    const body = response.json() as { limits?: { maxCostUsd?: number } };
    expect(body.limits?.maxCostUsd).toBe(config.limits.maxRunCostUsd);
  });

  it('keeps every pre-existing snapshot key and adds only limits', async () => {
    const response = await snapshot('run_limit_small');
    const body = response.json() as Record<string, unknown>;
    for (const key of ['run', 'lastEventId', 'steps', 'checks', 'artifacts', 'truncated', 'limits']) {
      expect(body).toHaveProperty(key);
    }
    expect(Object.keys(body).sort()).toEqual(['artifacts', 'checks', 'lastEventId', 'limits', 'run', 'steps', 'truncated']);
  });

  it('keeps the unknown-run refusal unchanged', async () => {
    const response = await snapshot('run_limit_missing');
    expect(response.statusCode).toBe(404);
    expect((response.json() as { error: { code: string } }).error.code).toBe('E_RUN_NOT_FOUND');
  });
});
