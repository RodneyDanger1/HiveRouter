import { afterEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initDb, nowIso } from '../../src/server/db/database.js';
import { buildLearningOverview } from '../../src/server/learning/overview.js';
import { grantConsent } from '../../src/server/learning/consent.js';

afterEach(() => closeDb());

function addBlock(id: string, cases: number): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO sealed_pool_blocks (block_id, status, dev_count, holdout_count, used_by_suite_id, created_at) VALUES (?, 'ready', 15, 50, NULL, ?)",
  ).run(id, nowIso());
  const insertCase = db.prepare(
    'INSERT INTO sealed_pool (case_id, block_id, case_index, source, license, consent_id, captured_at, hash, redaction_scan) VALUES (?,?,?,?,?,?,?,?,?)',
  );
  for (let index = 0; index < cases; index += 1) {
    insertCase.run(`${id}_c${index}`, id, index, 'fixture', 'CC0', null, nowIso(), `hash_${id}_${index}`, 'clean');
  }
}

describe('learning overview truth', () => {
  it('does not call an incomplete block a complete sealed pool', () => {
    initDb(':memory:');
    addBlock('block_partial', 10);
    const view = buildLearningOverview(getDb(), 'B2');
    expect(view.counts.sealedBlocks).toBe(1);
    expect(view.counts.completeSealedBlocks).toBe(0);
    expect(view.reason).toBe('E_LEARNING_POOL_EXHAUSTED');
  });

  it('distinguishes active consent scopes instead of counting a revoked/other scope', () => {
    initDb(':memory:');
    for (let index = 0; index < 6; index += 1) addBlock(`block_${index}`, 65);
    grantConsent(getDb(), 'trace_retention');
    const view = buildLearningOverview(getDb(), 'B2');
    expect(view.counts.completeSealedBlocks).toBe(6);
    expect(view.consent.traceRetention).toBe(true);
    expect(view.consent.caseToProviderEval).toBe(false);
    expect(view.reason).toBe('E_LEARNING_CONSENT_REQUIRED');
    expect(view.consentRequired).toBe(true);
  });

  it('reports insufficient sample after pool and eval consent, not a fake enabled loop', () => {
    initDb(':memory:');
    for (let index = 0; index < 6; index += 1) addBlock(`block_${index}`, 65);
    grantConsent(getDb(), 'case_to_provider_eval');
    const view = buildLearningOverview(getDb(), 'B2');
    expect(view.reason).toBe('E_LEARNING_INSUFFICIENT_SAMPLE');
    expect(view.enabled).toBe(false);
  });
});
