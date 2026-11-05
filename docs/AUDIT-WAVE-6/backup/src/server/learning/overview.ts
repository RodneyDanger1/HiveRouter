import type { DatabaseSync } from 'node:sqlite';
import { MIN_SEALED_BLOCKS } from './contracts.js';
import { consentMatrix } from './consent.js';

export interface LearningOverviewView {
  enabled: boolean;
  reason?: string;
  consentRequired: boolean;
  phase: string;
  screeningLabel: string;
  counts: {
    traces: number;
    failures: number | null;
    datasets: number | null;
    sealedBlocks: number;
    completeSealedBlocks: number;
    candidates: number | null;
    evaluations: number | null;
    promotions: number | null;
    audit: number | null;
  };
  consent: { traceRetention: boolean; caseToProviderEval: boolean; dshKey: false };
  consentScopes: ReturnType<typeof consentMatrix>;
  lastEvalAt: string | null;
}

function count(db: DatabaseSync, table: string): number | null {
  try {
    return Number((db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n);
  } catch {
    return null;
  }
}

/**
 * The UI must not treat an incomplete block, a revoked consent, or an
 * unrelated consent scope as readiness. This is derived from the same
 * complete-block/active-consent rules the evaluation services enforce.
 */
export function buildLearningOverview(database: DatabaseSync, phase: string): LearningOverviewView {
  const totalBlocks = count(database, 'sealed_pool_blocks') ?? 0;
  let completeBlocks = 0;
  try {
    completeBlocks = Number(
      (
        database
          .prepare(
            `SELECT COUNT(*) AS n
             FROM sealed_pool_blocks b
             WHERE b.status = 'ready'
               AND (SELECT COUNT(*) FROM sealed_pool p WHERE p.block_id = b.block_id) = 65`,
          )
          .get() as { n: number }
      ).n,
    );
  } catch {
    completeBlocks = 0;
  }
  const traces = count(database, 'traces') ?? 0;
  const consents = consentMatrix(database);
  const traceRetention = consents.trace_retention.active;
  const caseToProviderEval = consents.case_to_provider_eval.active;
  const enabled = completeBlocks >= MIN_SEALED_BLOCKS && caseToProviderEval && traces >= 3;
  const reason = completeBlocks < MIN_SEALED_BLOCKS
    ? 'E_LEARNING_POOL_EXHAUSTED'
    : !caseToProviderEval
      ? 'E_LEARNING_CONSENT_REQUIRED'
      : traces < 3
        ? 'E_LEARNING_INSUFFICIENT_SAMPLE'
        : undefined;
  let lastEvalAt: string | null = null;
  try {
    lastEvalAt = (database.prepare('SELECT MAX(started_at) AS at FROM eval_runs').get() as { at: string | null }).at;
  } catch {
    lastEvalAt = null;
  }
  return {
    enabled,
    reason,
    consentRequired: !caseToProviderEval,
    phase,
    screeningLabel: 'Screening-grade, low power; no general-quality claim; no promotion expected.',
    counts: {
      traces,
      failures: count(database, 'failure_signatures'),
      datasets: count(database, 'eval_suites'),
      sealedBlocks: totalBlocks,
      completeSealedBlocks: completeBlocks,
      candidates: count(database, 'variants'),
      evaluations: count(database, 'eval_runs'),
      promotions: count(database, 'promotions'),
      audit: count(database, 'learning_audit'),
    },
    consent: { traceRetention, caseToProviderEval, dshKey: false },
    consentScopes: consents,
    lastEvalAt,
  };
}
