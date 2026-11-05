import { describe, expect, it } from 'vitest';
import {
  AgentCapability,
  FileTask,
  ROUTE_WEIGHT_PRESETS,
  RoutePolicy,
} from '../../src/shared/algorithms';
import { routeTasks } from '../../src/server/routing/ccr';
import { REGISTRY, capabilities } from '../../src/server/agents/registry';

function cap(overrides: Partial<AgentCapability> & { agentId: string }): AgentCapability {
  const { agentId, ...rest } = overrides;
  return {
    agentId,
    outputKinds: ['files'],
    canWrite: true,
    canReview: false,
    canTest: false,
    languages: ['python'],
    pathGlobs: ['**/*.py'],
    verificationSupport: 'syntax',
    fallbackFor: [],
    maxOutputTokens: 65_536,
    staticPrior: 0.7,
    priorVersion: 'prior-v1',
    promptVersion: 'prompt-v1',
    schemaId: 'schema-v1',
    enabled: true,
    ...rest,
  };
}

function task(overrides: Partial<FileTask> & { id: string; path: string }): FileTask {
  const { id, path, ...rest } = overrides;
  return {
    id,
    path,
    language: 'python',
    duty: 'write a module',
    deps: [],
    required: true,
    riskHints: [],
    requiredChecks: [],
    estimatedBytes: 1000,
    ...rest,
  };
}

function policy(overrides: Partial<RoutePolicy> = {}): RoutePolicy {
  return {
    policyVersion: 'policy-v1',
    routePolicyId: 'balanced-v1',
    preset: 'balanced',
    budgetUsd: 0.05,
    reserveRatio: 0.2,
    maxFiles: 24,
    weights: ROUTE_WEIGHT_PRESETS.balanced,
    riskThreshold: 0.5,
    blockedRiskHints: [],
    allowThinkingDowngrade: true,
    requireJsonForStructured: true,
    ...overrides,
  };
}

const python = cap({ agentId: 'python-engine' });

describe('CCR', () => {
  it('uses the 37-row capability fixture when the registry exists', () => {
    const caps = capabilities();
    expect(REGISTRY).toHaveLength(37);
    expect(caps).toHaveLength(37);
    const result = routeTasks({
      tasks: [task({ id: 'a', path: 'src/a.py' })],
      capabilities: caps,
      policy: policy({ budgetUsd: 0.2 }),
    });
    expect(result.ok).toBe(true);
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0]?.agentId).toBeTruthy();
    expect(result.routes[0]?.candidates.length).toBeGreaterThan(0);
    expect(result.routes[0]?.candidates.some((candidate) => candidate.model && candidate.thinking)).toBe(true);
  });

  it('matches root-level files against a **/*.ext capability glob', () => {
    const result = routeTasks({
      tasks: [task({ id: 'root', path: 'main.py' })],
      capabilities: [python],
      policy: policy(),
    });
    expect(result.ok).toBe(true);
    expect(result.routes[0]?.agentId).toBe('python-engine');
  });

  it('routes every required task with a static prior and a positive reserve', () => {
    const result = routeTasks({
      tasks: [task({ id: 'a', path: 'src/a.py' }), task({ id: 'b', path: 'src/b.py', deps: ['a'] })],
      capabilities: [python],
      policy: policy(),
      runId: 'run-1',
    });
    expect(result.ok).toBe(true);
    expect(result.routes).toHaveLength(2);
    expect(result.routes.every((route) => route.qualitySource === 'prior' && route.sampleSize === 0)).toBe(true);
    expect(result.reserveUsd).toBeCloseTo(0.01, 6);
    expect(result.allocatedCostUsd).toBeLessThanOrEqual(result.allocatableUsd + 1e-9);
    expect(result.criticalPath).toEqual(['a', 'b']);
  });

  it('routes when allocatable budget exceeds the exact-DP micro-USD ceiling', () => {
    const result = routeTasks({
      tasks: [task({ id: 'a', path: 'src/a.py' }), task({ id: 'b', path: 'src/b.py', deps: ['a'] })],
      capabilities: [python],
      policy: policy({ budgetUsd: 2, reserveRatio: 0.2 }),
    });
    expect(result.ok).toBe(true);
    expect(result.routes).toHaveLength(2);
    expect(result.allocatableUsd).toBe(1.6);
    expect(result.allocatedCostUsd).toBeLessThanOrEqual(result.allocatableUsd + 1e-9);
  });

  it('uses policy seed, not runId, for stable ties', () => {
    const request = {
      tasks: [task({ id: 'a', path: 'src/a.py' })],
      capabilities: [python],
      policy: policy(),
    };
    const first = routeTasks({ ...request, runId: 'run-a' });
    const second = routeTasks({ ...request, runId: 'run-b' });
    expect(first.routes).toEqual(second.routes);
    expect(first.seed).toBe(second.seed);
  });

  it('refuses when no agent can write the language', () => {
    const result = routeTasks({
      tasks: [task({ id: 'a', path: 'src/a.rb', language: 'ruby' })],
      capabilities: [python],
      policy: policy(),
    });
    expect(result.ok).toBe(false);
    expect(result.refusals.map((refusal) => refusal.code)).toContain('E_NO_CAPABLE_AGENT');
  });

  it('refuses when all matching agents are disabled', () => {
    const result = routeTasks({
      tasks: [task({ id: 'a', path: 'src/a.py' })],
      capabilities: [{ ...python, enabled: false }],
      policy: policy(),
    });
    expect(result.ok).toBe(false);
    expect(result.refusals.map((refusal) => refusal.code)).toContain('E_ALL_CANDIDATES_DISABLED');
  });

  it('refuses with E_ROUTE_BUDGET_INFEASIBLE when the allocatable budget is too small', () => {
    const result = routeTasks({
      tasks: [task({ id: 'a', path: 'src/a.py' })],
      capabilities: [python],
      policy: policy({ budgetUsd: 0.0001 }),
    });
    expect(result.ok).toBe(false);
    expect(result.refusals.map((refusal) => refusal.code)).toContain('E_ROUTE_BUDGET_INFEASIBLE');
  });

  it('keeps a required task dependent on a required task routed together', () => {
    const result = routeTasks({
      tasks: [
        task({ id: 'main', path: 'src/main.py', deps: ['config'] }),
        task({ id: 'config', path: 'src/config.py', required: false }),
      ],
      capabilities: [python],
      policy: policy({ budgetUsd: 0.05 }),
    });
    expect(result.ok).toBe(true);
    expect(result.routes.map((route) => route.taskId).sort()).toEqual(['config', 'main']);
    expect(result.skippedTasks).toEqual([]);
  });

  it('refuses an unknown dependency', () => {
    const result = routeTasks({
      tasks: [task({ id: 'main', path: 'src/main.py', deps: ['missing'] })],
      capabilities: [python],
      policy: policy(),
    });
    expect(result.ok).toBe(false);
    expect(result.refusals[0]?.code).toBe('E_MISSING_DEPENDENCY');
  });

  it('refuses a dependency cycle', () => {
    const result = routeTasks({
      tasks: [
        task({ id: 'a', path: 'src/a.py', deps: ['b'] }),
        task({ id: 'b', path: 'src/b.py', deps: ['a'] }),
      ],
      capabilities: [python],
      policy: policy(),
    });
    expect(result.ok).toBe(false);
    expect(result.refusals[0]?.code).toBe('E_DAG_CYCLE_DETECTED');
  });

  it('refuses a high-risk task with only unverified agents', () => {
    const unverified = cap({ agentId: 'powershell-core', verificationSupport: 'unverified', languages: ['python'], pathGlobs: ['**/*.py'] });
    const result = routeTasks({
      tasks: [task({ id: 'secret', path: 'src/secrets.py', riskHints: ['secrets'] })],
      capabilities: [unverified],
      policy: policy(),
    });
    expect(result.ok).toBe(false);
    expect(result.refusals.map((refusal) => refusal.code)).toContain('E_RISK_UNVERIFIABLE');
  });

  it('honors an engineHint fallback before polyglot', () => {
    const fallback = cap({
      agentId: 'fallback-engine',
      fallbackFor: ['missing-engine'],
    });
    const polyglot = cap({
      agentId: 'polyglot-engine',
      languages: ['python', 'ruby', 'javascript'],
      pathGlobs: ['**/*'],
    });
    const result = routeTasks({
      tasks: [task({ id: 'a', path: 'src/a.py', engineHint: 'missing-engine' })],
      capabilities: [fallback, polyglot],
      policy: policy(),
    });
    expect(result.ok).toBe(true);
    expect(result.routes[0]?.agentId).toBe('fallback-engine');
  });

  it('refuses an unsafe path with E_POLICY_BLOCKED', () => {
    const result = routeTasks({
      tasks: [task({ id: 'a', path: '../escape.py' })],
      capabilities: [python],
      policy: policy(),
    });
    expect(result.ok).toBe(false);
    expect(result.refusals[0]?.code).toBe('E_POLICY_BLOCKED');
  });

  it('does not exceed the allocatable budget across three tasks', () => {
    const result = routeTasks({
      tasks: [
        task({ id: 'a', path: 'src/a.py' }),
        task({ id: 'b', path: 'src/b.py' }),
        task({ id: 'c', path: 'src/c.py' }),
      ],
      capabilities: [python],
      policy: policy({ budgetUsd: 0.02 }),
    });
    expect(result.ok).toBe(true);
    expect(result.allocatedCostUsd).toBeLessThanOrEqual(result.allocatableUsd + 1e-9);
  });

  it('holds the budget invariant across deterministic policy variants', () => {
    for (let index = 0; index < 40; index += 1) {
      const result = routeTasks({
        tasks: [
          task({ id: 'a', path: 'src/a.py' }),
          task({ id: 'b', path: 'src/b.py', deps: ['a'] }),
          task({ id: 'c', path: 'src/c.py', deps: ['b'] }),
        ],
        capabilities: [python],
        policy: policy({ budgetUsd: 0.01 + (index % 8) * 0.002, routePolicyId: `policy-${index}` }),
      });
      expect(result.ok).toBe(true);
      expect(result.allocatedCostUsd).toBeLessThanOrEqual(result.allocatableUsd + 1e-9);
      expect(result.reserveUsd).toBeGreaterThan(0);
    }
  });

  it('refuses with E_CONTEXT_INFEASIBLE when every candidate overflows the model context', () => {
    const result = routeTasks({
      tasks: [task({ id: 'a', path: 'src/a.py', estimatedBytes: 100_000 })],
      capabilities: [python],
      policy: policy(),
      modelProfiles: [
        {
          model: 'deepseek-flash',
          thinking: 'disabled',
          inputUsdPerMTok: 0.3,
          outputUsdPerMTok: 1.2,
          contextTokens: 100,
          maxOutputTokens: 65_536,
          supportsJson: true,
          latencyMs: 20_000,
          qualityDelta: 0,
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.refusals.map((refusal) => refusal.code)).toContain('E_CONTEXT_INFEASIBLE');
  });

  it('is independent of capability array order', () => {
    const other = cap({ agentId: 'structural-engine', staticPrior: 0.6, languages: ['python', 'javascript'], pathGlobs: ['**/*'] });
    const request = {
      tasks: [task({ id: 'a', path: 'src/a.py' })],
      policy: policy(),
    };
    const first = routeTasks({ ...request, capabilities: [python, other] });
    const second = routeTasks({ ...request, capabilities: [other, python] });
    expect(first.routes).toEqual(second.routes);
  });
});
