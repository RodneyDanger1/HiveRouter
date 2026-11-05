import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { nowIso } from '../db/database.js';
import { containsSecret, sha256 } from '../security/redact.js';
import {
  CandidateDraftSchema,
  SAFETY_POLICY,
  SAFETY_POLICY_VERSION,
  THRESHOLD_BOUNDS,
  type CandidateDraft,
  type CandidateKind,
  type ThresholdKey,
} from './contracts.js';
import { LearningError, refuse } from './errors.js';

export interface CandidateLintResult {
  ok: boolean;
  errors: Array<{ code: string; message: string }>;
  safety: {
    policyVersion: string;
    policyHash: string;
    checks: Array<{ code: string; message: string }>;
  };
  parentText: string | null;
}

export interface VariantRecord {
  id: string;
  candidateFamilyId: string;
  kind: CandidateKind;
  targetAgentId: string;
  parentVersionId: string | null;
  baselineVersionId: string;
  payload: unknown;
  hypothesis: string;
  targetSignature: string | null;
  status: string;
  hash: string;
  safetyJson: string;
  createdAt: string;
  createdBy: string;
}

interface VariantRow {
  id: string;
  candidate_family_id: string;
  kind: string;
  target_agent_id: string;
  parent_version_id: string | null;
  baseline_version_id: string;
  payload_json: string;
  hypothesis: string;
  target_signature: string | null;
  status: string;
  hash: string;
  safety_json: string;
  created_at: string;
  created_by: string;
}

const FORBIDDEN_PATTERNS: Array<{ code: string; re: RegExp }> = [
  { code: 'ignore_verifier', re: /ignore\s+(the\s+)?verifier/i },
  { code: 'disable_check', re: /disable\s+(the\s+)?(secret|stub|mandatory|pii|path|gate)\s*(check|scan)?/i },
  { code: 'bypass_gate', re: /\b(bypass|circumvent)\b[^.]*\b(check|verifier|gate)\b/i },
  { code: 'permission_escalation', re: /\bpermission\s+escalation\b/i },
  { code: 'tool_execution', re: /\b(child_process|subprocess|execSync|spawnSync)\b/i },
  { code: 'route_policy', re: /\b(route[ -]?policy|bandit|exploration)\b/i },
  { code: 'forced_pass', re: /\b(always\s+pass|mark\s+(it|this)\s+pass)\b/i },
];

const FORBIDDEN_KINDS = new Set(['route', 'route-policy', 'router', 'policy', 'exploration']);

function payloadText(payload: unknown): string {
  return typeof payload === 'string' ? payload : JSON.stringify(payload);
}

function parentRecord(
  db: DatabaseSync,
  kind: CandidateKind,
  parentVersionId: string,
  targetAgentId: string,
): { text: string; json: Record<string, unknown> | null } | null {
  if (kind === 'prompt') {
    const row = db
      .prepare('SELECT text, agent_id FROM prompt_versions WHERE id = ?')
      .get(parentVersionId) as { text: string; agent_id: string } | undefined;
    if (!row || row.agent_id !== targetAgentId) return null;
    return { text: row.text, json: null };
  }
  const row = db
    .prepare('SELECT json FROM policy_versions WHERE id = ?')
    .get(parentVersionId) as { json: string } | undefined;
  if (!row) return null;
  try {
    return { text: row.json, json: JSON.parse(row.json) as Record<string, unknown> };
  } catch {
    return null;
  }
}

function baselineExists(
  db: DatabaseSync,
  kind: CandidateKind,
  baselineVersionId: string,
): boolean {
  const table = kind === 'prompt' ? 'prompt_versions' : 'policy_versions';
  const row = db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(baselineVersionId);
  return Boolean(row);
}

export function parseCandidateDraft(raw: unknown): CandidateDraft {
  if (raw && typeof raw === 'object' && 'kind' in raw) {
    const kind = String((raw as { kind?: unknown }).kind ?? '');
    if (FORBIDDEN_KINDS.has(kind)) {
      refuse('E_LEARNING_ROUTE_POLICY_FORBIDDEN', undefined, { kind });
    }
  }
  const parsed = CandidateDraftSchema.safeParse(raw);
  if (!parsed.success) {
    refuse('E_LEARNING_CANDIDATE_INVALID', undefined, {
      issues: parsed.error.issues.map((issue) => issue.message),
    });
  }
  return parsed.data;
}

export function lintCandidate(db: DatabaseSync, draft: CandidateDraft): CandidateLintResult {
  const errors: Array<{ code: string; message: string }> = [];
  const add = (code: string, message: string) => errors.push({ code, message });

  const parent = parentRecord(db, draft.kind, draft.parentVersionId, draft.targetAgentId);
  if (!parent) add('parent_missing', 'parent version does not exist for this target agent');
  if (!baselineExists(db, draft.kind, draft.baselineVersionId)) {
    add('baseline_missing', 'baseline version does not exist');
  }

  const text = payloadText(draft.payload);
  if (containsSecret(text)) {
    add('secret_in_candidate', 'candidate payload contains a secret-shaped value');
  }
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.re.test(text)) add(pattern.code, `candidate payload matches forbidden rule ${pattern.code}`);
  }

  if (draft.kind === 'threshold' && 'key' in draft.payload) {
    const key = draft.payload.key as ThresholdKey;
    const bounds = THRESHOLD_BOUNDS[key];
    if (!bounds) {
      add('unsafe_threshold', `threshold key ${String(key)} is not allowlisted`);
    } else if (draft.payload.value < bounds.min || draft.payload.value > bounds.max) {
      add(
        'unsafe_threshold',
        `threshold ${key}=${draft.payload.value} is outside [${bounds.min}, ${bounds.max}]`,
      );
    }
  }

  if (draft.kind === 'prompt' && 'prompt' in draft.payload && parent) {
    if (draft.payload.prompt.trim() === parent.text.trim()) {
      add('empty_diff', 'candidate prompt is identical to the parent');
    }
  }
  if (draft.kind !== 'prompt' && parent?.json) {
    if (JSON.stringify(draft.payload) === JSON.stringify(parent.json)) {
      add('empty_diff', 'candidate payload is identical to the parent');
    }
  }

  const policyHash = sha256(JSON.stringify(SAFETY_POLICY));
  return {
    ok: errors.length === 0,
    errors,
    safety: {
      policyVersion: SAFETY_POLICY_VERSION,
      policyHash,
      checks: errors,
    },
    parentText: parent?.text ?? null,
  };
}

function variantHash(draft: CandidateDraft): string {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        kind: draft.kind,
        targetAgentId: draft.targetAgentId,
        parentVersionId: draft.parentVersionId,
        baselineVersionId: draft.baselineVersionId,
        payload: draft.payload,
      }),
    )
    .digest('hex');
}

function mapVariant(row: VariantRow): VariantRecord {
  return {
    id: row.id,
    candidateFamilyId: row.candidate_family_id,
    kind: row.kind as CandidateKind,
    targetAgentId: row.target_agent_id,
    parentVersionId: row.parent_version_id,
    baselineVersionId: row.baseline_version_id,
    payload: JSON.parse(row.payload_json) as unknown,
    hypothesis: row.hypothesis,
    targetSignature: row.target_signature,
    status: row.status,
    hash: row.hash,
    safetyJson: row.safety_json,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

export function createVariant(db: DatabaseSync, raw: unknown): VariantRecord {
  const draft = parseCandidateDraft(raw);
  const lint = lintCandidate(db, draft);
  if (!lint.ok) {
    const first = lint.errors[0]!;
    const code =
      first.code === 'secret_in_candidate'
        ? 'E_LEARNING_REDACTION_BLOCKED'
        : first.code === 'unsafe_threshold'
          ? 'E_LEARNING_UNSAFE_THRESHOLD'
          : first.code === 'route_policy'
            ? 'E_LEARNING_ROUTE_POLICY_FORBIDDEN'
            : 'E_LEARNING_CANDIDATE_INVALID';
    refuse(code, first.message, { errors: lint.errors });
  }

  const familyCount = db
    .prepare(
      "SELECT COUNT(*) AS n FROM variants WHERE candidate_family_id = ? AND status IN ('draft','evaluating','promoted')",
    )
    .get(draft.candidateFamilyId) as { n: number };
  if (familyCount.n >= 3) {
    refuse('E_LEARNING_CANDIDATE_INVALID', 'candidate family already has 3 candidates', {
      candidateFamilyId: draft.candidateFamilyId,
    });
  }

  const record: VariantRecord = {
    id: `var_${crypto.randomUUID()}`,
    candidateFamilyId: draft.candidateFamilyId,
    kind: draft.kind,
    targetAgentId: draft.targetAgentId,
    parentVersionId: draft.parentVersionId,
    baselineVersionId: draft.baselineVersionId,
    payload: draft.payload,
    hypothesis: draft.hypothesis,
    targetSignature: draft.targetSignature ?? null,
    status: 'draft',
    hash: variantHash(draft),
    safetyJson: JSON.stringify(lint.safety),
    createdAt: nowIso(),
    createdBy: draft.createdBy,
  };

  db.prepare(
    `INSERT INTO variants (
       id, candidate_family_id, kind, target_agent_id, parent_version_id, baseline_version_id,
       payload_json, hypothesis, target_signature, status, hash, safety_json, created_at, created_by
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    record.id,
    record.candidateFamilyId,
    record.kind,
    record.targetAgentId,
    record.parentVersionId,
    record.baselineVersionId,
    JSON.stringify(record.payload),
    record.hypothesis,
    record.targetSignature,
    record.status,
    record.hash,
    record.safetyJson,
    record.createdAt,
    record.createdBy,
  );
  return record;
}

export function getVariant(db: DatabaseSync, variantId: string): VariantRecord | null {
  const row = db.prepare('SELECT * FROM variants WHERE id = ?').get(variantId) as
    | VariantRow
    | undefined;
  return row ? mapVariant(row) : null;
}

export function setVariantStatus(
  db: DatabaseSync,
  variantId: string,
  status: string,
): void {
  db.prepare('UPDATE variants SET status = ? WHERE id = ?').run(status, variantId);
}

export function candidateFamilySize(db: DatabaseSync, familyId: string): number {
  const row = db
    .prepare('SELECT COUNT(*) AS n FROM variants WHERE candidate_family_id = ?')
    .get(familyId) as { n: number };
  return row.n;
}

export { LearningError };
