import { describe, expect, it } from 'vitest';
import { FailureInput } from '../../src/shared/algorithms';
import {
  classifyFailure,
  failureSignature,
  normalizeFailure,
  triageFailures,
} from '../../src/server/repair/triage';

function failure(overrides: Partial<FailureInput> & { file: string; message: string }): FailureInput {
  const { file, message, ...rest } = overrides;
  return {
    checkId: 'syntax.python',
    taskId: 'task-1',
    file,
    message,
    stderr: '',
    language: 'python',
    attempt: 1,
    ...rest,
  };
}

const graph = { nodes: ['a.py', 'b.py', 'c.py'], edges: [['b.py', 'a.py'], ['c.py', 'b.py']] };

describe('FSN', () => {
  it('normalizes paths and line numbers into one signature', () => {
    const first = failure({ file: 'C:\\work\\a.py', message: 'SyntaxError at line 12: unexpected token' });
    const second = failure({ file: 'C:\\work\\b.py', message: 'SyntaxError at line 99: unexpected token' });
    expect(normalizeFailure(first)).toBe(normalizeFailure(second));
    expect(failureSignature(first)).toBe(failureSignature(second));
    expect(classifyFailure(normalizeFailure(first))).toBe('syntax');
  });

  it('clusters the same error and separates different categories', () => {
    const result = triageFailures({
      graph,
      failures: [
        failure({ file: 'a.py', message: 'SyntaxError: unexpected token at line 1' }),
        failure({ file: 'a.py', message: 'SyntaxError: unexpected token at line 2' }),
        failure({ file: 'b.py', message: 'ENOENT: no such file or directory' }),
      ],
    });
    expect(result.clusters).toHaveLength(2);
    expect(result.clusters.find((cluster) => cluster.category === 'syntax')?.occurrences).toBe(2);
  });

  it('produces identical cluster ids when input order changes', () => {
    const failures = [
      failure({ file: 'a.py', message: 'SyntaxError: unexpected token at line 1' }),
      failure({ file: 'a.py', message: 'SyntaxError: unexpected token at line 2' }),
      failure({ file: 'c.py', message: 'ENOENT: no such file or directory' }),
    ];
    const first = triageFailures({ graph, failures });
    const second = triageFailures({ graph, failures: [...failures].reverse() });
    expect(first.clusters.map((cluster) => cluster.clusterId)).toEqual(second.clusters.map((cluster) => cluster.clusterId));
  });

  it('computes transitive blast radius and ordered repair targets', () => {
    const result = triageFailures({
      graph,
      failures: [failure({ file: 'a.py', message: 'SyntaxError: unexpected token' })],
    });
    const cluster = result.clusters[0];
    expect(cluster.blastRadius).toBe(2);
    expect(result.occurrences[0]?.targets).toEqual(['a.py', 'b.py']);
  });

  it('suppresses a cluster after two failed repairs', () => {
    const input = failure({ file: 'a.py', message: 'SyntaxError: unexpected token' });
    const signature = failureSignature(input);
    const result = triageFailures({
      graph,
      failures: [input],
      existing: [
        {
          clusterId: 'cluster-1',
          category: 'syntax',
          language: 'python',
          representative: signature,
          signatures: [signature],
          occurrences: 1,
          blastRadius: 0,
          repairFailures: 2,
          suppressed: false,
        },
      ],
    });
    expect(result.clusters[0]?.suppressed).toBe(true);
    expect(result.suppressedSignatures).toContain(signature);
    expect(result.refusals.map((refusal) => refusal.code)).toContain('E_REPAIR_STALLED');
  });

  it('refuses a new cluster when the 200-cluster cap is reached', () => {
    const result = triageFailures({
      graph,
      maxClusters: 1,
      failures: [
        failure({ file: 'a.py', message: 'SyntaxError: unexpected token' }),
        failure({ file: 'b.py', message: 'ENOENT: no such file or directory' }),
      ],
    });
    expect(result.refusals.map((refusal) => refusal.code)).toContain('E_FSN_CLUSTER_LIMIT');
  });
});
