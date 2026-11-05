import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/server/app.js';
import { closeDb, getDb, initDb } from '../../src/server/db/database.js';
import { createRunRow } from '../../src/server/runs/recorder.js';
import { recordAgentEvidence, revisionFilesForRun } from '../../src/server/pipeline/run.js';
import { config } from '../../src/server/config.js';
import { mapPersistedRunEvents } from '../../src/shared/run-events.js';

let app: Awaited<ReturnType<typeof buildApp>>;

const host = `127.0.0.1:${config.port}`;

beforeAll(async () => {
  initDb(':memory:', 'B2');
  const db = getDb();
  const now = new Date().toISOString();
  const workspace = process.cwd();
  createRunRow({
    id: 'run_trace_route',
    brief: 'trace route seed',
    preset: 'full-build',
    model: 'deepseek-flash',
    thinking: 'disabled',
    effort: null,
    workspacePath: workspace,
  });
  db.prepare(
    'INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)',
  ).run('run_limit:run_trace_route', JSON.stringify({ maxCostUsd: 0.03 }), now);
  db.prepare(
    'INSERT INTO route_decisions (id, run_id, task_id, agent_id, policy_version_id, score, rank, features_json, rejected_json, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
  ).run(
    'rtd_trace',
    'run_trace_route',
    'src/a.py',
    'python-engine',
    'pol_trace',
    0.91,
    1,
    JSON.stringify({ quality: 0.8, qualitySource: 'prior', sampleSize: 0, costUsd: 0.002, latencyMs: 20000, model: 'deepseek-flash', thinking: 'disabled' }),
    '[]',
    now,
  );
  db.prepare(
    'INSERT INTO route_candidates (id, run_id, task_id, agent_id, feasible, reject_reasons_json, quality, quality_source, sample_size, est_cost_usd, est_latency_ms, context_fit, risk, score, model, thinking, effort, chosen, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
  ).run('rtc_trace', 'run_trace_route', 'src/a.py', 'python-engine', 1, '[]', 0.8, 'prior', 0, 0.002, 20000, 0.8, 0, 0.91, 'deepseek-flash', 'disabled', null, 1, now);
  db.prepare(
    'INSERT INTO agent_evidence (id, agent_id, badge, provenance, run_id, evidence_hash, created_at) VALUES (?,?,?,?,?,?,?)',
  ).run('evd_trace_schema', 'architect', 'schema-valid', 'live', 'run_trace_route', 'hash-schema', now);
  db.prepare(
    'INSERT INTO agent_evidence (id, agent_id, badge, provenance, run_id, evidence_hash, created_at) VALUES (?,?,?,?,?,?,?)',
  ).run('evd_trace_live', 'architect', 'representative-live', 'live', 'run_trace_route', 'hash-live', now);
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
  closeDb();
});

describe('TRACE-01 agent detail parity', () => {
  it('returns the same badges/evidence in detail as the list', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/agents', headers: { host } });
    expect(list.statusCode).toBe(200);
    const listed = (list.json() as Array<{ id: string; badges: string[]; evidence: unknown[] }>).find((a) => a.id === 'architect');
    expect(listed?.badges).toContain('schema-valid');
    expect(listed?.badges).toContain('representative-live');

    const detail = await app.inject({ method: 'GET', url: '/api/agents/architect', headers: { host } });
    expect(detail.statusCode).toBe(200);
    const body = detail.json() as { badges: string[]; evidence: unknown[] };
    expect(body.badges).toEqual(expect.arrayContaining(['registered', 'schema-valid', 'representative-live']));
    expect(body.evidence.length).toBeGreaterThanOrEqual(2);
  });
});

describe('TRACE-02 routing candidates', () => {
  it('returns persisted candidates and marks the chosen one', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/runs/run_trace_route/routing', headers: { host } });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      decisions: Array<{ taskId: string; chosen: boolean; model: string; thinking: string; candidates: Array<{ agentId: string; chosen: boolean; quality: number; qualitySource: string; model: string; thinking: string }> }>;
      candidatesTotal: number;
      reserveUsd: number;
    };
    expect(body.candidatesTotal).toBe(1);
    expect(body.decisions[0]?.taskId).toBe('src/a.py');
    expect(body.decisions[0]?.model).toBe('deepseek-flash');
    expect(body.decisions[0]?.thinking).toBe('disabled');
    expect(body.reserveUsd).toBe(0.006);
    expect(body.decisions[0]?.candidates[0]?.agentId).toBe('python-engine');
    expect(body.decisions[0]?.candidates[0]?.model).toBe('deepseek-flash');
    expect(body.decisions[0]?.candidates[0]?.thinking).toBe('disabled');
    expect(body.decisions[0]?.candidates[0]?.chosen).toBe(true);
    expect(body.decisions[0]?.candidates[0]?.chosen).toBe(true);
    expect(body.decisions[0]?.candidates[0]?.quality).toBe(0.8);
    expect(body.decisions[0]?.candidates[0]?.qualitySource).toBe('prior');
  });
});

describe('TRACE-03 revision scope', () => {
  it('filters parent files from run metadata and refuses an invalid selection', () => {
    getDb().prepare('INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)').run(
      'run_meta:run_child_trace',
      JSON.stringify({ revisionFiles: ['src/a.py'] }),
      new Date().toISOString(),
    );
    expect(revisionFilesForRun('run_child_trace', ['src/a.py', 'src/b.py'])).toEqual(['src/a.py']);
    expect(revisionFilesForRun('run_no_scope', ['src/a.py', 'src/b.py'])).toEqual(['src/a.py', 'src/b.py']);
    expect(() => revisionFilesForRun('run_child_trace', ['src/b.py'])).toThrow('E_INVALID_REVISION_SCOPE');
  });
});

describe('TRACE-04 schema-valid evidence producer', () => {
  it('writes schema-valid evidence for every successful validated agent step', () => {
    recordAgentEvidence('run_evidence_trace', 'router', 'step-1');
    const rows = getDb()
      .prepare('SELECT badge FROM agent_evidence WHERE run_id = ? AND agent_id = ? ORDER BY badge')
      .all('run_evidence_trace', 'router') as Array<{ badge: string }>;
    expect(rows.map((row) => row.badge)).toEqual(['schema-valid']);
  });
});

describe('W2 run boundary — cost limit', () => {
  it('refuses a non-number maxCostUsd instead of silently using the global cap', async () => {
    const before = Number((getDb().prepare('SELECT COUNT(*) AS n FROM runs').get() as { n: number }).n);
    const response = await app.inject({
      method: 'POST',
      url: '/api/runs',
      headers: { host, 'content-type': 'application/json', 'idempotency-key': 'trace-invalid-cost-0001' },
      payload: { brief: 'a valid brief for cost validation', preset: 'docs', model: 'deepseek-flash', maxCostUsd: '0.01' },
    });
    expect(response.statusCode).toBe(422);
    expect((response.json() as { error: { code: string } }).error.code).toBe('E_BUDGET_INVALID_LIMIT');
    const after = Number((getDb().prepare('SELECT COUNT(*) AS n FROM runs').get() as { n: number }).n);
    expect(after).toBe(before);
  });
});

describe('TRACE-05 run enum boundary', () => {
  it('refuses invalid preset/model/thinking before createRun and creates no row', async () => {
    const before = Number((getDb().prepare('SELECT COUNT(*) AS n FROM runs').get() as { n: number }).n);
    const response = await app.inject({
      method: 'POST',
      url: '/api/runs',
      headers: { host, 'content-type': 'application/json', 'idempotency-key': 'trace-invalid-enum-0001' },
      payload: { brief: 'must be refused', preset: 'bogus-preset', model: 'bogus-model', thinking: 'bogus-thinking' },
    });
    expect(response.statusCode).toBe(422);
    expect((response.json() as { error?: { code?: string } }).error?.code).toBe('E_INVALID_RUN_INPUT');
    const after = Number((getDb().prepare('SELECT COUNT(*) AS n FROM runs').get() as { n: number }).n);
    expect(after).toBe(before);
  });
});

describe('TRACE-06 persisted event mapping', () => {
  it('maps the persisted /events ledger into renderable rows', () => {
    const mapped = mapPersistedRunEvents([
      { type: 'run.completed', payload: { status: 'completed' }, createdAt: '2026-11-03T20:00:00.000Z' },
      { type: 'phase.started', data: { phase: 'planning' }, createdAt: '2026-11-03T19:59:00.000Z' },
      'malformed-row',
    ]);
    expect(mapped).toEqual([
      { type: 'run.completed', data: { status: 'completed' }, receivedAt: '2026-11-03T20:00:00.000Z' },
      { type: 'phase.started', data: { phase: 'planning' }, receivedAt: '2026-11-03T19:59:00.000Z' },
    ]);
  });
});
