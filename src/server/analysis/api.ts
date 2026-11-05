import type { DominatorInput } from './dominators.js';
import type { ScorecardsInput, SpecialistScorecard } from './scorecards.js';
import { SCORECARD_DIMENSIONS, SCORECARD_SPECIALISTS } from './scorecards.js';

export class AnalysisInputError extends Error {
  readonly code = 'E_ANALYSIS_INVALID_INPUT';

  constructor(message: string) {
    super(message);
    this.name = 'AnalysisInputError';
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AnalysisInputError(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string, max = 512): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) {
    throw new AnalysisInputError(`${label} must be a non-empty string of at most ${max} characters`);
  }
  return value;
}

export function parseDominatorRequest(value: unknown): DominatorInput {
  const body = record(value, 'body');
  const root = string(body.root, 'root');
  if (!Array.isArray(body.edges) || body.edges.length > 5_000) {
    throw new AnalysisInputError('edges must be an array of at most 5000 edge objects');
  }
  const edges = body.edges.map((raw, index) => {
    const edge = record(raw, `edges[${index}]`);
    return { from: string(edge.from, `edges[${index}].from`), to: string(edge.to, `edges[${index}].to`) };
  });
  let nodes: string[] | undefined;
  if (body.nodes !== undefined) {
    if (!Array.isArray(body.nodes) || body.nodes.length > 2_000) {
      throw new AnalysisInputError('nodes must be an array of at most 2000 strings');
    }
    nodes = body.nodes.map((node, index) => string(node, `nodes[${index}]`));
  }
  let maxIterations: number | undefined;
  if (body.maxIterations !== undefined) {
    if (typeof body.maxIterations !== 'number' || !Number.isInteger(body.maxIterations) || body.maxIterations < 1 || body.maxIterations > 100_000) {
      throw new AnalysisInputError('maxIterations must be an integer in [1,100000]');
    }
    maxIterations = body.maxIterations;
  }
  return { root, edges, ...(nodes ? { nodes } : {}), ...(maxIterations ? { maxIterations } : {}) };
}

export function parseScorecardsRequest(value: unknown): ScorecardsInput {
  const body = record(value, 'body');
  if (!Array.isArray(body.scorecards) || body.scorecards.length === 0 || body.scorecards.length > 4) {
    throw new AnalysisInputError('scorecards must contain between 1 and 4 scorecards');
  }
  const scorecards = body.scorecards.map((raw, index) => {
    const card = record(raw, `scorecards[${index}]`);
    const specialist = string(card.specialist, `scorecards[${index}].specialist`);
    if (!(SCORECARD_SPECIALISTS as readonly string[]).includes(specialist)) {
      throw new AnalysisInputError(`unknown specialist: ${specialist}`);
    }
    const scores: Record<string, number> = {};
    for (const dimension of SCORECARD_DIMENSIONS) {
      const score = card[dimension];
      if (typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > 5) {
        throw new AnalysisInputError(`scorecards[${index}].${dimension} must be an integer in [1,5]`);
      }
      scores[dimension] = score;
    }
    if (!Array.isArray(card.evidenceRefs) || card.evidenceRefs.length === 0 || card.evidenceRefs.length > 20) {
      throw new AnalysisInputError(`scorecards[${index}].evidenceRefs must contain 1..20 strings`);
    }
    const evidenceRefs = card.evidenceRefs.map((ref, refIndex) => string(ref, `scorecards[${index}].evidenceRefs[${refIndex}]`));
    return {
      specialist: specialist as SpecialistScorecard['specialist'],
      architecture: scores.architecture,
      risk: scores.risk,
      testability: scores.testability,
      clarity: scores.clarity,
      evidenceRefs,
    } satisfies SpecialistScorecard;
  });
  let threshold: number | undefined;
  if (body.threshold !== undefined) {
    if (typeof body.threshold !== 'number' || !Number.isFinite(body.threshold) || body.threshold < 0 || body.threshold > 5) {
      throw new AnalysisInputError('threshold must be a finite number in [0,5]');
    }
    threshold = body.threshold;
  }
  return { scorecards, ...(threshold !== undefined ? { threshold } : {}) };
}
