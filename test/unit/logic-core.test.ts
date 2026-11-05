import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { config } from '../../src/server/config';
import { closeDb, getDb, initDb, nowIso } from '../../src/server/db/database';
import { canAfford, commit, releaseReservationsForRun, reserve, runBudgetUsd } from '../../src/server/runs/budget';
import { cancelRun, createRun, markStartupInterrupted, runWorkspace, setExecutor } from '../../src/server/runs/manager';
import { scopeCap } from '../../src/server/runs/budget';
import { createRunRow, getRun, insertUsage, usageTotals } from '../../src/server/runs/recorder';
import { PathError, normalizeRel } from '../../src/server/security/paths';
import { transitionRun } from '../../src/server/logic/run-state';

const opened: string[] = [];

function freshDb(): string {
  closeDb();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-core-'));
  initDb(path.join(dir, 'hive.db'));
  opened.push(dir);
  return dir;
}

afterEach(() => {
  closeDb();
  for (const dir of opened.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('budget ledger — overcommit and per-run limits', () => {
  it('records the actual overrun before throwing E_BUDGET_OVERCOMMIT', () => {
    freshDb();
    reserve({ id: 'over', scope: 'cycle', ownerRunId: null, amountMicroUsd: 1_000 });
    expect(() => commit('over', 2_000)).toThrow('E_BUDGET_OVERCOMMIT');
    const row = getDb().prepare('SELECT state, committed_micro_usd FROM budget_reservations WHERE id = ?').get('over') as { state: string; committed_micro_usd: number };
    expect(row.state).toBe('committed');
    expect(row.committed_micro_usd).toBe(2_000);
  });

  it('uses a per-run cap from settings instead of the global cap', () => {
    freshDb();
    getDb().prepare('INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)').run('run_limit:run_cap', JSON.stringify({ maxCostUsd: 0.01 }), nowIso());
    reserve({ id: 'cap1', scope: 'user', ownerRunId: 'run_cap', amountMicroUsd: 6_000 });
    expect(() => reserve({ id: 'cap2', scope: 'user', ownerRunId: 'run_cap', amountMicroUsd: 5_000 })).toThrow('E_BUDGET_EXCEEDED');
    expect(runBudgetUsd('run_cap')).toBe(0.01);
  });
});

describe('run lifecycle — cancel and per-run max cost', () => {
  it('cancels a needs_review run with no in-process controller', () => {
    freshDb();
    createRunRow({ id: 'run_review', brief: 'test', preset: 'docs', model: 'deepseek-flash', thinking: 'disabled', effort: null, workspacePath: runWorkspace('run_review') });
    getDb().prepare("UPDATE runs SET status = 'needs_review', phase = 'done' WHERE id = 'run_review'").run();
    expect(cancelRun('run_review')).toBe(true);
    expect(getRun('run_review')?.status).toBe('cancelled');
  });

  it('stores a per-run maxCostUsd cap used by the budget ledger', async () => {
    freshDb();
    setExecutor(async () => undefined);
    const created = await createRun({
      brief: 'cap test',
      preset: 'docs',
      model: 'deepseek-flash',
      thinking: 'disabled',
      effort: null,
      idempotencyKey: 'idempotency-cap-test-1',
      maxCostUsd: 0.01,
    });
    expect(scopeCap('user', created.runId)).toBe(10_000);
  });
});

describe('budget ledger — committed actuals and reservations', () => {
  it('uses committed actual cost, not the original reservation amount, for the cap', () => {
    freshDb();
    reserve({ id: 'r1', scope: 'cycle', ownerRunId: null, amountMicroUsd: 3_000_000 });
    commit('r1', 1_000_000);
    // 1M actual + 2M new = 3M, under the 4.5M cycle cap. The old SUM(amount)
    // counted 3M committed + 2M and refused this correctly affordable call.
    expect(() =>
      reserve({ id: 'r2', scope: 'cycle', ownerRunId: null, amountMicroUsd: 2_000_000 }),
    ).not.toThrow();
  });

  it('counts outstanding reservations in canAfford for the same run', () => {
    freshDb();
    const run = createRunRow({
      id: 'run_budget',
      brief: 'test',
      preset: 'docs',
      model: 'deepseek-flash',
      thinking: 'disabled',
      effort: null,
      workspacePath: path.join(opened[0], 'workspace'),
    });
    reserve({ id: 'r3', scope: 'user', ownerRunId: run.id, amountMicroUsd: 400_000 });
    // 400k reserved + 200k estimate = 600k, above the $0.50 per-run cap.
    expect(canAfford(run.id, 200_000)).toBe(false);
  });
});

describe('idempotency — expired keys can be reused', () => {
  it('creates a new run instead of failing on the expired key primary key', async () => {
    freshDb();
    setExecutor(async () => {});
    const key = `idem-${crypto.randomBytes(12).toString('hex')}`;
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    getDb()
      .prepare(
        'INSERT INTO idempotency_keys (key_hash, method, path, body_sha256, status, response_json, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(hash, 'POST', '/api/runs', 'old-body', 202, '{"runId":"run_old"}', new Date(Date.now() - 1000).toISOString(), nowIso());

    const result = await createRun({
      brief: 'A docs task',
      preset: 'docs',
      model: 'deepseek-flash',
      thinking: 'disabled',
      effort: null,
      idempotencyKey: key,
    });
    expect(result.runId).toMatch(/^run_/);
    expect(result.replayed).toBe(false);
    fs.rmSync(runWorkspace(result.runId), { recursive: true, force: true });
  });
});

describe('usage aggregates — null is unknown, never zero', () => {
  it('returns null totals when any usage row is unknown', () => {
    freshDb();
    const run = createRunRow({
      id: 'run_unknown',
      brief: 'test',
      preset: 'docs',
      model: 'deepseek-flash',
      thinking: 'disabled',
      effort: null,
      workspacePath: path.join(opened[0], 'workspace'),
    });
    insertUsage(run.id, null, 'architect', {
      promptTokens: 0,
      completionTokens: 0,
      cacheHitTokens: 0,
      cacheMissTokens: 0,
      reasoningTokens: 0,
      costUsd: 0,
      source: 'unknown',
      model: 'deepseek-flash',
    });
    expect(usageTotals(run.id)).toEqual({ costUsd: null, promptTokens: null, completionTokens: null, cacheHitTokens: null, cacheMissTokens: null, reasoningTokens: null });

    const knownRun = createRunRow({
      id: 'run_known',
      brief: 'test',
      preset: 'docs',
      model: 'deepseek-flash',
      thinking: 'disabled',
      effort: null,
      workspacePath: path.join(opened[0], 'workspace'),
    });
    insertUsage(knownRun.id, null, 'architect', {
      promptTokens: 10,
      completionTokens: 5,
      cacheHitTokens: 0,
      cacheMissTokens: 10,
      reasoningTokens: 0,
      costUsd: 0.01,
      source: 'provider',
      model: 'deepseek-flash',
    });
    expect(usageTotals(knownRun.id)).toEqual({ costUsd: 0.01, promptTokens: 10, completionTokens: 5, cacheHitTokens: 0, cacheMissTokens: 10, reasoningTokens: 0 });
  });
});

describe('crash recovery — interrupted runs release held budget', () => {
  it('marks active runs interrupted and releases their reserved money', () => {
    const dir = freshDb();
    // Isolation only: the interrupt writer now records a structured error log,
    // so point config.dataDir at this test's throwaway directory (restored below).
    const originalDataDir = config.dataDir;
    (config as unknown as { dataDir: string }).dataDir = dir;
    try {
      const run = createRunRow({
        id: 'run_interrupt',
        brief: 'test',
        preset: 'docs',
        model: 'deepseek-flash',
        thinking: 'disabled',
        effort: null,
        workspacePath: path.join(opened[0], 'workspace'),
      });
      getDb().prepare("UPDATE runs SET status = 'running', phase = 'generating' WHERE id = ?").run(run.id);
      reserve({ id: 'r_interrupt', scope: 'user', ownerRunId: run.id, amountMicroUsd: 100_000 });

      expect(markStartupInterrupted()).toBe(1);
      const row = getDb().prepare('SELECT status FROM runs WHERE id = ?').get(run.id) as { status: string };
      expect(row.status).toBe('interrupted');
      const budget = getDb().prepare('SELECT state FROM budget_reservations WHERE id = ?').get('r_interrupt') as { state: string };
      expect(budget.state).toBe('released');
      expect(releaseReservationsForRun(run.id)).toBe(0);
    } finally {
      (config as unknown as { dataDir: string }).dataDir = originalDataDir;
    }
  });
});

describe('path safety — Windows device names with multiple extensions', () => {
  it('rejects CON.tar.gz and nested COM1.a.b', () => {
    for (const value of ['CON.tar.gz', 'src/CON.tar.gz', 'src/COM1.a.b', 'src/nul.data.json']) {
      expect(() => normalizeRel(value)).toThrow(PathError);
    }
    expect(normalizeRel('src/console.ts')).toBe('src/console.ts');
  });
});

describe('run-state — successful terminal requires finalizing', () => {
  it('refuses completed directly from generating and allows it from finalizing/done', () => {
    expect(() =>
      transitionRun(
        { runId: 'run_term', status: 'running', phase: 'generating' },
        { status: 'completed' },
      ),
    ).toThrow(/E_ILLEGAL_RUN_TRANSITION/);
    expect(
      transitionRun(
        { runId: 'run_term', status: 'running', phase: 'finalizing' },
        { status: 'completed', phase: 'done' },
      ),
    ).toEqual({ runId: 'run_term', status: 'completed', phase: 'done' });
  });
});
