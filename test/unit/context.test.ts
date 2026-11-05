import { describe, expect, it } from 'vitest';
import { ContextItem } from '../../src/shared/algorithms';
import { packContext, pageRank } from '../../src/server/context/packer';

function item(overrides: Partial<ContextItem> & { id: string; kind: ContextItem['kind'] }): ContextItem {
  const { id, kind, ...rest } = overrides;
  return {
    id,
    kind,
    text: 'x'.repeat(400),
    mandatory: false,
    cachePrefix: false,
    secret: false,
    criticality: 0,
    ...rest,
  };
}

const prefix = { system: 'system contract', briefDigest: 'brief digest', planSummary: 'plan summary' };

describe('CPO', () => {
  it('packs mandatory and optional items under the token budget', () => {
    const pack = packContext({
      taskId: 'task-1',
      maxTokens: 2000,
      prefix,
      mandatory: [
        item({ id: 'system', kind: 'system', text: 'system', mandatory: true }),
        item({ id: 'task', kind: 'brief', text: 'task', mandatory: true }),
      ],
      optional: [
        item({ id: 'dep', kind: 'dependency', path: 'src/a.py', text: 'x'.repeat(2000), importance: 1 }),
        item({ id: 'low', kind: 'review', text: 'x'.repeat(2000), importance: 0.01 }),
      ],
      graph: { nodes: ['src/a.py'], edges: [] },
    });
    expect(pack.ok).toBe(true);
    expect(pack.items.map((entry) => entry.id)).toContain('system');
    expect(pack.estimatedTokens).toBeLessThanOrEqual(2000);
    expect(pack.pageRank.converged).toBe(true);
  });

  it('never truncates mandatory context', () => {
    const pack = packContext({
      taskId: 'task-1',
      maxTokens: 10,
      prefix,
      mandatory: [item({ id: 'system', kind: 'system', text: 'x'.repeat(400), mandatory: true })],
      optional: [],
    });
    expect(pack.ok).toBe(false);
    expect(pack.refusal?.code).toBe('E_CONTEXT_INFEASIBLE');
  });

  it('refuses a mandatory secret and excludes an optional secret with a reason', () => {
    const secret = item({ id: 'secret', kind: 'dependency', secret: true });
    const refused = packContext({
      taskId: 'task-1',
      maxTokens: 2000,
      prefix,
      mandatory: [secret],
      optional: [],
    });
    expect(refused.ok).toBe(false);
    expect(refused.refusal?.code).toBe('E_POLICY_BLOCKED');

    const packed = packContext({
      taskId: 'task-1',
      maxTokens: 2000,
      prefix,
      mandatory: [],
      optional: [secret, item({ id: 'ok', kind: 'dependency', text: 'ok', path: 'src/a.py' })],
    });
    expect(packed.ok).toBe(true);
    expect(packed.excluded).toContainEqual({ id: 'secret', reason: 'secret' });
  });

  it('has a stable prefix hash across tasks and detects a mismatch', () => {
    const base = {
      maxTokens: 2000,
      prefix,
      mandatory: [item({ id: 'system', kind: 'system', text: 'system', mandatory: true })],
      optional: [],
    };
    const first = packContext({ ...base, taskId: 'task-1' });
    const second = packContext({ ...base, taskId: 'task-2' });
    expect(first.prefixHash).toBe(second.prefixHash);
    const mismatch = packContext({ ...base, taskId: 'task-3', expectedPrefixHash: 'deadbeef' });
    expect(mismatch.cachePrefixStable).toBe(false);
  });

  it('computes deterministic PageRank and degrades when it does not converge', () => {
    const converged = pageRank(['a', 'b'], [['a', 'b'], ['b', 'a']]);
    expect(converged.converged).toBe(true);
    expect(converged.ranks.a).toBeCloseTo(converged.ranks.b, 9);

    const degraded = pageRank(['a', 'b'], [['a', 'b']], 0.85, 1, 1e-99);
    expect(degraded.converged).toBe(false);
    expect(degraded.ranks.a).toBe(0);
    expect(degraded.ranks.b).toBe(1);
  });

  it('never exceeds maxTokens across deterministic budgets', () => {
    for (let index = 0; index < 30; index += 1) {
      const maxTokens = 500 + index * 100;
      const pack = packContext({
        taskId: `task-${index}`,
        maxTokens,
        prefix,
        mandatory: [item({ id: 'system', kind: 'system', text: 'x'.repeat(200), mandatory: true })],
        optional: [
          item({ id: 'a', kind: 'dependency', text: 'x'.repeat(800), path: 'a.py' }),
          item({ id: 'b', kind: 'review', text: 'x'.repeat(400), path: 'b.py' }),
        ],
        graph: { nodes: ['a.py', 'b.py'], edges: [['b.py', 'a.py']] },
      });
      expect(pack.ok).toBe(true);
      expect(pack.estimatedTokens).toBeLessThanOrEqual(maxTokens);
      expect(pack.items.some((entry) => entry.id === 'system')).toBe(true);
    }
  });

  it('excludes duplicate and over-budget optional items with reasons', () => {
    const pack = packContext({
      taskId: 'task-1',
      maxTokens: 1000,
      prefix,
      mandatory: [],
      optional: [
        item({ id: 'dup', kind: 'dependency', text: 'a' }),
        item({ id: 'dup', kind: 'dependency', text: 'b' }),
        item({ id: 'huge', kind: 'dependency', text: 'x'.repeat(20_000) }),
      ],
    });
    expect(pack.ok).toBe(true);
    expect(pack.excluded.some((entry) => entry.id === 'dup' && entry.reason === 'duplicate')).toBe(true);
    expect(pack.excluded.some((entry) => entry.id === 'huge' && entry.reason === 'over-budget')).toBe(true);
  });
});
