import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initDb } from '../../src/server/db/database.js';
import {
  evaluateLoopGuard,
  mineFailures,
  recordRepair,
  recordRepairOutcome,
  recordTrace,
  retrieveRepairs,
  type GuardState,
} from '../../src/server/learning/index.js';

function insertRun(id: string, status = 'completed'): void {
  getDb()
    .prepare(
      `INSERT INTO runs (id, brief, preset, status, phase, model, thinking, created_at, workspace_path)
       VALUES (?, 'brief', 'full-build', ?, 'done', 'deepseek-flash', 'disabled', ?, '/tmp/run')`,
    )
    .run(id, status, new Date().toISOString());
}

function trace(runId: string, outcome: 'failure' | 'success', message: string, provenance: 'live' | 'mock' = 'live') {
  recordTrace(getDb(), {
    runId,
    model: 'deepseek-flash',
    thinking: 'disabled',
    outcome,
    errorMessage: message,
    provenance,
  });
}

beforeEach(() => {
  closeDb();
  initDb(':memory:', 'B2');
});

afterEach(() => {
  closeDb();
});

describe('deterministic failure mining', () => {
  it('clusters the same normalized failure across three live runs', () => {
    for (let i = 0; i < 3; i += 1) {
      insertRun(`run-${i}`);
      trace(`run-${i}`, 'failure', `Error: line ${10 + i} failed with code 42`);
    }
    const clusters = mineFailures(getDb());
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.distinctRuns).toBe(3);
    expect(clusters[0]!.liveRuns).toBe(3);
    expect(clusters[0]!.eligible).toBe(true);
    expect(clusters[0]!.representativeTraceIds).toHaveLength(3);
  });

  it('does not make a mock-only cluster eligible', () => {
    for (let i = 0; i < 3; i += 1) {
      insertRun(`mock-run-${i}`);
      trace(`mock-run-${i}`, 'failure', 'Permission denied opening file', 'mock');
    }
    const clusters = mineFailures(getDb());
    // The cluster exists but has zero live runs, so it cannot seed a candidate.
    expect(clusters[0]!.liveRuns).toBe(0);
    expect(clusters[0]!.eligible).toBe(false);
  });

  it('keeps different categories in different signatures', () => {
    insertRun('cat-1');
    insertRun('cat-2');
    trace('cat-1', 'failure', 'SyntaxError: unexpected token at line 4');
    trace('cat-2', 'failure', 'Permission denied: EACCES');
    const clusters = mineFailures(getDb());
    expect(clusters.length).toBeGreaterThanOrEqual(2);
    expect(new Set(clusters.map((cluster) => cluster.signature)).size).toBe(clusters.length);
  });
});

describe('repair memory', () => {
  it('isolates projects, requires successes, and decays on failure', () => {
    const repair = recordRepair(getDb(), {
      projectId: 'project-a',
      signature: 'sig-1',
      agentId: 'python-engine',
      fixSummary: 'Add a guard for null input before parsing.',
      patch: { op: 'add-guard' },
    });
    expect(retrieveRepairs(getDb(), { projectId: 'project-a', signature: 'sig-1' })).toHaveLength(0);
    const success = recordRepairOutcome(getDb(), repair.id, true);
    expect(success.successes).toBe(1);
    const retrieved = retrieveRepairs(getDb(), { projectId: 'project-a', signature: 'sig-1' });
    expect(retrieved).toHaveLength(1);
    expect(retrieveRepairs(getDb(), { projectId: 'project-b', signature: 'sig-1' })).toHaveLength(0);

    let current = success;
    current = recordRepairOutcome(getDb(), current.id, false);
    expect(current.confidence).toBeCloseTo(0.5, 6);
    current = recordRepairOutcome(getDb(), current.id, false);
    expect(current.confidence).toBeCloseTo(0.25, 6);
    current = recordRepairOutcome(getDb(), current.id, false);
    expect(current.status).toBe('archived');
    expect(retrieveRepairs(getDb(), { projectId: 'project-a', signature: 'sig-1' })).toHaveLength(0);
  });

  it('excludes expired repair memory', () => {
    const repair = recordRepair(getDb(), {
      projectId: 'project-c',
      signature: 'sig-2',
      agentId: 'python-engine',
      fixSummary: 'Use a bounded retry loop.',
      patch: { retries: 1 },
    });
    recordRepairOutcome(getDb(), repair.id, true);
    getDb()
      .prepare('UPDATE repair_memory SET expires_at = ? WHERE id = ?')
      .run('2000-01-01T00:00:00.000Z', repair.id);
    expect(retrieveRepairs(getDb(), { projectId: 'project-c', signature: 'sig-2' })).toHaveLength(0);
  });
});

describe('L4 loop guard', () => {
  const base: GuardState = {
    repeatedSignatureCount: 0,
    identicalRequestCount: 0,
    spendUsd: 0,
    capUsd: 0.5,
    lastProgressAt: '2026-11-03T12:00:00.000Z',
    now: '2026-11-03T12:01:00.000Z',
    pausedAt: null,
  };

  it('continues under normal progress and thresholds', () => {
    expect(evaluateLoopGuard(base).action).toBe('continue');
    expect(evaluateLoopGuard({ ...base, repeatedSignatureCount: 2 }).action).toBe('continue');
  });

  it('pauses on repeated signature, identical request, spend, or no progress', () => {
    expect(evaluateLoopGuard({ ...base, repeatedSignatureCount: 3 }).action).toBe('pause');
    expect(evaluateLoopGuard({ ...base, identicalRequestCount: 2 }).action).toBe('pause');
    expect(evaluateLoopGuard({ ...base, spendUsd: 0.46 }).action).toBe('pause');
    expect(
      evaluateLoopGuard({ ...base, now: '2026-11-03T12:06:01.000Z' }).action,
    ).toBe('pause');
  });

  it('moves to needs_review after the 10-minute pause timeout', () => {
    const decision = evaluateLoopGuard({
      ...base,
      pausedAt: '2026-11-03T12:00:00.000Z',
      now: '2026-11-03T12:10:00.000Z',
    });
    expect(decision.action).toBe('needs_review');
    expect(decision.code).toBe('E_LOOP_GUARD_TRIPPED');
    expect(decision.releaseBudget).toBe(true);
  });

  it('does not false-positive on a recent heartbeat', () => {
    const decision = evaluateLoopGuard({
      ...base,
      lastProgressAt: '2026-11-03T12:00:30.000Z',
      now: '2026-11-03T12:04:00.000Z',
    });
    expect(decision.action).toBe('continue');
  });
});
