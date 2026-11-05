import { describe, expect, it } from 'vitest';
import { RetryRequest } from '../../src/shared/algorithms';
import { decideRetry } from '../../src/server/retry/allocator';

function request(overrides: Partial<RetryRequest> = {}): RetryRequest {
  return {
    taskId: 'task-1',
    attempt: 1,
    maxAttempts: 3,
    repairsDone: 0,
    maxRepairs: 2,
    failureCategory: 'syntax',
    finishReason: 'stop',
    currentAgentId: 'python-engine',
    currentModel: 'deepseek-flash',
    currentThinking: 'disabled',
    currentCostUsd: 0.001,
    currentExpectedSeconds: 20,
    budget: { spentUsd: 0.01, remainingUsd: 0.04, reserveUsd: 0.01 },
    candidates: [],
    riskTier: 'T2',
    lambdaUsdPerSec: 0.001,
    attemptEvidence: 0,
    ...overrides,
  };
}

describe('CRA', () => {
  it('never retries auth failures', () => {
    const decision = decideRetry(request({ failureCategory: 'auth' }));
    expect(decision.action).toBe('abort');
    expect(decision.refusalCode).toBe('E_KEY_INVALID');
  });

  it('retries rate-limit failures with deterministic backoff', () => {
    const decision = decideRetry(request({ failureCategory: 'rate-limit', attempt: 2 }));
    expect(decision.action).toBe('retry_same');
    expect(decision.backoffMs).toBe(2000);
  });

  it('aborts content-filter stops', () => {
    const decision = decideRetry(request({ finishReason: 'content_filter' }));
    expect(decision.action).toBe('abort');
  });

  it('does not treat a null budget as zero', () => {
    const decision = decideRetry(request({ budget: null }));
    expect(decision.action).toBe('abort');
    expect(decision.refusalCode).toBe('E_BUDGET_UNKNOWN_RESERVATION');
  });

  it('aborts when no action fits the remaining budget', () => {
    const decision = decideRetry(
      request({ budget: { spentUsd: 0.05, remainingUsd: 0, reserveUsd: 0 } }),
    );
    expect(decision.action).toBe('abort');
    expect(decision.refusalCode).toBe('E_RETRY_INFEASIBLE');
  });

  it('respects max attempts and max repairs', () => {
    expect(decideRetry(request({ attempt: 3 })).action).toBe('abort');
    expect(decideRetry(request({ repairsDone: 2 })).refusalCode).toBe('E_REPAIR_BUDGET_EXHAUSTED');
  });

  it('switches model for a length stop when a larger-output candidate exists', () => {
    const decision = decideRetry(
      request({
        finishReason: 'length',
        candidates: [
          {
            agentId: 'python-engine',
            model: 'deepseek-v4-pro',
            thinking: 'enabled',
            effort: 'high',
            costUsd: 0.005,
            expectedSeconds: 30,
            quality: 0.8,
            maxOutputTokens: 200_000,
            capabilityFiltered: true,
          },
        ],
      }),
    );
    expect(decision.action).toBe('switch_model');
    expect(decision.candidate?.model).toBe('deepseek-v4-pro');
  });

  it('switches agent for a verification failure when a capable alternative exists', () => {
    const decision = decideRetry(
      request({
        failureCategory: 'verification',
        candidates: [
          {
            agentId: 'ts-engine',
            model: 'deepseek-flash',
            thinking: 'disabled',
            costUsd: 0.002,
            expectedSeconds: 20,
            quality: 0.7,
            maxOutputTokens: 65_536,
            capabilityFiltered: true,
          },
        ],
      }),
    );
    expect(decision.action).toBe('switch_agent');
    expect(decision.candidate?.agentId).toBe('ts-engine');
  });

  it('filters capability-unfiltered candidates', () => {
    const decision = decideRetry(
      request({
        candidates: [
          {
            agentId: 'bad-engine',
            model: 'deepseek-v4-pro',
            thinking: 'enabled',
            costUsd: 0.0001,
            expectedSeconds: 1,
            quality: 1,
            maxOutputTokens: 65_536,
            capabilityFiltered: false,
          },
        ],
      }),
    );
    expect(decision.candidate?.agentId).not.toBe('bad-engine');
  });
});
