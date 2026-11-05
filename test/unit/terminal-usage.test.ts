import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { config } from '../../src/server/config.js';
import { buildApp } from '../../src/server/app.js';
import { closeDb, getDb, initDb, nowIso } from '../../src/server/db/database.js';
import { createRun, markTerminal, setExecutor } from '../../src/server/runs/manager.js';
import { createRunRow, getEvents, getRun, insertUsage, usageFields } from '../../src/server/runs/recorder.js';
import { executeRun } from '../../src/server/pipeline/run.js';
import type { UsageRecord } from '../../src/shared/types.js';

const HOST = `127.0.0.1:${config.port}`;

let tmpRoot = '';
let savedDataDir = '';
let savedWorkspaceDir = '';

function usageRecord(costUsd: number, promptTokens: number, completionTokens: number, source: UsageRecord['source'] = 'provider'): UsageRecord {
  return {
    promptTokens,
    completionTokens,
    cacheHitTokens: 0,
    cacheMissTokens: promptTokens,
    reasoningTokens: 0,
    costUsd,
    source,
    model: 'deepseek-flash',
  };
}

function createTerminalCandidate(runId: string): string {
  createRunRow({
    id: runId,
    brief: 'terminal usage test',
    preset: 'docs',
    model: 'deepseek-flash',
    thinking: 'disabled',
    effort: null,
    workspacePath: path.join(config.workspaceDir, 'runs', runId),
  });
  return runId;
}

function terminalPayload(runId: string): { type: string; payload: Record<string, unknown> } | undefined {
  const events = getEvents(runId);
  const last = events[events.length - 1];
  return last ? { type: last.type, payload: last.payload } : undefined;
}

beforeEach(() => {
  closeDb();
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-terminal-usage-'));
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

describe('AF-01 terminal usage aggregation', () => {
  it('writes the summed provider usage onto the run row at the terminal write', () => {
    const runId = createTerminalCandidate('run_usage_sum');
    insertUsage(runId, null, 'architect', usageRecord(0.003, 100, 40));
    insertUsage(runId, null, 'python-engine', usageRecord(0.002, 50, 10));

    expect(usageFields(runId)).toEqual({ cost_usd: 0.005, prompt_tokens: 150, completion_tokens: 50 });

    markTerminal(runId, 'failed', 'done', { code: 'GATE_FAILED', message: 'Mandatory verification failed' });

    const run = getRun(runId);
    expect(run?.status).toBe('failed');
    expect(run?.costUsd).not.toBeNull();
    expect(run?.costUsd as number).toBeCloseTo(0.005, 10);
    expect(run?.promptTokens).toBe(150);
    expect(run?.completionTokens).toBe(50);
  });

  it('keeps every usage field NULL when any usage row has source=unknown', () => {
    const runId = createTerminalCandidate('run_usage_unknown');
    insertUsage(runId, null, 'architect', usageRecord(0.004, 80, 20));
    insertUsage(runId, null, 'architect', usageRecord(0, 0, 0, 'unknown'));

    markTerminal(runId, 'failed', 'done', { code: 'GATE_FAILED', message: 'Mandatory verification failed' });

    const run = getRun(runId);
    expect(run?.costUsd).toBeNull();
    expect(run?.promptTokens).toBeNull();
    expect(run?.completionTokens).toBeNull();
  });

  it('keeps every usage field NULL when the run never called the provider (never 0)', () => {
    const runId = createTerminalCandidate('run_usage_none');

    markTerminal(runId, 'cancelled', 'done', { code: 'E_CANCELLED', message: 'Cancelled before the first provider call.' });

    const run = getRun(runId);
    expect(run?.costUsd).toBeNull();
    expect(run?.promptTokens).toBeNull();
    expect(run?.completionTokens).toBeNull();
    expect(run?.status).toBe('cancelled');
  });

  it('is idempotent across duplicate terminal writes (usage rows are per call, not per write)', () => {
    const runId = createTerminalCandidate('run_usage_twice');
    insertUsage(runId, null, 'architect', usageRecord(0.001, 20, 10));

    markTerminal(runId, 'failed', 'done', { code: 'GATE_FAILED', message: 'Mandatory verification failed' });
    markTerminal(runId, 'failed', 'done', { code: 'GATE_FAILED', message: 'Mandatory verification failed' });

    const run = getRun(runId);
    expect(run?.status).toBe('failed');
    expect(run?.costUsd as number).toBeCloseTo(0.001, 10);
    expect(run?.promptTokens).toBe(20);
    expect(run?.completionTokens).toBe(10);
  });

  it('serves the summed cost from GET /api/runs/:id/snapshot', async () => {
    const runId = createTerminalCandidate('run_usage_snapshot');
    insertUsage(runId, null, 'architect', usageRecord(0.003, 100, 40));
    insertUsage(runId, null, 'python-engine', usageRecord(0.002, 50, 10));
    markTerminal(runId, 'failed', 'done', { code: 'GATE_FAILED', message: 'Mandatory verification failed' });

    const app = await buildApp();
    try {
      const response = await app.inject({ method: 'GET', url: `/api/runs/${runId}/snapshot`, headers: { host: HOST } });
      expect(response.statusCode).toBe(200);
      const body = response.json() as { run: { costUsd: number | null; promptTokens: number | null; completionTokens: number | null } };
      expect(body.run.costUsd as number).toBeCloseTo(0.005, 10);
      expect(body.run.promptTokens).toBe(150);
      expect(body.run.completionTokens).toBe(50);
    } finally {
      await app.close();
    }
  });

  it('emits a real pipeline-catch run.failed with costUsd and a human message, not the code', async () => {
    setExecutor(executeRun);
    const created = await createRun({
      brief: 'revise without a parent',
      preset: 'revise',
      model: 'deepseek-flash',
      thinking: 'disabled',
      effort: null,
      idempotencyKey: 'terminal-usage-catch-0001',
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const run = getRun(created.runId);
    expect(run?.status).toBe('failed');
    expect(run?.errorCode).toBe('E_INVALID_PARENT');
    expect(run?.costUsd).toBeNull();

    const terminal = terminalPayload(created.runId);
    expect(terminal?.type).toBe('run.failed');
    expect(terminal?.payload.code).toBe('E_INVALID_PARENT');
    expect(terminal?.payload.message).toBe('Parent run is not terminal or has no artifacts.');
    expect(terminal?.payload.message).not.toBe(terminal?.payload.code);
    expect(terminal?.payload).toHaveProperty('costUsd');
    expect(terminal?.payload.costUsd).toBeNull();
  });

  it('emits a human message for a bare Error(E_PROVIDER_EMPTY) on the executor rejection path', async () => {
    setExecutor(() => Promise.reject(new Error('E_PROVIDER_EMPTY')));
    const created = await createRun({
      brief: 'executor rejection with a bare code',
      preset: 'docs',
      model: 'deepseek-flash',
      thinking: 'disabled',
      effort: null,
      idempotencyKey: 'terminal-usage-bare-0001',
    });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const run = getRun(created.runId);
    expect(run?.status).toBe('failed');
    expect(run?.errorCode).toBe('E_PROVIDER_EMPTY');

    const terminal = terminalPayload(created.runId);
    expect(terminal?.type).toBe('run.failed');
    expect(terminal?.payload.code).toBe('E_PROVIDER_EMPTY');
    expect(terminal?.payload.message).toBe('The run failed with E_PROVIDER_EMPTY.');
    expect(terminal?.payload.message).not.toBe(terminal?.payload.code);
    expect(terminal?.payload).toHaveProperty('costUsd');
    expect(terminal?.payload.costUsd).toBeNull();
  });

  it('does not backfill a historical failed row that has usage rows but NULL cost', () => {
    const historical = createTerminalCandidate('run_historical_null');
    getDb().prepare("UPDATE runs SET status = 'failed', phase = 'done', finished_at = ? WHERE id = ?").run(nowIso(), historical);
    insertUsage(historical, null, 'architect', usageRecord(0.007, 70, 30));

    const live = createTerminalCandidate('run_live_terminal');
    insertUsage(live, null, 'architect', usageRecord(0.001, 10, 5));
    markTerminal(live, 'failed', 'done', { code: 'GATE_FAILED', message: 'Mandatory verification failed' });

    const historicalRow = getRun(historical);
    expect(historicalRow?.status).toBe('failed');
    expect(historicalRow?.costUsd).toBeNull();
    expect(historicalRow?.promptTokens).toBeNull();
    expect(historicalRow?.completionTokens).toBeNull();
    expect(getRun(live)?.costUsd as number).toBeCloseTo(0.001, 10);
  });
});
