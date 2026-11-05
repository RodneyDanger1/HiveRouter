import { describe, expect, it } from 'vitest';
import { RiskFile } from '../../src/shared/algorithms';
import { planVerification } from '../../src/server/quality/rvs';
import { computeConfidence, intervalDecision } from '../../src/server/quality/confidence';

function file(overrides: Partial<RiskFile> & { path: string; language: string; riskTier: RiskFile['riskTier'] }): RiskFile {
  return {
    path: overrides.path,
    language: overrides.language,
    riskTier: overrides.riskTier,
    requiredChecks: overrides.requiredChecks ?? [],
  };
}

describe('RVS', () => {
  it('makes syntax mandatory for every code file, including T2', () => {
    const plan = planVerification({
      files: [file({ path: 'src/util.py', language: 'python', riskTier: 'T2' })],
      budgetMs: 1000,
    });
    const syntax = plan.checks.find((check) => check.checkId === 'syntax.python');
    expect(syntax?.mandatory).toBe(true);
    expect(syntax?.status).toBe('planned');
    expect(plan.mandatoryEstimatedMs).toBeGreaterThan(0);
  });

  it('uses markdown.structure for docs and does not require Python syntax for them', () => {
    const plan = planVerification({
      files: [file({ path: 'docs/readme.md', language: 'markdown', riskTier: 'T3' })],
      budgetMs: 1000,
      availableChecks: ['path.safety', 'secret.scan', 'plan.coverage', 'markdown.structure'],
    });
    expect(plan.checks.some((check) => check.checkId === 'markdown.structure')).toBe(true);
    expect(plan.checks.some((check) => check.checkId === 'syntax.python')).toBe(false);
  });

  it('runs mandatory checks over budget and skips only optional checks', () => {
    const plan = planVerification({
      files: [file({ path: 'src/main.py', language: 'python', riskTier: 'T0' })],
      budgetMs: 1,
    });
    expect(plan.overBudget).toBe(true);
    expect(plan.checks.some((check) => check.mandatory)).toBe(true);
    expect(plan.skipped.some((row) => row.reason === 'budget')).toBe(true);
  });

  it('requires a syntax check for every code language in a mixed file set', () => {
    const plan = planVerification({
      files: [
        file({ path: 'src/a.py', language: 'python', riskTier: 'T2' }),
        file({ path: 'src/b.ts', language: 'typescript', riskTier: 'T2' }),
        file({ path: 'src/c.js', language: 'javascript', riskTier: 'T2' }),
        file({ path: 'src/d.json', language: 'json', riskTier: 'T2' }),
      ],
      budgetMs: 1000,
    });
    const syntax = plan.checks.filter((check) => check.checkId.startsWith('syntax.')).map((check) => check.checkId);
    expect(syntax).toEqual(expect.arrayContaining(['syntax.python', 'syntax.typescript', 'syntax.javascript', 'syntax.json']));
    expect(plan.checks.filter((check) => check.checkId.startsWith('syntax.')).every((check) => check.mandatory)).toBe(true);
  });

  it('marks an unavailable mandatory check unverified, never pass', () => {
    const plan = planVerification({
      files: [file({ path: 'src/main.py', language: 'python', riskTier: 'T1' })],
      budgetMs: 1000,
      availableChecks: ['path.safety', 'secret.scan', 'plan.coverage', 'stub.scan'],
    });
    const syntax = plan.checks.find((check) => check.checkId === 'syntax.python');
    expect(syntax?.status).toBe('unverified');
    expect(plan.refusals.map((refusal) => refusal.code)).toContain('E_VERIFY_TOOL_UNAVAILABLE');
  });

  it('orders mandatory checks before optional checks', () => {
    const plan = planVerification({
      files: [file({ path: 'src/main.py', language: 'python', riskTier: 'T0' })],
      budgetMs: 1000,
    });
    const firstOptional = plan.checks.findIndex((check) => !check.mandatory);
    if (firstOptional >= 0) {
      expect(plan.checks.slice(firstOptional).every((check) => !check.mandatory)).toBe(true);
    }
  });
});

describe('CCA', () => {
  it('uses half-open intervals at the boundaries', () => {
    expect(intervalDecision(0.75)).toBe('accept');
    expect(intervalDecision(0.749)).toBe('retry');
    expect(intervalDecision(0.45)).toBe('retry');
    expect(intervalDecision(0.449)).toBe('needs_review');
    expect(intervalDecision(0.25)).toBe('needs_review');
    expect(intervalDecision(0.249)).toBe('reject');
  });

  it('never accepts when a mandatory check failed', () => {
    const result = computeConfidence({
      taskId: 'task-1',
      verification: 1,
      review: 1,
      schema: 1,
      finish: 1,
      routePrior: 1,
      mandatoryFailed: true,
    });
    expect(result.decision).not.toBe('accept');
    expect(result.decision).toBe('retry');
  });

  it('abstains and caps at needs_review when a mandatory check is unverified', () => {
    const result = computeConfidence({
      taskId: 'task-1',
      verification: 1,
      review: 1,
      schema: 1,
      finish: 1,
      routePrior: 1,
      mandatoryUnverified: true,
    });
    expect(result.abstained).toBe(true);
    expect(result.decision).not.toBe('accept');
    expect(result.refusal?.code).toBe('E_CONFIDENCE_ABSTAIN');
  });

  it('is provisional when a component is missing', () => {
    const result = computeConfidence({
      taskId: 'task-1',
      verification: 1,
      schema: 1,
      finish: 1,
      routePrior: 1,
    });
    expect(result.provisional).toBe(true);
    expect(result.decision).toBe('needs_review');
    expect(result.abstained).toBe(true);
  });

  it('renormalizes present weights instead of treating missing components as zero', () => {
    const result = computeConfidence({
      taskId: 'task-1',
      verification: 1,
      review: 1,
      schema: 1,
      finish: 1,
      routePrior: 1,
    });
    expect(result.raw).toBe(1);
    expect(result.decision).toBe('accept');
  });
});
