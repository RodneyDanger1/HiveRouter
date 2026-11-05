import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { RunSnapshot } from '../../src/shared/types.js';

const mocks = vi.hoisted(() => ({
  chatJson: vi.fn(),
  chat: vi.fn(),
  reserve: vi.fn(() => 'res_test'),
  maxTokens: vi.fn(() => 2048),
  commit: vi.fn(),
  release: vi.fn(),
}));

vi.mock('../../src/server/llm/client', () => ({
  chatJson: mocks.chatJson,
  chat: mocks.chat,
  DeepSeekError: class DeepSeekError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'DeepSeekError';
    }
  },
}));

vi.mock('../../src/server/runs/manager', () => ({
  reserveLlmCall: mocks.reserve,
  maxAffordableOutputTokens: mocks.maxTokens,
  commitLlmCall: mocks.commit,
  releaseLlmCall: mocks.release,
}));

vi.mock('../../src/server/agents/registry', () => ({
  getAgent: (id: string) => ({
    id,
    maxOutputTokens: 8192,
    outputKind: 'files',
    canWrite: true,
  }),
  engineForPath: () => 'python-engine',
}));

vi.mock('../../src/server/agents/prompts', () => ({
  buildSystemPrompt: () => 'system prompt',
}));

import { callAgentJson } from '../../src/server/pipeline/agent-runner';

function snapshot(overrides: Partial<RunSnapshot> = {}): RunSnapshot {
  return {
    id: 'snap_test',
    runId: 'run_test',
    createdAt: new Date(0).toISOString(),
    model: 'deepseek-flash',
    thinking: 'disabled',
    effort: undefined,
    preset: 'full-build',
    limits: { maxOutputTokens: 4096 },
    pricing: {},
    engineMap: {},
    promptVersions: [{ agentId: 'python-engine', version: 'v1', hash: 'h', text: 'system prompt' }],
    policyVersion: { id: 'pol', version: 'v1', hash: 'h', json: '{}' },
    capabilities: [],
    hash: 'h',
    ...overrides,
  } as RunSnapshot;
}

const schema = z.object({ ok: z.literal(true) });

function usage(costUsd: number, completionTokens: number) {
  return {
    promptTokens: 10,
    completionTokens,
    cacheHitTokens: 0,
    cacheMissTokens: 10,
    reasoningTokens: 0,
    costUsd,
    source: 'provider' as const,
    model: 'deepseek-flash',
  };
}

describe('agent runtime precedence', () => {
  it('honors snapshot thinking and explicit routed model/effort', async () => {
    let captured: Record<string, unknown> = {};
    mocks.chatJson.mockImplementation(async (_schema: unknown, _messages: unknown, options: Record<string, unknown>) => {
      captured = options;
      return { data: { ok: true }, usage: usage(0.01, 10), content: '{"ok":true}' };
    });

    await callAgentJson('python-engine', snapshot({ thinking: 'enabled', effort: 'max' }), 'user', schema, {
      model: 'deepseek-v4-pro',
      thinking: 'enabled',
      effort: 'max',
    } as never);

    expect(captured.model).toBe('deepseek-v4-pro');
    expect(captured.thinking).toBe('enabled');
    expect(captured.effort).toBe('max');
  });

  it('keeps user-disabled thinking disabled when no route override exists', async () => {
    let captured: Record<string, unknown> = {};
    mocks.chatJson.mockImplementation(async (_schema: unknown, _messages: unknown, options: Record<string, unknown>) => {
      captured = options;
      return { data: { ok: true }, usage: usage(0.01, 10), content: '{"ok":true}' };
    });

    await callAgentJson('python-engine', snapshot({ thinking: 'disabled' }), 'user', schema);

    expect(captured.thinking).toBe('disabled');
    expect(captured.model).toBe('deepseek-flash');
  });
});

describe('agent usage accounting', () => {
  it('records every provider attempt, including a failed repair attempt', async () => {
    const recorded: number[] = [];
    mocks.chatJson.mockImplementation(async (_schema: unknown, _messages: unknown, options: {
      onHttpAttemptStart?: (attempt: number) => void;
      onHttpAttemptEnd?: (attempt: number, u: ReturnType<typeof usage> | null) => void;
    }) => {
      options.onHttpAttemptStart?.(1);
      options.onHttpAttemptEnd?.(1, usage(0.003, 3));
      options.onHttpAttemptStart?.(2);
      options.onHttpAttemptEnd?.(2, usage(0.004, 4));
      return { data: { ok: true }, usage: usage(0.007, 7), content: '{"ok":true}' };
    });

    const result = await callAgentJson('python-engine', snapshot(), 'user', schema, {
      onUsage: (u) => recorded.push(u.costUsd),
    });

    expect(recorded).toEqual([0.003, 0.004]);
    expect(result.usage.costUsd).toBeCloseTo(0.007, 12);
    expect(mocks.commit).toHaveBeenCalledTimes(2);
  });

  it('does not settle the same reservation twice when commit throws after changing state', async () => {
    mocks.commit.mockClear();
    mocks.commit.mockImplementationOnce(() => {
      throw new Error('E_BUDGET_OVERCOMMIT');
    });
    mocks.chatJson.mockImplementation(async (_schema: unknown, _messages: unknown, options: {
      onHttpAttemptStart?: (attempt: number) => void;
      onHttpAttemptEnd?: (attempt: number, u: ReturnType<typeof usage> | null) => void;
    }) => {
      options.onHttpAttemptStart?.(1);
      options.onHttpAttemptEnd?.(1, usage(0.01, 10));
      // The client also invokes the catch-side end hook after a throw.
      options.onHttpAttemptEnd?.(1, null);
      return { data: { ok: true }, usage: usage(0.01, 10), content: '{"ok":true}' };
    });

    await expect(callAgentJson('python-engine', snapshot(), 'user', schema)).rejects.toThrow('E_BUDGET_OVERCOMMIT');
    expect(mocks.commit).toHaveBeenCalledTimes(1);
    expect(mocks.release).not.toHaveBeenCalled();
  });
});
