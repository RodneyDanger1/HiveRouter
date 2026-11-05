/**
 * CCA — conservative confidence and abstention (P6a A4).
 *
 * P6a deliberately has no isotonic/calibration fit: the raw score is a fixed,
 * conservative weighted sum. A failed or unverified mandatory check can never
 * be accepted, regardless of the score. Missing components make the result
 * provisional and cap it at needs_review.
 */
import {
  AlgorithmRefusal,
  CONFIDENCE_WEIGHTS,
  ConfidenceInput,
  ConfidenceInputSchema,
  ConfidenceResult,
  ConfidenceResultSchema,
  clamp,
} from '../../shared/algorithms';

const WEIGHTS = CONFIDENCE_WEIGHTS;
const COMPONENT_KEYS = ['verification', 'review', 'schema', 'finish', 'routePrior'] as const;
type ComponentKey = (typeof COMPONENT_KEYS)[number];

const DECISION_RANK: Record<ConfidenceResult['decision'], number> = {
  reject: 0,
  needs_review: 1,
  retry: 2,
  accept: 3,
};

function capDecision(decision: ConfidenceResult['decision'], cap: ConfidenceResult['decision']): ConfidenceResult['decision'] {
  return DECISION_RANK[decision] <= DECISION_RANK[cap] ? decision : cap;
}

function intervalDecision(raw: number): ConfidenceResult['decision'] {
  if (raw >= 0.75) return 'accept';
  if (raw >= 0.45) return 'retry';
  if (raw >= 0.25) return 'needs_review';
  return 'reject';
}

function refusal(code: AlgorithmRefusal['code'], message: string, details: Record<string, unknown> = {}): AlgorithmRefusal {
  return { code, message, details };
}

export function computeConfidence(raw: unknown): ConfidenceResult {
  const input = ConfidenceInputSchema.parse(raw) as ConfidenceInput;
  const components: Record<ComponentKey, number> = {
    verification: input.verification ?? 0,
    review: input.review ?? 0,
    schema: input.schema ?? 0,
    finish: input.finish ?? 0,
    routePrior: input.routePrior ?? 0,
  };
  const present = COMPONENT_KEYS.filter((key) => input[key] !== undefined);
  const provisional = present.length < COMPONENT_KEYS.length;
  const denominator = present.reduce((sum, key) => sum + WEIGHTS[key], 0);
  const rawScore =
    denominator === 0
      ? 0
      : clamp(
          present.reduce((sum, key) => sum + WEIGHTS[key] * components[key], 0) / denominator,
          0,
          1,
        );

  let decision = intervalDecision(rawScore);
  if (input.mandatoryFailed || input.mandatoryUnverified) {
    decision = capDecision(decision, 'retry');
  }
  if (provisional) {
    decision = capDecision(decision, 'needs_review');
  }

  const abstained = provisional || input.mandatoryUnverified;
  const result: ConfidenceResult = {
    taskId: input.taskId,
    raw: Number(rawScore.toFixed(6)),
    calibrated: Number(rawScore.toFixed(6)),
    components,
    calibrationSource: 'identity',
    calibrationVersion: 'p6a-identity-v1',
    decision,
    threshold: decision === 'accept' ? 0.75 : decision === 'retry' ? 0.45 : decision === 'needs_review' ? 0.25 : 0,
    provisional,
    abstained,
    ...(abstained
      ? {
          refusal: refusal('E_CONFIDENCE_ABSTAIN', 'Confidence is provisional; the run needs review.', {
            provisional,
            mandatoryUnverified: input.mandatoryUnverified,
          }),
        }
      : {}),
  };
  return ConfidenceResultSchema.parse(result);
}

export { intervalDecision, capDecision, WEIGHTS as CCA_WEIGHTS };
