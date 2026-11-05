import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initDb } from '../../src/server/db/database.js';
import {
  assertHoldoutTarget,
  claimSuite,
  createSealedBlock,
  createSuiteFromBlock,
  ensureSealedPoolReady,
  getSuite,
  getSuiteCases,
  getSuiteUse,
  grantConsent,
  loadSealedCase,
  type SealedCase,
} from '../../src/server/learning/index.js';

let rootDir: string;

function makeCases(blockId: string): SealedCase[] {
  const cases: SealedCase[] = [];
  for (let i = 0; i < 65; i += 1) {
    cases.push({
      caseId: `${blockId}_case_${i}`,
      source: 'curated-fixture',
      license: 'CC0-1.0',
      consentId: null,
      capturedAt: new Date().toISOString(),
      split: i < 15 ? 'dev' : 'holdout',
      brief: `Build fixture ${blockId} number ${i} with a small deterministic task.`,
      fixture: { index: i, blockId },
      expected: { gatePass: true },
    });
  }
  return cases;
}

beforeEach(() => {
  closeDb();
  initDb(':memory:', 'B2');
  grantConsent(getDb(), 'case_to_provider_eval');
  rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-learning-pool-'));
});

afterEach(() => {
  closeDb();
  fs.rmSync(rootDir, { recursive: true, force: true });
});

describe('sealed pool and single-use suites', () => {
  it('requires six complete 65-case blocks before P7 can evaluate', () => {
    const db = getDb();
    for (let i = 0; i < 5; i += 1) {
      createSealedBlock(db, { blockId: `block-${i}`, cases: makeCases(`block-${i}`), rootDir });
    }
    expect(() => ensureSealedPoolReady(db)).toThrow(/sealed pool is below the 6-block minimum/);
    createSealedBlock(db, { blockId: 'block-5', cases: makeCases('block-5'), rootDir });
    expect(ensureSealedPoolReady(db)).toHaveLength(6);
  });

  it('freezes a 15-dev/50-holdout suite and protects holdout reads', () => {
    const db = getDb();
    createSealedBlock(db, { blockId: 'block-a', cases: makeCases('block-a'), rootDir });
    const loaded = loadSealedCase(db, 'block-a_case_0', rootDir);
    expect(loaded.entry.caseId).toBe('block-a_case_0');
    const { suite } = createSuiteFromBlock(db, {
      blockId: 'block-a',
      name: 'fixture-suite',
      version: 1,
      rootDir,
    });
    expect(suite.devCount).toBe(15);
    expect(suite.holdoutCount).toBe(50);
    assertHoldoutTarget(suite);
    expect(getSuiteCases(db, suite.id, 'eval')).toHaveLength(65);
    expect(getSuiteCases(db, suite.id, 'mining')).toHaveLength(15);
    expect(getSuiteCases(db, suite.id, 'inspect')).toHaveLength(15);
  });

  it('claims a suite exactly once, before any provider spend', () => {
    const db = getDb();
    createSealedBlock(db, { blockId: 'block-b', cases: makeCases('block-b'), rootDir });
    const { suite } = createSuiteFromBlock(db, {
      blockId: 'block-b',
      name: 'claim-suite',
      version: 1,
      rootDir,
    });
    const use = claimSuite(db, {
      suiteId: suite.id,
      candidateId: 'variant-x',
      evalRunId: 'eval-x',
    });
    expect(use.status).toBe('claimed');
    expect(getSuiteUse(db, suite.id)?.evalRunId).toBe('eval-x');
    expect(() =>
      claimSuite(db, {
        suiteId: suite.id,
        candidateId: 'variant-y',
        evalRunId: 'eval-y',
      }),
    ).toThrow(/already been claimed/);
  });

  it('refuses a block whose suite was already frozen', () => {
    const db = getDb();
    createSealedBlock(db, { blockId: 'block-c', cases: makeCases('block-c'), rootDir });
    createSuiteFromBlock(db, { blockId: 'block-c', name: 'one', version: 1, rootDir });
    expect(() =>
      createSuiteFromBlock(db, { blockId: 'block-c', name: 'two', version: 2, rootDir }),
    ).toThrow(/already claimed/);
    expect(getSuite(db, 'missing')).toBeNull();
  });
});
