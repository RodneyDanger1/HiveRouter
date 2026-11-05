import { describe, expect, it } from 'vitest';
import {
  computeGatePass,
  criticalSafetyFromChecks,
  evaluatePromotionGate,
  evaluateScreening,
  mcnemarExact,
  pairedBootstrap,
  wilson,
  type GateEvidence,
} from '../../src/server/learning/index.js';
import type { PairedOutcome } from '../../src/server/learning/contracts.js';
import type { CheckResult } from '../../src/shared/types.js';

function makePairs(n: number, baselineSuccesses: number, candidateSuccesses: number): PairedOutcome[] {
  const pairs: PairedOutcome[] = [];
  for (let i = 0; i < n; i += 1) {
    pairs.push({
      caseId: `case-${String(i).padStart(3, '0')}`,
      baselinePass: i < baselineSuccesses,
      candidatePass: i < candidateSuccesses,
      baselineCostUsd: 0.01,
      candidateCostUsd: 0.01,
      candidateCriticalSafety: false,
    });
  }
  return pairs;
}

function evidence(pairs: PairedOutcome[], overrides: Partial<GateEvidence> = {}): GateEvidence {
  return {
    evalRunId: 'eval-1',
    suiteId: 'suite-1',
    suiteUseId: 'use-1',
    variantId: 'variant-1',
    variantHash: 'variant-hash',
    baselineVersionId: 'baseline-1',
    activeBaselineVersionId: 'baseline-1',
    candidateFamilyId: 'family-1',
    candidateFamilySize: 1,
    provenance: 'synthetic',
    fingerprintStatus: 'stable',
    evidenceHash: 'same-hash',
    expectedEvidenceHash: 'same-hash',
    pairs,
    excludedPairs: 0,
    model: 'deepseek-flash',
    mode: 'synthetic',
    suiteManifestHash: 'manifest-1',
    ...overrides,
  };
}

describe('learning stats', () => {
  it('computes Wilson intervals with bounds', () => {
    const interval = wilson(25, 50);
    expect(interval.low).toBeGreaterThan(0.3);
    expect(interval.high).toBeLessThan(0.7);
    expect(interval.center).toBe(0.5);
  });

  it('computes the exact McNemar p-value symmetrically', () => {
    expect(mcnemarExact(0, 5)).toBeCloseTo(0.0625, 6);
    expect(mcnemarExact(5, 0)).toBeCloseTo(0.0625, 6);
    expect(mcnemarExact(0, 20)).toBeLessThan(0.001);
  });

  it('is deterministic for a fixed bootstrap seed', () => {
    const pairs = makePairs(50, 10, 40);
    const first = pairedBootstrap(pairs, { iterations: 1000, seed: 42 });
    const second = pairedBootstrap(pairs, { iterations: 1000, seed: 42 });
    expect(first).toEqual(second);
    expect(first.lowerBound).toBeGreaterThan(0.15);
  });

  it('returns insufficient sample at 25 holdout pairs', () => {
    const gate = evaluatePromotionGate(evidence(makePairs(25, 5, 25)), { requireLive: false });
    expect(gate.decision).toBe('refused');
    expect(gate.code).toBe('E_LEARNING_INSUFFICIENT_SAMPLE');
  });

  it('promotes a strong synthetic fixture when live is not required (gate unit only)', () => {
    const gate = evaluatePromotionGate(evidence(makePairs(50, 10, 50)), { requireLive: false });
    expect(gate.decision).toBe('promote_eligible');
    expect(gate.metrics?.n).toBe(50);
    expect(gate.metrics?.lowerBound).toBeGreaterThan(0.15);
  });

  it('refuses mock/synthetic promotion when live is required', () => {
    const gate = evaluatePromotionGate(evidence(makePairs(50, 10, 50)));
    expect(gate.decision).toBe('refused');
    expect(gate.code).toBe('E_LEARNING_PROMOTION_REFUSED');
  });

  it('refuses tampered evidence hashes', () => {
    const gate = evaluatePromotionGate(
      evidence(makePairs(50, 10, 50), { evidenceHash: 'actual', expectedEvidenceHash: 'expected' }),
      { requireLive: false },
    );
    expect(gate.code).toBe('E_LEARNING_EVIDENCE_TAMPERED');
  });

  it('handles changed and unavailable fingerprints', () => {
    const changed = evaluatePromotionGate(
      evidence(makePairs(50, 10, 50), { fingerprintStatus: 'changed' }),
      { requireLive: false },
    );
    expect(changed.decision).toBe('inconclusive');
    const unavailable = evaluatePromotionGate(
      evidence(makePairs(50, 10, 50), { fingerprintStatus: 'unavailable' }),
      { requireLive: false },
    );
    expect(unavailable.code).toBe('E_LEARNING_VERSION_DRIFT');
  });

  it('does not promote a no-effect candidate', () => {
    const gate = evaluatePromotionGate(evidence(makePairs(50, 25, 25)), { requireLive: false });
    expect(gate.decision).toBe('no_promotion');
    expect(gate.metrics?.lowerBound).toBeLessThan(0.15);
  });

  it('exposes screening metrics with paired counts', () => {
    const metrics = evaluateScreening(makePairs(50, 10, 40), { alpha: 0.05 });
    expect(metrics.n).toBe(50);
    expect(metrics.baselineRate).toBeCloseTo(0.2, 6);
    expect(metrics.candidateRate).toBeCloseTo(0.8, 6);
    expect(metrics.discordantCandidatePass).toBe(30);
  });
});

describe('gatePass metric', () => {
  const check = (id: string, status: CheckResult['status'], mandatory = true): CheckResult => ({
    id,
    status,
    detail: '',
    mandatory,
  });

  it('passes only when mandatory checks, syntax, files, and safety all hold', () => {
    const ok = computeGatePass({
      checks: [check('syntax', 'pass'), check('secret', 'pass')],
      plannedFiles: ['src/a.py'],
      generatedFiles: ['src/a.py'],
      criticalSafety: false,
      syntaxPass: true,
    });
    expect(ok.pass).toBe(true);

    expect(
      computeGatePass({
        checks: [check('syntax', 'fail')],
        plannedFiles: ['src/a.py'],
        generatedFiles: ['src/a.py'],
        criticalSafety: false,
        syntaxPass: true,
      }).pass,
    ).toBe(false);
    expect(
      computeGatePass({
        checks: [check('syntax', 'pass')],
        plannedFiles: ['src/a.py', 'src/b.py'],
        generatedFiles: ['src/a.py'],
        criticalSafety: false,
        syntaxPass: true,
      }).pass,
    ).toBe(false);
    expect(
      computeGatePass({
        checks: [check('syntax', 'pass')],
        plannedFiles: ['src/a.py'],
        generatedFiles: ['src/a.py'],
        criticalSafety: true,
        syntaxPass: true,
      }).pass,
    ).toBe(false);
    expect(
      computeGatePass({
        checks: [check('syntax', 'pass')],
        plannedFiles: ['src/a.py'],
        generatedFiles: ['src/a.py'],
        criticalSafety: false,
        syntaxPass: false,
      }).pass,
    ).toBe(false);
    expect(
      computeGatePass({
        checks: [],
        plannedFiles: [],
        generatedFiles: [],
        criticalSafety: false,
        syntaxPass: true,
      }).pass,
    ).toBe(false);
  });

  it('detects a critical safety failure from a failed mandatory check', () => {
    expect(criticalSafetyFromChecks([check('secret-scan', 'fail')])).toBe(true);
    expect(criticalSafetyFromChecks([check('lint', 'fail', false)])).toBe(false);
  });
});
