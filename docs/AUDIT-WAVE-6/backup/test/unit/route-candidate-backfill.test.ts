import { afterEach, describe, expect, it } from 'vitest';
import { backfillRouteCandidateDisclosure, closeDb, getDb, initDb, nowIso } from '../../src/server/db/database.js';
import { createRunRow } from '../../src/server/runs/recorder.js';

afterEach(() => closeDb());

describe('route candidate disclosure backfill', () => {
  it('backfills the chosen runtime from historical route_decisions evidence', () => {
    initDb(':memory:');
    const db = getDb();
    createRunRow({
      id: 'run_old_candidate',
      brief: 'historical',
      preset: 'docs',
      model: 'deepseek-flash',
      thinking: 'disabled',
      effort: null,
      workspacePath: 'workspace/runs/run_old_candidate',
    });
    db.prepare(
      'INSERT INTO route_decisions (id, run_id, task_id, agent_id, policy_version_id, score, rank, features_json, rejected_json, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
    ).run(
      'rtd_old',
      'run_old_candidate',
      'src/a.py',
      'python-engine',
      'pol_old',
      0.9,
      1,
      JSON.stringify({ model: 'deepseek-flash', thinking: 'enabled', effort: 'high' }),
      '[]',
      nowIso(),
    );
    db.prepare(
      'INSERT INTO route_candidates (id, run_id, task_id, agent_id, feasible, reject_reasons_json, quality, quality_source, sample_size, est_cost_usd, est_latency_ms, context_fit, risk, score, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    ).run('rtc_old', 'run_old_candidate', 'src/a.py', 'python-engine', 1, '[]', 0.8, 'prior', 0, 0.002, 20000, 0.8, 0, 0.9, nowIso());

    expect(backfillRouteCandidateDisclosure(db)).toBe(1);

    const row = db.prepare('SELECT model, thinking, effort, chosen FROM route_candidates WHERE id = ?').get('rtc_old') as {
      model: string;
      thinking: string;
      effort: string;
      chosen: number;
    };
    expect(row.model).toBe('deepseek-flash');
    expect(row.thinking).toBe('enabled');
    expect(row.effort).toBe('high');
    expect(row.chosen).toBe(1);
  });
});
