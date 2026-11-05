import { describe, expect, it } from 'vitest';
import {
  computeDominators,
  DominatorInputError,
  type FileDependencyEdge,
} from '../../src/server/analysis/dominators';

const edge = (from: string, to: string): FileDependencyEdge => ({ from, to });

describe('static file dominators', () => {
  it('computes a linear chain and normalizes root risk to 1', () => {
    const result = computeDominators({
      root: 'root',
      nodes: ['root', 'a', 'b'],
      edges: [edge('root', 'a'), edge('a', 'b')],
    });
    expect(result.analysis).toBe('static-file-dominators');
    expect(result.kind).toBe('static');
    expect(result.dynamic).toBe(false);
    expect(result.cfg).toBe(false);
    expect(result.reachable).toEqual(['a', 'b', 'root']);
    expect(result.dominators.root).toEqual(['root']);
    expect(result.dominators.a).toEqual(['a', 'root']);
    expect(result.dominators.b).toEqual(['a', 'b', 'root']);
    expect(result.dominatedCounts).toEqual({ a: 1, b: 0, root: 2 });
    expect(result.risk.root).toBe(1);
    expect(result.risk.a).toBe(0.5);
    expect(result.risk.b).toBe(0);
    expect(result.overallRisk).toBe(0.5);
    expect(result.truncated).toBe(false);
  });

  it('keeps the join node only at the root in a diamond', () => {
    const result = computeDominators({
      root: 'root',
      nodes: ['root', 'a', 'b', 'c'],
      edges: [edge('root', 'a'), edge('root', 'b'), edge('a', 'c'), edge('b', 'c')],
    });
    expect(result.dominators.c).toEqual(['c', 'root']);
    expect(result.dominators.a).toEqual(['a', 'root']);
    expect(result.dominators.b).toEqual(['b', 'root']);
    expect(result.dominatedCounts.root).toBe(3);
    expect(result.dominatedCounts.a).toBe(0);
    expect(result.dominatedCounts.b).toBe(0);
    expect(result.dominatedCounts.c).toBe(0);
    expect(result.risk.root).toBe(1);
    expect(result.risk.a).toBe(0);
    expect(result.risk.c).toBe(0);
  });

  it('handles a cycle without looping and computes a fixed point', () => {
    const result = computeDominators({
      root: 'root',
      nodes: ['root', 'a', 'b'],
      edges: [edge('root', 'a'), edge('a', 'b'), edge('b', 'a')],
    });
    expect(result.truncated).toBe(false);
    expect(result.dominators.a).toEqual(['a', 'root']);
    expect(result.dominators.b).toEqual(['a', 'b', 'root']);
    expect(result.dominatedCounts.root).toBe(2);
    expect(result.dominatedCounts.a).toBe(1);
    expect(result.dominatedCounts.b).toBe(0);
  });

  it('reports unreachable nodes with no dominator set and zero risk', () => {
    const result = computeDominators({
      root: 'root',
      nodes: ['root', 'a', 'orphan'],
      edges: [edge('root', 'a')],
    });
    expect(result.reachable).toEqual(['a', 'root']);
    expect(result.unreachable).toEqual(['orphan']);
    expect(result.dominators.orphan).toEqual([]);
    expect(result.dominatedCounts.orphan).toBe(0);
    expect(result.risk.orphan).toBe(0);
    expect(result.overallRisk).toBe(0.5);
  });

  it('deduplicates repeated edges deterministically', () => {
    const result = computeDominators({
      root: 'root',
      nodes: ['root', 'a'],
      edges: [edge('root', 'a'), edge('root', 'a'), edge('root', 'a')],
    });
    expect(result.edgeCount).toBe(1);
    expect(result.dominatedCounts.root).toBe(1);
  });

  it('is independent of edge input order', () => {
    const edges = [edge('root', 'a'), edge('a', 'b'), edge('b', 'c')];
    const first = computeDominators({ root: 'root', nodes: ['root', 'a', 'b', 'c'], edges });
    const second = computeDominators({ root: 'root', nodes: ['root', 'a', 'b', 'c'], edges: [...edges].reverse() });
    expect(second).toEqual(first);
  });

  it('infers the node set from the explicit root and edges', () => {
    const result = computeDominators({
      root: 'entry.ts',
      edges: [edge('entry.ts', 'lib.ts')],
    });
    expect(result.nodes).toEqual(['entry.ts', 'lib.ts']);
    expect(result.reachable).toEqual(['entry.ts', 'lib.ts']);
  });

  it('marks truncated when the hard pass bound is reached before convergence', () => {
    const result = computeDominators({
      root: 'root',
      nodes: ['root', 'a', 'b', 'c'],
      edges: [edge('root', 'a'), edge('root', 'b'), edge('a', 'c'), edge('b', 'c')],
      maxIterations: 1,
    });
    expect(result.truncated).toBe(true);
    expect(result.iterations).toBe(1);
    expect(result.maxIterations).toBe(1);
    expect(result.risk.root).toBeLessThanOrEqual(1);
  });

  it('rejects an empty root with a named error', () => {
    expect(() => computeDominators({ root: '', edges: [] })).toThrowError(DominatorInputError);
    try {
      computeDominators({ root: '', edges: [] });
    } catch (error) {
      expect((error as DominatorInputError).code).toBe('E_DOMINATOR_INVALID_ROOT');
    }
  });

  it('rejects malformed edges and invalid bounds with named errors', () => {
    expect(() =>
      computeDominators({ root: 'root', edges: [{ from: 'root', to: '' }] }),
    ).toThrowError(DominatorInputError);
    expect(() =>
      computeDominators({ root: 'root', edges: [], maxIterations: 0 }),
    ).toThrowError(DominatorInputError);
  });

  it('keeps every static risk value in [0,1]', () => {
    const result = computeDominators({
      root: 'root',
      nodes: ['root', 'a', 'b', 'c'],
      edges: [edge('root', 'a'), edge('root', 'b'), edge('a', 'c'), edge('b', 'c')],
    });
    for (const value of Object.values(result.risk)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    expect(result.overallRisk).toBeGreaterThanOrEqual(0);
    expect(result.overallRisk).toBeLessThanOrEqual(1);
  });
});
