/**
 * Filename: src/server/pipeline/features.ts
 * Dependencies: src/shared/features.ts
 * Run: imported by src/server/pipeline/run.ts
 *
 * Stage capability map for pipeline-only work. Release A must not write P6a
 * (routing/context/RVS/CCA/failure-memory) or P7 (trace/audit) rows.
 */

import { FEATURES } from '../../shared/features.js';

export interface PipelineFeatures {
  routing: boolean;
  learning: boolean;
}

export interface PipelineCapabilities {
  /** P6a: CCR/route_decisions/route_candidates. */
  routing: boolean;
  /** P6a: CPO/context_packs. */
  contextPacker: boolean;
  /** P6a: RVS/verification_plans. */
  rvs: boolean;
  /** P6a: CCA/confidence_records. */
  cca: boolean;
  /** P6a: FSN/failure_signatures/failure_occurrences. */
  failureMemory: boolean;
  /** P7: traces. */
  trace: boolean;
  /** P7: learning_audit + L4 guard. */
  learningAudit: boolean;
  /** Fallback used when routing is unavailable; null when routing is on. */
  fallback: 'deterministic-engine-map' | null;
  /** Named codes for callers/UI; a disabled operation must refuse, not fake. */
  disabledRefusals: Array<'E_ROUTING_DISABLED' | 'E_LEARNING_DISABLED'>;
}

export function pipelineCapabilities(features: PipelineFeatures = FEATURES): PipelineCapabilities {
  const routing = features.routing === true;
  const learning = features.learning === true;
  return {
    routing,
    contextPacker: routing,
    rvs: routing,
    cca: routing,
    failureMemory: routing,
    trace: learning,
    learningAudit: learning,
    fallback: routing ? null : 'deterministic-engine-map',
    disabledRefusals: [
      ...(routing ? [] : (['E_ROUTING_DISABLED'] as const)),
      ...(learning ? [] : (['E_LEARNING_DISABLED'] as const)),
    ],
  };
}
