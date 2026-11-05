import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initDb, tx } from '../../src/server/db/database.js';
import {
  claimSuite,
  computeEvidenceHash,
  createApprovalService,
  createSealedBlock,
  createSuiteFromBlock,
  createVariant,
  evaluatePromotionGate,
  getActiveVersion,
  getLastKnownGood,
  getMonitor,
  getPromotion,
  grantConsent,
  loadGateEvidence,
  promote,
  recordMonitorObservation,
  rollback,
  setActiveVersion,
  type ApprovalBinding,
  type PairedOutcome,
  type SealedCase,
} from '../../src/server/learning/index.js';

let rootDir: string;
let nowValue: Date;
const secret = Buffer.alloc(32, 9);

function makeCases(blockId: string): SealedCase[] {
  const cases: SealedCase[] = [];
  for (let i = 0; i < 65; i += 1) {
    cases.push({
      caseId: `${blockId}_case_${i}`,
      source: 'curated-fixture',
      license: 'CC0-1.0',
      consentId: null,
      capturedAt: '2026-11-03T00:00:00.000Z',
      split: i < 15 ? 'dev' : 'holdout',
      brief: `Promotion fixture ${blockId} ${i}`,
      fixture: { index: i },
      expected: { gatePass: true },
    });
  }
  return cases;
}

function approvalService() {
  return createApprovalService({ secret, now: () => nowValue, ttlMs: 10 * 60 * 1000 });
}

function seedEvaluation(): {
  variantId: string;
  variantHash: string;
  suiteId: string;
  suiteManifestHash: string;
  suiteUseId: string;
  evalRunId: string;
  evidenceHash: string;
  holdoutCaseIds: string[];
} {
  const db = getDb();
  const baselineId = 'pv-base';
  db.prepare(
    `INSERT INTO prompt_versions (id, agent_id, version, hash, text, created_at)
     VALUES (?, 'python-engine', 'v1', 'base-hash', 'Baseline prompt for Python engine.', 'now')`,
  ).run(baselineId);
  setActiveVersion(db, 'prompt', 'python-engine', baselineId);
  const variant = createVariant(db, {
    kind: 'prompt',
    targetAgentId: 'python-engine',
    parentVersionId: baselineId,
    baselineVersionId: baselineId,
    candidateFamilyId: 'promotion-family',
    payload: { prompt: 'Baseline prompt for Python engine. Always emit complete JSON.' },
    hypothesis: 'A stricter JSON instruction improves gate pass rate.',
    createdBy: 'human',
  });
  createSealedBlock(db, { blockId: 'promotion-block', cases: makeCases('promotion-block'), rootDir });
  const { suite } = createSuiteFromBlock(db, {
    blockId: 'promotion-block',
    name: 'promotion-suite',
    version: 1,
    rootDir,
  });
  const evalRunId = 'eval-live-1';
  const use = claimSuite(db, {
    suiteId: suite.id,
    candidateId: variant.id,
    evalRunId,
  });
  db.prepare(
    `INSERT INTO eval_runs
     (id, suite_id, suite_use_id, variant_id, baseline_version_id, model, mode, status, started_at, finished_at, total_cost_usd, metrics_json, evidence_hash, fingerprint_status)
     VALUES (?, ?, ?, ?, ?, 'deepseek-flash', 'live', 'completed', 'now', 'now', 1.0, NULL, NULL, 'stable')`,
  ).run(evalRunId, suite.id, use.suiteUseId, variant.id, baselineId);

  const all = db
    .prepare("SELECT case_id FROM eval_cases WHERE suite_id = ? AND split = 'holdout' ORDER BY case_id ASC")
    .all(suite.id) as Array<{ case_id: string }>;
  const holdoutCaseIds = all.map((row) => row.case_id);
  const pairs: PairedOutcome[] = holdoutCaseIds.map((caseId, index) => ({
    caseId,
    baselinePass: index < 10,
    candidatePass: true,
    baselineCostUsd: 0.01,
    candidateCostUsd: 0.01,
    candidateCriticalSafety: false,
  }));
  tx((database) => {
    const insert = database.prepare(
      `INSERT INTO eval_results
       (id, eval_run_id, case_id, arm, outcome, checks_json, cost_usd, latency_ms, excluded_reason)
       VALUES (?, ?, ?, ?, ?, '{"criticalSafety":false}', 0.01, 1, NULL)`,
    );
    for (const [index, caseId] of holdoutCaseIds.entries()) {
      const baselineOutcome = index < 10 ? 'pass' : 'fail';
      insert.run(`res-b-${index}`, evalRunId, caseId, 'baseline', baselineOutcome);
      insert.run(`res-c-${index}`, evalRunId, caseId, 'candidate', 'pass');
    }
  });
  const evidenceHash = computeEvidenceHash({
    suiteId: suite.id,
    suiteManifestHash: suite.manifestHash,
    variantHash: variant.hash,
    baselineVersionId: baselineId,
    model: 'deepseek-flash',
    mode: 'live',
    fingerprintStatus: 'stable',
    pairs,
  });
  db.prepare('UPDATE eval_runs SET evidence_hash = ? WHERE id = ?').run(evidenceHash, evalRunId);
  return {
    variantId: variant.id,
    variantHash: variant.hash,
    suiteId: suite.id,
    suiteManifestHash: suite.manifestHash,
    suiteUseId: use.suiteUseId,
    evalRunId,
    evidenceHash,
    holdoutCaseIds,
  };
}

beforeEach(() => {
  closeDb();
  initDb(':memory:', 'B2');
  grantConsent(getDb(), 'case_to_provider_eval');
  rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-learning-promotion-'));
  nowValue = new Date('2026-11-03T12:00:00.000Z');
});

afterEach(() => {
  closeDb();
  fs.rmSync(rootDir, { recursive: true, force: true });
});

describe('learning promotion and rollback', () => {
  it('gates a live evaluation, promotes only with a token, and rolls back', () => {
    const seeded = seedEvaluation();
    const evidence = loadGateEvidence(getDb(), seeded.evalRunId);
    expect(evidence.pairs).toHaveLength(50);
    expect(evidence.pairs.filter((pair) => pair.candidatePass)).toHaveLength(50);
    expect(evaluatePromotionGate(evidence).decision).toBe('promote_eligible');

    const approval = approvalService();
    const binding: ApprovalBinding = {
      action: 'promote',
      candidateHash: seeded.variantHash,
      evalHash: seeded.evidenceHash,
      baselineVersionId: 'pv-base',
      suiteUseId: seeded.suiteUseId,
    };
    expect(() => promote(getDb(), { evalRunId: seeded.evalRunId, approvalService: approval })).toThrow(
      /approval token is required/i,
    );
    const issued = approval.issue(binding);
    const result = promote(getDb(), {
      evalRunId: seeded.evalRunId,
      approvalToken: issued.token,
      approvalService: approval,
      approvedBy: 'tester',
    });
    expect(result.promotion.decision).toBe('promote');
    expect(result.version.versionId).not.toBe('pv-base');
    expect(getActiveVersion(getDb(), 'prompt', 'python-engine')).toBe(result.version.versionId);
    expect(getLastKnownGood(getDb(), 'prompt', 'python-engine')).toBe('pv-base');
    expect(getMonitor(getDb(), result.promotion.id)?.status).toBe('monitoring');

    recordMonitorObservation(getDb(), {
      promotionId: result.promotion.id,
      gatePass: false,
      criticalSafety: false,
    });
    const paused = recordMonitorObservation(getDb(), {
      promotionId: result.promotion.id,
      gatePass: false,
      criticalSafety: false,
    });
    expect(paused.status).toBe('paused_review');
    expect(paused.trigger).toBe('two_consecutive_failures');

    const rollbackBinding: ApprovalBinding = { ...binding, action: 'rollback' };
    const rollbackToken = approval.issue(rollbackBinding);
    const rollbackRecord = rollback(getDb(), {
      promotionId: result.promotion.id,
      approvalToken: rollbackToken.token,
      approvalService: approval,
      actor: 'user',
      reason: 'test rollback',
    });
    expect(rollbackRecord.decision).toBe('rollback');
    expect(getActiveVersion(getDb(), 'prompt', 'python-engine')).toBe('pv-base');
    expect(getMonitor(getDb(), result.promotion.id)?.status).toBe('rolled_back');
    expect(getPromotion(getDb(), result.promotion.id)?.decision).toBe('promote');
  });

  it('refuses tampered evidence before any promotion', () => {
    const seeded = seedEvaluation();
    getDb()
      .prepare('UPDATE eval_runs SET evidence_hash = ? WHERE id = ?')
      .run('tampered-hash', seeded.evalRunId);
    expect(() => loadGateEvidence(getDb(), seeded.evalRunId)).toThrow(/evidence hash mismatch/);
  });
});
