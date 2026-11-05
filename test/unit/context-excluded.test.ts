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
    brief: 'context excluded test',
    preset: 'docs',
    model: 'deepseek-flash',
    thinking: 'disabled',
    effort: null,
    workspacePath: path.join(config.workspaceDir, 'runs', runId),
  });
  return runId;
}

function insertPack(input: {
  id: string;
  runId: string;
  taskId: string;
  included: unknown;
  excluded: string;
  estTokens: number;
  prefixHash: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO context_packs (id, run_id, task_id, strategy, included_json, excluded_json, est_tokens, prefix_hash, converged, degraded, created_at)
       VALUES (?, ?, ?, 'cpo-v1', ?, ?, ?, ?, 1, 0, ?)`,
    )
    .run(input.id, input.runId, input.taskId, JSON.stringify(input.included), input.excluded, input.estTokens, input.prefixHash, nowIso());
}

async function context(runId: string) {
  return app.inject({ method: 'GET', url: `/api/runs/${runId}/context`, headers: { host: HOST } });
}

beforeAll(async () => {
  initDb(':memory:', 'B2');
  seedRun('run_context_excluded');
  seedRun('run_context_malformed');
  insertPack({
    id: 'ctx_valid',
    runId: 'run_context_excluded',
    taskId: 'src/app.py',
    included: [
      { id: 'brief', kind: 'brief', path: null, tokens: null, mandatory: true },
      { id: 'task', kind: 'plan', path: null, tokens: null, mandatory: true },
    ],
    excluded: JSON.stringify([{ id: 'dep:src/util.py', reason: 'over the optional context budget' }, { id: 'dep:src/big.py' }]),
    estTokens: 1234,
    prefixHash: 'prefix-valid',
  });
  insertPack({
    id: 'ctx_malformed',
    runId: 'run_context_malformed',
    taskId: 'src/broken.py',
    included: [{ id: 'brief', kind: 'brief', path: null, tokens: null, mandatory: true }],
    excluded: '{"not":"an array"',
    estTokens: 55,
    prefixHash: 'prefix-broken',
  });
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
  closeDb();
});

describe('AF-08 context excluded rows', () => {
  it('returns included rows with included:true and excluded rows with included:false and a reason', async () => {
    const response = await context('run_context_excluded');
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      packs: Array<{ usedTokens: number; prefixHash: string; items: Array<Record<string, unknown>> }>;
      items: Array<Record<string, unknown>>;
    };
    const pack = body.packs[0];
    expect(pack?.usedTokens).toBe(1234);
    expect(pack?.prefixHash).toBe('prefix-valid');

    const included = (pack?.items ?? []).filter((item) => item.included === true);
    expect(included.map((item) => item.id)).toEqual(['brief', 'task']);
    expect(included.every((item) => item.kind !== 'excluded')).toBe(true);

    const excluded = (pack?.items ?? []).filter((item) => item.included === false);
    expect(excluded).toHaveLength(2);
    expect(excluded[0]).toEqual({
      id: 'dep:src/util.py',
      path: null,
      kind: 'excluded',
      tokens: null,
      mandatory: false,
      reason: 'over the optional context budget',
      included: false,
    });
    // A missing reason becomes the literal 'excluded', never an empty string.
    expect(excluded[1]?.reason).toBe('excluded');

    // Top-level items remains packs.flatMap.
    expect(body.items).toHaveLength(4);
  });

  it('returns no fabricated excluded rows for malformed excluded_json and never 500s', async () => {
    const response = await context('run_context_malformed');
    expect(response.statusCode).toBe(200);
    const body = response.json() as { packs: Array<{ usedTokens: number; items: Array<{ included?: boolean }> }> };
    expect(body.packs[0]?.usedTokens).toBe(55);
    expect(body.packs[0]?.items).toHaveLength(1);
    expect(body.packs[0]?.items[0]?.included).toBe(true);
  });

  it('keeps the unknown-run refusal unchanged', async () => {
    const response = await context('run_context_missing');
    expect(response.statusCode).toBe(404);
    expect((response.json() as { error: { code: string } }).error.code).toBe('E_RUN_NOT_FOUND');
  });
});
