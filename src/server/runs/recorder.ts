import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import { getDb, nowIso } from '../db/database.js';
import { config } from '../config.js';
import { redactValue } from '../security/redact.js';
import { RunTransitionError, assertStatusTransition, isTerminalStatus } from '../logic/run-state.js';
import type {
  ArtifactRecord,
  CheckResult,
  RunEvent,
  RunRecord,
  RunStatus,
  StepRecord,
  UsageRecord,
} from '../../shared/types.js';

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

function id(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(9).toString('hex')}`;
}

function json(value: unknown): string {
  return JSON.stringify(redactValue(value));
}

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function emitEvent(runId: string, type: string, payload: Record<string, unknown> = {}): RunEvent {
  const db = getDb();
  const safe = redactValue(payload) as Record<string, unknown>;
  let payloadJson = JSON.stringify(safe);
  if (Buffer.byteLength(payloadJson, 'utf8') > config.limits.eventPayloadMaxBytes) {
    payloadJson = JSON.stringify({ truncated: true, type, note: 'payload exceeded 8KB; see artifact/step detail' });
  }
  const createdAt = nowIso();
  const info = db
    .prepare('INSERT INTO events (run_id, type, payload_json, created_at) VALUES (?, ?, ?, ?)')
    .run(runId, type, payloadJson, createdAt);
  const seq = Number(info.lastInsertRowid);
  const event: RunEvent = { seq, runId, type, payload: JSON.parse(payloadJson) as Record<string, unknown>, createdAt };
  emitter.emit(runId, event);
  return event;
}

export function subscribe(runId: string, listener: (event: RunEvent) => void): () => void {
  emitter.on(runId, listener);
  return () => emitter.off(runId, listener);
}

export function getEvents(runId: string, after = 0, limit = config.limits.eventReplayWindow): RunEvent[] {
  const rows = getDb()
    .prepare('SELECT seq, run_id, type, payload_json, created_at FROM events WHERE run_id = ? AND seq > ? ORDER BY seq ASC LIMIT ?')
    .all(runId, after, limit) as Array<{ seq: number; run_id: string; type: string; payload_json: string; created_at: string }>;
  return rows.map((r) => ({
    seq: Number(r.seq),
    runId: r.run_id,
    type: r.type,
    payload: parseJson<Record<string, unknown>>(r.payload_json) ?? {},
    createdAt: r.created_at,
  }));
}

export function lastEventId(runId: string): number {
  const row = getDb().prepare('SELECT COALESCE(MAX(seq),0) AS seq FROM events WHERE run_id = ?').get(runId) as { seq: number } | undefined;
  return Number(row?.seq ?? 0);
}

/** Number of this run's events after the cursor (the run's own rows, not the global seq space). */
export function countEventsAfter(runId: string, after: number): number {
  const row = getDb().prepare('SELECT COUNT(*) AS n FROM events WHERE run_id = ? AND seq > ?').get(runId, after) as { n: number } | undefined;
  return Number(row?.n ?? 0);
}

/**
 * The newest `limit` events of this run after the cursor, returned in ascending
 * seq order (DESC fetch, then reverse) with the same row mapping as getEvents.
 */
export function getRecentEvents(runId: string, after: number, limit: number): RunEvent[] {
  const rows = getDb()
    .prepare('SELECT seq, run_id, type, payload_json, created_at FROM events WHERE run_id = ? AND seq > ? ORDER BY seq DESC LIMIT ?')
    .all(runId, after, limit) as Array<{ seq: number; run_id: string; type: string; payload_json: string; created_at: string }>;
  return rows
    .map((r) => ({
      seq: Number(r.seq),
      runId: r.run_id,
      type: r.type,
      payload: parseJson<Record<string, unknown>>(r.payload_json) ?? {},
      createdAt: r.created_at,
    }))
    .reverse();
}

export function createRunRow(input: {
  id: string;
  brief: string;
  preset: string;
  model: string;
  thinking: string;
  effort: string | null;
  workspacePath: string;
  parentRunId?: string | null;
  runKind?: string;
}): RunRecord {
  const db = getDb();
  const createdAt = nowIso();
  db.prepare(
    `INSERT INTO runs (id, parent_run_id, brief, preset, status, phase, model, thinking, effort, created_at, workspace_path, run_kind)
     VALUES (?, ?, ?, ?, 'queued', 'intake', ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.id,
    input.parentRunId ?? null,
    input.brief,
    input.preset,
    input.model,
    input.thinking,
    input.effort,
    createdAt,
    input.workspacePath,
    input.runKind ?? 'user',
  );
  return getRun(input.id) as RunRecord;
}

export function updateRun(runId: string, patch: Partial<{
  status: RunStatus;
  phase: string;
  started_at: string | null;
  finished_at: string | null;
  cost_usd: number | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  error_code: string | null;
  error_message: string | null;
  summary: string | null;
  snapshot_hash: string | null;
  policy_version_id: string | null;
  trace_complete: number;
}>): void {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;
  let currentStatus: RunStatus | null = null;
  let currentPhase: string | null = null;
  if (patch.status !== undefined || patch.phase !== undefined) {
    const current = getDb().prepare('SELECT status, phase FROM runs WHERE id = ?').get(runId) as
      | { status: string; phase: string }
      | undefined;
    if (current) {
      currentStatus = current.status as RunStatus;
      currentPhase = current.phase;
      if (patch.status !== undefined) {
        // Status changes are one-way state-machine edges. Same-value writes are
        // idempotent; terminal states cannot move anywhere else.
        assertStatusTransition(currentStatus, patch.status, runId);
      }
      if (isTerminalStatus(currentStatus) && patch.phase !== undefined && patch.phase !== currentPhase) {
        throw new RunTransitionError('phase', currentPhase, patch.phase, runId);
      }
      const nextStatus = patch.status ?? currentStatus;
      if (
        (nextStatus === 'completed' || nextStatus === 'completed_with_warnings') &&
        (patch.phase ?? currentPhase) !== 'done'
      ) {
        throw new RunTransitionError('phase', currentPhase, patch.phase ?? currentPhase, runId);
      }
    }
  }
  const sql = `UPDATE runs SET ${entries.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?${
    currentStatus === null ? '' : ' AND status = ?'
  }`;
  const params: Array<string | number | null> = entries.map(([, v]) => v as string | number | null);
  params.push(runId);
  if (currentStatus !== null) params.push(currentStatus);
  const result = getDb().prepare(sql).run(...params);
  if (currentStatus !== null && Number(result.changes) !== 1) {
    // A concurrent write moved the row between the read and this CAS. Fail
    // closed rather than silently overwriting a terminal state.
    throw new RunTransitionError('status', currentStatus, patch.status as RunStatus, runId);
  }
}

export function getRun(runId: string): RunRecord | null {
  const row = getDb().prepare('SELECT * FROM runs WHERE id = ?').get(runId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: String(row.id),
    parentRunId: (row.parent_run_id as string | null) ?? null,
    brief: String(row.brief),
    preset: String(row.preset) as RunRecord['preset'],
    status: String(row.status) as RunRecord['status'],
    phase: String(row.phase) as RunRecord['phase'],
    model: String(row.model) as RunRecord['model'],
    thinking: String(row.thinking) as RunRecord['thinking'],
    effort: (row.effort as RunRecord['effort']) ?? null,
    createdAt: String(row.created_at),
    startedAt: (row.started_at as string | null) ?? null,
    finishedAt: (row.finished_at as string | null) ?? null,
    costUsd: row.cost_usd == null ? null : Number(row.cost_usd),
    promptTokens: row.prompt_tokens == null ? null : Number(row.prompt_tokens),
    completionTokens: row.completion_tokens == null ? null : Number(row.completion_tokens),
    errorCode: (row.error_code as string | null) ?? null,
    errorMessage: (row.error_message as string | null) ?? null,
    workspacePath: String(row.workspace_path),
    summary: (row.summary as string | null) ?? null,
    snapshotHash: (row.snapshot_hash as string | null) ?? null,
    policyVersionId: (row.policy_version_id as string | null) ?? null,
    traceComplete: Number(row.trace_complete) === 1,
    runKind: String(row.run_kind) as RunRecord['runKind'],
  };
}

export function listRuns(limit = 50, status?: string): RunRecord[] {
  const rows = status
    ? (getDb().prepare('SELECT id FROM runs WHERE status = ? ORDER BY created_at DESC LIMIT ?').all(status, limit) as Array<{ id: string }>)
    : (getDb().prepare('SELECT id FROM runs ORDER BY created_at DESC LIMIT ?').all(limit) as Array<{ id: string }>);
  return rows.map((r) => getRun(r.id)).filter((r): r is RunRecord => Boolean(r));
}

export function startStep(runId: string, phase: string, agentId: string | null, inputSummary: string): StepRecord {
  const db = getDb();
  const seqRow = db.prepare('SELECT COALESCE(MAX(seq),0)+1 AS seq FROM steps WHERE run_id = ?').get(runId) as { seq: number };
  const idValue = id('stp');
  const startedAt = nowIso();
  db.prepare(
    `INSERT INTO steps (id, run_id, seq, phase, agent_id, status, started_at, input_summary)
     VALUES (?, ?, ?, ?, ?, 'started', ?, ?)`,
  ).run(idValue, runId, Number(seqRow.seq), phase, agentId, startedAt, inputSummary.slice(0, 500));
  return {
    id: idValue,
    runId,
    seq: Number(seqRow.seq),
    phase: phase as StepRecord['phase'],
    agentId,
    status: 'started',
    startedAt,
    finishedAt: null,
    inputSummary: inputSummary.slice(0, 500),
    outputSummary: null,
    errorCode: null,
    errorMessage: null,
    promptTokens: null,
    completionTokens: null,
    costUsd: null,
  };
}

export function finishStep(
  stepId: string,
  status: 'succeeded' | 'failed' | 'skipped' | 'cancelled',
  outputSummary: string,
  usage?: UsageRecord,
  error?: { code?: string; message?: string },
): void {
  getDb()
    .prepare(
      `UPDATE steps SET status = ?, finished_at = ?, output_summary = ?, error_code = ?, error_message = ?,
       prompt_tokens = ?, completion_tokens = ?, cost_usd = ? WHERE id = ?`,
    )
    .run(
      status,
      nowIso(),
      outputSummary.slice(0, 2000),
      error?.code ?? null,
      error?.message ?? null,
      usage?.promptTokens ?? null,
      usage?.completionTokens ?? null,
      usage?.costUsd ?? null,
      stepId,
    );
}

export function insertArtifact(input: {
  runId: string;
  path: string;
  kind: ArtifactRecord['kind'];
  language: string;
  sha256: string;
  bytes: number;
  agentId: string | null;
  revisedFrom?: string | null;
  redactionStatus?: ArtifactRecord['redactionStatus'];
  redactorVersion: string;
}): ArtifactRecord {
  const record: ArtifactRecord = {
    id: id('art'),
    runId: input.runId,
    path: input.path,
    kind: input.kind,
    language: input.language,
    sha256: input.sha256,
    bytes: input.bytes,
    agentId: input.agentId,
    revisedFrom: input.revisedFrom ?? null,
    createdAt: nowIso(),
    redactionStatus: input.redactionStatus ?? 'clean',
    redactorVersion: input.redactorVersion,
  };
  getDb()
    .prepare(
      `INSERT INTO artifacts (id, run_id, path, kind, language, sha256, bytes, agent_id, revised_from, created_at, redaction_status, redactor_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      record.id,
      record.runId,
      record.path,
      record.kind,
      record.language,
      record.sha256,
      record.bytes,
      record.agentId,
      record.revisedFrom,
      record.createdAt,
      record.redactionStatus,
      record.redactorVersion,
    );
  return record;
}

export function getArtifacts(runId: string): ArtifactRecord[] {
  const rows = getDb().prepare('SELECT * FROM artifacts WHERE run_id = ? ORDER BY path ASC').all(runId) as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: String(row.id),
    runId: String(row.run_id),
    path: String(row.path),
    kind: String(row.kind) as ArtifactRecord['kind'],
    language: String(row.language),
    sha256: String(row.sha256),
    bytes: Number(row.bytes),
    agentId: (row.agent_id as string | null) ?? null,
    revisedFrom: (row.revised_from as string | null) ?? null,
    createdAt: String(row.created_at),
    redactionStatus: String(row.redaction_status) as ArtifactRecord['redactionStatus'],
    redactorVersion: String(row.redactor_version),
  }));
}

export function insertCheck(runId: string, check: CheckResult): void {
  getDb()
    .prepare(
      `INSERT INTO checks (id, run_id, check_id, status, detail, mandatory, file, line, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id('chk'), runId, check.id, check.status, check.detail.slice(0, 2000), check.mandatory ? 1 : 0, check.file ?? null, check.line ?? null, nowIso());
}

export function getChecks(runId: string): CheckResult[] {
  const rows = getDb().prepare('SELECT * FROM checks WHERE run_id = ? ORDER BY created_at ASC').all(runId) as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: String(row.check_id),
    rowId: String(row.id),
    status: String(row.status) as CheckResult['status'],
    detail: String(row.detail),
    mandatory: Number(row.mandatory) === 1,
    file: (row.file as string | null) ?? undefined,
    line: row.line == null ? undefined : Number(row.line),
  }));
}

export function getSteps(runId: string): StepRecord[] {
  const rows = getDb().prepare('SELECT * FROM steps WHERE run_id = ? ORDER BY seq ASC').all(runId) as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: String(row.id),
    runId: String(row.run_id),
    seq: Number(row.seq),
    phase: String(row.phase) as StepRecord['phase'],
    agentId: (row.agent_id as string | null) ?? null,
    status: String(row.status) as StepRecord['status'],
    startedAt: String(row.started_at),
    finishedAt: (row.finished_at as string | null) ?? null,
    inputSummary: (row.input_summary as string | null) ?? null,
    outputSummary: (row.output_summary as string | null) ?? null,
    errorCode: (row.error_code as string | null) ?? null,
    errorMessage: (row.error_message as string | null) ?? null,
    promptTokens: row.prompt_tokens == null ? null : Number(row.prompt_tokens),
    completionTokens: row.completion_tokens == null ? null : Number(row.completion_tokens),
    costUsd: row.cost_usd == null ? null : Number(row.cost_usd),
  }));
}

export function insertReview(runId: string, kind: string, verdict: string, findings: unknown): void {
  getDb()
    .prepare('INSERT INTO reviews (id, run_id, kind, verdict, findings_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id('rev'), runId, kind, verdict, json(findings), nowIso());
}

export function insertUsage(runId: string, stepId: string | null, agentId: string | null, usage: UsageRecord): void {
  getDb()
    .prepare(
      `INSERT INTO usage (run_id, step_id, agent_id, model, prompt_tokens, completion_tokens, cache_hit_tokens, cache_miss_tokens, reasoning_tokens, cost_usd, source, system_fingerprint, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      runId,
      stepId,
      agentId,
      usage.model,
      usage.promptTokens,
      usage.completionTokens,
      usage.cacheHitTokens,
      usage.cacheMissTokens,
      usage.reasoningTokens,
      usage.costUsd,
      usage.source,
      usage.systemFingerprint ?? null,
      nowIso(),
    );
}

export function usageTotals(runId: string): { costUsd: number | null; promptTokens: number | null; completionTokens: number | null; cacheHitTokens: number | null; cacheMissTokens: number | null; reasoningTokens: number | null } {
  // A run containing any unknown-usage row must not present a zero as if it
  // were measured spend. Null is the honest aggregate; known-only rows sum.
  const row = getDb()
    .prepare(
      `SELECT
         CASE WHEN SUM(CASE WHEN source = 'unknown' THEN 1 ELSE 0 END) > 0 THEN NULL ELSE SUM(cost_usd) END AS cost,
         CASE WHEN SUM(CASE WHEN source = 'unknown' THEN 1 ELSE 0 END) > 0 THEN NULL ELSE SUM(prompt_tokens) END AS p,
         CASE WHEN SUM(CASE WHEN source = 'unknown' THEN 1 ELSE 0 END) > 0 THEN NULL ELSE SUM(completion_tokens) END AS c,
         CASE WHEN SUM(CASE WHEN source = 'unknown' THEN 1 ELSE 0 END) > 0 THEN NULL ELSE SUM(cache_hit_tokens) END AS chit,
         CASE WHEN SUM(CASE WHEN source = 'unknown' THEN 1 ELSE 0 END) > 0 THEN NULL ELSE SUM(cache_miss_tokens) END AS cmiss,
         CASE WHEN SUM(CASE WHEN source = 'unknown' THEN 1 ELSE 0 END) > 0 THEN NULL ELSE SUM(reasoning_tokens) END AS reasoning
       FROM usage WHERE run_id = ?`,
    )
    .get(runId) as { cost: number | null; p: number | null; c: number | null; chit: number | null; cmiss: number | null; reasoning: number | null } | undefined;
  return {
    costUsd: row?.cost == null ? null : Number(row.cost),
    promptTokens: row?.p == null ? null : Number(row.p),
    completionTokens: row?.c == null ? null : Number(row.c),
    cacheHitTokens: row?.chit == null ? null : Number(row.chit),
    cacheMissTokens: row?.cmiss == null ? null : Number(row.cmiss),
    reasoningTokens: row?.reasoning == null ? null : Number(row.reasoning),
  };
}

/**
 * Row projection of the honest usage aggregate written by every terminal
 * writer. A run with no usage rows (or any unknown-usage row) maps to NULL for
 * all three columns; the recorder never writes 0 to mean "unknown".
 */
export function usageFields(runId: string): { cost_usd: number | null; prompt_tokens: number | null; completion_tokens: number | null } {
  const totals = usageTotals(runId);
  return { cost_usd: totals.costUsd, prompt_tokens: totals.promptTokens, completion_tokens: totals.completionTokens };
}

export function getUserFeedback(runId: string): Array<Record<string, unknown>> {
  return getDb().prepare('SELECT * FROM feedback WHERE run_id = ? ORDER BY created_at DESC').all(runId) as Array<Record<string, unknown>>;
}
