import { describe, expect, it } from 'vitest';
import {
  normalizeRepairPath,
  planRepair,
  type RepairFailure,
} from '../../src/server/logic/repair-plan';

function failure(overrides: Partial<RepairFailure> = {}): RepairFailure {
  return {
    checkId: 'syntax',
    code: 'PARSE_ERROR',
    file: 'src/a.ts',
    severity: 'high',
    ...overrides,
  };
}

describe('LG3 repair-plan — normalization and dedupe', () => {
  it('normalizes separators but refuses traversal, absolute paths, ADS, and reserved names', () => {
    expect(normalizeRepairPath('src\\a.ts')).toBe('src/a.ts');
    expect(normalizeRepairPath('./src/a.ts')).toBe('src/a.ts');
    expect(normalizeRepairPath('../etc/passwd')).toBeNull();
    expect(normalizeRepairPath('C:\\Windows\\system.ini')).toBeNull();
    expect(normalizeRepairPath('src/file.ts:stream')).toBeNull();
    expect(normalizeRepairPath('src/CON.ts')).toBeNull();
    expect(normalizeRepairPath('src/a.ts.')).toBeNull();
    expect(normalizeRepairPath('src/a/b/c/d/e/f/g/h/i.ts')).toBeNull();
  });

  it('deduplicates the same signature even when line numbers differ', () => {
    const plan = planRepair(
      [
        failure({ line: 1 }),
        failure({ line: 99 }),
        failure({ file: 'src/b.ts', line: 2 }),
      ],
      { attempts: 0, maxAttempts: 2 },
    );
    expect(plan.status).toBe('planned');
    expect(plan.actions).toHaveLength(2);
    expect(plan.suppressed).toBe(1);
    expect(plan.actions.map((a) => a.file).sort()).toEqual(['src/a.ts', 'src/b.ts']);
  });
});

describe('LG3 repair-plan — deterministic priority', () => {
  it('orders severity desc, depth desc, then lexical path asc', () => {
    const plan = planRepair(
      [
        failure({ file: 'src/a.ts', severity: 'high' }),
        failure({ file: 'src/z.ts', severity: 'critical' }),
        failure({ file: 'src/deep.ts', severity: 'critical' }),
        failure({ file: 'src/x.ts', severity: 'medium' }),
      ],
      {
        attempts: 0,
        maxAttempts: 2,
        fileDepth: { 'src/deep.ts': 4, 'src/z.ts': 1 },
      },
    );
    expect(plan.status).toBe('planned');
    expect(plan.actions.map((a) => a.file)).toEqual([
      'src/deep.ts',
      'src/z.ts',
      'src/a.ts',
      'src/x.ts',
    ]);
  });

  it('caps the plan at five actions and reports suppressed work', () => {
    const failures = Array.from({ length: 8 }, (_, i) =>
      failure({ file: `src/f${i}.ts`, checkId: `check-${i}`, code: `CODE_${i}` }),
    );
    const plan = planRepair(failures, { attempts: 0, maxAttempts: 2 });
    expect(plan.status).toBe('planned');
    expect(plan.actions).toHaveLength(5);
    expect(plan.suppressed).toBe(3);
  });

  it('uses an explicit owner map, otherwise a manual action', () => {
    const plan = planRepair(
      [
        failure({ file: 'src/a.ts', checkId: 'secret.scan' }),
        failure({ file: 'src/unknown.ts', checkId: 'syntax', code: 'X' }),
      ],
      {
        attempts: 0,
        maxAttempts: 2,
        fileOwners: { 'src/a.ts': 'sentinel' },
      },
    );
    const sentinel = plan.actions.find((a) => a.file === 'src/a.ts');
    const manual = plan.actions.find((a) => a.file === 'src/unknown.ts');
    expect(sentinel?.kind).toBe('patch');
    expect(sentinel?.agentId).toBe('sentinel');
    expect(manual?.kind).toBe('manual');
    expect(manual?.agentId).toBeNull();
  });

  it('maps gatekeeper failures to an add_test action', () => {
    const plan = planRepair(
      [failure({ file: 'tests/test_a.py', checkId: 'test.assert', code: 'FAIL' })],
      { attempts: 0, maxAttempts: 2, fileOwners: { 'tests/test_a.py': 'gatekeeper' } },
    );
    expect(plan.actions[0].kind).toBe('add_test');
  });
});

describe('LG3 repair-plan — exhausted and stalled boundaries', () => {
  it('returns budget-exhausted with no actions when attempts are spent', () => {
    const plan = planRepair([failure()], { attempts: 2, maxAttempts: 2 });
    expect(plan.status).toBe('exhausted');
    expect(plan.code).toBe('E_REPAIR_BUDGET_EXHAUSTED');
    expect(plan.actions).toHaveLength(0);
  });

  it('returns stalled when the same plan signature repeats', () => {
    const first = planRepair([failure()], { attempts: 0, maxAttempts: 2 });
    expect(first.planSignature).not.toBeNull();
    const second = planRepair([failure()], {
      attempts: 1,
      maxAttempts: 2,
      lastSignature: first.planSignature,
    });
    expect(second.status).toBe('exhausted');
    expect(second.code).toBe('E_REPAIR_STALLED');
  });

  it('returns unsafe-target exhausted when every target fails lexical safety', () => {
    const plan = planRepair(
      [failure({ file: '../escape.ts' }), failure({ file: 'C:\\abs.ts' })],
      { attempts: 0, maxAttempts: 2 },
    );
    expect(plan.status).toBe('exhausted');
    expect(plan.code).toBe('E_REPAIR_UNSAFE_TARGET');
  });

  it('returns nothing_to_repair when there are no failures', () => {
    const plan = planRepair([], { attempts: 0, maxAttempts: 2 });
    expect(plan.status).toBe('nothing_to_repair');
    expect(plan.code).toBeNull();
    expect(plan.actions).toHaveLength(0);
  });

  it('rejects malformed failures and invalid contexts at the boundary', () => {
    expect(() => planRepair([{ ...failure(), severity: 'nope' } as never], { attempts: 0, maxAttempts: 2 })).toThrow();
    expect(() => planRepair([failure()], { attempts: 3, maxAttempts: 2 } as never)).toThrow();
    expect(() => planRepair([failure()], { attempts: 0, maxAttempts: 2, maxActions: 0 } as never)).toThrow();
  });
});
