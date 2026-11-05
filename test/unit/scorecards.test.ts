import { describe, expect, it } from 'vitest';
import {
  evaluateScorecards,
  ScorecardInputError,
  type SpecialistScorecard,
} from '../../src/server/analysis/scorecards';

function card(
  specialist: SpecialistScorecard['specialist'],
  scores: { architecture: number; risk: number; testability: number; clarity: number },
): SpecialistScorecard {
  return {
    specialist,
    ...scores,
    evidenceRefs: [`evidence:${specialist}`],
  };
}

const aligned: SpecialistScorecard[] = [
  card('architect', { architecture: 5, risk: 3, testability: 4, clarity: 2 }),
  card('risk-auditor', { architecture: 5, risk: 3, testability: 4, clarity: 2 }),
  card('testability-engineer', { architecture: 5, risk: 3, testability: 4, clarity: 2 }),
  card('clarity-editor', { architecture: 5, risk: 3, testability: 4, clarity: 2 }),
];

describe('specialist scorecards', () => {
  it('reports zero debate for aligned specialists and preserves evidence', () => {
    const result = evaluateScorecards({ scorecards: aligned });
    expect(result.variance).toBe(0);
    expect(result.needsDebate).toBe(false);
    expect(result.missing).toEqual([]);
    expect(result.scorecards).toHaveLength(4);
    expect(result.scorecards.map((entry) => entry.specialist)).toEqual([
      'architect',
      'risk-auditor',
      'testability-engineer',
      'clarity-editor',
    ]);
    expect(result.scorecards[0].evidenceRefs).toEqual(['evidence:architect']);
    expect(result).not.toHaveProperty('consensus');
    expect(result).not.toHaveProperty('truth');
  });

  it('triggers debate at the default 1.5 max-min disagreement', () => {
    const result = evaluateScorecards({
      scorecards: [
        card('architect', { architecture: 5, risk: 3, testability: 3, clarity: 3 }),
        card('risk-auditor', { architecture: 3, risk: 3, testability: 3, clarity: 3 }),
        card('testability-engineer', { architecture: 3, risk: 3, testability: 3, clarity: 3 }),
        card('clarity-editor', { architecture: 3, risk: 3, testability: 3, clarity: 3 }),
      ],
    });
    expect(result.variance).toBe(2);
    expect(result.needsDebate).toBe(true);
  });

  it('uses the maximum per-dimension range, not global cross-dimension range', () => {
    const result = evaluateScorecards({
      scorecards: [
        card('architect', { architecture: 5, risk: 3, testability: 5, clarity: 1 }),
        card('risk-auditor', { architecture: 5, risk: 3, testability: 5, clarity: 1 }),
        card('testability-engineer', { architecture: 5, risk: 3, testability: 5, clarity: 1 }),
        card('clarity-editor', { architecture: 5, risk: 3, testability: 5, clarity: 1 }),
      ],
    });
    expect(result.variance).toBe(0);
    expect(result.needsDebate).toBe(false);
  });

  it('applies a custom threshold at the boundary', () => {
    const scores = [
      card('architect', { architecture: 5, risk: 3, testability: 3, clarity: 3 }),
      card('risk-auditor', { architecture: 3, risk: 3, testability: 3, clarity: 3 }),
      card('testability-engineer', { architecture: 3, risk: 3, testability: 3, clarity: 3 }),
      card('clarity-editor', { architecture: 3, risk: 3, testability: 3, clarity: 3 }),
    ];
    expect(evaluateScorecards({ scorecards: scores, threshold: 2 }).needsDebate).toBe(true);
    expect(evaluateScorecards({ scorecards: scores, threshold: 2.1 }).needsDebate).toBe(false);
  });

  it('flags missing specialists even when the supplied scores agree', () => {
    const result = evaluateScorecards({ scorecards: aligned.slice(0, 2) });
    expect(result.missing).toEqual(['testability-engineer', 'clarity-editor']);
    expect(result.needsDebate).toBe(true);
    expect(result.variance).toBe(0);
  });

  it('sorts shuffled input into the canonical specialist order', () => {
    const result = evaluateScorecards({ scorecards: [...aligned].reverse() });
    expect(result.scorecards.map((entry) => entry.specialist)).toEqual([
      'architect',
      'risk-auditor',
      'testability-engineer',
      'clarity-editor',
    ]);
  });

  it('rejects duplicate specialists', () => {
    expect(() =>
      evaluateScorecards({ scorecards: [aligned[0], aligned[0]] }),
    ).toThrowError(ScorecardInputError);
  });

  it('rejects unknown specialists, non-integer scores, and out-of-range scores', () => {
    expect(() =>
      evaluateScorecards({ scorecards: [{ ...aligned[0], specialist: 'unknown' as never }] }),
    ).toThrowError(ScorecardInputError);
    expect(() =>
      evaluateScorecards({
        scorecards: [{ ...aligned[0], architecture: 1.5 }],
      }),
    ).toThrowError(ScorecardInputError);
    expect(() =>
      evaluateScorecards({
        scorecards: [{ ...aligned[0], clarity: 6 }],
      }),
    ).toThrowError(ScorecardInputError);
  });

  it('rejects a scorecard without evidence references', () => {
    expect(() =>
      evaluateScorecards({ scorecards: [{ ...aligned[0], evidenceRefs: [] }] }),
    ).toThrowError(ScorecardInputError);
    expect(() =>
      evaluateScorecards({ scorecards: [{ ...aligned[0], evidenceRefs: [' '] }] }),
    ).toThrowError(ScorecardInputError);
  });

  it('handles an empty board by requiring all four specialists', () => {
    const result = evaluateScorecards({ scorecards: [] });
    expect(result.variance).toBe(0);
    expect(result.needsDebate).toBe(true);
    expect(result.missing).toEqual([
      'architect',
      'risk-auditor',
      'testability-engineer',
      'clarity-editor',
    ]);
    expect(result.scorecards).toEqual([]);
  });
});
