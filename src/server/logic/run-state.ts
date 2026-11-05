import { z } from 'zod';
import type { RefusalCode } from '../../shared/refusals';
import {
  RUN_PHASES,
  RUN_STATUSES,
  TERMINAL_STATUSES,
  type RunPhase,
  type RunStatus,
} from '../../shared/types';

/**
 * LG2 — run/phase state machine.
 *
 * Pure: no I/O, no clock, no randomness. The same input always yields the same
 * result or the same named refusal. `RunManager` is the only production caller
 * that may persist the returned state.
 */

export const RunStatusSchema = z.enum(RUN_STATUSES);
export const RunPhaseSchema = z.enum(RUN_PHASES);
export const TERMINAL_STATUS_LIST: readonly RunStatus[] = RUN_STATUSES.filter((s) =>
  TERMINAL_STATUSES.has(s),
);

export const TERMINAL_PHASES: readonly RunPhase[] = ['done'];

export const STATUS_TRANSITIONS: Readonly<Record<RunStatus, readonly RunStatus[]>> = {
  queued: ['running', 'failed', 'budget_exceeded', 'cancelled', 'interrupted'],
  running: [
    'paused',
    'needs_review',
    'completed',
    'completed_with_warnings',
    'failed',
    'cancelled',
    'budget_exceeded',
    'interrupted',
  ],
  paused: ['running', 'needs_review', 'cancelled', 'interrupted'],
  needs_review: [
    'running',
    'completed',
    'completed_with_warnings',
    'failed',
    'cancelled',
    'interrupted',
  ],
  completed: [],
  completed_with_warnings: [],
  failed: [],
  cancelled: [],
  budget_exceeded: [],
  interrupted: [],
} as const;

export const PHASE_TRANSITIONS: Readonly<Record<RunPhase, readonly RunPhase[]>> = {
  intake: ['planning'],
  planning: ['routing', 'generating', 'finalizing'],
  routing: ['generating', 'finalizing'],
  generating: ['cleaning', 'hardening', 'testing', 'verifying', 'finalizing'],
  cleaning: ['hardening', 'testing', 'verifying', 'finalizing'],
  hardening: ['testing', 'verifying', 'finalizing'],
  testing: ['verifying', 'finalizing'],
  verifying: ['repairing', 'finalizing'],
  repairing: ['verifying', 'finalizing'],
  finalizing: ['done'],
  done: [],
} as const;

export const RunStateSchema = z.object({
  runId: z.string().min(1).max(128),
  status: RunStatusSchema,
  phase: RunPhaseSchema,
});
export type RunState = z.infer<typeof RunStateSchema>;

export const RunStateUpdateSchema = z
  .object({
    status: RunStatusSchema.optional(),
    phase: RunPhaseSchema.optional(),
  })
  .refine((v) => v.status !== undefined || v.phase !== undefined, {
    message: 'update must change status or phase',
  });
export type RunStateUpdate = z.infer<typeof RunStateUpdateSchema>;

export type TransitionKind = 'status' | 'phase';

export class RunTransitionError extends Error {
  readonly code: RefusalCode = 'E_ILLEGAL_RUN_TRANSITION';
  readonly kind: TransitionKind;
  readonly from: string;
  readonly to: string;
  readonly runId: string;

  constructor(kind: TransitionKind, from: string, to: string, runId: string) {
    super(
      `Illegal ${kind} transition for run ${runId}: ${from} -> ${to} (E_ILLEGAL_RUN_TRANSITION)`,
    );
    this.name = 'RunTransitionError';
    this.kind = kind;
    this.from = from;
    this.to = to;
    this.runId = runId;
  }

  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      kind: this.kind,
      from: this.from,
      to: this.to,
      runId: this.runId,
    };
  }
}

export function isTerminalStatus(status: RunStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function isTerminalPhase(phase: RunPhase): boolean {
  return TERMINAL_PHASES.includes(phase);
}

export function allowedNextStatuses(status: RunStatus): readonly RunStatus[] {
  return STATUS_TRANSITIONS[status];
}

export function allowedNextPhases(phase: RunPhase): readonly RunPhase[] {
  return PHASE_TRANSITIONS[phase];
}

/** A same-value transition is the idempotent no-op; terminal states may not move elsewhere. */
export function assertStatusTransition(
  from: RunStatus,
  to: RunStatus,
  runId = 'unknown',
): void {
  RunStatusSchema.parse(from);
  RunStatusSchema.parse(to);
  if (from === to) return;
  if (isTerminalStatus(from) || !STATUS_TRANSITIONS[from].includes(to)) {
    throw new RunTransitionError('status', from, to, runId);
  }
}

export function assertPhaseTransition(from: RunPhase, to: RunPhase, runId = 'unknown'): void {
  RunPhaseSchema.parse(from);
  RunPhaseSchema.parse(to);
  if (from === to) return;
  if (isTerminalPhase(from) || !PHASE_TRANSITIONS[from].includes(to)) {
    throw new RunTransitionError('phase', from, to, runId);
  }
}

/**
 * Apply one status and/or phase update. Both channels are validated; the caller
 * may move only one at a time when that is enough.
 */
export function transitionRun(
  state: RunState,
  update: RunStateUpdate,
): RunState {
  const current = RunStateSchema.parse(state);
  const next = RunStateUpdateSchema.parse(update);

  if (isTerminalStatus(current.status)) {
    const statusChanges = next.status !== undefined && next.status !== current.status;
    const phaseChanges = next.phase !== undefined && next.phase !== current.phase;
    if (statusChanges || phaseChanges) {
      const kind: TransitionKind = statusChanges ? 'status' : 'phase';
      const from = statusChanges ? current.status : current.phase;
      const to = statusChanges ? String(next.status) : String(next.phase);
      throw new RunTransitionError(kind, from, to, current.runId);
    }
    return current;
  }

  if (next.status !== undefined && next.status !== current.status) {
    assertStatusTransition(current.status, next.status, current.runId);
    if (next.status === 'completed' || next.status === 'completed_with_warnings') {
      const nextPhase = next.phase ?? current.phase;
      if (nextPhase !== 'done') {
        throw new RunTransitionError('phase', current.phase, nextPhase, current.runId);
      }
    }
  }
  if (next.phase !== undefined && next.phase !== current.phase) {
    assertPhaseTransition(current.phase, next.phase, current.runId);
  }

  return RunStateSchema.parse({
    runId: current.runId,
    status: next.status ?? current.status,
    phase: next.phase ?? current.phase,
  });
}

export function transitionPhase(state: RunState, phase: RunPhase): RunState {
  return transitionRun(state, { phase });
}

export function transitionStatus(state: RunState, status: RunStatus): RunState {
  return transitionRun(state, { status });
}

export function nextPhase(phase: RunPhase): RunPhase | null {
  const next = PHASE_TRANSITIONS[phase][0];
  return next ?? null;
}
