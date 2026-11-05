import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initDb } from '../../src/server/db/database.js';
import { createRunRow, getRun, updateRun } from '../../src/server/runs/recorder.js';

beforeEach(() => {
  initDb(':memory:', 'B2');
});

afterEach(() => closeDb());

function makeRun(id: string): void {
  createRunRow({
    id,
    brief: 'transition probe',
    preset: 'full-build',
    model: 'deepseek-flash',
    thinking: 'disabled',
    effort: null,
    workspacePath: `workspace/runs/${id}`,
  });
}

describe('run status persistence guard', () => {
  it('allows queued -> running and same-status updates', () => {
    makeRun('run_transition_ok');
    updateRun('run_transition_ok', { status: 'running', phase: 'intake' });
    expect(getRun('run_transition_ok')?.status).toBe('running');
    updateRun('run_transition_ok', { status: 'running', phase: 'planning' });
    expect(getRun('run_transition_ok')?.status).toBe('running');
  });

  it('rejects a terminal run moving to running without changing the row', () => {
    makeRun('run_transition_terminal');
    updateRun('run_transition_terminal', { status: 'running' });
    updateRun('run_transition_terminal', { status: 'completed', phase: 'done' });
    expect(() => updateRun('run_transition_terminal', { status: 'running' })).toThrow(
      /E_ILLEGAL_RUN_TRANSITION/,
    );
    const run = getRun('run_transition_terminal');
    expect(run?.status).toBe('completed');
    expect(run?.phase).toBe('done');
  });

  it('rejects queued -> completed (skipping an in-progress state)', () => {
    makeRun('run_transition_skip');
    expect(() => updateRun('run_transition_skip', { status: 'completed' })).toThrow(
      /E_ILLEGAL_RUN_TRANSITION/,
    );
    expect(getRun('run_transition_skip')?.status).toBe('queued');
  });

  it('rejects changing a terminal run phase', () => {
    makeRun('run_transition_phase');
    updateRun('run_transition_phase', { status: 'running' });
    updateRun('run_transition_phase', { status: 'completed', phase: 'done' });
    expect(() => updateRun('run_transition_phase', { phase: 'planning' })).toThrow(
      /E_ILLEGAL_RUN_TRANSITION/,
    );
    expect(getRun('run_transition_phase')?.phase).toBe('done');
  });

  it('requires completed status to use phase done', () => {
    makeRun('run_transition_completed_phase');
    updateRun('run_transition_completed_phase', { status: 'running' });
    expect(() =>
      updateRun('run_transition_completed_phase', { status: 'completed', phase: 'intake' }),
    ).toThrow(/E_ILLEGAL_RUN_TRANSITION/);
    expect(getRun('run_transition_completed_phase')?.status).toBe('running');
    expect(getRun('run_transition_completed_phase')?.phase).toBe('intake');
  });
});
