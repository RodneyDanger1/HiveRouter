import { describe, expect, it } from 'vitest';
import {
  PHASE_TRANSITIONS,
  STATUS_TRANSITIONS,
  TERMINAL_STATUS_LIST,
  RunStateSchema,
  RunTransitionError,
  allowedNextPhases,
  allowedNextStatuses,
  assertPhaseTransition,
  assertStatusTransition,
  isTerminalPhase,
  isTerminalStatus,
  nextPhase,
  transitionPhase,
  transitionRun,
  transitionStatus,
} from '../../src/server/logic/run-state';
import { RUN_PHASES, RUN_STATUSES, type RunPhase, type RunStatus } from '../../src/shared/types';

function expectIllegal(fn: () => void, kind: 'status' | 'phase', from: string, to: string) {
  try {
    fn();
    throw new Error(`expected ${kind} transition ${from} -> ${to} to be refused`);
  } catch (error) {
    expect(error).toBeInstanceOf(RunTransitionError);
    const refusal = error as RunTransitionError;
    expect(refusal.code).toBe('E_ILLEGAL_RUN_TRANSITION');
    expect(refusal.kind).toBe(kind);
    expect(refusal.from).toBe(from);
    expect(refusal.to).toBe(to);
  }
}

describe('LG2 run-state — status matrix', () => {
  it('allows exactly the declared status edges and refuses every other edge by name', () => {
    for (const from of RUN_STATUSES) {
      for (const to of RUN_STATUSES) {
        const legal = from === to || STATUS_TRANSITIONS[from].includes(to);
        if (legal) {
          expect(() => assertStatusTransition(from, to, `run-${from}`)).not.toThrow();
        } else {
          expectIllegal(() => assertStatusTransition(from, to, `run-${from}`), 'status', from, to);
        }
      }
    }
  });

  it('makes every terminal status immutable except for the idempotent no-op', () => {
    expect(TERMINAL_STATUS_LIST.length).toBeGreaterThan(0);
    for (const terminal of TERMINAL_STATUS_LIST) {
      expect(isTerminalStatus(terminal)).toBe(true);
      expect(allowedNextStatuses(terminal)).toHaveLength(0);
      expect(() => assertStatusTransition(terminal, terminal, 'run-terminal')).not.toThrow();
      for (const other of RUN_STATUSES) {
        if (other === terminal) continue;
        expectIllegal(
          () => assertStatusTransition(terminal, other, 'run-terminal'),
          'status',
          terminal,
          other,
        );
      }
    }
  });

  it('allows cancellation/restart edges from every non-terminal status', () => {
    for (const status of RUN_STATUSES) {
      if (isTerminalStatus(status)) continue;
      expect(() => assertStatusTransition(status, 'cancelled', 'run-cancel')).not.toThrow();
      expect(() => assertStatusTransition(status, 'interrupted', 'run-restart')).not.toThrow();
    }
  });
});

describe('LG2 run-state — phase matrix', () => {
  it('allows exactly the declared phase edges', () => {
    for (const from of RUN_PHASES) {
      for (const to of RUN_PHASES) {
        const legal = from === to || PHASE_TRANSITIONS[from].includes(to);
        if (legal) {
          expect(() => assertPhaseTransition(from, to, 'run-phase')).not.toThrow();
        } else {
          expectIllegal(() => assertPhaseTransition(from, to, 'run-phase'), 'phase', from, to);
        }
      }
    }
  });

  it('has a terminal done phase and no outgoing edge', () => {
    expect(isTerminalPhase('done')).toBe(true);
    expect(allowedNextPhases('done')).toHaveLength(0);
    expect(nextPhase('done')).toBeNull();
    expect(nextPhase('intake')).toBe('planning');
    for (const phase of RUN_PHASES) {
      if (phase === 'done') continue;
      expectIllegal(() => assertPhaseTransition('done', phase, 'run-done'), 'phase', 'done', phase);
    }
  });

  it('requires repair to re-enter verifying rather than generating', () => {
    expect(PHASE_TRANSITIONS.repairing).toEqual(['verifying', 'finalizing']);
    expect(PHASE_TRANSITIONS.repairing).not.toContain('generating');
  });
});

describe('LG2 run-state — transitions', () => {
  const queued = { runId: 'run-1', status: 'queued' as RunStatus, phase: 'intake' as RunPhase };

  it('applies status and phase updates and returns a parsed state', () => {
    const running = transitionStatus(queued, 'running');
    expect(running).toEqual({ runId: 'run-1', status: 'running', phase: 'intake' });
    const planning = transitionPhase(running, 'planning');
    expect(planning.phase).toBe('planning');
    const both = transitionRun(planning, { phase: 'generating', status: 'paused' });
    expect(both).toEqual({ runId: 'run-1', status: 'paused', phase: 'generating' });
  });

  it('returns the identical state for the idempotent no-op', () => {
    const completed = { runId: 'run-2', status: 'completed' as RunStatus, phase: 'done' as RunPhase };
    expect(transitionRun(completed, { status: 'completed' })).toEqual(completed);
    expect(transitionRun(completed, { phase: 'done' })).toEqual(completed);
  });

  it('refuses any change from a terminal status, including a phase change', () => {
    const failed = { runId: 'run-3', status: 'failed' as RunStatus, phase: 'verifying' as RunPhase };
    expectIllegal(() => transitionRun(failed, { phase: 'finalizing' }), 'phase', 'verifying', 'finalizing');
    expectIllegal(() => transitionRun(failed, { status: 'running' }), 'status', 'failed', 'running');
  });

  it('rejects an empty update and invalid state through Zod', () => {
    expect(() => transitionRun(queued, {} as never)).toThrow();
    expect(() => RunStateSchema.parse({ runId: 'x', status: 'nope', phase: 'intake' })).toThrow();
    expect(() => RunStateSchema.parse({ runId: '', status: 'queued', phase: 'intake' })).toThrow();
  });
});
