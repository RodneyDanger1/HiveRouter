import type { DatabaseSync } from 'node:sqlite';
import type { LearningProvenance } from './contracts.js';
import { classifyFailure, type FailureCategory } from './signatures.js';
import { readTracePreview, type TracePreview } from './trace-store.js';

interface TraceRow {
  id: string;
  run_id: string;
  agent_id: string | null;
  phase: string | null;
  failure_signature: string;
  provenance: string;
  verifier_json: string;
  created_at: string;
}

export interface FailureCluster {
  signature: string;
  category: FailureCategory;
  count: number;
  distinctRuns: number;
  liveRuns: number;
  mockRuns: number;
  humanRuns: number;
  syntheticRuns: number;
  firstSeen: string;
  lastSeen: string;
  eligible: boolean;
  representativeTraceIds: string[];
  previews: TracePreview[];
}

export interface MiningOptions {
  minRuns?: number;
  minLive?: number;
  limit?: number;
  previewRoot?: string;
}

function failureText(row: TraceRow): string {
  try {
    const parsed = JSON.parse(row.verifier_json) as unknown;
    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>;
      const candidate = record.error ?? record.message ?? record.detail ?? record.reason;
      if (typeof candidate === 'string') return candidate;
    }
  } catch {
    // fall through to raw verifier text
  }
  return row.verifier_json;
}

export function mineFailures(
  db: DatabaseSync,
  options: MiningOptions = {},
): FailureCluster[] {
  const minRuns = options.minRuns ?? 3;
  const minLive = options.minLive ?? 1;
  const limit = Math.min(Math.max(options.limit ?? 200, 1), 200);
  const rows = db
    .prepare(
      `SELECT id, run_id, agent_id, phase, failure_signature, provenance, verifier_json, created_at
       FROM traces
       WHERE outcome = 'failure' AND failure_signature IS NOT NULL
       ORDER BY created_at ASC`,
    )
    .all() as unknown as TraceRow[];

  const groups = new Map<string, TraceRow[]>();
  for (const row of rows) {
    const list = groups.get(row.failure_signature) ?? [];
    list.push(row);
    groups.set(row.failure_signature, list);
  }

  const clusters: FailureCluster[] = [];
  for (const [signature, group] of groups) {
    const distinctRuns = new Set(group.map((row) => row.run_id)).size;
    const provenanceCount = (value: LearningProvenance) =>
      group.filter((row) => row.provenance === value).length;
    const liveRuns = provenanceCount('live');
    const mockRuns = provenanceCount('mock');
    const humanRuns = provenanceCount('human');
    const syntheticRuns = provenanceCount('synthetic');
    const sorted = [...group].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const representativeTraceIds = sorted.slice(0, 3).map((row) => row.id);
    const previews = representativeTraceIds
      .map((traceId) => readTracePreview(traceId, { previewRoot: options.previewRoot }))
      .filter((preview): preview is TracePreview => preview !== null);
    const firstSeen = group.reduce(
      (min, row) => (row.created_at < min ? row.created_at : min),
      group[0]!.created_at,
    );
    const lastSeen = group.reduce(
      (max, row) => (row.created_at > max ? row.created_at : max),
      group[0]!.created_at,
    );
    clusters.push({
      signature,
      category: classifyFailure(failureText(group[0]!)),
      count: group.length,
      distinctRuns,
      liveRuns,
      mockRuns,
      humanRuns,
      syntheticRuns,
      firstSeen,
      lastSeen,
      eligible: distinctRuns >= minRuns && liveRuns >= minLive,
      representativeTraceIds,
      previews,
    });
  }

  clusters.sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    return a.signature.localeCompare(b.signature);
  });
  return clusters.slice(0, limit);
}

export function eligibleClusters(
  db: DatabaseSync,
  options: MiningOptions = {},
): FailureCluster[] {
  return mineFailures(db, options).filter((cluster) => cluster.eligible);
}
