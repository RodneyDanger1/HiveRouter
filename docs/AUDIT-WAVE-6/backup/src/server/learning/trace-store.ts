import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { nowIso } from '../db/database.js';
import { config } from '../config.js';
import { containsSecret, redactString, redactValue, REDACTOR_VERSION } from '../security/redact.js';
import { TERMINAL_STATUSES, type RunStatus } from '../../shared/types.js';
import {
  TraceInputSchema,
  type LearningProvenance,
  type TraceInput,
} from './contracts.js';
import { refuse } from './errors.js';
import { classifyFailure, failureSignature } from './signatures.js';

export interface TraceRecord {
  id: string;
  runId: string;
  stepId: string | null;
  agentId: string | null;
  phase: string | null;
  promptVersion: string | null;
  contextPackId: string | null;
  policyVersionId: string | null;
  model: string;
  thinking: string;
  promptTokens: number | null;
  completionTokens: number | null;
  cacheHitTokens: number | null;
  cacheMissTokens: number | null;
  reasoningTokens: number | null;
  costUsd: number | null;
  latencyMs: number | null;
  outcome: string;
  failureSignature: string | null;
  verifierJson: string;
  repairRound: number | null;
  provenance: LearningProvenance;
  redactionStatus: string;
  userVerdict: string | null;
  editDistance: number | null;
  createdAt: string;
  complete: boolean;
}

interface TraceRow {
  id: string;
  run_id: string;
  step_id: string | null;
  agent_id: string | null;
  phase: string | null;
  prompt_version: string | null;
  context_pack_id: string | null;
  policy_version_id: string | null;
  model: string;
  thinking: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cache_hit_tokens: number | null;
  cache_miss_tokens: number | null;
  reasoning_tokens: number | null;
  cost_usd: number | null;
  latency_ms: number | null;
  outcome: string;
  failure_signature: string | null;
  verifier_json: string;
  repair_round: number | null;
  provenance: string;
  redaction_status: string;
  user_verdict: string | null;
  edit_distance: number | null;
  created_at: string;
  complete: number;
}

export interface TracePreview {
  traceId: string;
  inputPreview: string;
  outputPreview: string;
  redactorVersion: string;
}

function mapTrace(row: TraceRow): TraceRecord {
  return {
    id: row.id,
    runId: row.run_id,
    stepId: row.step_id,
    agentId: row.agent_id,
    phase: row.phase,
    promptVersion: row.prompt_version,
    contextPackId: row.context_pack_id,
    policyVersionId: row.policy_version_id,
    model: row.model,
    thinking: row.thinking,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    cacheHitTokens: row.cache_hit_tokens,
    cacheMissTokens: row.cache_miss_tokens,
    reasoningTokens: row.reasoning_tokens,
    costUsd: row.cost_usd,
    latencyMs: row.latency_ms,
    outcome: row.outcome,
    failureSignature: row.failure_signature,
    verifierJson: row.verifier_json,
    repairRound: row.repair_round,
    provenance: row.provenance as LearningProvenance,
    redactionStatus: row.redaction_status,
    userVerdict: row.user_verdict,
    editDistance: row.edit_distance,
    createdAt: row.created_at,
    complete: row.complete === 1,
  };
}

function previewPath(traceId: string, root: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(traceId)) {
    refuse('E_LEARNING_EVIDENCE_TAMPERED', 'invalid trace id');
  }
  return path.join(root, `${traceId}.json`);
}

export function recordTrace(
  db: DatabaseSync,
  raw: TraceInput,
  options: { previewRoot?: string; now?: () => Date } = {},
): TraceRecord {
  const input = TraceInputSchema.parse(raw);
  const run = db.prepare('SELECT status FROM runs WHERE id = ?').get(input.runId) as
    | { status: string }
    | undefined;
  if (!run) refuse('E_RUN_NOT_FOUND', undefined, { runId: input.runId });
  if (!TERMINAL_STATUSES.has(run.status as RunStatus)) {
    refuse('E_LEARNING_RUN_NOT_TERMINAL', undefined, { runId: input.runId, status: run.status });
  }

  const existing = db
    .prepare('SELECT * FROM traces WHERE run_id = ?')
    .get(input.runId) as TraceRow | undefined;
  const traceId = existing?.id ?? `tr_${crypto.randomUUID()}`;
  const combinedPreview = `${input.inputPreview ?? ''}\n${input.outputPreview ?? ''}`;
  const hadSecret = containsSecret(combinedPreview);
  const redactionStatus =
    input.redactionStatus === 'blocked'
      ? 'blocked'
      : hadSecret || input.redactionStatus === 'redacted'
        ? 'redacted'
        : 'clean';
  const inputPreview = redactString(input.inputPreview ?? '');
  const outputPreview = redactString(input.outputPreview ?? '');
  const verifierJson = JSON.stringify(redactValue(input.verifier ?? {}));
  const category = classifyFailure(input.errorMessage ?? input.outputPreview ?? '');
  const signature =
    input.failureSignature !== undefined
      ? input.failureSignature
      : input.outcome === 'failure'
        ? failureSignature({
            phase: input.phase,
            agentId: input.agentId,
            category,
            message: input.errorMessage ?? input.outputPreview ?? 'unknown failure',
            repairRound: input.repairRound,
          })
        : null;
  const createdAt = nowIso();
  const failureSignatureValue = signature ?? null;

  db.prepare(
    `INSERT INTO traces (
       id, run_id, step_id, agent_id, phase, prompt_version, context_pack_id, policy_version_id,
       model, thinking, prompt_tokens, completion_tokens, cache_hit_tokens, cache_miss_tokens,
       reasoning_tokens, cost_usd, latency_ms, outcome, failure_signature, verifier_json,
       repair_round, provenance, redaction_status, user_verdict, edit_distance, created_at, complete
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
     ON CONFLICT(run_id) DO UPDATE SET
       step_id = excluded.step_id,
       agent_id = excluded.agent_id,
       phase = excluded.phase,
       prompt_version = excluded.prompt_version,
       context_pack_id = excluded.context_pack_id,
       policy_version_id = excluded.policy_version_id,
       model = excluded.model,
       thinking = excluded.thinking,
       prompt_tokens = excluded.prompt_tokens,
       completion_tokens = excluded.completion_tokens,
       cache_hit_tokens = excluded.cache_hit_tokens,
       cache_miss_tokens = excluded.cache_miss_tokens,
       reasoning_tokens = excluded.reasoning_tokens,
       cost_usd = excluded.cost_usd,
       latency_ms = excluded.latency_ms,
       outcome = excluded.outcome,
       failure_signature = excluded.failure_signature,
       verifier_json = excluded.verifier_json,
       repair_round = excluded.repair_round,
       provenance = excluded.provenance,
       redaction_status = excluded.redaction_status,
       user_verdict = excluded.user_verdict,
       edit_distance = excluded.edit_distance,
       created_at = excluded.created_at,
       complete = 1`,
  ).run(
    traceId,
    input.runId,
    input.stepId ?? null,
    input.agentId ?? null,
    input.phase ?? null,
    input.promptVersion ?? null,
    input.contextPackId ?? null,
    input.policyVersionId ?? null,
    input.model,
    input.thinking,
    input.promptTokens ?? null,
    input.completionTokens ?? null,
    input.cacheHitTokens ?? null,
    input.cacheMissTokens ?? null,
    input.reasoningTokens ?? null,
    input.costUsd ?? null,
    input.latencyMs ?? null,
    input.outcome,
    failureSignatureValue,
    verifierJson,
    input.repairRound ?? null,
    input.provenance,
    redactionStatus,
    input.userVerdict ?? null,
    input.editDistance ?? null,
    createdAt,
  );

  if (redactionStatus !== 'blocked' && (input.inputPreview || input.outputPreview)) {
    const root = options.previewRoot ?? path.join(config.dataDir, 'learning', 'traces');
    fs.mkdirSync(root, { recursive: true });
    const preview: TracePreview = {
      traceId,
      inputPreview,
      outputPreview,
      redactorVersion: REDACTOR_VERSION,
    };
    fs.writeFileSync(previewPath(traceId, root), JSON.stringify(preview), {
      mode: 0o600,
      encoding: 'utf8',
    });
  }

  return getTrace(db, traceId)!;
}

export function getTrace(db: DatabaseSync, traceId: string): TraceRecord | null {
  const row = db.prepare('SELECT * FROM traces WHERE id = ?').get(traceId) as
    | TraceRow
    | undefined;
  return row ? mapTrace(row) : null;
}

export function getTraceByRun(db: DatabaseSync, runId: string): TraceRecord | null {
  const row = db.prepare('SELECT * FROM traces WHERE run_id = ?').get(runId) as
    | TraceRow
    | undefined;
  return row ? mapTrace(row) : null;
}

export interface TraceFilter {
  agentId?: string;
  outcome?: string;
  provenance?: LearningProvenance;
  limit?: number;
}

export function listTraces(db: DatabaseSync, filter: TraceFilter = {}): TraceRecord[] {
  const clauses: string[] = [];
  const params: Array<string | number | null> = [];
  if (filter.agentId) {
    clauses.push('agent_id = ?');
    params.push(filter.agentId);
  }
  if (filter.outcome) {
    clauses.push('outcome = ?');
    params.push(filter.outcome);
  }
  if (filter.provenance) {
    clauses.push('provenance = ?');
    params.push(filter.provenance);
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const limit = Math.min(Math.max(filter.limit ?? 200, 1), 1000);
  const rows = db
    .prepare(`SELECT * FROM traces ${where} ORDER BY created_at DESC LIMIT ?`)
    .all(...params, limit) as unknown as TraceRow[];
  return rows.map(mapTrace);
}

export function readTracePreview(
  traceId: string,
  options: { previewRoot?: string } = {},
): TracePreview | null {
  const root = options.previewRoot ?? path.join(config.dataDir, 'learning', 'traces');
  const file = previewPath(traceId, root);
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw) as TracePreview;
    if (parsed.traceId !== traceId) return null;
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export function recordUserVerdict(
  db: DatabaseSync,
  input: {
    runId: string;
    verdict: 'accepted' | 'edited' | 'rejected';
    editDistance?: number | null;
    note?: string;
  },
): void {
  const trace = getTraceByRun(db, input.runId);
  if (!trace) refuse('E_LEARNING_DATASET_EMPTY', 'no trace for run', { runId: input.runId });
  db.prepare(
    'UPDATE traces SET user_verdict = ?, edit_distance = ? WHERE run_id = ?',
  ).run(input.verdict, input.editDistance ?? null, input.runId);
  db.prepare(
    'INSERT INTO feedback (id, run_id, rating, labels_json, note, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(
    `fb_${crypto.randomUUID()}`,
    input.runId,
    input.verdict === 'accepted' ? 1 : input.verdict === 'edited' ? 0 : -1,
    JSON.stringify({ verdict: input.verdict }),
    input.note ?? null,
    nowIso(),
  );
}
