import { z } from 'zod';
import type { RefusalCode } from '../../shared/refusals.js';

export const GuardPolicySchema = z.object({
  repeatedSignatureThreshold: z.number().int().min(1).default(3),
  identicalRequestThreshold: z.number().int().min(1).default(2),
  spendRatio: z.number().min(0).max(1).default(0.9),
  noProgressMs: z.number().int().min(1000).default(5 * 60 * 1000),
  pauseTimeoutMs: z.number().int().min(1000).default(10 * 60 * 1000),
});
export type GuardPolicy = z.infer<typeof GuardPolicySchema>;

export const DEFAULT_GUARD_POLICY: GuardPolicy = GuardPolicySchema.parse({});

export const GuardStateSchema = z.object({
  repeatedSignatureCount: z.number().int().nonnegative().default(0),
  identicalRequestCount: z.number().int().nonnegative().default(0),
  spendUsd: z.number().nonnegative().default(0),
  capUsd: z.number().positive(),
  lastProgressAt: z.string().min(1),
  now: z.string().min(1),
  pausedAt: z.string().min(1).nullable().optional(),
});
export type GuardState = z.infer<typeof GuardStateSchema>;

export interface GuardDecision {
  action: 'continue' | 'pause' | 'needs_review';
  code: RefusalCode | null;
  reasons: string[];
  releaseBudget: boolean;
}

export function evaluateLoopGuard(
  raw: GuardState,
  rawPolicy: Partial<GuardPolicy> = {},
): GuardDecision {
  const state = GuardStateSchema.parse(raw);
  const policy = GuardPolicySchema.parse({ ...DEFAULT_GUARD_POLICY, ...rawPolicy });
  const now = Date.parse(state.now);
  if (!Number.isFinite(now)) {
    return { action: 'continue', code: null, reasons: [], releaseBudget: false };
  }
  if (state.pausedAt) {
    const pausedAt = Date.parse(state.pausedAt);
    if (Number.isFinite(pausedAt) && now - pausedAt >= policy.pauseTimeoutMs) {
      return {
        action: 'needs_review',
        code: 'E_LOOP_GUARD_TRIPPED',
        reasons: ['guard pause exceeded 10 minutes without review'],
        releaseBudget: true,
      };
    }
    return {
      action: 'pause',
      code: 'E_LOOP_GUARD_TRIPPED',
      reasons: ['guard is already paused'],
      releaseBudget: true,
    };
  }
  const reasons: string[] = [];
  if (state.repeatedSignatureCount >= policy.repeatedSignatureThreshold) {
    reasons.push(`repeated failure signature count ${state.repeatedSignatureCount}`);
  }
  if (state.identicalRequestCount >= policy.identicalRequestThreshold) {
    reasons.push(`identical request count ${state.identicalRequestCount}`);
  }
  if (state.capUsd > 0 && state.spendUsd / state.capUsd >= policy.spendRatio) {
    reasons.push(`spend ${state.spendUsd}/${state.capUsd} reached guard ratio`);
  }
  const lastProgress = Date.parse(state.lastProgressAt);
  if (Number.isFinite(lastProgress) && now - lastProgress >= policy.noProgressMs) {
    reasons.push('no artifact/check progress for 5 minutes');
  }
  if (reasons.length > 0) {
    return {
      action: 'pause',
      code: 'E_LOOP_GUARD_TRIPPED',
      reasons,
      releaseBudget: true,
    };
  }
  return { action: 'continue', code: null, reasons: [], releaseBudget: false };
}
