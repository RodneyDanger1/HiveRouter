import path from 'node:path';
import { config } from '../config.js';
import { getDb } from '../db/database.js';
import { FEATURES } from '../../shared/features.js';
import { recordError } from '../observability/error-log.js';
import { recordTrace } from '../learning/trace-store.js';
import { getChecks, getRun, usageTotals } from './recorder.js';

/**
 * Terminal trace producer for every terminal path. Kept outside pipeline/run so
 * the run manager can record an interrupted/cancelled/executor-failure trace
 * without importing the pipeline (which would be a cycle). P7-gated.
 */
export function recordRunTerminalTrace(
  runId: string,
  outcome: 'success' | 'failure' | 'cancelled' | 'budget_exceeded',
): boolean {
  if (!FEATURES.learning) return false;
  try {
    const run = getRun(runId);
    if (!run) return false;
    const usage = usageTotals(runId);
    const checks = getChecks(runId);
    recordTrace(getDb(), {
      runId,
      phase: run.phase,
      policyVersionId: run.policyVersionId ?? undefined,
      model: run.model,
      thinking: run.thinking,
      ...(usage.promptTokens != null ? { promptTokens: usage.promptTokens } : {}),
      ...(usage.completionTokens != null ? { completionTokens: usage.completionTokens } : {}),
      ...(usage.cacheHitTokens != null ? { cacheHitTokens: usage.cacheHitTokens } : {}),
      ...(usage.cacheMissTokens != null ? { cacheMissTokens: usage.cacheMissTokens } : {}),
      ...(usage.reasoningTokens != null ? { reasoningTokens: usage.reasoningTokens } : {}),
      ...(usage.costUsd != null ? { costUsd: usage.costUsd } : {}),
      outcome: outcome === 'success' ? 'success' : outcome === 'cancelled' ? 'cancelled' : 'failure',
      ...(run.errorMessage ? { errorMessage: run.errorMessage } : {}),
      verifier: { checks },
      provenance: 'live',
      inputPreview: run.brief.slice(0, 4096),
      ...(run.summary ? { outputPreview: run.summary.slice(0, 4096) } : {}),
    }, { previewRoot: path.join(config.dataDir, 'replay') });
    return true;
  } catch (error) {
    recordError({
      source: 'run',
      code: 'E_TRACE_RECORD_FAILED',
      message: `trace write failed for ${runId}: ${error instanceof Error ? error.message : String(error)}`,
      runId,
    });
    return false;
  }
}
