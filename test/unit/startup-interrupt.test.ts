import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { config } from '../../src/server/config.js';
import { closeDb, getDb, initDb, nowIso } from '../../src/server/db/database.js';
import { reserve } from '../../src/server/runs/budget.js';
import { markStartupInterrupted } from '../../src/server/runs/manager.js';
import { createRunRow, getEvents, getRun, insertUsage } from '../../src/server/runs/recorder.js';
import { REFUSALS } from '../../src/shared/refusals.js';
import type { UsageRecord } from '../../src/shared/types.js';

let tmpRoot = '';
let savedDataDir = '';
let savedWorkspaceDir = '';

function createActiveRun(runId: string, status: 'queued' | 'running'): string {
  createRunRow({
    id: runId,
    brief: 'startup interrupt test',
    preset: 'docs',
    model: 'deepseek-flash',
    thinking: 'disabled',
    effort: null,
    workspacePath: path.join(config.workspaceDir, 'runs', runId),
  });
  if (status !== 'queued') {
    getDb().prepare("UPDATE runs SET status = ?, phase = 'generating', started_at = ? WHERE id = ?").run(status, nowIso(), runId);
  }
  return runId;
}

function errorLogLines(): Array<{ source?: string; code?: string; runId?: string | null }> {
  const file = path.join(config.dataDir, 'logs', 'errors.jsonl');
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as { source?: string; code?: string; runId?: string | null });
}

beforeEach(() => {
  closeDb();
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-startup-interrupt-'));
  savedDataDir = config.dataDir;
  savedWorkspaceDir = config.workspaceDir;
  (config as unknown as { dataDir: string }).dataDir = path.join(tmpRoot, 'data');
  (config as unknown as { workspaceDir: string }).workspaceDir = path.join(tmpRoot, 'workspace');
  initDb(':memory:', 'B2');
});

afterEach(() => {
  closeDb();
  (config as unknown as { dataDir: string }).dataDir = savedDataDir;
  (config as unknown as { workspaceDir: string }).workspaceDir = savedWorkspaceDir;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('AF-07 interrupted terminal state', () => {
  it('explains, emits, logs and releases every run it transitions', () => {
    const queued = createActiveRun('run_interrupt_queued', 'queued');
    const running = createActiveRun('run_interrupt_running', 'running');
    const usage: UsageRecord = {
      promptTokens: 12,
      completionTokens: 4,
      cacheHitTokens: 0,
      cacheMissTokens: 12,
      reasoningTokens: 0,
      costUsd: 0.001,
      source: 'provider',
      model: 'deepseek-flash',
    };
    insertUsage(running, null, 'architect', usage);
    reserve({ id: 'res_interrupt_running', scope: 'user', ownerRunId: running, amountMicroUsd: 1_000 });

    expect(markStartupInterrupted()).toBe(2);

    const message = REFUSALS.E_RUN_INTERRUPTED.message;
    for (const runId of [queued, running]) {
      const run = getRun(runId);
      expect(run?.status).toBe('interrupted');
      expect(run?.phase).toBe('done');
      expect(run?.errorCode).toBe('E_RUN_INTERRUPTED');
      expect(run?.errorMessage).toBe(message);
      expect(run?.finishedAt).toBeTruthy();
      const interrupted = getEvents(runId).filter((event) => event.type === 'run.interrupted');
      expect(interrupted).toHaveLength(1);
      expect(interrupted[0]?.payload.code).toBe('E_RUN_INTERRUPTED');
      expect(interrupted[0]?.payload.message).toBe(message);
      expect(interrupted[0]?.payload).toHaveProperty('costUsd');
    }
    expect(getRun(queued)?.costUsd).toBeNull();
    expect(getEvents(queued)[0]?.payload.costUsd).toBeNull();
    expect(getRun(running)?.costUsd as number).toBeCloseTo(0.001, 10);
    expect(getEvents(running)[0]?.payload.costUsd as number).toBeCloseTo(0.001, 10);

    const reservation = getDb().prepare('SELECT state FROM budget_reservations WHERE id = ?').get('res_interrupt_running') as { state: string };
    expect(reservation.state).toBe('released');

    const logs = errorLogLines();
    expect(logs).toHaveLength(2);
    expect(logs.map((line) => line.source)).toEqual(['run', 'run']);
    expect(logs.map((line) => line.code)).toEqual(['E_RUN_INTERRUPTED', 'E_RUN_INTERRUPTED']);
    expect(logs.map((line) => line.runId).sort()).toEqual([queued, running].sort());

    const eventCounts = [queued, running].map((runId) => getEvents(runId).length);
    expect(markStartupInterrupted()).toBe(0);
    expect([queued, running].map((runId) => getEvents(runId).length)).toEqual(eventCounts);
    expect(errorLogLines()).toHaveLength(2);
    expect(getRun(queued)?.status).toBe('interrupted');
    expect(getRun(running)?.status).toBe('interrupted');
  });
});
