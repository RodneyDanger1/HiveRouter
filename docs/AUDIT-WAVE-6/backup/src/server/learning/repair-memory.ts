import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { nowIso } from '../db/database.js';
import { containsSecret, redactString, sha256 } from '../security/redact.js';
import { refuse } from './errors.js';

export interface RepairEntry {
  id: string;
  projectId: string;
  signature: string;
  agentId: string;
  fixSummary: string;
  patch: unknown;
  sourceTraceId: string | null;
  successes: number;
  failures: number;
  confidence: number;
  status: string;
  expiresAt: string;
  lastUsedAt: string | null;
  hash: string;
  createdAt: string;
}

interface RepairRow {
  id: string;
  project_id: string;
  signature: string;
  agent_id: string;
  fix_summary: string;
  patch_json: string;
  source_trace_id: string | null;
  successes: number;
  failures: number;
  confidence: number;
  status: string;
  expires_at: string;
  last_used_at: string | null;
  hash: string;
  created_at: string;
}

const TTL_MS = 30 * 24 * 60 * 60 * 1000;

function mapRow(row: RepairRow): RepairEntry {
  return {
    id: row.id,
    projectId: row.project_id,
    signature: row.signature,
    agentId: row.agent_id,
    fixSummary: row.fix_summary,
    patch: JSON.parse(row.patch_json) as unknown,
    sourceTraceId: row.source_trace_id,
    successes: row.successes,
    failures: row.failures,
    confidence: row.confidence,
    status: row.status,
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
    hash: row.hash,
    createdAt: row.created_at,
  };
}

export function recordRepair(
  db: DatabaseSync,
  input: {
    projectId: string;
    signature: string;
    agentId: string;
    fixSummary: string;
    patch: unknown;
    sourceTraceId?: string | null;
  },
): RepairEntry {
  const fixSummary = redactString(input.fixSummary);
  const patchJson = redactString(JSON.stringify(input.patch ?? {}));
  if (containsSecret(input.fixSummary) || containsSecret(JSON.stringify(input.patch ?? {}))) {
    refuse('E_LEARNING_REDACTION_BLOCKED', 'repair memory contains a secret-shaped value');
  }
  const createdAt = nowIso();
  const record: RepairEntry = {
    id: `rm_${crypto.randomUUID()}`,
    projectId: input.projectId,
    signature: input.signature,
    agentId: input.agentId,
    fixSummary,
    patch: JSON.parse(patchJson) as unknown,
    sourceTraceId: input.sourceTraceId ?? null,
    successes: 0,
    failures: 0,
    confidence: 1,
    status: 'active',
    expiresAt: new Date(Date.now() + TTL_MS).toISOString(),
    lastUsedAt: null,
    hash: sha256(
      JSON.stringify({
        projectId: input.projectId,
        signature: input.signature,
        fixSummary,
        patch: patchJson,
      }),
    ),
    createdAt,
  };
  db.prepare(
    `INSERT INTO repair_memory
     (id, project_id, signature, agent_id, fix_summary, patch_json, source_trace_id, successes, failures,
      confidence, status, expires_at, last_used_at, hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 1.0, 'active', ?, NULL, ?, ?)`,
  ).run(
    record.id,
    record.projectId,
    record.signature,
    record.agentId,
    record.fixSummary,
    patchJson,
    record.sourceTraceId,
    record.expiresAt,
    record.hash,
    record.createdAt,
  );
  return record;
}

export function retrieveRepairs(
  db: DatabaseSync,
  input: { projectId: string; signature: string; limit?: number; maxTokens?: number; now?: Date },
): RepairEntry[] {
  const now = input.now ?? new Date();
  const limit = Math.min(Math.max(input.limit ?? 3, 1), 3);
  const maxTokens = Math.min(Math.max(input.maxTokens ?? 600, 1), 600);
  const rows = db
    .prepare(
      `SELECT * FROM repair_memory
       WHERE project_id = ? AND signature = ? AND status = 'active'
         AND expires_at > ? AND confidence >= 0.2 AND successes > 0
       ORDER BY successes DESC, confidence DESC, created_at ASC
       LIMIT ?`,
    )
    .all(input.projectId, input.signature, now.toISOString(), limit) as unknown as RepairRow[];
  const out: RepairEntry[] = [];
  let tokens = 0;
  for (const row of rows) {
    const entry = mapRow(row);
    const estimate = Math.ceil((entry.fixSummary.length + JSON.stringify(entry.patch).length) / 4);
    if (out.length > 0 && tokens + estimate > maxTokens) break;
    tokens += estimate;
    out.push(entry);
  }
  return out;
}

export function recordRepairOutcome(
  db: DatabaseSync,
  id: string,
  success: boolean,
): RepairEntry {
  const row = db.prepare('SELECT * FROM repair_memory WHERE id = ?').get(id) as unknown as
    | RepairRow
    | undefined;
  if (!row) refuse('E_LEARNING_DATASET_EMPTY', 'repair memory entry not found', { id });
  const successes = row.successes + (success ? 1 : 0);
  const failures = row.failures + (success ? 0 : 1);
  const confidence = success ? Math.min(1, row.confidence + 0.1) : row.confidence * 0.5;
  const status = confidence < 0.2 ? 'archived' : 'active';
  db.prepare(
    `UPDATE repair_memory
     SET successes = ?, failures = ?, confidence = ?, status = ?, last_used_at = ?
     WHERE id = ?`,
  ).run(successes, failures, confidence, status, nowIso(), id);
  return mapRow(
    db.prepare('SELECT * FROM repair_memory WHERE id = ?').get(id) as unknown as RepairRow,
  );
}

export function listRepairMemory(db: DatabaseSync, projectId: string): RepairEntry[] {
  const rows = db
    .prepare('SELECT * FROM repair_memory WHERE project_id = ? ORDER BY created_at DESC LIMIT 500')
    .all(projectId) as unknown as RepairRow[];
  return rows.map(mapRow);
}
