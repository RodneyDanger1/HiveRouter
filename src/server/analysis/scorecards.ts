/**
 * Specialist scorecards for a debate-budget trigger.
 *
 * These scores are opinions with evidence references. They are NOT a
 * consensus, a truth score, a quality certificate, or a promotion gate. The
 * only product decision here is whether disagreement is wide enough to spend
 * debate budget; `needsDebate` is a scheduler hint, not a verdict.
 */

export const SCORECARD_SPECIALISTS = [
  'architect',
  'risk-auditor',
  'testability-engineer',
  'clarity-editor',
] as const;

export type ScorecardSpecialist = (typeof SCORECARD_SPECIALISTS)[number];

export const SCORECARD_DIMENSIONS = [
  'architecture',
  'risk',
  'testability',
  'clarity',
] as const;

export type ScorecardDimension = (typeof SCORECARD_DIMENSIONS)[number];

export interface SpecialistScorecard {
  specialist: ScorecardSpecialist;
  /** Integer 1..5. */
  architecture: number;
  /** Integer 1..5. */
  risk: number;
  /** Integer 1..5. */
  testability: number;
  /** Integer 1..5. */
  clarity: number;
  /** Non-empty evidence pointers supporting this opinion. */
  evidenceRefs: string[];
}

export interface ScorecardsInput {
  scorecards: readonly SpecialistScorecard[];
  /** Disagreement threshold; default 1.5 on the 1..5 scale. */
  threshold?: number;
}

export interface ScorecardsResult {
  /** Maximum per-dimension max-min spread across the supplied specialists. */
  variance: number;
  /** True when specialists are missing or the spread reaches the threshold. */
  needsDebate: boolean;
  /** Canonical specialist names without a scorecard. */
  missing: string[];
  /** Canonical, deterministic order; opinions only. */
  scorecards: SpecialistScorecard[];
}

export type ScorecardErrorCode = 'E_SCORECARD_INPUT_INVALID';

export class ScorecardInputError extends Error {
  readonly code: ScorecardErrorCode;

  constructor(message: string) {
    super(message);
    this.name = 'ScorecardInputError';
    this.code = 'E_SCORECARD_INPUT_INVALID';
  }
}

const SPECIALIST_ORDER = new Map<string, number>(SCORECARD_SPECIALISTS.map((name, index) => [name, index]));

function compareSpecialists(a: string, b: string): number {
  return (SPECIALIST_ORDER.get(a) ?? Number.MAX_SAFE_INTEGER) - (SPECIALIST_ORDER.get(b) ?? Number.MAX_SAFE_INTEGER);
}

function assertScore(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5) {
    throw new ScorecardInputError(`${field} must be an integer in [1,5]`);
  }
}

function validateEvidence(evidenceRefs: unknown, specialist: string): string[] {
  if (!Array.isArray(evidenceRefs) || evidenceRefs.length === 0) {
    throw new ScorecardInputError(`${specialist}.evidenceRefs must contain at least one reference`);
  }
  const refs = evidenceRefs.map((ref) => {
    if (typeof ref !== 'string' || ref.trim().length === 0) {
      throw new ScorecardInputError(`${specialist}.evidenceRefs must contain non-empty strings`);
    }
    return ref;
  });
  return refs;
}

function normalizeThreshold(value: number | undefined): number {
  if (value === undefined) return 1.5;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new ScorecardInputError('threshold must be a finite non-negative number');
  }
  return value;
}

/**
 * Evaluate four specialist opinions. `variance` is the largest per-dimension
 * max-min spread, so normal differences between dimensions (e.g. high clarity,
 * low risk) do not trigger debate; only disagreement between specialists does.
 */
export function evaluateScorecards(input: ScorecardsInput): ScorecardsResult {
  if (!input || typeof input !== 'object' || !Array.isArray(input.scorecards)) {
    throw new ScorecardInputError('scorecards must be an array');
  }
  const threshold = normalizeThreshold(input.threshold);
  const seen = new Set<string>();
  const normalized: SpecialistScorecard[] = [];

  for (const card of input.scorecards) {
    if (!card || typeof card !== 'object') {
      throw new ScorecardInputError('each scorecard must be an object');
    }
    const specialist = card.specialist;
    if (typeof specialist !== 'string' || !SPECIALIST_ORDER.has(specialist)) {
      throw new ScorecardInputError(`unknown specialist: ${String(specialist)}`);
    }
    if (seen.has(specialist)) {
      throw new ScorecardInputError(`duplicate specialist: ${specialist}`);
    }
    seen.add(specialist);
    for (const dimension of SCORECARD_DIMENSIONS) {
      assertScore(card[dimension], `${specialist}.${dimension}`);
    }
    normalized.push({
      specialist: specialist as ScorecardSpecialist,
      architecture: card.architecture,
      risk: card.risk,
      testability: card.testability,
      clarity: card.clarity,
      evidenceRefs: validateEvidence(card.evidenceRefs, specialist),
    });
  }

  normalized.sort((a, b) => compareSpecialists(a.specialist, b.specialist));
  const missing = SCORECARD_SPECIALISTS.filter((specialist) => !seen.has(specialist));

  let variance = 0;
  for (const dimension of SCORECARD_DIMENSIONS) {
    if (normalized.length === 0) continue;
    let minimum = 5;
    let maximum = 1;
    for (const card of normalized) {
      minimum = Math.min(minimum, card[dimension]);
      maximum = Math.max(maximum, card[dimension]);
    }
    variance = Math.max(variance, maximum - minimum);
  }

  return {
    variance,
    needsDebate: missing.length > 0 || variance >= threshold,
    missing: [...missing],
    scorecards: normalized,
  };
}
