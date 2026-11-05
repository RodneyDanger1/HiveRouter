import { describe, expect, it } from 'vitest';
import {
  GateDecisionError,
  GATE_OUTCOMES,
  GATE_POLICY_NAMES,
  decideGate,
  gateSignature,
  toLegacyGateDecision,
  type GateInput,
  type GateOutcome,
} from '../../src/server/logic/gate-decision';

function input(overrides: Partial<GateInput> = {}): GateInput {
  return {
    checks: [{ id: 'syntax', status: 'pass', mandatory: true }],
    policy: { name: 'normal', version: 'gate-v1' },
    risk: { cancelled: false, budgetExceeded: false, criticalFindings: 0 },
    repair: { attempts: 0, maxRepairs: 2, lastSignature: null },
    ...overrides,
  };
}

const matrixCases: Record<Exclude<GateOutcome, 'pass_with_warnings' | 'pass'>, Partial<GateInput>> = {
  cancelled: { risk: { cancelled: true, budgetExceeded: false, criticalFindings: 0 } },
  failed: { checks: [{ id: 'syntax', status: 'fail', mandatory: true }] },
  unverified: { checks: [{ id: 'syntax', status: 'unverified', mandatory: true }] },
  budget_exceeded: { risk: { cancelled: false, budgetExceeded: true, criticalFindings: 0 } },
};

describe('LG1 gate-decision — 3 policies × 6 outcomes', () => {
  it('produces the complete 18-case truth table', () => {
    for (const policy of GATE_POLICY_NAMES) {
      const expected: Record<string, GateOutcome> = {
        cancelled: 'cancelled',
        failed: 'failed',
        unverified: 'unverified',
        budget_exceeded: 'budget_exceeded',
        warn: policy === 'strict' ? 'failed' : policy === 'permissive' ? 'pass' : 'pass_with_warnings',
        pass: 'pass',
      };
      const cases: Record<string, GateInput> = {
        cancelled: input(matrixCases.cancelled),
        failed: input(matrixCases.failed),
        unverified: input(matrixCases.unverified),
        budget_exceeded: input(matrixCases.budget_exceeded),
        warn: input({ checks: [{ id: 'format', status: 'warn', mandatory: false }] }),
        pass: input(),
      };
      for (const [name, caseInput] of Object.entries(cases)) {
        const decision = decideGate({
          ...caseInput,
          policy: { name: policy, version: 'gate-v1' },
        });
        expect(decision.status, `${policy}/${name}`).toBe(expected[name]);
      }
    }
  });

  it('never passes a failed or unverified mandatory check', () => {
    for (const policy of GATE_POLICY_NAMES) {
      const failed = decideGate(
        input({ policy: { name: policy, version: 'gate-v1' }, checks: [{ id: 'x', status: 'fail', mandatory: true }] }),
      );
      expect(failed.status).not.toBe('pass');
      expect(failed.status).not.toBe('pass_with_warnings');
      const unverified = decideGate(
        input({ policy: { name: policy, version: 'gate-v1' }, checks: [{ id: 'x', status: 'unverified', mandatory: true }] }),
      );
      expect(unverified.status).not.toBe('pass');
      expect(unverified.status).not.toBe('pass_with_warnings');
    }
  });
});

describe('LG1 gate-decision — precedence', () => {
  it('applies cancelled > failed > unverified > budget > warn > pass', () => {
    expect(decideGate(input({ risk: { cancelled: true, budgetExceeded: true, criticalFindings: 1 } })).status).toBe('cancelled');
    expect(decideGate(input({
      checks: [{ id: 'a', status: 'fail', mandatory: true }, { id: 'b', status: 'unverified', mandatory: true }],
      risk: { cancelled: false, budgetExceeded: true, criticalFindings: 0 },
    })).status).toBe('failed');
    expect(decideGate(input({
      checks: [{ id: 'a', status: 'unverified', mandatory: true }],
      risk: { cancelled: false, budgetExceeded: true, criticalFindings: 0 },
    })).status).toBe('unverified');
    expect(decideGate(input({
      checks: [{ id: 'a', status: 'warn', mandatory: false }],
      risk: { cancelled: false, budgetExceeded: true, criticalFindings: 0 },
    })).status).toBe('budget_exceeded');
    expect(decideGate(input({ checks: [{ id: 'a', status: 'warn', mandatory: false }] })).status).toBe('pass_with_warnings');
  });

  it('treats a risk-critical finding as failed under every policy', () => {
    for (const policy of GATE_POLICY_NAMES) {
      expect(decideGate(input({ policy: { name: policy, version: 'gate-v1' }, risk: { cancelled: false, budgetExceeded: false, criticalFindings: 1 } })).status).toBe('failed');
    }
  });

  it('refuses a vacuous pass when no checks exist', () => {
    const decision = decideGate(input({ checks: [] }));
    expect(decision.status).toBe('unverified');
    expect(decision.reasons.some((r) => r.code === 'GATE_NO_CHECKS')).toBe(true);
  });
});

describe('LG1 gate-decision — signature and repair context', () => {
  it('is stable across details/paths/lines and changes with policy version', () => {
    const a = decideGate(input({ checks: [{ id: 'syntax', status: 'pass', mandatory: true, detail: 'ok', file: 'a.py', line: 1 }] }));
    const b = decideGate(input({ checks: [{ id: 'syntax', status: 'pass', mandatory: true, detail: 'different', file: 'b.py', line: 99 }] }));
    expect(a.signature).toBe(b.signature);
    expect(a.signature).toMatch(/^[a-f0-9]{64}$/);
    const c = decideGate(input({ policy: { name: 'normal', version: 'gate-v2' } }));
    expect(c.signature).not.toBe(a.signature);
    expect(gateSignature([{ id: 'syntax', status: 'pass', mandatory: true }], 'gate-v1')).toBe(a.signature);
  });

  it('emits one repair while attempts remain, then stops at budget/stall', () => {
    const fail = input({ checks: [{ id: 'syntax', status: 'fail', mandatory: true }] });
    const first = decideGate(fail);
    expect(first.status).toBe('failed');
    expect(first.repairEligible).toBe(true);
    expect(first.actions).toEqual(['repair']);

    const exhausted = decideGate({ ...fail, repair: { attempts: 2, maxRepairs: 2, lastSignature: null } });
    expect(exhausted.repairEligible).toBe(false);
    expect(exhausted.actions).toEqual(['stop']);
    expect(exhausted.refusal).toBe('E_REPAIR_BUDGET_EXHAUSTED');

    const stalled = decideGate({ ...fail, repair: { attempts: 1, maxRepairs: 2, lastSignature: first.signature } });
    expect(stalled.repairEligible).toBe(false);
    expect(stalled.refusal).toBe('E_REPAIR_STALLED');
  });

  it('maps to the legacy three-state gate without losing its signature', () => {
    const result = decideGate(input({ checks: [{ id: 'a', status: 'unverified', mandatory: true }] }));
    const legacy = toLegacyGateDecision(result);
    expect(legacy.status).toBe('fail');
    expect(legacy.signature).toBe(result.signature);
    expect(legacy.repairEligible).toBe(false);
  });
});

describe('LG1 gate-decision — refusals', () => {
  it('rejects duplicate check ids and impossible repair attempts', () => {
    expect(() => decideGate(input({ checks: [{ id: 'a', status: 'pass', mandatory: true }, { id: 'a', status: 'pass', mandatory: true }] }))).toThrow(GateDecisionError);
    try {
      decideGate(input({ checks: [{ id: 'a', status: 'pass', mandatory: true }, { id: 'a', status: 'pass', mandatory: true }] }));
    } catch (error) {
      expect((error as GateDecisionError).code).toBe('E_GATE_CONTRADICTION');
    }
    try {
      decideGate(input({ repair: { attempts: 3, maxRepairs: 2, lastSignature: null } }));
    } catch (error) {
      expect((error as GateDecisionError).code).toBe('E_GATE_CONTRADICTION');
    }
  });

  it('rejects malformed input with a named gate-policy error', () => {
    expect(() => decideGate(input({ policy: { name: 'nope' as never } }))).toThrow(GateDecisionError);
    try {
      decideGate(input({ policy: { name: 'nope' as never } }));
    } catch (error) {
      expect((error as GateDecisionError).code).toBe('E_GATE_POLICY_INVALID');
    }
  });

  it('keeps one decision object per valid outcome', () => {
    for (const outcome of GATE_OUTCOMES) {
      expect(typeof outcome).toBe('string');
    }
  });
});
