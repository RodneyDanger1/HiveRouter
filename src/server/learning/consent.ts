import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { nowIso } from '../db/database.js';
import {
  LEARNING_CONSENT_SCOPES,
  type LearningConsentScope,
} from './contracts.js';
import { refuse } from './errors.js';

export interface ConsentRecord {
  id: string;
  scope: LearningConsentScope;
  grantedAt: string;
  version: number;
  source: string;
  revokedAt: string | null;
}

interface ConsentRow {
  id: string;
  scope: string;
  granted_at: string;
  version: number;
  source: string;
  revoked_at: string | null;
}

function mapRow(row: ConsentRow): ConsentRecord {
  return {
    id: row.id,
    scope: row.scope as LearningConsentScope,
    grantedAt: row.granted_at,
    version: row.version,
    source: row.source,
    revokedAt: row.revoked_at,
  };
}

export function latestConsent(
  db: DatabaseSync,
  scope: LearningConsentScope,
): ConsentRecord | null {
  const row = db
    .prepare('SELECT * FROM consent_records WHERE scope = ? ORDER BY version DESC LIMIT 1')
    .get(scope) as ConsentRow | undefined;
  return row ? mapRow(row) : null;
}

export function isConsentActive(db: DatabaseSync, scope: LearningConsentScope): boolean {
  const row = latestConsent(db, scope);
  return Boolean(row && row.revokedAt === null);
}

export function grantConsent(
  db: DatabaseSync,
  scope: LearningConsentScope,
  source = 'user',
): ConsentRecord {
  const latest = latestConsent(db, scope);
  const version = (latest?.version ?? 0) + 1;
  const record: ConsentRecord = {
    id: `consent_${crypto.randomUUID()}`,
    scope,
    grantedAt: nowIso(),
    version,
    source,
    revokedAt: null,
  };
  db.prepare(
    'INSERT INTO consent_records (id, scope, granted_at, version, source, revoked_at) VALUES (?, ?, ?, ?, ?, NULL)',
  ).run(record.id, record.scope, record.grantedAt, record.version, record.source);
  return record;
}

export function revokeConsent(
  db: DatabaseSync,
  scope: LearningConsentScope,
  actor = 'user',
): ConsentRecord | null {
  const latest = latestConsent(db, scope);
  if (!latest || latest.revokedAt !== null) return latest;
  const revokedAt = nowIso();
  db.prepare(
    "UPDATE consent_records SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL",
  ).run(revokedAt, latest.id);
  if (scope === 'case_to_provider_eval') {
    // Pending/unclaimed suites can no longer be used; claimed suites stay auditable.
    db.prepare(
      `UPDATE eval_cases
       SET tombstoned_at = ?
       WHERE tombstoned_at IS NULL
         AND suite_id IN (
           SELECT id FROM eval_suites
           WHERE id NOT IN (SELECT suite_id FROM suite_uses)
         )`,
    ).run(revokedAt);
  }
  void actor;
  return { ...latest, revokedAt };
}

export function requireConsent(db: DatabaseSync, scope: LearningConsentScope): ConsentRecord {
  const row = latestConsent(db, scope);
  if (!row || row.revokedAt !== null) {
    refuse('E_LEARNING_CONSENT_REQUIRED', undefined, { scope });
  }
  return row;
}

export function consentMatrix(db: DatabaseSync): Record<
  LearningConsentScope,
  { active: boolean; version: number | null; grantedAt: string | null; revokedAt: string | null }
> {
  const out = {} as Record<
    LearningConsentScope,
    { active: boolean; version: number | null; grantedAt: string | null; revokedAt: string | null }
  >;
  for (const scope of LEARNING_CONSENT_SCOPES) {
    const row = latestConsent(db, scope);
    out[scope] = {
      active: Boolean(row && row.revokedAt === null),
      version: row?.version ?? null,
      grantedAt: row?.grantedAt ?? null,
      revokedAt: row?.revokedAt ?? null,
    };
  }
  return out;
}
