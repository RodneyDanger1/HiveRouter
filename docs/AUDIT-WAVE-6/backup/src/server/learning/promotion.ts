import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { nowIso, tx } from '../db/database.js';
import { sha256 } from '../security/redact.js';
import type { RefusalCode } from '../../shared/refusals.js';
import {
  type LearningProvenance,
  type PairedOutcome,
  PairedOutcomeSchema,
} from './contracts.js';
import { requireConsent } from './consent.js';
import {
  createApprovalService,
  type ApprovalBinding,
  type ApprovalService,
} from './approval.js';
import { getVariant, setVariantStatus, type VariantRecord } from './candidates.js';
import { refuse } from './errors.js';
import { evaluateScreening, type ScreeningMetrics } from './stats.js';

export type FingerprintStatus = 'stable' | 'unavailable' | 'changed';
export type GateDecision = 'promote_eligible' | 'no_promotion' | 'refused' | 'inconclusive';

export interface GateEvidence {
  evalRunId: string;
  suiteId: string;
  suiteUseId: string;
  variantId: string;
  variantHash: string;
  baselineVersionId: string;
  activeBaselineVersionId: string;
  candidateFamilyId: string;
  candidateFamilySize: number;
  provenance: LearningProvenance;
  fingerprintStatus: FingerprintStatus;
  evidenceHash: string;
  expectedEvidenceHash: string;
  pairs: PairedOutcome[];
  excludedPairs: number;
  model: string;
  mode: string;
  suiteManifestHash: string;
}

export interface GateResult {
  decision: GateDecision;
  code: RefusalCode | null;
  reasons: string[];
  metrics: ScreeningMetrics | null;
  alphaSpent: number;
  baselineCostPerSuccess: number | null;
  candidateCostPerSuccess: number | null;
}

export interface PromotionRecord {
  id: string;
  variantId: string;
  baselineVersionId: string;
  decision: string;
  evidenceJson: string;
  alphaSpent: number | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rollbackOf: string | null;
  notes: string | null;
}

export interface MonitorRecord {
  promotionId: string;
  startedAt: string;
  windowRuns: number;
  windowDays: number;
  status: string;
  rolledBackAt: string | null;
  trigger: string | null;
}

interface EvalRunRow {
  id: string;
  suite_id: string;
  suite_use_id: string;
  variant_id: string;
  baseline_version_id: string;
  model: string;
  mode: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  total_cost_usd: number | null;
  metrics_json: string | null;
  evidence_hash: string | null;
  fingerprint_status: string | null;
}

interface ResultRow {
  case_id: string;
  arm: string;
  outcome: string;
  checks_json: string;
  cost_usd: number | null;
  excluded_reason: string | null;
}

function getSetting(db: DatabaseSync, key: string): string | null {
  const row = db.prepare('SELECT value_json FROM settings WHERE key = ?').get(key) as
    | { value_json: string }
    | undefined;
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.value_json) as unknown;
    return typeof parsed === 'string' ? parsed : row.value_json;
  } catch {
    return row.value_json;
  }
}

function setSetting(db: DatabaseSync, key: string, value: string): void {
  db.prepare(
    `INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
  ).run(key, JSON.stringify(value), nowIso());
}

function pointerKey(kind: string, agentId: string, prefix: 'active' | 'lkg'): string {
  return `learning.${prefix}.${kind}.${agentId}`;
}

export function getActiveVersion(
  db: DatabaseSync,
  kind: string,
  agentId: string,
): string | null {
  return getSetting(db, pointerKey(kind, agentId, 'active'));
}

export function setActiveVersion(
  db: DatabaseSync,
  kind: string,
  agentId: string,
  versionId: string,
): void {
  setSetting(db, pointerKey(kind, agentId, 'active'), versionId);
}

export function getLastKnownGood(
  db: DatabaseSync,
  kind: string,
  agentId: string,
): string | null {
  return getSetting(db, pointerKey(kind, agentId, 'lkg'));
}

export function setLastKnownGood(
  db: DatabaseSync,
  kind: string,
  agentId: string,
  versionId: string,
): void {
  setSetting(db, pointerKey(kind, agentId, 'lkg'), versionId);
}

function mapPromotion(row: Record<string, unknown>): PromotionRecord {
  return {
    id: String(row.id),
    variantId: String(row.variant_id),
    baselineVersionId: String(row.baseline_version_id),
    decision: String(row.decision),
    evidenceJson: String(row.evidence_json),
    alphaSpent: row.alpha_spent == null ? null : Number(row.alpha_spent),
    approvedBy: row.approved_by == null ? null : String(row.approved_by),
    approvedAt: row.approved_at == null ? null : String(row.approved_at),
    rollbackOf: row.rollback_of == null ? null : String(row.rollback_of),
    notes: row.notes == null ? null : String(row.notes),
  };
}

function mapMonitor(row: Record<string, unknown>): MonitorRecord {
  return {
    promotionId: String(row.promotion_id),
    startedAt: String(row.started_at),
    windowRuns: Number(row.window_runs),
    windowDays: Number(row.window_days),
    status: String(row.status),
    rolledBackAt: row.rolled_back_at == null ? null : String(row.rolled_back_at),
    trigger: row.trigger == null ? null : String(row.trigger),
  };
}

export function computeEvidenceHash(input: {
  suiteId: string;
  suiteManifestHash: string;
  variantHash: string;
  baselineVersionId: string;
  model: string;
  mode: string;
  fingerprintStatus: string;
  pairs: PairedOutcome[];
}): string {
  return sha256(
    JSON.stringify({
      suiteId: input.suiteId,
      suiteManifestHash: input.suiteManifestHash,
      variantHash: input.variantHash,
      baselineVersionId: input.baselineVersionId,
      model: input.model,
      mode: input.mode,
      fingerprintStatus: input.fingerprintStatus,
      pairs: input.pairs.map((pair) => ({
        caseId: pair.caseId,
        baselinePass: pair.baselinePass,
        candidatePass: pair.candidatePass,
        baselineCostUsd: pair.baselineCostUsd ?? null,
        candidateCostUsd: pair.candidateCostUsd ?? null,
        candidateCriticalSafety: pair.candidateCriticalSafety ?? false,
      })),
    }),
  );
}

export function loadGateEvidence(db: DatabaseSync, evalRunId: string): GateEvidence {
  const run = db.prepare('SELECT * FROM eval_runs WHERE id = ?').get(evalRunId) as
    | EvalRunRow
    | undefined;
  if (!run) refuse('E_LEARNING_DATASET_EMPTY', 'eval run not found', { evalRunId });
  if (run.status !== 'completed') {
    refuse('E_LEARNING_RUN_NOT_TERMINAL', 'eval run is not complete', { status: run.status });
  }
  const suiteUse = db
    .prepare('SELECT * FROM suite_uses WHERE suite_id = ?')
    .get(run.suite_id) as Record<string, unknown> | undefined;
  if (!suiteUse) refuse('E_LEARNING_EVIDENCE_TAMPERED', 'suite use row missing');
  if (String(suiteUse.eval_run_id) !== evalRunId) {
    refuse('E_LEARNING_EVIDENCE_TAMPERED', 'eval run is not the suite-use claimant');
  }
  if (String(suiteUse.candidate_id) !== run.variant_id) {
    refuse('E_LEARNING_EVIDENCE_TAMPERED', 'suite use candidate mismatch');
  }
  const variant = getVariant(db, run.variant_id);
  if (!variant) refuse('E_LEARNING_CANDIDATE_INVALID', 'variant not found', { variantId: run.variant_id });
  if (variant.baselineVersionId !== run.baseline_version_id) {
    refuse('E_LEARNING_VERSION_DRIFT', 'variant baseline differs from eval baseline');
  }
  const suite = db
    .prepare('SELECT id, manifest_hash FROM eval_suites WHERE id = ?')
    .get(run.suite_id) as { id: string; manifest_hash: string } | undefined;
  if (!suite) refuse('E_LEARNING_DATASET_EMPTY', 'suite not found');
  requireConsent(db, 'case_to_provider_eval');
  const activeBaseline = getActiveVersion(db, variant.kind, variant.targetAgentId);
  if (!activeBaseline) refuse('E_LEARNING_NO_BASELINE');
  if (activeBaseline !== run.baseline_version_id) {
    refuse('E_LEARNING_VERSION_DRIFT', 'active version changed after candidate creation', {
      activeBaseline,
      baseline: run.baseline_version_id,
    });
  }

  const holdout = db
    .prepare("SELECT case_id FROM eval_cases WHERE suite_id = ? AND split = 'holdout' ORDER BY case_id ASC")
    .all(run.suite_id) as Array<{ case_id: string }>;
  const resultRows = db
    .prepare('SELECT case_id, arm, outcome, checks_json, cost_usd, excluded_reason FROM eval_results WHERE eval_run_id = ?')
    .all(evalRunId) as unknown as ResultRow[];
  const byCase = new Map<string, { baseline?: ResultRow; candidate?: ResultRow }>();
  for (const row of resultRows) {
    const target = byCase.get(row.case_id) ?? {};
    if (row.arm === 'baseline') target.baseline = row;
    else if (row.arm === 'candidate') target.candidate = row;
    else refuse('E_LEARNING_EVIDENCE_TAMPERED', 'unknown eval arm', { arm: row.arm });
    byCase.set(row.case_id, target);
  }
  const pairs: PairedOutcome[] = [];
  let excludedPairs = 0;
  for (const item of holdout) {
    const pair = byCase.get(item.case_id);
    if (!pair?.baseline || !pair.candidate) {
      refuse('E_LEARNING_INSUFFICIENT_SAMPLE', 'holdout case does not have both arms', {
        caseId: item.case_id,
      });
    }
    if (pair.baseline.excluded_reason || pair.candidate.excluded_reason) excludedPairs += 1;
    let critical = false;
    try {
      const checks = JSON.parse(pair.candidate.checks_json) as { criticalSafety?: unknown };
      critical = checks.criticalSafety === true;
    } catch {
      critical = false;
    }
    const outcome = PairedOutcomeSchema.parse({
      caseId: item.case_id,
      baselinePass: pair.baseline.outcome === 'pass',
      candidatePass: pair.candidate.outcome === 'pass',
      baselineCostUsd: pair.baseline.cost_usd,
      candidateCostUsd: pair.candidate.cost_usd,
      candidateCriticalSafety: critical,
    });
    pairs.push(outcome);
  }
  pairs.sort((a, b) => a.caseId.localeCompare(b.caseId));

  const fingerprintStatus = (run.fingerprint_status ?? 'unavailable') as FingerprintStatus;
  const mode = run.mode;
  const provenance: LearningProvenance =
    mode === 'live' ? 'live' : mode === 'synthetic' ? 'synthetic' : 'mock';
  const familySize = (
    db
      .prepare('SELECT COUNT(*) AS n FROM variants WHERE candidate_family_id = ?')
      .get(variant.candidateFamilyId) as { n: number }
  ).n;
  const hash = computeEvidenceHash({
    suiteId: run.suite_id,
    suiteManifestHash: suite.manifest_hash,
    variantHash: variant.hash,
    baselineVersionId: run.baseline_version_id,
    model: run.model,
    mode,
    fingerprintStatus,
    pairs,
  });
  if (!run.evidence_hash || hash !== run.evidence_hash) {
    refuse('E_LEARNING_EVIDENCE_TAMPERED', 'eval evidence hash mismatch', {
      expected: run.evidence_hash,
      actual: hash,
    });
  }
  return {
    evalRunId,
    suiteId: run.suite_id,
    suiteUseId: String(suiteUse.suite_use_id),
    variantId: variant.id,
    variantHash: variant.hash,
    baselineVersionId: run.baseline_version_id,
    activeBaselineVersionId: activeBaseline,
    candidateFamilyId: variant.candidateFamilyId,
    candidateFamilySize: familySize,
    provenance,
    fingerprintStatus,
    evidenceHash: hash,
    expectedEvidenceHash: run.evidence_hash,
    pairs,
    excludedPairs,
    model: run.model,
    mode,
    suiteManifestHash: suite.manifest_hash,
  };
}

function costPerSuccess(pairs: PairedOutcome[], arm: 'baseline' | 'candidate'): number | null {
  let cost = 0;
  let successes = 0;
  for (const pair of pairs) {
    const value = arm === 'baseline' ? pair.baselineCostUsd : pair.candidateCostUsd;
    if (value == null) return null;
    cost += value;
    if (arm === 'baseline' ? pair.baselinePass : pair.candidatePass) successes += 1;
  }
  return successes === 0 ? null : cost / successes;
}

export function evaluatePromotionGate(
  evidence: GateEvidence,
  options: { requireLive?: boolean } = {},
): GateResult {
  const requireLive = options.requireLive ?? true;
  const reasons: string[] = [];
  const refuseGate = (code: RefusalCode, reason: string): GateResult => ({
    decision: 'refused',
    code,
    reasons: [...reasons, reason],
    metrics: null,
    alphaSpent: 0.05 / Math.max(1, evidence.candidateFamilySize),
    baselineCostPerSuccess: null,
    candidateCostPerSuccess: null,
  });
  if (evidence.pairs.length < 12) {
    return refuseGate('E_LEARNING_INSUFFICIENT_SAMPLE', 'fewer than 12 paired holdout cases');
  }
  if (evidence.pairs.length !== 50) {
    return refuseGate(
      'E_LEARNING_INSUFFICIENT_SAMPLE',
      `need exactly 50 paired holdout cases; got ${evidence.pairs.length}`,
    );
  }
  if (requireLive && evidence.provenance !== 'live') {
    return refuseGate('E_LEARNING_PROMOTION_REFUSED', 'mock or synthetic provenance cannot promote');
  }
  if (evidence.evidenceHash !== evidence.expectedEvidenceHash) {
    return refuseGate('E_LEARNING_EVIDENCE_TAMPERED', 'evidence hash mismatch');
  }
  if (evidence.baselineVersionId !== evidence.activeBaselineVersionId) {
    return refuseGate('E_LEARNING_VERSION_DRIFT', 'active baseline changed');
  }
  if (evidence.candidateFamilySize > 3) {
    return refuseGate('E_LEARNING_PROMOTION_REFUSED', 'candidate family exceeds 3');
  }
  if (evidence.fingerprintStatus === 'changed') {
    return {
      decision: 'inconclusive',
      code: 'E_LEARNING_PROMOTION_REFUSED',
      reasons: ['model fingerprint changed during evaluation'],
      metrics: null,
      alphaSpent: 0.05 / Math.max(1, evidence.candidateFamilySize),
      baselineCostPerSuccess: null,
      candidateCostPerSuccess: null,
    };
  }
  if (evidence.fingerprintStatus === 'unavailable') {
    return refuseGate('E_LEARNING_VERSION_DRIFT', 'model fingerprint unavailable; fresh replication required');
  }

  const alpha = 0.05 / Math.max(1, evidence.candidateFamilySize);
  const metrics = evaluateScreening(evidence.pairs, { alpha });
  const baselineCost = costPerSuccess(evidence.pairs, 'baseline');
  const candidateCost = costPerSuccess(evidence.pairs, 'candidate');
  const successDrop = metrics.baselineRate - metrics.candidateRate;
  if (metrics.criticalRegressions > 0) reasons.push('critical safety regression');
  if (successDrop > 0.02) reasons.push(`success drop ${(successDrop * 100).toFixed(2)} pp exceeds 2 pp`);
  if (baselineCost == null || candidateCost == null) {
    reasons.push('cost per successful task is unknown');
  } else if (baselineCost === 0) {
    reasons.push('baseline cost per success is zero; cost guard cannot be evaluated');
  } else if (candidateCost > baselineCost * 1.25) {
    reasons.push('candidate cost per successful task exceeds +25%');
  }
  if (metrics.lowerBound < 0.15) {
    reasons.push(
      `lower bound ${(metrics.lowerBound * 100).toFixed(2)} pp is below the +15 pp screening threshold`,
    );
  }
  const eligible = reasons.length === 0;
  return {
    decision: eligible ? 'promote_eligible' : 'no_promotion',
    code: eligible ? null : 'E_LEARNING_PROMOTION_REFUSED',
    reasons,
    metrics,
    alphaSpent: alpha,
    baselineCostPerSuccess: baselineCost,
    candidateCostPerSuccess: candidateCost,
  };
}

function recordGateDecision(
  db: DatabaseSync,
  evidence: GateEvidence,
  gate: GateResult,
): PromotionRecord {
  const decision = gate.decision === 'promote_eligible' ? 'no_promotion' : gate.decision;
  const id = `promo_${crypto.randomUUID()}`;
  const evidenceJson = JSON.stringify({
    gate,
    evalRunId: evidence.evalRunId,
    suiteUseId: evidence.suiteUseId,
    candidateHash: evidence.variantHash,
    evalHash: evidence.expectedEvidenceHash,
    baselineVersionId: evidence.baselineVersionId,
    candidateFamilyId: evidence.candidateFamilyId,
  });
  db.prepare(
    `INSERT INTO promotions
     (id, variant_id, baseline_version_id, decision, evidence_json, alpha_spent, approved_by, approved_at, rollback_of, notes)
     VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?)`,
  ).run(
    id,
    evidence.variantId,
    evidence.baselineVersionId,
    decision,
    evidenceJson,
    gate.alphaSpent,
    gate.reasons.join('; '),
  );
  return getPromotion(db, id)!;
}

export function getPromotion(db: DatabaseSync, promotionId: string): PromotionRecord | null {
  const row = db.prepare('SELECT * FROM promotions WHERE id = ?').get(promotionId) as
    | Record<string, unknown>
    | undefined;
  return row ? mapPromotion(row) : null;
}

export function listPromotions(db: DatabaseSync, limit = 100): PromotionRecord[] {
  const rows = db
    .prepare('SELECT * FROM promotions ORDER BY rowid DESC LIMIT ?')
    .all(Math.min(Math.max(limit, 1), 500)) as Array<Record<string, unknown>>;
  return rows.map(mapPromotion);
}

interface CreatedVersion {
  versionId: string;
  version: string;
  kind: string;
  targetAgentId: string;
}

function createVersionForVariant(
  db: DatabaseSync,
  variant: VariantRecord,
  createdAt: string,
): CreatedVersion {
  if (variant.kind === 'prompt') {
    const payload = variant.payload as { prompt?: string };
    if (!payload.prompt) refuse('E_LEARNING_CANDIDATE_INVALID', 'prompt payload missing');
    const hash = sha256(payload.prompt);
    const existing = db
      .prepare('SELECT id, version FROM prompt_versions WHERE agent_id = ? AND hash = ?')
      .get(variant.targetAgentId, hash) as { id: string; version: string } | undefined;
    if (existing) {
      return {
        versionId: existing.id,
        version: existing.version,
        kind: variant.kind,
        targetAgentId: variant.targetAgentId,
      };
    }
    const versionId = `pv_${crypto.randomUUID()}`;
    const version = `v-${hash.slice(0, 12)}`;
    db.prepare(
      `INSERT INTO prompt_versions (id, agent_id, version, hash, text, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(versionId, variant.targetAgentId, version, hash, payload.prompt, createdAt);
    return { versionId, version, kind: variant.kind, targetAgentId: variant.targetAgentId };
  }
  const json = JSON.stringify(variant.payload);
  const hash = sha256(json);
  const existing = db
    .prepare('SELECT id, version FROM policy_versions WHERE hash = ?')
    .get(hash) as { id: string; version: string } | undefined;
  if (existing) {
    return {
      versionId: existing.id,
      version: existing.version,
      kind: variant.kind,
      targetAgentId: variant.targetAgentId,
    };
  }
  const versionId = `pol_${crypto.randomUUID()}`;
  const version = `v-${hash.slice(0, 12)}`;
  db.prepare(
    `INSERT INTO policy_versions (id, version, hash, json, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(versionId, version, hash, json, createdAt);
  return { versionId, version, kind: variant.kind, targetAgentId: variant.targetAgentId };
}

export function promote(
  db: DatabaseSync,
  input: {
    evalRunId: string;
    approvalToken?: string;
    approvedBy?: string;
    approvalService?: ApprovalService;
  },
): { promotion: PromotionRecord; version: CreatedVersion; gate: GateResult } {
  const evidence = loadGateEvidence(db, input.evalRunId);
  const gate = evaluatePromotionGate(evidence);
  if (gate.decision !== 'promote_eligible') {
    recordGateDecision(db, evidence, gate);
    refuse((gate.code ?? 'E_LEARNING_PROMOTION_REFUSED') as RefusalCode, gate.reasons.join('; '), {
      reasons: gate.reasons,
      decision: gate.decision,
    });
  }
  if (!input.approvalToken) {
    refuse('E_LEARNING_APPROVAL_REQUIRED');
  }
  const approval = input.approvalService ?? createApprovalService();
  const expected: ApprovalBinding = {
    action: 'promote',
    candidateHash: evidence.variantHash,
    evalHash: evidence.expectedEvidenceHash,
    baselineVersionId: evidence.baselineVersionId,
    suiteUseId: evidence.suiteUseId,
  };
  const approvedAt = nowIso();
  const result = tx((database) => {
    const variant = getVariant(database, evidence.variantId);
    if (!variant) refuse('E_LEARNING_CANDIDATE_INVALID', 'variant vanished');
    const active = getActiveVersion(database, variant.kind, variant.targetAgentId);
    if (active !== evidence.baselineVersionId) {
      refuse('E_LEARNING_VERSION_DRIFT', 'active baseline changed before promotion');
    }
    const consumed = approval.consume({ token: input.approvalToken!, expected });
    const created = createVersionForVariant(database, variant, approvedAt);
    setVariantStatus(database, variant.id, 'promoted');
    setLastKnownGood(database, variant.kind, variant.targetAgentId, evidence.baselineVersionId);
    setActiveVersion(database, variant.kind, variant.targetAgentId, created.versionId);
    const promotionId = `promo_${crypto.randomUUID()}`;
    database.prepare(
      `INSERT INTO promotions
       (id, variant_id, baseline_version_id, decision, evidence_json, alpha_spent, approved_by, approved_at, rollback_of, notes)
       VALUES (?, ?, ?, 'promote', ?, ?, ?, ?, NULL, ?)`,
    ).run(
      promotionId,
      variant.id,
      evidence.baselineVersionId,
      JSON.stringify({
        gate,
        evalRunId: evidence.evalRunId,
        suiteUseId: evidence.suiteUseId,
        candidateHash: evidence.variantHash,
        evalHash: evidence.expectedEvidenceHash,
        baselineVersionId: evidence.baselineVersionId,
        candidateFamilyId: evidence.candidateFamilyId,
        kind: variant.kind,
        targetAgentId: variant.targetAgentId,
        fromVersionId: evidence.baselineVersionId,
        toVersionId: created.versionId,
        approvalJti: consumed.jti,
      }),
      gate.alphaSpent,
      input.approvedBy ?? 'user',
      approvedAt,
      'promotion approved by single-use token',
    );
    database.prepare(
      `INSERT INTO post_promotion_monitor
       (promotion_id, started_at, window_runs, window_days, status, rolled_back_at, trigger)
       VALUES (?, ?, 20, 14, 'monitoring', NULL, NULL)`,
    ).run(promotionId, approvedAt);
    database.prepare(
      `INSERT INTO learning_audit (id, actor, action, before_hash, after_hash, reason, created_at)
       VALUES (?, ?, 'promote', ?, ?, ?, ?)`,
    ).run(
      `aud_${crypto.randomUUID()}`,
      input.approvedBy ?? 'user',
      evidence.baselineVersionId,
      created.versionId,
      'promotion',
      approvedAt,
    );
    return {
      promotion: getPromotion(database, promotionId)!,
      version: created,
      gate,
    };
  });
  return result;
}

function parsePromotionEvidence(promotion: PromotionRecord): {
  kind: string;
  targetAgentId: string;
  fromVersionId: string;
  toVersionId: string;
  candidateHash: string;
  evalHash: string;
  suiteUseId: string;
} {
  try {
    const parsed = JSON.parse(promotion.evidenceJson) as Record<string, unknown>;
    return {
      kind: String(parsed.kind ?? 'prompt'),
      targetAgentId: String(parsed.targetAgentId ?? ''),
      fromVersionId: String(parsed.fromVersionId ?? promotion.baselineVersionId),
      toVersionId: String(parsed.toVersionId ?? ''),
      candidateHash: String(parsed.candidateHash ?? ''),
      evalHash: String(parsed.evalHash ?? ''),
      suiteUseId: String(parsed.suiteUseId ?? ''),
    };
  } catch {
    refuse('E_LEARNING_EVIDENCE_TAMPERED', 'promotion evidence is malformed');
  }
}

function performRollback(
  db: DatabaseSync,
  promotion: PromotionRecord,
  actor: string,
  reason: string,
  approvalToken?: string,
  approvalService?: ApprovalService,
): PromotionRecord {
  const evidence = parsePromotionEvidence(promotion);
  if (!evidence.kind || !evidence.targetAgentId) {
    refuse('E_LEARNING_ROLLBACK_UNAVAILABLE', 'promotion target is incomplete');
  }
  const lkg = getLastKnownGood(db, evidence.kind, evidence.targetAgentId);
  if (!lkg) refuse('E_LEARNING_ROLLBACK_UNAVAILABLE', 'no last-known-good version');
  if (!approvalToken && actor === 'user') {
    refuse('E_LEARNING_APPROVAL_REQUIRED');
  }
  const rolledBackAt = nowIso();
  const rollback = tx((database) => {
    if (approvalToken) {
      const approval = approvalService ?? createApprovalService();
      approval.consume({
        token: approvalToken,
        expected: {
          action: 'rollback',
          candidateHash: evidence.candidateHash,
          evalHash: evidence.evalHash,
          baselineVersionId: promotion.baselineVersionId,
          suiteUseId: evidence.suiteUseId,
        },
      });
    }
    setActiveVersion(database, evidence.kind, evidence.targetAgentId, lkg);
    const id = `promo_${crypto.randomUUID()}`;
    database.prepare(
      `INSERT INTO promotions
       (id, variant_id, baseline_version_id, decision, evidence_json, alpha_spent, approved_by, approved_at, rollback_of, notes)
       VALUES (?, ?, ?, 'rollback', ?, NULL, ?, ?, ?, ?)`,
    ).run(
      id,
      promotion.variantId,
      promotion.baselineVersionId,
      JSON.stringify({
        kind: evidence.kind,
        targetAgentId: evidence.targetAgentId,
        fromVersionId: evidence.toVersionId,
        toVersionId: lkg,
        reason,
      }),
      actor,
      rolledBackAt,
      promotion.id,
      reason,
    );
    database.prepare(
      `INSERT INTO learning_audit (id, actor, action, before_hash, after_hash, reason, created_at)
       VALUES (?, ?, 'rollback', ?, ?, ?, ?)`,
    ).run(
      `aud_${crypto.randomUUID()}`,
      actor,
      evidence.toVersionId,
      lkg,
      reason,
      rolledBackAt,
    );
    return getPromotion(database, id)!;
  });
  db.prepare(
    `UPDATE post_promotion_monitor
     SET status = 'rolled_back', rolled_back_at = ?, trigger = ?
     WHERE promotion_id = ?`,
  ).run(rolledBackAt, reason, promotion.id);
  return rollback;
}

export function rollback(
  db: DatabaseSync,
  input: {
    promotionId: string;
    approvalToken?: string;
    actor?: string;
    reason?: string;
    approvalService?: ApprovalService;
  },
): PromotionRecord {
  const promotion = getPromotion(db, input.promotionId);
  if (!promotion) refuse('E_LEARNING_ROLLBACK_UNAVAILABLE', 'promotion not found');
  if (promotion.decision !== 'promote') {
    refuse('E_LEARNING_ROLLBACK_UNAVAILABLE', 'promotion is not active');
  }
  return performRollback(
    db,
    promotion,
    input.actor ?? 'user',
    input.reason ?? 'manual rollback',
    input.approvalToken,
    input.approvalService,
  );
}

export function autoRollback(
  db: DatabaseSync,
  promotionId: string,
  reason: string,
): PromotionRecord {
  const promotion = getPromotion(db, promotionId);
  if (!promotion) refuse('E_LEARNING_ROLLBACK_UNAVAILABLE', 'promotion not found');
  return performRollback(db, promotion, 'monitor', reason);
}

export function getMonitor(db: DatabaseSync, promotionId: string): MonitorRecord | null {
  const row = db
    .prepare('SELECT * FROM post_promotion_monitor WHERE promotion_id = ?')
    .get(promotionId) as Record<string, unknown> | undefined;
  return row ? mapMonitor(row) : null;
}

export interface MonitorObservation {
  promotionId: string;
  gatePass: boolean;
  criticalSafety: boolean;
  costUsd?: number | null;
  baselineCostUsd?: number | null;
  at?: string;
}

export function recordMonitorObservation(
  db: DatabaseSync,
  observation: MonitorObservation,
): MonitorRecord {
  const monitor = getMonitor(db, observation.promotionId);
  if (!monitor) refuse('E_LEARNING_ROLLBACK_UNAVAILABLE', 'monitor not found');
  if (monitor.status !== 'monitoring') return monitor;
  const key = `learning.monitor.${observation.promotionId}`;
  const raw = getSetting(db, key);
  let state = { runs: 0, consecutiveFailures: 0 };
  if (raw) {
    try {
      state = JSON.parse(raw) as { runs: number; consecutiveFailures: number };
    } catch {
      state = { runs: 0, consecutiveFailures: 0 };
    }
  }
  state.runs += 1;
  state.consecutiveFailures = observation.gatePass ? 0 : state.consecutiveFailures + 1;
  setSetting(db, key, JSON.stringify(state));
  if (observation.criticalSafety) {
    autoRollback(db, observation.promotionId, 'critical safety during post-promotion monitor');
    return getMonitor(db, observation.promotionId)!;
  }
  const elapsedDays =
    (Date.now() - Date.parse(monitor.startedAt)) / (24 * 60 * 60 * 1000);
  if (state.runs >= monitor.windowRuns || elapsedDays >= monitor.windowDays) {
    db.prepare("UPDATE post_promotion_monitor SET status = 'completed' WHERE promotion_id = ?").run(
      observation.promotionId,
    );
  } else if (state.consecutiveFailures >= 2) {
    db.prepare(
      "UPDATE post_promotion_monitor SET status = 'paused_review', trigger = 'two_consecutive_failures' WHERE promotion_id = ?",
    ).run(observation.promotionId);
  } else if (
    observation.costUsd != null &&
    observation.baselineCostUsd != null &&
    observation.baselineCostUsd > 0 &&
    observation.costUsd > observation.baselineCostUsd * 1.25
  ) {
    db.prepare(
      "UPDATE post_promotion_monitor SET status = 'paused_review', trigger = 'cost_over_25pct' WHERE promotion_id = ?",
    ).run(observation.promotionId);
  }
  return getMonitor(db, observation.promotionId)!;
}
