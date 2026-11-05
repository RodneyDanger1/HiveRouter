import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/server/app.js';
import { config } from '../../src/server/config.js';
import { closeDb, getDb, initDb } from '../../src/server/db/database.js';
import { createRunRow, getChecks, insertCheck } from '../../src/server/runs/recorder.js';
import type { CheckResult } from '../../src/shared/types.js';

const HOST = `127.0.0.1:${config.port}`;

let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  initDb(':memory:', 'B2');
  createRunRow({
    id: 'run_checks_identity',
    brief: 'checks identity test',
    preset: 'docs',
    model: 'deepseek-flash',
    thinking: 'disabled',
    effort: null,
    workspacePath: path.join(config.workspaceDir, 'runs', 'run_checks_identity'),
  });
  insertCheck('run_checks_identity', { id: 'stub.scan', status: 'fail', detail: 'first pass finding', mandatory: true, file: 'src/a.py', line: 4 });
  insertCheck('run_checks_identity', { id: 'stub.scan', status: 'pass', detail: 'second pass clean', mandatory: true });
  // Give the two passes distinct created_at values so ordering is explicit.
  const rows = getDb().prepare('SELECT id FROM checks WHERE run_id = ? ORDER BY rowid ASC').all('run_checks_identity') as Array<{ id: string }>;
  getDb().prepare('UPDATE checks SET created_at = ? WHERE id = ?').run('2026-11-04T00:00:01.000Z', rows[0]!.id);
  getDb().prepare('UPDATE checks SET created_at = ? WHERE id = ?').run('2026-11-04T00:00:02.000Z', rows[1]!.id);
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
  closeDb();
});

describe('AF-10 checks row identity', () => {
  it('returns a distinct rowId for repeated verifier check ids', () => {
    const checks = getChecks('run_checks_identity');
    expect(checks).toHaveLength(2);
    expect(checks.map((check) => check.id)).toEqual(['stub.scan', 'stub.scan']);
    const rowIds = checks.map((check) => check.rowId);
    expect(rowIds.every((rowId) => typeof rowId === 'string' && rowId.length > 0)).toBe(true);
    expect(new Set(rowIds).size).toBe(2);
    // The persisted fields survive the rowId addition.
    expect(checks[0]?.status).toBe('fail');
    expect(checks[0]?.detail).toBe('first pass finding');
    expect(checks[0]?.file).toBe('src/a.py');
    expect(checks[0]?.line).toBe(4);
    expect(checks[1]?.status).toBe('pass');
    expect(checks[1]?.detail).toBe('second pass clean');
  });

  it('serves rowId from GET /checks and from the snapshot', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/runs/run_checks_identity/checks', headers: { host: HOST } });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { checks: Array<{ id: string; rowId?: string; detail: string }> };
    expect(body.checks).toHaveLength(2);
    expect(new Set(body.checks.map((check) => check.rowId)).size).toBe(2);
    expect(body.checks.map((check) => check.detail)).toEqual(['first pass finding', 'second pass clean']);

    const snapshot = await app.inject({ method: 'GET', url: '/api/runs/run_checks_identity/snapshot', headers: { host: HOST } });
    expect(snapshot.statusCode).toBe(200);
    const snapshotBody = snapshot.json() as { checks: Array<{ rowId?: string }> };
    expect(snapshotBody.checks).toHaveLength(2);
    expect(new Set(snapshotBody.checks.map((check) => check.rowId)).size).toBe(2);
  });

  it('does not invent a rowId when reading a payload without one', () => {
    // The shared field is optional, so older payloads remain valid.
    const legacy: CheckResult = {
      id: 'legacy.check',
      status: 'pass',
      detail: 'legacy payload',
      mandatory: false,
    };
    expect(legacy.rowId).toBeUndefined();
  });

  it('keeps the checks timestamp readable so ordering is explicit', () => {
    const rows = getDb().prepare('SELECT created_at FROM checks WHERE run_id = ? ORDER BY created_at ASC').all('run_checks_identity') as Array<{ created_at: string }>;
    expect(rows.map((row) => row.created_at)).toEqual(['2026-11-04T00:00:01.000Z', '2026-11-04T00:00:02.000Z']);
  });
});
