/**
 * INDEPENDENT Wave 7 auditor probe — run-status persistence guard and CAS.
 * Uses only throwaway databases: ':memory:' for the matrix, a file DB under
 * audit2 for the concurrent-writer section. The production DB is never opened.
 *
 * Run: node_modules\.bin\tsx.cmd docs\IMPROVE-WAVE-7\audit2\probe-cas.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { closeDb, getDb, initDb } from '../../../src/server/db/database.js';
import { createRunRow, getRun, updateRun } from '../../../src/server/runs/recorder.js';
import {
  RunTransitionError,
  STATUS_TRANSITIONS,
  isTerminalStatus,
  type TransitionKind,
} from '../../../src/server/logic/run-state.js';
import { RUN_STATUSES, type RunStatus } from '../../../src/shared/types.js';

const AUDIT_DIR = path.resolve('docs/IMPROVE-WAVE-7/audit2');
const DB_FILE = path.join(AUDIT_DIR, '.cas-probe.db');
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(DB_FILE + suffix, { force: true });

initDb(':memory:', 'B2');

const results: Array<Record<string, unknown>> = [];
const matrix: Array<Record<string, unknown>> = [];

function makeRun(id: string): void {
  createRunRow({
    id,
    brief: 'wave7 independent audit probe',
    preset: 'full-build',
    model: 'deepseek-flash',
    thinking: 'disabled',
    effort: null,
    workspacePath: `workspace/runs/${id}`,
  });
}

function describe(error: unknown): Record<string, unknown> {
  if (error instanceof RunTransitionError) {
    return { kind: 'RunTransitionError', code: error.code, transitionKind: error.kind, from: error.from, to: error.to, runId: error.runId };
  }
  if (error instanceof Error) return { kind: error.name, message: error.message };
  return { kind: typeof error, message: String(error) };
}

function attempt(name: string, id: string, patch: Parameters<typeof updateRun>[1]): Record<string, unknown> {
  try {
    updateRun(id, patch);
    return { case: name, outcome: 'ok', row: getRun(id) };
  } catch (error) {
    return { case: name, outcome: 'threw', error: describe(error), row: getRun(id) };
  }
}

/** Build a run in `status` through legal edges only. Returns the run id. */
function seed(status: RunStatus, id: string): void {
  makeRun(id);
  switch (status) {
    case 'queued':
      break;
    case 'running':
      updateRun(id, { status: 'running', phase: 'intake' });
      break;
    case 'paused':
      updateRun(id, { status: 'running', phase: 'intake' });
      updateRun(id, { status: 'paused' });
      break;
    case 'needs_review':
      updateRun(id, { status: 'running', phase: 'intake' });
      updateRun(id, { status: 'needs_review' });
      break;
    case 'completed':
    case 'completed_with_warnings':
      updateRun(id, { status: 'running', phase: 'intake' });
      updateRun(id, { status, phase: 'done' });
      break;
    case 'failed':
    case 'cancelled':
    case 'budget_exceeded':
    case 'interrupted':
      updateRun(id, { status, phase: 'done' });
      break;
    default:
      throw new Error(`unhandled seed status ${status}`);
  }
  const row = getRun(id);
  if (row?.status !== status) throw new Error(`seed failed for ${status}: got ${row?.status}`);
}

// ---------------------------------------------------------------------------
// 1. Full status-edge matrix, resetting the row for every pair.
// ---------------------------------------------------------------------------
let pairIndex = 0;
for (const from of RUN_STATUSES) {
  for (const to of RUN_STATUSES) {
    const id = `mx_${pairIndex}`;
    pairIndex += 1;
    seed(from, id);
    const expectedLegal = from === to || STATUS_TRANSITIONS[from].includes(to);
    const patch: Parameters<typeof updateRun>[1] = { status: to };
    if ((to === 'completed' || to === 'completed_with_warnings') && to !== from) patch.phase = 'done';
    let actual: 'ok' | 'threw' | 'other' = 'other';
    let error: Record<string, unknown> | null = null;
    try {
      updateRun(id, patch);
      actual = 'ok';
    } catch (caught) {
      actual = caught instanceof RunTransitionError ? 'threw' : 'other';
      error = describe(caught);
    }
    const row = getRun(id);
    const unchanged = !expectedLegal && row?.status === from;
    const match = expectedLegal ? actual === 'ok' : actual === 'threw' && unchanged;
    matrix.push({ from, to, expectedLegal, actual, match, error, rowStatus: row?.status, rowPhase: row?.phase });
  }
}
const matrixSummary = {
  total: matrix.length,
  mismatches: matrix.filter((m) => !m.match),
  legalPairs: matrix.filter((m) => m.expectedLegal).length,
  illegalPairs: matrix.filter((m) => !m.expectedLegal).length,
};
results.push({ probe: 'status-edge matrix', ...matrixSummary });

// ---------------------------------------------------------------------------
// 2. Terminal immutability, all six terminal statuses.
// ---------------------------------------------------------------------------
for (const terminal of RUN_STATUSES.filter((s) => isTerminalStatus(s))) {
  const id = `term_${terminal}`;
  seed(terminal, id);
  const before = getRun(id);
  for (const other of RUN_STATUSES) {
    if (other === terminal) {
      results.push({ case: `same-status idempotent on ${terminal}`, ...attempt(`same ${terminal}`, id, { status: terminal }) });
      continue;
    }
    const r = attempt(`${terminal}->${other}`, id, {
      status: other,
      ...(other === 'completed' || other === 'completed_with_warnings' ? { phase: 'done' as const } : {}),
    });
    results.push({ case: `terminal ${terminal} must reject ->${other}`, ...r, unchanged: getRun(id)?.status === terminal });
  }
  results.push({ case: `terminal ${terminal} rejects phase change`, ...attempt('phase planning', id, { phase: 'planning' }), unchanged: getRun(id)?.phase === before?.phase });
  results.push({ case: `terminal ${terminal} allows same-phase write`, ...attempt('phase done', id, { phase: 'done' }) });
  results.push({ case: `terminal ${terminal} allows metadata-only write`, ...attempt('summary', id, { summary: 'audit metadata' }) });
}

// ---------------------------------------------------------------------------
// 3. completed / completed_with_warnings must be phase done.
// ---------------------------------------------------------------------------
for (const target of ['completed', 'completed_with_warnings'] as const) {
  for (const [label, extra] of [
    ['no phase (current intake)', {}],
    ['phase intake', { phase: 'intake' as const }],
    ['phase done', { phase: 'done' as const }],
  ] as const) {
    const id = `phase_${target}_${label.replace(/[^a-z]+/gi, '_')}`;
    seed('running', id);
    const r = attempt(`${target} with ${label}`, id, { status: target, ...extra });
    results.push({ case: `phase rule ${target} ${label}`, ...r, expected: label === 'phase done' ? 'ok' : 'threw' });
  }
}
{
  const id = 'phase_nr_completed';
  seed('needs_review', id);
  results.push({ case: 'needs_review->completed phase done (legal)', ...attempt('needs_review completed', id, { status: 'completed', phase: 'done' }) });
}

// ---------------------------------------------------------------------------
// 4. Same-status idempotency for every non-terminal status.
// ---------------------------------------------------------------------------
for (const status of RUN_STATUSES.filter((s) => !isTerminalStatus(s))) {
  const id = `idem_${status}`;
  seed(status, id);
  results.push({ case: `non-terminal same-status ${status}`, ...attempt('same status', id, { status }) });
}

// ---------------------------------------------------------------------------
// 5. Phase-only observations (matrix deliberately unwired).
// ---------------------------------------------------------------------------
{
  const id = 'phaseonly_running';
  seed('running', id);
  results.push({ case: 'phase-only running->planning (allowed by design, no phase graph)', ...attempt('planning', id, { phase: 'planning' }) });
}
{
  const id = 'phaseonly_running_done';
  seed('running', id);
  results.push({ case: 'phase-only running->done (observed; not claimed to be blocked)', ...attempt('done', id, { phase: 'done' }) });
}
{
  const id = 'phaseonly_terminal';
  seed('completed', id);
  results.push({ case: 'phase-only completed->planning (must throw)', ...attempt('planning', id, { phase: 'planning' }) });
  results.push({ case: 'phase-only completed->done (idempotent)', ...attempt('done', id, { phase: 'done' }) });
}

// ---------------------------------------------------------------------------
// 6. Invalid status and missing run.
// ---------------------------------------------------------------------------
{
  const id = 'invalid_status';
  seed('queued', id);
  results.push({ case: 'invalid status string', ...attempt('invalid', id, { status: 'bogus' as never }), unchanged: getRun(id)?.status === 'queued' });
}
{
  results.push({ case: 'status write for missing run', ...attempt('missing', 'run_missing_probe', { status: 'running' }) });
}

// ---------------------------------------------------------------------------
// 7. Concurrent writer between the read and the guarded UPDATE (CAS).
// ---------------------------------------------------------------------------
closeDb();
initDb(DB_FILE, 'B2');
const db = getDb();
const competitor = new DatabaseSync(DB_FILE);
competitor.exec('PRAGMA busy_timeout=5000;');

type AnyStmt = { get?: (...args: unknown[]) => unknown; run?: (...args: unknown[]) => unknown };
const target = db as unknown as { prepare: (sql: string) => AnyStmt };
const originalPrepare = target.prepare.bind(db);
let armed = false;
let injected = false;
let competedStatus: RunStatus = 'failed';
let didPatch = false;
try {
  target.prepare = ((sql: string) => {
    const statement = originalPrepare(sql);
    if (armed && !injected && sql.startsWith('SELECT status, phase FROM runs')) {
      const realGet = statement.get!.bind(statement);
      statement.get = (...args: unknown[]) => {
        const stale = realGet(...args);
        if (armed && !injected) {
          injected = true;
          const change = competitor
            .prepare("UPDATE runs SET status = ?, phase = 'done', finished_at = '2026-11-04T00:00:00.000Z' WHERE id = ? AND status = 'running'")
            .run(competedStatus, args[0] as string);
          (globalThis as Record<string, unknown>).__lastCompetitorChanges = Number(change.changes);
        }
        return stale;
      };
    }
    return statement;
  }) as never;
  didPatch = (db as unknown as { prepare: unknown }).prepare !== originalPrepare;
} catch (error) {
  results.push({ case: 'CAS instrumentation', outcome: 'patch failed', error: describe(error) });
}

async function raceCase(name: string, targetStatus: RunStatus | 'phase-only', competitorStatus: RunStatus): Promise<void> {
  const id = `race_${results.length}`;
  seed('running', id);
  armed = true;
  injected = false;
  competedStatus = competitorStatus;
  (globalThis as Record<string, unknown>).__lastCompetitorChanges = 0;
  try {
    updateRun(id, targetStatus === 'phase-only' ? { phase: 'planning' } : { status: targetStatus });
    results.push({ case: name, outcome: 'NO-THROW (CAS failed open)', row: getRun(id), injected });
  } catch (error) {
    const d = describe(error);
    results.push({
      case: name,
      outcome: 'threw (CAS failed closed)',
      error: d,
      injected,
      competitorChanges: (globalThis as Record<string, unknown>).__lastCompetitorChanges,
      row: getRun(id),
      preservedCompetitorStatus: getRun(id)?.status === competitorStatus,
      codeMatches: d.code === 'E_ILLEGAL_RUN_TRANSITION',
    });
  } finally {
    armed = false;
  }
}

if (didPatch) {
  await raceCase('CAS: running->paused vs concurrent running->failed', 'paused', 'failed');
  await raceCase('CAS: same-status running write vs concurrent running->completed', 'running', 'completed');
  await raceCase('CAS: phase-only running write vs concurrent running->failed', 'phase-only', 'failed');
  {
    const id = 'race_control';
    seed('running', id);
    armed = false;
    injected = false;
    results.push({ case: 'CAS control: running->paused with no competitor', ...attempt('control paused', id, { status: 'paused' }), injected });
  }
} else {
  results.push({ case: 'CAS races', outcome: 'SKIPPED — database prepare override did not take effect' });
}

competitor.close();
closeDb();
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(DB_FILE + suffix, { force: true });

console.log(JSON.stringify({ probe: 'independent run-status guard + CAS', results, matrixSummary, matrixMismatches: matrixSummary.mismatches, matrix }, null, 2));
