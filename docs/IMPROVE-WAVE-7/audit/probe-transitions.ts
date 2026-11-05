/**
 * Wave 7 adversarial probe: updateRun status guard + CAS.
 * Uses a throwaway file DB under the audit directory (never the product DB).
 * Run: node_modules\.bin\tsx.cmd docs\IMPROVE-WAVE-7\audit\probe-transitions.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { closeDb, getDb, initDb } from '../../../src/server/db/database.js';
import { createRunRow, getRun, updateRun } from '../../../src/server/runs/recorder.js';
import { cancelRun, markRunning, markTerminal } from '../../../src/server/runs/manager.js';
import { RunTransitionError } from '../../../src/server/logic/run-state.js';

const AUDIT_DIR = path.resolve('docs/IMPROVE-WAVE-7/audit');
const DB_FILE = path.join(AUDIT_DIR, '.probe-race.db');
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(DB_FILE + suffix, { force: true });

initDb(DB_FILE, 'B2');

const results: Array<Record<string, unknown>> = [];
const known: Array<Record<string, unknown>> = [];

function describeError(error: unknown): Record<string, unknown> {
  if (error instanceof RunTransitionError) {
    return { kind: 'RunTransitionError', code: error.code, from: error.from, to: error.to, runId: error.runId, message: error.message };
  }
  if (error instanceof Error) return { kind: error.name, message: error.message };
  return { kind: typeof error, message: String(error) };
}

function caseRun(id: string): void {
  createRunRow({
    id,
    brief: 'wave-7 transition probe',
    preset: 'full-build',
    model: 'deepseek-flash',
    thinking: 'disabled',
    effort: null,
    workspacePath: `workspace/runs/${id}`,
  });
}

function expectThrow(name: string, id: string, patch: Parameters<typeof updateRun>[1], expectCode = 'E_ILLEGAL_RUN_TRANSITION'): void {
  try {
    updateRun(id, patch);
    results.push({ case: name, outcome: 'NO-THROW (unexpected)', row: getRun(id) });
  } catch (error) {
    const d = describeError(error);
    results.push({ case: name, outcome: 'threw', error: d, row: getRun(id), codeMatches: d.code === expectCode });
  }
}

function expectOk(name: string, id: string, patch: Parameters<typeof updateRun>[1]): void {
  try {
    updateRun(id, patch);
    results.push({ case: name, outcome: 'ok', row: getRun(id) });
  } catch (error) {
    results.push({ case: name, outcome: 'THREW (unexpected)', error: describeError(error), row: getRun(id) });
  }
}

// ---- LEGAL lifecycle writes -------------------------------------------------
caseRun('p_legal');
expectOk('queued->running', 'p_legal', { status: 'running', phase: 'intake' });
expectOk('same-status running (status only, no other change)', 'p_legal', { status: 'running' });
expectOk('same-status running with phase change', 'p_legal', { status: 'running', phase: 'planning' });
expectOk('running->paused', 'p_legal', { status: 'paused' });
expectOk('paused->running (resume)', 'p_legal', { status: 'running' });
expectOk('running->needs_review', 'p_legal', { status: 'needs_review' });
expectOk('needs_review->running', 'p_legal', { status: 'running' });
expectOk('running->completed with phase done', 'p_legal', { status: 'completed', phase: 'done' });
expectOk('terminal same-status idempotent write', 'p_legal', { status: 'completed' });

caseRun('p_cancel');
expectOk('queued->cancelled (no-controller cancel path)', 'p_cancel', { status: 'cancelled', phase: 'done', finished_at: new Date().toISOString() });

caseRun('p_fail');
expectOk('queued->failed (executor rejection path)', 'p_fail', { status: 'failed', phase: 'done' });

// ---- Production helpers, not just raw updateRun -----------------------------
caseRun('p_helpers');
try {
  markRunning('p_helpers');
  markTerminal('p_helpers', 'completed', 'done');
  results.push({ case: 'production markRunning + markTerminal(completed)', outcome: 'ok', row: getRun('p_helpers') });
} catch (error) {
  results.push({ case: 'production markRunning + markTerminal(completed)', outcome: 'THREW (regression)', error: describeError(error), row: getRun('p_helpers') });
}

caseRun('p_cancel_helper');
try {
  const cancelled = cancelRun('p_cancel_helper');
  results.push({ case: 'production cancelRun on a queued run (no controller)', outcome: 'ok', returned: cancelled, row: getRun('p_cancel_helper') });
} catch (error) {
  results.push({ case: 'production cancelRun on a queued run (no controller)', outcome: 'THREW (regression)', error: describeError(error), row: getRun('p_cancel_helper') });
}

// ---- ILLEGAL transitions ----------------------------------------------------
caseRun('p_terminal');
expectOk('setup running', 'p_terminal', { status: 'running' });
expectOk('setup completed', 'p_terminal', { status: 'completed', phase: 'done' });
expectThrow('completed->running', 'p_terminal', { status: 'running' });
expectThrow('completed->failed', 'p_terminal', { status: 'failed' });
expectThrow('completed->budget_exceeded', 'p_terminal', { status: 'budget_exceeded' });
results.push({ case: 'completed row unchanged after rejected writes', row: getRun('p_terminal') });

caseRun('p_skip');
expectThrow('queued->completed (skips in-progress)', 'p_skip', { status: 'completed' });
results.push({ case: 'queued row unchanged after rejected write', row: getRun('p_skip') });

caseRun('p_failed_terminal');
expectOk('setup failed terminal', 'p_failed_terminal', { status: 'running' });
expectOk('setup failed terminal 2', 'p_failed_terminal', { status: 'failed', phase: 'done' });
expectThrow('failed->running', 'p_failed_terminal', { status: 'running' });

// ---- Phase invariants added to updateRun after the REPORT snapshot ----------
caseRun('p_phase_scope');
expectOk('setup running for phase-only probe', 'p_phase_scope', { status: 'running' });
expectOk('setup completed for phase-only probe', 'p_phase_scope', { status: 'completed', phase: 'done' });
expectThrow('terminal run phase-only write is rejected', 'p_phase_scope', { phase: 'planning' });
expectOk('terminal run same-phase write stays allowed', 'p_phase_scope', { phase: 'done' });
results.push({ case: 'terminal row unchanged after rejected phase write', row: getRun('p_phase_scope') });

caseRun('p_completed_no_done');
expectOk('setup running (phase intake)', 'p_completed_no_done', { status: 'running' });
expectThrow('running->completed without phase done is rejected', 'p_completed_no_done', { status: 'completed' });
results.push({ case: 'running row unchanged after rejected completed-without-done', row: getRun('p_completed_no_done') });

// ---- Invalid input ----------------------------------------------------------
caseRun('p_bad_status');
expectThrow('invalid status string', 'p_bad_status', { status: 'bogus' as never }, 'ZodError');

// ---- Nonexistent run --------------------------------------------------------
try {
  updateRun('run_does_not_exist', { status: 'running' });
  results.push({ case: 'status write for missing run', outcome: 'silent no-op (0 changes, no throw)', row: getRun('run_does_not_exist') });
} catch (error) {
  results.push({ case: 'status write for missing run', outcome: 'threw', error: describeError(error) });
}

// ---- CAS: concurrent status change between read and guarded UPDATE ----------
const db = getDb();
const competitor = new DatabaseSync(DB_FILE);
const target = db as unknown as { prepare: (sql: string) => { get?: (...args: unknown[]) => unknown; run?: (...args: unknown[]) => unknown } };
const originalPrepare = target.prepare.bind(db);
let armed = false;
let injected = false;
let competedStatus: 'failed' | 'completed' = 'failed';
let didPatchPrepare = false;

try {
  target.prepare = ((sql: string) => {
    const statement = originalPrepare(sql) as { get?: (...args: unknown[]) => unknown };
    if (armed && !injected && sql.startsWith('SELECT status')) {
      const originalGet = statement.get!.bind(statement);
      statement.get = (...args: unknown[]) => {
        const row = originalGet(...args);
        if (!injected) {
          injected = true;
          competitor
            .prepare(`UPDATE runs SET status = '${competedStatus}', phase = 'done' WHERE id = ? AND status = 'running'`)
            .run(args[0] as string);
        }
        return row;
      };
    }
    return statement;
  }) as never;
  didPatchPrepare = (db as unknown as { prepare: unknown }).prepare !== originalPrepare;
} catch (error) {
  results.push({ case: 'patch db.prepare for CAS injection', outcome: 'FAILED', error: describeError(error) });
}

async function raceCase(
  name: string,
  id: string,
  patch: Parameters<typeof updateRun>[1],
  competitorStatus: 'failed' | 'completed',
  expectedStatus: string,
): Promise<void> {
  caseRun(id);
  updateRun(id, { status: 'running', phase: 'intake' });
  armed = true;
  injected = false;
  competedStatus = competitorStatus;
  try {
    updateRun(id, patch);
    results.push({ case: name, outcome: 'NO-THROW (CAS failed open)', row: getRun(id) });
  } catch (error) {
    const d = describeError(error);
    results.push({
      case: name,
      outcome: 'threw (fail-closed)',
      error: d,
      row: getRun(id),
      preservedExpectedStatus: getRun(id)?.status === expectedStatus,
      codeMatches: d.code === 'E_ILLEGAL_RUN_TRANSITION',
    });
  } finally {
    armed = false;
    competedStatus = 'failed';
  }
}

if (didPatchPrepare) {
  await raceCase('CAS race: concurrent running->failed rejects a paused write', 'p_race_paused', { status: 'paused' }, 'failed', 'failed');
  await raceCase('CAS race: concurrent running->completed rejects an idempotent running write', 'p_race_same', { status: 'running' }, 'completed', 'completed');
  await raceCase('CAS race: concurrent running->failed rejects a phase-only write', 'p_race_phase', { phase: 'planning' }, 'failed', 'failed');
  // Control: without a competing write the same legal transition still succeeds.
  caseRun('p_control');
  updateRun('p_control', { status: 'running', phase: 'intake' });
  armed = false;
  injected = false;
  expectOk('CAS control: running->paused with no competitor', 'p_control', { status: 'paused' });
} else {
  results.push({ case: 'CAS race', outcome: 'SKIPPED - db.prepare patch did not take effect' });
}

competitor.close();
closeDb();
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(DB_FILE + suffix, { force: true });

console.log(JSON.stringify({ probe: 'updateRun transitions + CAS', results, known }, null, 2));
