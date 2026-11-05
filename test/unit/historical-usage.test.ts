import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/server/app.js';
import { config } from '../../src/server/config.js';
import { closeDb, getDb, initDb, nowIso } from '../../src/server/db/database.js';
import { cancelRun, createRun, markStartupInterrupted, markTerminal, setExecutor } from '../../src/server/runs/manager.js';
import { createRunRow, getRun, insertUsage, usageTotals } from '../../src/server/runs/recorder.js';
import { executeRun } from '../../src/server/pipeline/run.js';
import type { RunStatus, UsageRecord } from '../../src/shared/types.js';

/**
 * P0-5 historical NULL/zero audit.
 *
 * Invariant: when spend is unknown, every persisted or projected spend field is
 * NULL. A terminal writer may aggregate measured usage into its own row, but no
 * writer, migration, or projection may rewrite a historical NULL to 0.
 *
 * Truth sources:
 *  - `runs.cost_usd/prompt_tokens/completion_tokens` (per-run terminal aggregate)
 *  - `usage` rows (per-call ledger; `source='unknown'` means the call's usage is unknown)
 *  - `chat_jobs.cost_usd` (per chat job)
 *  - `/api/runs`, `/api/runs/:id`, `/api/runs/:id/snapshot`, `/api/stats`
 */

const HOST = `127.0.0.1:${config.port}`;
const TERMINAL_STATUSES = "'completed','completed_with_warnings','failed','cancelled','budget_exceeded','interrupted'";

let tmpRoot = '';
let savedDataDir = '';
let savedWorkspaceDir = '';
let savedVaultDir = '';

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

function createRow(id: string): void {
  createRunRow({
    id,
    brief: 'historical usage fixture',
    preset: 'docs',
    model: 'deepseek-flash',
    thinking: 'disabled',
    effort: null,
    workspacePath: path.join(config.workspaceDir, 'runs', id),
  });
}

/** Simulate a terminal row written before the terminal-usage fix: terminal, spend still NULL. */
function historicalTerminal(id: string, status: RunStatus, withKnownUsage: boolean): void {
  createRow(id);
  getDb()
    .prepare("UPDATE runs SET status = ?, phase = 'done', finished_at = ?, error_code = ? WHERE id = ?")
    .run(status, nowIso(), status === 'completed' ? null : 'E_HISTORICAL', id);
  if (withKnownUsage) insertUsage(id, null, 'architect', usageRecord(0.007, 70, 30));
}

/** A measured completed run: usage rows exist before the terminal aggregate is written. */
function measuredCompletedRun(id: string): void {
  createRow(id);
  getDb().prepare("UPDATE runs SET status = 'running', phase = 'finalizing' WHERE id = ?").run(id);
  insertUsage(id, null, 'architect', usageRecord(0.01, 10, 4));
  markTerminal(id, 'completed', 'done');
}

function installBackfillTrigger(): void {
  const db = getDb();
  db.exec(`CREATE TABLE IF NOT EXISTS backfill_log (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    old_cost REAL, new_cost REAL,
    old_prompt INTEGER, new_prompt INTEGER,
    old_completion INTEGER, new_completion INTEGER
  )`);
  db.exec(`CREATE TRIGGER IF NOT EXISTS capture_run_spend_backfill
    AFTER UPDATE OF cost_usd, prompt_tokens, completion_tokens ON runs
    BEGIN
      INSERT INTO backfill_log (run_id, old_cost, new_cost, old_prompt, new_prompt, old_completion, new_completion)
      VALUES (OLD.id, OLD.cost_usd, NEW.cost_usd, OLD.prompt_tokens, NEW.prompt_tokens, OLD.completion_tokens, NEW.completion_tokens);
    END`);
}

function spendSnapshot(): Array<Record<string, unknown>> {
  return getDb()
    .prepare(
      `SELECT id, status, phase, cost_usd, prompt_tokens, completion_tokens, finished_at
       FROM runs WHERE id LIKE 'hist_%' ORDER BY id`,
    )
    .all() as unknown as Array<Record<string, unknown>>;
}

function backfilledHistoricalRows(): number {
  return Number(
    (getDb().prepare("SELECT COUNT(*) AS n FROM backfill_log WHERE run_id LIKE 'hist_%'").get() as { n: number }).n,
  );
}

function seedChatJob(id: string, status: string, attempts: number, costUsd: number | null): void {
  const db = getDb();
  const now = nowIso();
  db.prepare(
    'INSERT INTO chat_threads (id, title, agent_id, model, thinking, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(`thread_${id}`, 'fixture thread', 'architect', 'deepseek-flash', 'disabled', 'active', now, now);
  db.prepare(
    'INSERT INTO chat_messages (id, thread_id, seq, role, content, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(`msg_user_${id}`, `thread_${id}`, 1, 'user', 'hello', 'complete', now, now);
  db.prepare(
    'INSERT INTO chat_messages (id, thread_id, seq, role, content, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(`msg_reply_${id}`, `thread_${id}`, 2, 'assistant', '', 'failed', now, now);
  db.prepare(
    `INSERT INTO chat_jobs (id, thread_id, message_id, user_message_id, agent_id, kind, status, attempts, available_at, cost_usd, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'chat.reply', ?, ?, ?, ?, ?, ?)`,
  ).run(id, `thread_${id}`, `msg_reply_${id}`, `msg_user_${id}`, 'architect', status, attempts, now, costUsd, now, now);
}

async function waitForTerminal(runId: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const run = getRun(runId);
    if (run && ['completed', 'completed_with_warnings', 'failed', 'cancelled', 'budget_exceeded', 'interrupted'].includes(run.status)) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`run ${runId} did not settle`);
}

beforeEach(() => {
  closeDb();
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-historical-usage-'));
  savedDataDir = config.dataDir;
  savedWorkspaceDir = config.workspaceDir;
  savedVaultDir = config.vaultDir;
  (config as unknown as { dataDir: string }).dataDir = path.join(tmpRoot, 'data');
  (config as unknown as { workspaceDir: string }).workspaceDir = path.join(tmpRoot, 'workspace');
  (config as unknown as { vaultDir: string }).vaultDir = path.join(tmpRoot, 'vault');
  initDb(':memory:', 'B2');
  installBackfillTrigger();
});

afterEach(() => {
  setExecutor(executeRun);
  closeDb();
  (config as unknown as { dataDir: string }).dataDir = savedDataDir;
  (config as unknown as { workspaceDir: string }).workspaceDir = savedWorkspaceDir;
  (config as unknown as { vaultDir: string }).vaultDir = savedVaultDir;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('P0-5 historical NULL/unknown spend', () => {
  it('never rewrites a historical NULL spend row from any terminal writer', async () => {
    historicalTerminal('hist_failed_known_usage', 'failed', true);
    historicalTerminal('hist_completed_unknown', 'completed', false);
    historicalTerminal('hist_cancelled_unknown', 'cancelled', false);
    const before = spendSnapshot();
    expect(before.filter((row) => row.cost_usd === null)).toHaveLength(3);

    // Startup interrupt only touches non-terminal rows.
    createRow('run_active_for_interrupt');
    getDb().prepare("UPDATE runs SET status = 'running', phase = 'generating' WHERE id = 'run_active_for_interrupt'").run();
    expect(markStartupInterrupted()).toBe(1);

    // No-controller cancel.
    createRow('run_paused_for_cancel');
    getDb().prepare("UPDATE runs SET status = 'paused', phase = 'generating' WHERE id = 'run_paused_for_cancel'").run();
    expect(cancelRun('run_paused_for_cancel')).toBe(true);

    // Manager executor-catch terminal writer.
    setExecutor(() => Promise.reject(new Error('E_PROVIDER_EMPTY')));
    const rejected = await createRun({
      brief: 'manager catch historical fixture',
      preset: 'docs',
      model: 'deepseek-flash',
      thinking: 'disabled',
      effort: null,
      idempotencyKey: 'historical-manager-catch-0001',
    });
    await waitForTerminal(rejected.runId);

    // Pipeline catch terminal writer.
    setExecutor(executeRun);
    const pipelineCatch = await createRun({
      brief: 'revise without a parent',
      preset: 'revise',
      model: 'deepseek-flash',
      thinking: 'disabled',
      effort: null,
      idempotencyKey: 'historical-pipeline-catch-0001',
    });
    await waitForTerminal(pipelineCatch.runId);

    // Direct terminal writer.
    createRow('run_direct_terminal');
    getDb().prepare("UPDATE runs SET status = 'running', phase = 'generating' WHERE id = 'run_direct_terminal'").run();
    markTerminal('run_direct_terminal', 'budget_exceeded', 'done', {
      code: 'E_BUDGET_EXCEEDED',
      message: 'The run exceeded its configured budget.',
    });

    expect(spendSnapshot()).toEqual(before);
    expect(backfilledHistoricalRows()).toBe(0);

    // The historical row's ledger truth is the measured usage rows; the stale
    // per-run copy stays NULL and is never rewritten to zero.
    expect(getRun('hist_failed_known_usage')?.costUsd).toBeNull();
    expect(usageTotals('hist_failed_known_usage')).toMatchObject({
      costUsd: 0.007,
      promptTokens: 70,
      completionTokens: 30,
    });
    expect(getRun('hist_completed_unknown')?.costUsd).toBeNull();
    expect(usageTotals('hist_completed_unknown')).toMatchObject({
      costUsd: null,
      promptTokens: null,
      completionTokens: null,
    });
  });

  it('does not backfill spend when the database is reopened (migration/reconcile path)', () => {
    const file = path.join(tmpRoot, 'reopen', 'hive.db');
    closeDb();
    initDb(file, 'B2');
    historicalTerminal('hist_reopen_failed', 'failed', true);
    historicalTerminal('hist_reopen_completed', 'completed', false);
    const before = spendSnapshot();
    closeDb();

    initDb(file, 'B2');
    expect(spendSnapshot()).toEqual(before);
    expect(getRun('hist_reopen_failed')?.costUsd).toBeNull();
    expect(getRun('hist_reopen_completed')?.costUsd).toBeNull();
    expect(getRun('hist_reopen_completed')?.phase).toBe('done');
  });

  it('serves NULL (never 0) for historical spend on list, detail and snapshot routes', async () => {
    historicalTerminal('hist_api_known_usage', 'failed', true);
    historicalTerminal('hist_api_unknown', 'completed', false);
    measuredCompletedRun('run_api_measured');

    const app = await buildApp();
    try {
      const list = await app.inject({ method: 'GET', url: '/api/runs?limit=100', headers: { host: HOST } });
      expect(list.statusCode).toBe(200);
      const listBody = list.json() as { runs: Array<Record<string, unknown>> };
      for (const id of ['hist_api_known_usage', 'hist_api_unknown']) {
        const row = listBody.runs.find((run) => run.id === id);
        expect(row, `run ${id} present in list`).toBeDefined();
        expect(row?.costUsd).toBeNull();
        expect(row?.promptTokens).toBeNull();
        expect(row?.completionTokens).toBeNull();
      }
      const measured = listBody.runs.find((run) => run.id === 'run_api_measured');
      expect(measured?.costUsd as number).toBeCloseTo(0.01, 10);
      expect(measured?.promptTokens).toBe(10);
      expect(measured?.completionTokens).toBe(4);

      for (const id of ['hist_api_known_usage', 'hist_api_unknown']) {
        const detail = await app.inject({ method: 'GET', url: `/api/runs/${id}`, headers: { host: HOST } });
        expect(detail.statusCode).toBe(200);
        const detailBody = detail.json() as { run: { costUsd: number | null; promptTokens: number | null; completionTokens: number | null } };
        expect(detailBody.run.costUsd).toBeNull();
        expect(detailBody.run.promptTokens).toBeNull();
        expect(detailBody.run.completionTokens).toBeNull();

        const snapshot = await app.inject({ method: 'GET', url: `/api/runs/${id}/snapshot`, headers: { host: HOST } });
        expect(snapshot.statusCode).toBe(200);
        const snapshotBody = snapshot.json() as { run: { costUsd: number | null; promptTokens: number | null; completionTokens: number | null } };
        expect(snapshotBody.run.costUsd).toBeNull();
        expect(snapshotBody.run.promptTokens).toBeNull();
        expect(snapshotBody.run.completionTokens).toBeNull();
      }
    } finally {
      await app.close();
    }
  });

  it('does not report a complete total when a terminal run has spend nowhere in the ledger', async () => {
    historicalTerminal('hist_stats_unknown', 'completed', false);
    measuredCompletedRun('run_stats_measured');

    const app = await buildApp();
    try {
      const response = await app.inject({ method: 'GET', url: '/api/stats', headers: { host: HOST } });
      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      expect(body.partial).toBe(true);
      expect(body.totalCostUsd).toBeNull();
      expect(body.totalPromptTokens).toBeNull();
      expect(body.totalCompletionTokens).toBeNull();
      expect(body.measuredCostUsd as number).toBeCloseTo(0.01, 10);
      expect(body.unknownUsageRows).toBe(0);
      expect(body.unknownRunSpendRows).toBe(1);
      expect(body.unknownChatSpendJobs).toBe(0);
    } finally {
      await app.close();
    }
  });

  it('keeps the total complete when the stale NULL run row is backed by measured usage rows', async () => {
    historicalTerminal('hist_stats_known_usage', 'failed', true);
    measuredCompletedRun('run_stats_measured');

    const app = await buildApp();
    try {
      const response = await app.inject({ method: 'GET', url: '/api/stats', headers: { host: HOST } });
      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      expect(body.partial).toBe(false);
      expect(body.totalCostUsd as number).toBeCloseTo(0.017, 10);
      expect(body.totalPromptTokens).toBe(80);
      expect(body.totalCompletionTokens).toBe(34);
      expect(body.unknownRunSpendRows).toBe(0);
      expect(body.unknownChatSpendJobs).toBe(0);
      expect(getRun('hist_stats_known_usage')?.costUsd).toBeNull();
    } finally {
      await app.close();
    }
  });

  it('marks unknown chat spend as partial instead of adding it as zero', async () => {
    measuredCompletedRun('run_stats_measured');
    seedChatJob('cjob_fixture_unknown', 'failed', 1, null);
    seedChatJob('cjob_fixture_retry_queued', 'queued', 1, null);
    seedChatJob('cjob_fixture_never_ran', 'cancelled', 0, null);

    const app = await buildApp();
    try {
      const response = await app.inject({ method: 'GET', url: '/api/stats', headers: { host: HOST } });
      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      expect(body.unknownChatSpendJobs).toBe(2);
      expect(body.unknownRunSpendRows).toBe(0);
      expect(body.partial).toBe(true);
      expect(body.totalCostUsd).toBeNull();
      expect(body.measuredCostUsd as number).toBeCloseTo(0.01, 10);

      // A job cancelled before any attempt has no spend to account for.
      seedChatJob('cjob_fixture_zero_attempts', 'cancelled', 0, null);
      const again = await app.inject({ method: 'GET', url: '/api/stats', headers: { host: HOST } });
      expect((again.json() as Record<string, unknown>).unknownChatSpendJobs).toBe(2);
    } finally {
      await app.close();
    }
  });

  it('keeps a terminal run with no usage rows as unknown spend, even when it never started', async () => {
    createRow('run_stats_cancelled_before_start');
    expect(cancelRun('run_stats_cancelled_before_start')).toBe(true);
    const cancelled = getRun('run_stats_cancelled_before_start');
    expect(cancelled?.status).toBe('cancelled');
    expect(cancelled?.costUsd).toBeNull();
    expect(usageTotals('run_stats_cancelled_before_start')).toMatchObject({
      costUsd: null,
      promptTokens: null,
      completionTokens: null,
    });

    const app = await buildApp();
    try {
      const response = await app.inject({ method: 'GET', url: '/api/stats', headers: { host: HOST } });
      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      expect(body.unknownRunSpendRows).toBe(1);
      expect(body.partial).toBe(true);
      expect(body.totalCostUsd).toBeNull();
      expect(body.measuredCostUsd).toBe(0);
    } finally {
      await app.close();
    }
  });

  it('keeps the historical-NULL query invariant over the terminal-status set', () => {
    historicalTerminal('hist_query_failed', 'failed', true);
    historicalTerminal('hist_query_completed', 'completed', false);
    const rows = getDb()
      .prepare(
        `SELECT id, status FROM runs
         WHERE status IN (${TERMINAL_STATUSES}) AND cost_usd IS NULL AND prompt_tokens IS NULL AND completion_tokens IS NULL
         ORDER BY id`,
      )
      .all() as Array<{ id: string }>;
    expect(rows.map((row) => row.id)).toEqual(['hist_query_completed', 'hist_query_failed']);
    expect(getRun('hist_query_failed')?.finishedAt).toBeTruthy();
  });
});
