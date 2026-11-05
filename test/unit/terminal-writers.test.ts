import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { config } from '../../src/server/config.js';
import { buildApp } from '../../src/server/app.js';
import { closeDb, getDb, initDb } from '../../src/server/db/database.js';
import { cancelRun, createRun, markStartupInterrupted, markTerminal, setExecutor } from '../../src/server/runs/manager.js';
import { createRunRow, getEvents, getRun, getSteps, insertUsage, startStep } from '../../src/server/runs/recorder.js';
import { getTraceByRun } from '../../src/server/learning/trace-store.js';
import { executeRun } from '../../src/server/pipeline/run.js';
import type { RunStatus, UsageRecord } from '../../src/shared/types.js';

const HOST = `127.0.0.1:${config.port}`;

let tmpRoot = '';
let savedDataDir = '';
let savedWorkspaceDir = '';

function usageRecord(costUsd: number, promptTokens: number, completionTokens: number): UsageRecord {
  return {
    promptTokens,
    completionTokens,
    cacheHitTokens: 0,
    cacheMissTokens: promptTokens,
    reasoningTokens: 0,
    costUsd,
    source: 'provider',
    model: 'deepseek-flash',
  };
}

function seedRun(runId: string, status: 'running' | 'paused' = 'running'): void {
  createRunRow({
    id: runId,
    brief: 'terminal writer integration test',
    preset: 'docs',
    model: 'deepseek-flash',
    thinking: 'disabled',
    effort: null,
    workspacePath: path.join(config.workspaceDir, 'runs', runId),
  });
  getDb().prepare("UPDATE runs SET status = ?, phase = 'generating', started_at = ? WHERE id = ?").run(status, new Date().toISOString(), runId);
  startStep(runId, 'generating', 'markdown-engine', 'terminal writer fixture');
  insertUsage(runId, null, 'markdown-engine', usageRecord(0.004, 80, 20));
}

async function assertTerminalTruth(
  runId: string,
  expected: {
    status: RunStatus;
    event: string;
    code: string;
    stepStatus: 'failed' | 'cancelled';
  },
): Promise<void> {
  const run = getRun(runId);
  expect(run?.status).toBe(expected.status);
  expect(run?.phase).toBe('done');
  expect(run?.errorCode).toBe(expected.code);
  expect(run?.traceComplete).toBe(true);
  expect(run?.costUsd as number).toBeCloseTo(0.004, 10);

  const steps = getSteps(runId);
  expect(steps).toHaveLength(1);
  expect(steps[0]?.status).toBe(expected.stepStatus);
  expect(steps[0]?.finishedAt).toBeTruthy();
  expect(steps[0]?.errorCode).toBe(expected.code);
  expect(steps[0]?.errorMessage).toBeTruthy();

  const terminalEvents = getEvents(runId).filter((event) => event.type === expected.event);
  if (expected.event !== '') {
    expect(terminalEvents).toHaveLength(1);
    expect(terminalEvents[0]?.payload.code).toBe(expected.code);
  }

  const trace = getTraceByRun(getDb(), runId);
  expect(trace).not.toBeNull();
  expect(trace?.outcome).toBe(expected.status === 'cancelled' ? 'cancelled' : 'failure');

  const app = await buildApp();
  try {
    const response = await app.inject({
      method: 'GET',
      url: `/api/runs/${runId}/snapshot`,
      headers: { host: HOST },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      run: { status: string; traceComplete: boolean };
      steps: Array<{ status: string; errorCode: string | null }>;
    };
    expect(body.run.status).toBe(expected.status);
    expect(body.run.traceComplete).toBe(true);
    expect(body.steps).toHaveLength(1);
    expect(body.steps[0]?.status).toBe(expected.stepStatus);
    expect(body.steps[0]?.errorCode).toBe(expected.code);
  } finally {
    await app.close();
  }
}

beforeEach(() => {
  closeDb();
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-terminal-writers-'));
  savedDataDir = config.dataDir;
  savedWorkspaceDir = config.workspaceDir;
  (config as unknown as { dataDir: string }).dataDir = path.join(tmpRoot, 'data');
  (config as unknown as { workspaceDir: string }).workspaceDir = path.join(tmpRoot, 'workspace');
  initDb(':memory:', 'B2');
});

afterEach(() => {
  closeDb();
  setExecutor(executeRun);
  (config as unknown as { dataDir: string }).dataDir = savedDataDir;
  (config as unknown as { workspaceDir: string }).workspaceDir = savedWorkspaceDir;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('terminal writers — run, step, event, snapshot, usage, trace', () => {
  it('settles the open step and trace for a manager executor failure', async () => {
    setExecutor(({ runId }) => {
      startStep(runId, 'generating', 'markdown-engine', 'executor failure fixture');
      insertUsage(runId, null, 'markdown-engine', usageRecord(0.004, 80, 20));
      return Promise.reject(new Error('E_PROVIDER_EMPTY'));
    });
    const created = await createRun({
      brief: 'executor failure terminal truth',
      preset: 'docs',
      model: 'deepseek-flash',
      thinking: 'disabled',
      effort: null,
      idempotencyKey: 'terminal-writers-executor-0001',
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    // The executor-created step is the one that must be settled; seedRun's step
    // is not used by this path.
    const steps = getSteps(created.runId);
    expect(steps.length).toBeGreaterThanOrEqual(1);
    expect(steps.some((step) => step.status === 'started')).toBe(false);
    await assertTerminalTruth(created.runId, {
      status: 'failed',
      event: 'run.failed',
      code: 'E_PROVIDER_EMPTY',
      stepStatus: 'failed',
    });
  });

  it('settles a paused run and its open step on no-controller cancel', async () => {
    seedRun('run_terminal_cancel', 'paused');
    expect(cancelRun('run_terminal_cancel')).toBe(true);
    await assertTerminalTruth('run_terminal_cancel', {
      status: 'cancelled',
      event: 'run.cancelled',
      code: 'E_CANCELLED',
      stepStatus: 'cancelled',
    });
  });

  it('settles steps and records a trace for budget_exceeded', async () => {
    seedRun('run_terminal_budget');
    markTerminal('run_terminal_budget', 'budget_exceeded', 'done', {
      code: 'E_BUDGET_EXCEEDED',
      message: 'The run exceeded its configured budget.',
    });
    const run = getRun('run_terminal_budget');
    expect(run?.status).toBe('budget_exceeded');
    expect(run?.traceComplete).toBe(true);
    const steps = getSteps('run_terminal_budget');
    expect(steps[0]?.status).toBe('failed');
    expect(steps[0]?.errorCode).toBe('E_BUDGET_EXCEEDED');
    expect(getTraceByRun(getDb(), 'run_terminal_budget')?.outcome).toBe('failure');

    const app = await buildApp();
    try {
      const response = await app.inject({ method: 'GET', url: '/api/runs/run_terminal_budget/snapshot', headers: { host: HOST } });
      expect(response.statusCode).toBe(200);
      const body = response.json() as { run: { status: string }; steps: Array<{ status: string }> };
      expect(body.run.status).toBe('budget_exceeded');
      expect(body.steps[0]?.status).toBe('failed');
    } finally {
      await app.close();
    }
  });

  it('settles steps, emits the event and records a trace on startup interrupt', async () => {
    seedRun('run_terminal_interrupt');
    expect(markStartupInterrupted()).toBe(1);
    await assertTerminalTruth('run_terminal_interrupt', {
      status: 'interrupted',
      event: 'run.interrupted',
      code: 'E_RUN_INTERRUPTED',
      stepStatus: 'failed',
    });
  });
});
