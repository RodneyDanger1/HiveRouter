import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/server/app.js';
import { config } from '../../src/server/config.js';
import { closeDb, getDb, initDb, nowIso } from '../../src/server/db/database.js';
import { createRunRow } from '../../src/server/runs/recorder.js';

const HOST = `127.0.0.1:${config.port}`;

let app: Awaited<ReturnType<typeof buildApp>>;

interface DecisionView {
  taskId: string;
  agentId: string;
  reason?: string;
  qualitySource?: unknown;
  sampleSize?: unknown;
  candidates: unknown[];
  [key: string]: unknown;
}

function insertDecision(input: { id: string; taskId: string; features: unknown; rank: number }): void {
  getDb()
    .prepare(
      `INSERT INTO route_decisions (id, run_id, task_id, agent_id, policy_version_id, score, rank, features_json, rejected_json, created_at)
       VALUES (?, ?, ?, 'python-engine', 'pol_v1', 0.9, ?, ?, '[]', ?)`,
    )
    .run(input.id, 'run_routing_reason', input.taskId, input.rank, JSON.stringify(input.features), nowIso());
}

async function decisionsByTask(): Promise<Map<string, DecisionView>> {
  const response = await app.inject({ method: 'GET', url: '/api/runs/run_routing_reason/routing', headers: { host: HOST } });
  expect(response.statusCode).toBe(200);
  const body = response.json() as { decisions: DecisionView[]; allocatedCostUsd: number; reserveUsd: number; candidatesTotal: number };
  expect(body.allocatedCostUsd).toBe(0);
  expect(body.reserveUsd).toBe(config.limits.maxRunCostUsd * 0.2);
  expect(body.candidatesTotal).toBe(0);
  return new Map(body.decisions.map((decision) => [decision.taskId, decision]));
}

beforeAll(async () => {
  initDb(':memory:', 'B2');
  createRunRow({
    id: 'run_routing_reason',
    brief: 'routing reason test',
    preset: 'docs',
    model: 'deepseek-flash',
    thinking: 'disabled',
    effort: null,
    workspacePath: path.join(config.workspaceDir, 'runs', 'run_routing_reason'),
  });
  insertDecision({
    id: 'rtd_prior',
    taskId: 'src/prior.py',
    rank: 1,
    features: { qualitySource: 'prior', sampleSize: 0, model: 'deepseek-flash', thinking: 'disabled' },
  });
  insertDecision({ id: 'rtd_empty', taskId: 'src/empty.py', rank: 2, features: {} });
  insertDecision({ id: 'rtd_persisted', taskId: 'src/persisted.py', rank: 3, features: { reason: 'learned v2' } });
  insertDecision({ id: 'rtd_nonstring', taskId: 'src/nonstring.py', rank: 4, features: { qualitySource: { nested: true }, sampleSize: 4 } });
  insertDecision({
    id: 'rtd_partial',
    taskId: 'src/partial.py',
    rank: 5,
    features: { qualitySource: 'prior', sampleSize: 'many', model: 7, thinking: '' },
  });
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
  closeDb();
});

describe('AF-11 routing reason derivation', () => {
  it('composes the reason from the decision\'s own persisted features', async () => {
    const decisions = await decisionsByTask();
    const decision = decisions.get('src/prior.py');
    expect(decision?.reason).toBe('prior-based selection (n=0) · model deepseek-flash · thinking disabled');
    // Every other decision key is preserved.
    expect(decision?.agentId).toBe('python-engine');
    expect(decision).toHaveProperty('qualitySource', 'prior');
    expect(decision).toHaveProperty('sampleSize', 0);
    expect(decision).toHaveProperty('candidates');
  });

  it('omits the reason key entirely when nothing is known', async () => {
    const decisions = await decisionsByTask();
    const decision = decisions.get('src/empty.py');
    expect(decision).toBeTruthy();
    expect(decision && 'reason' in decision).toBe(false);
  });

  it('lets a persisted reason win over the composed sentence', async () => {
    const decisions = await decisionsByTask();
    expect(decisions.get('src/persisted.py')?.reason).toBe('learned v2');
  });

  it('never emits NaN, [object Object], undefined, or a literal fallback', async () => {
    const decisions = await decisionsByTask();
    const nonString = decisions.get('src/nonstring.py');
    expect(nonString && 'reason' in nonString).toBe(false);
    const partial = decisions.get('src/partial.py');
    expect(partial?.reason).toBe('prior-based selection (n=0)');
    const serialized = JSON.stringify([...decisions.values()]);
    expect(serialized).not.toContain('NaN');
    expect(serialized).not.toContain('[object Object]');
    expect(serialized).not.toContain('"reason":"undefined"');
    expect(serialized).not.toContain('static prior route');
  });
});
