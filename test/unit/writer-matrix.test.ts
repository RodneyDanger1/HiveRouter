import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../src/server/config.js';
import { closeDb, getDb, initDb } from '../../src/server/db/database.js';
import {
  PHASE_TRANSITIONS,
  STATUS_TRANSITIONS,
  isTerminalStatus,
} from '../../src/server/logic/run-state.js';
import {
  cancelRun,
  createRun,
  markStartupInterrupted,
  markTerminal,
  runWorkspace,
  setExecutor,
} from '../../src/server/runs/manager.js';
import { createRunRow, getRun, updateRun } from '../../src/server/runs/recorder.js';
import { executeRun, persistStagedArtifacts } from '../../src/server/pipeline/run.js';
import type { RunPhase, RunStatus } from '../../src/shared/types.js';

/**
 * P0-1 production-writer matrix.
 *
 * Every status/phase write the server can persist is captured by a SQLite
 * trigger on `runs` and checked against STATUS_TRANSITIONS / PHASE_TRANSITIONS.
 * The trigger also sees the one raw `UPDATE runs` writer (startup interrupt), so
 * a writer cannot bypass this audit by using hand-rolled SQL.
 *
 * Test double: `pipeline/agent-runner` is replaced with a scripted queue, which
 * is the provider boundary (no network, no paid call). Everything below that
 * boundary - pipeline phases, recorder guard, manager terminal writers, SQLite -
 * is the real production code.
 */

const agent = vi.hoisted(() => ({
  queue: [] as Array<() => unknown>,
}));

vi.mock('../../src/server/pipeline/agent-runner', () => {
  const usage = () => ({
    promptTokens: 10,
    completionTokens: 5,
    cacheHitTokens: 0,
    cacheMissTokens: 10,
    reasoningTokens: 0,
    costUsd: 0.001,
    source: 'provider',
    model: 'deepseek-flash',
  });
  const next = (): (() => unknown) => {
    const factory = agent.queue.shift();
    if (!factory) throw new Error('E_TEST_UNEXPECTED_AGENT_CALL');
    return factory;
  };
  return {
    callAgentJson: async (
      _agentId: unknown,
      _snapshot: unknown,
      _prompt: unknown,
      _schema: unknown,
      options?: { onUsage?: (record: unknown) => void },
    ) => {
      const data = next()();
      const record = usage();
      options?.onUsage?.(record);
      return { data, usage: record, content: JSON.stringify(data) };
    },
    callAgentText: async (
      _agentId: unknown,
      _snapshot: unknown,
      _prompt: unknown,
      options?: { onUsage?: (record: unknown) => void },
    ) => {
      const text = next()();
      const record = usage();
      options?.onUsage?.(record);
      return { text: String(text), usage: record };
    },
  };
});

const FILE = 'src/app.ts';

interface TransitionRow {
  seq: number;
  run_id: string;
  old_status: RunStatus;
  new_status: RunStatus;
  old_phase: RunPhase;
  new_phase: RunPhase;
}

const originalDirs = {
  dataDir: config.dataDir,
  workspaceDir: config.workspaceDir,
  vaultDir: config.vaultDir,
};
let tmpRoot = '';

function installTransitionTrigger(): void {
  const db = getDb();
  db.exec(`CREATE TABLE IF NOT EXISTS transition_log (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL,
    old_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    old_phase TEXT NOT NULL,
    new_phase TEXT NOT NULL
  )`);
  db.exec(`CREATE TRIGGER IF NOT EXISTS capture_run_transition
    AFTER UPDATE OF status, phase ON runs
    BEGIN
      INSERT INTO transition_log (run_id, old_status, new_status, old_phase, new_phase)
      VALUES (OLD.id, OLD.status, NEW.status, OLD.phase, NEW.phase);
    END`);
}

function transitions(): TransitionRow[] {
  return getDb().prepare('SELECT * FROM transition_log ORDER BY seq ASC').all() as unknown as TransitionRow[];
}

function clearTransitions(): void {
  getDb().prepare('DELETE FROM transition_log').run();
}

/** Every captured persisted edge must be legal; a terminal write must close at phase done. */
function expectCapturedEdgesLegal(rows: TransitionRow[] = transitions()): void {
  for (const row of rows) {
    if (row.old_status !== row.new_status) {
      expect(
        STATUS_TRANSITIONS[row.old_status].includes(row.new_status),
        `${row.run_id} illegal status edge ${row.old_status} -> ${row.new_status}`,
      ).toBe(true);
    }
    if (row.old_phase !== row.new_phase) {
      if (isTerminalStatus(row.new_status)) {
        expect(
          row.new_phase,
          `${row.run_id} terminal status ${row.new_status} was persisted beside live phase ${row.new_phase}`,
        ).toBe('done');
      } else {
        expect(
          PHASE_TRANSITIONS[row.old_phase].includes(row.new_phase),
          `${row.run_id} illegal phase edge ${row.old_phase} -> ${row.new_phase}`,
        ).toBe(true);
      }
    }
  }
}

function changedPhases(runId: string): RunPhase[] {
  return transitions()
    .filter((row) => row.run_id === runId && row.old_phase !== row.new_phase)
    .map((row) => row.new_phase);
}

async function waitForTerminal(runId: string): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const run = getRun(runId);
    if (run && isTerminalStatus(run.status)) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`run ${runId} did not settle: ${JSON.stringify(getRun(runId))}`);
}

let keySeq = 0;
function nextKey(label: string): string {
  keySeq += 1;
  return `writer-matrix-${label}-${keySeq}-0001`;
}

async function drive(input: {
  preset: Parameters<typeof createRun>[0]['preset'];
  brief?: string;
  runKind?: Parameters<typeof createRun>[0]['runKind'];
  parentRunId?: string | null;
  metadata?: Record<string, unknown>;
  label: string;
}): Promise<string> {
  const created = await createRun({
    brief: input.brief ?? 'writer matrix run',
    preset: input.preset,
    model: 'deepseek-flash',
    thinking: 'disabled',
    effort: null,
    idempotencyKey: nextKey(input.label),
    parentRunId: input.parentRunId ?? null,
    runKind: input.runKind,
    metadata: input.metadata,
  });
  await waitForTerminal(created.runId);
  return created.runId;
}

function planResponse(files: string[]): () => unknown {
  return () => ({
    projectName: 'writer-matrix-project',
    coreParadigm: 'filesystem',
    storageTarget: 'filesystem',
    files: files.map((file) => ({
      path: file,
      engine: 'ts-engine',
      language: 'typescript',
      duty: 'implementation',
      deps: [],
      interfaces: [],
    })),
    interfaces: [],
    executionGraph: [],
    risks: [],
  });
}

function emissionResponse(file: string): () => unknown {
  return () => ({
    path: file,
    language: 'typescript',
    content: 'export const answer = 42;\n',
    summary: '',
    execution: '',
    complete: true,
  });
}

function reviewResponse(files: string[]): () => unknown {
  return () => ({ verdict: 'pass', summary: '', findings: [], files: [], reviewedFiles: [...files] });
}

function testsResponse(): () => unknown {
  return () => ({ summary: '', testCommand: 'echo matrix', files: [] });
}

function seedRun(runId: string, status: RunStatus, phase: RunPhase): void {
  createRunRow({
    id: runId,
    brief: 'writer matrix fixture',
    preset: 'docs',
    model: 'deepseek-flash',
    thinking: 'disabled',
    effort: null,
    workspacePath: path.join(config.workspaceDir, 'runs', runId),
  });
  getDb().prepare('UPDATE runs SET status = ?, phase = ?, started_at = ? WHERE id = ?').run(status, phase, new Date().toISOString(), runId);
}

beforeAll(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-writer-matrix-'));
  (config as unknown as { dataDir: string }).dataDir = path.join(tmpRoot, 'data');
  (config as unknown as { workspaceDir: string }).workspaceDir = path.join(tmpRoot, 'workspace');
  (config as unknown as { vaultDir: string }).vaultDir = path.join(tmpRoot, 'vault');
});

afterAll(() => {
  (config as unknown as { dataDir: string }).dataDir = originalDirs.dataDir;
  (config as unknown as { workspaceDir: string }).workspaceDir = originalDirs.workspaceDir;
  (config as unknown as { vaultDir: string }).vaultDir = originalDirs.vaultDir;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

beforeEach(() => {
  closeDb();
  agent.queue = [];
  initDb(':memory:', 'B2');
  installTransitionTrigger();
  setExecutor(executeRun);
});

afterEach(() => {
  setExecutor(executeRun);
  closeDb();
});

describe('P0-1 production status/phase writers', () => {
  it('persists only legal edges across a full-build run and closes at completed/done', async () => {
    agent.queue = [planResponse([FILE]), emissionResponse(FILE), reviewResponse([FILE]), reviewResponse([FILE]), testsResponse()];
    const runId = await drive({ preset: 'full-build', label: 'full-build' });

    const run = getRun(runId);
    expect(run?.status).toBe('completed');
    expect(run?.phase).toBe('done');
    expect(agent.queue).toHaveLength(0);
    expect(changedPhases(runId)).toEqual([
      'planning',
      'routing',
      'generating',
      'cleaning',
      'hardening',
      'testing',
      'verifying',
      'finalizing',
      'done',
    ]);
    expectCapturedEdgesLegal();
  });

  it('persists only legal edges for blueprint, docs, ui-build, revise, audit, adhoc and resume', async () => {
    const cases: Array<{ label: string; runId: string; phases: RunPhase[] }> = [];

    agent.queue = [planResponse([FILE])];
    const blueprint = await drive({ preset: 'blueprint', label: 'blueprint' });
    cases.push({ label: 'blueprint', runId: blueprint, phases: changedPhases(blueprint) });

    agent.queue = [planResponse([FILE]), emissionResponse(FILE)];
    const docs = await drive({ preset: 'docs', label: 'docs' });
    cases.push({ label: 'docs', runId: docs, phases: changedPhases(docs) });

    agent.queue = [planResponse([FILE]), emissionResponse(FILE), reviewResponse([FILE]), reviewResponse([FILE]), testsResponse()];
    const ui = await drive({ preset: 'ui-build', label: 'ui-build' });
    cases.push({ label: 'ui-build', runId: ui, phases: changedPhases(ui) });

    agent.queue = [reviewResponse([FILE]), reviewResponse([FILE])];
    const revise = await drive({
      preset: 'revise',
      runKind: 'revision',
      parentRunId: docs,
      brief: 'revise the published file',
      label: 'revise',
    });
    cases.push({ label: 'revise', runId: revise, phases: changedPhases(revise) });

    agent.queue = [reviewResponse([FILE]), reviewResponse([FILE]), testsResponse()];
    const audit = await drive({
      preset: 'audit',
      runKind: 'audit',
      parentRunId: docs,
      brief: 'audit the published file',
      label: 'audit',
    });
    cases.push({ label: 'audit', runId: audit, phases: changedPhases(audit) });

    agent.queue = [() => 'matrix adhoc text'];
    const adhoc = await drive({
      preset: 'adhoc',
      runKind: 'adhoc',
      metadata: { agentId: 'metacognitive', input: 'say matrix', targetPath: null },
      brief: 'adhoc matrix run',
      label: 'adhoc',
    });
    cases.push({ label: 'adhoc', runId: adhoc, phases: changedPhases(adhoc) });

    // Resume re-verifies a retained staged tree without a provider call.
    setExecutor(async ({ runId }) => {
      const staging = path.join(runWorkspace(runId), '.staging', 'attempt-1', 'src');
      fs.mkdirSync(staging, { recursive: true });
      fs.writeFileSync(path.join(staging, 'app.ts'), 'export const answer = 42;\n', 'utf8');
      throw new Error('E_TEST_GENERATION_FAILED');
    });
    const parent = await drive({ preset: 'docs', label: 'resume-parent', brief: 'resume parent' });
    expect(getRun(parent)?.status).toBe('failed');
    expect(persistStagedArtifacts(parent)).toBe(1);
    setExecutor(executeRun);
    agent.queue = [];
    const resumed = await drive({
      preset: 'docs',
      runKind: 'resume',
      parentRunId: parent,
      brief: 'resume child',
      label: 'resume-child',
    });
    cases.push({ label: 'resume', runId: resumed, phases: changedPhases(resumed) });

    expect(cases).toEqual([
      { label: 'blueprint', runId: blueprint, phases: ['planning', 'finalizing', 'done'] },
      { label: 'docs', runId: docs, phases: ['planning', 'routing', 'generating', 'verifying', 'finalizing', 'done'] },
      {
        label: 'ui-build',
        runId: ui,
        phases: ['planning', 'routing', 'generating', 'cleaning', 'hardening', 'testing', 'verifying', 'finalizing', 'done'],
      },
      { label: 'revise', runId: revise, phases: ['cleaning', 'hardening', 'verifying', 'finalizing', 'done'] },
      { label: 'audit', runId: audit, phases: ['cleaning', 'hardening', 'testing', 'verifying', 'finalizing', 'done'] },
      { label: 'adhoc', runId: adhoc, phases: ['generating', 'verifying', 'finalizing', 'done'] },
      { label: 'resume', runId: resumed, phases: ['generating', 'verifying', 'finalizing', 'done'] },
    ]);

    for (const entry of cases) {
      const run = getRun(entry.runId);
      expect(run?.status, `${entry.label} terminal status`).toBe('completed');
      expect(run?.phase, `${entry.label} terminal phase`).toBe('done');
    }
    expectCapturedEdgesLegal();
  });

  it('records failed/cancelled/budget/interrupted only as legal terminal edges', async () => {
    // Pipeline catch: revise without a parent refuses by name before any call.
    agent.queue = [];
    const failed = await drive({ preset: 'revise', brief: 'revise without a parent', label: 'pipeline-catch' });
    expect(getRun(failed)?.status).toBe('failed');
    expect(getRun(failed)?.errorCode).toBe('E_INVALID_PARENT');

    // Manager executor catch.
    setExecutor(() => Promise.reject(new Error('E_PROVIDER_EMPTY')));
    const managerFailed = await drive({ preset: 'docs', label: 'manager-catch' });
    expect(getRun(managerFailed)?.status).toBe('failed');
    setExecutor(executeRun);

    // No-controller cancel (paused run) and budget terminal.
    seedRun('run_matrix_cancel', 'paused', 'generating');
    clearTransitions();
    expect(cancelRun('run_matrix_cancel')).toBe(true);
    expect(getRun('run_matrix_cancel')?.status).toBe('cancelled');

    seedRun('run_matrix_budget', 'running', 'generating');
    clearTransitions();
    markTerminal('run_matrix_budget', 'budget_exceeded', 'done', {
      code: 'E_BUDGET_EXCEEDED',
      message: 'The run exceeded its configured budget.',
    });
    expect(getRun('run_matrix_budget')?.status).toBe('budget_exceeded');

    // Startup interrupt is a raw SQL writer; its WHERE guard must keep every
    // edge legal and must never downgrade a terminal row.
    for (const [index, status] of (['queued', 'running', 'paused', 'needs_review'] as const).entries()) {
      seedRun(`run_matrix_interrupt_${index}`, status, 'generating');
    }
    seedRun('run_matrix_interrupt_terminal', 'completed', 'done');
    clearTransitions();
    expect(markStartupInterrupted()).toBe(4);
    expect(getRun('run_matrix_interrupt_terminal')?.status).toBe('completed');

    expectCapturedEdgesLegal(transitions().filter((row) => !row.run_id.startsWith('run_matrix_interrupt_')));
    const interruptRows = transitions().filter((row) => row.run_id.startsWith('run_matrix_interrupt_'));
    expect(interruptRows).toHaveLength(4);
    for (const row of interruptRows) {
      expect(row.new_status).toBe('interrupted');
      expect(row.new_phase).toBe('done');
    }
    expectCapturedEdgesLegal(interruptRows);

    for (const id of ['run_matrix_cancel', 'run_matrix_budget', ...interruptRows.map((row) => row.run_id)]) {
      expect(getRun(id)?.phase, `${id} terminal phase`).toBe('done');
    }
  });

  it('refuses every status edge outside STATUS_TRANSITIONS by name and leaves the row unchanged', () => {
    for (const from of Object.keys(STATUS_TRANSITIONS) as RunStatus[]) {
      for (const to of Object.keys(STATUS_TRANSITIONS) as RunStatus[]) {
        const runId = `run_status_${from}_${to}`;
        createRunRow({
          id: runId,
          brief: 'status matrix walk',
          preset: 'docs',
          model: 'deepseek-flash',
          thinking: 'disabled',
          effort: null,
          workspacePath: path.join(config.workspaceDir, 'runs', runId),
        });
        getDb()
          .prepare('UPDATE runs SET status = ?, phase = ? WHERE id = ?')
          .run(from, isTerminalStatus(from) ? 'done' : 'intake', runId);
        const legal = from === to || STATUS_TRANSITIONS[from].includes(to);
        const patch = from !== to && isTerminalStatus(to)
          ? { status: to, phase: 'done' as RunPhase }
          : { status: to };
        if (legal) {
          expect(() => updateRun(runId, patch), `${from} -> ${to} should be legal`).not.toThrow();
          expect(getRun(runId)?.status).toBe(to);
          if (from !== to && isTerminalStatus(to)) {
            expect(getRun(runId)?.phase, `${from} -> ${to} closes at done`).toBe('done');
          }
        } else {
          expect(() => updateRun(runId, patch), `${from} -> ${to} should be refused`).toThrow(
            /E_ILLEGAL_RUN_TRANSITION/,
          );
          expect(getRun(runId)?.status).toBe(from);
        }
      }
    }
  });

  it('refuses every phase edge outside PHASE_TRANSITIONS while non-terminal', () => {
    for (const from of Object.keys(PHASE_TRANSITIONS) as RunPhase[]) {
      for (const to of Object.keys(PHASE_TRANSITIONS) as RunPhase[]) {
        const runId = `run_phase_${from}_${to}`;
        seedRun(runId, 'running', from);
        const legal = from === to || PHASE_TRANSITIONS[from].includes(to);
        if (legal) {
          expect(() => updateRun(runId, { phase: to }), `${from} -> ${to} should be legal`).not.toThrow();
          expect(getRun(runId)?.phase).toBe(to);
        } else {
          expect(() => updateRun(runId, { phase: to }), `${from} -> ${to} should be refused`).toThrow(
            /E_ILLEGAL_RUN_TRANSITION/,
          );
          expect(getRun(runId)?.phase).toBe(from);
        }
      }
    }
  });

  it('refuses a terminal status that is not closed at the terminal phase', () => {
    seedRun('run_terminal_phase_gap', 'running', 'generating');
    expect(() => updateRun('run_terminal_phase_gap', { status: 'failed' })).toThrow(
      /E_ILLEGAL_RUN_TRANSITION/,
    );
    expect(getRun('run_terminal_phase_gap')?.status).toBe('running');
    expect(getRun('run_terminal_phase_gap')?.phase).toBe('generating');

    expect(() =>
      updateRun('run_terminal_phase_gap', { status: 'cancelled', phase: 'cleaning' }),
    ).toThrow(/E_ILLEGAL_RUN_TRANSITION/);
    expect(getRun('run_terminal_phase_gap')?.status).toBe('running');

    for (const status of ['failed', 'cancelled', 'budget_exceeded', 'interrupted'] as const) {
      seedRun(`run_terminal_phase_${status}`, 'running', 'generating');
      updateRun(`run_terminal_phase_${status}`, { status, phase: 'done' });
      const run = getRun(`run_terminal_phase_${status}`);
      expect(run?.status).toBe(status);
      expect(run?.phase).toBe('done');
    }
  });

  it('has no run status/phase writer outside the audited inventory', () => {
    const root = path.join(process.cwd(), 'src', 'server');
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile() && entry.name.endsWith('.ts')) files.push(full);
      }
    };
    walk(root);
    const inventory = new Map([
      ['src/server/db/database.ts', 'trace_complete reconcile only; no status/phase write'],
      ['src/server/pipeline/run.ts', 'pipeline phase writers + terminal catch'],
      ['src/server/runs/manager.ts', 'markRunning / markTerminal / cancelRun / markStartupInterrupted'],
      ['src/server/runs/recorder.ts', 'createRunRow insert + updateRun guard'],
      ['src/server/runs/snapshot.ts', 'snapshot_hash/policy_version_id only; no status/phase write'],
    ]);
    const literalWriters = files.filter((file) => {
      const source = fs.readFileSync(file, 'utf8');
      return /updateRun\(|UPDATE runs\b|INSERT INTO runs\b/.test(source);
    });
    const relative = literalWriters
      .map((file) => path.relative(process.cwd(), file).split(path.sep).join('/'))
      .sort();
    expect(relative).toEqual([...inventory.keys()].sort());
    for (const file of relative) {
      expect(inventory.has(file), `${file} writes run state but is not in the audited writer inventory`).toBe(true);
    }
  });
});
