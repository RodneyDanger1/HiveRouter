import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';
import { nowIso, tx } from '../db/database.js';
import { containsSecret, sha256 } from '../security/redact.js';
import { requireConsent } from './consent.js';
import {
  BLOCK_CASES,
  DEV_TARGET,
  HOLDOUT_TARGET,
  MIN_SEALED_BLOCKS,
  SealedCaseSchema,
  type SealedCase,
} from './contracts.js';
import { refuse } from './errors.js';

export interface SealedBlock {
  blockId: string;
  status: string;
  devCount: number;
  holdoutCount: number;
  usedBySuiteId: string | null;
  createdAt: string;
}

export interface SealedPoolCaseRow {
  caseId: string;
  blockId: string;
  caseIndex: number;
  source: string;
  license: string;
  consentId: string | null;
  capturedAt: string;
  hash: string;
  redactionScan: string;
}

export interface EvalSuite {
  id: string;
  name: string;
  version: number;
  blockId: string;
  devCount: number;
  holdoutCount: number;
  metricId: string;
  frozenAt: string;
  splitHash: string;
  manifestHash: string;
  createdAt: string;
}

export interface EvalCaseRow {
  caseId: string;
  suiteId: string;
  split: 'dev' | 'holdout';
  brief: string;
  fixtureJson: string;
  expectedJson: string;
  provenance: string;
  hash: string;
  contentHash: string;
  redactionScan: string;
  tombstonedAt: string | null;
}

export interface SuiteUse {
  suiteUseId: string;
  suiteId: string;
  suiteVersion: number;
  blockId: string;
  candidateId: string;
  evalRunId: string;
  claimedAt: string;
  status: string;
}

function assertId(value: string, label: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    refuse('E_LEARNING_EVIDENCE_TAMPERED', `invalid ${label}`);
  }
}

function poolRoot(rootDir?: string): string {
  return rootDir ?? path.join(config.dataDir, 'learning', 'pool');
}

function blockDir(root: string, blockId: string): string {
  assertId(blockId, 'block id');
  return path.join(root, blockId);
}

function caseFile(root: string, blockId: string, caseId: string): string {
  assertId(caseId, 'case id');
  return path.join(blockDir(root, blockId), `${caseId}.json`);
}

export function sealedCaseHash(entry: SealedCase): string {
  return sha256(JSON.stringify({ brief: entry.brief, fixture: entry.fixture, expected: entry.expected }));
}

function mapBlock(row: Record<string, unknown>): SealedBlock {
  return {
    blockId: String(row.block_id),
    status: String(row.status),
    devCount: Number(row.dev_count),
    holdoutCount: Number(row.holdout_count),
    usedBySuiteId: row.used_by_suite_id == null ? null : String(row.used_by_suite_id),
    createdAt: String(row.created_at),
  };
}

function mapSuite(row: Record<string, unknown>): EvalSuite {
  return {
    id: String(row.id),
    name: String(row.name),
    version: Number(row.version),
    blockId: String(row.block_id),
    devCount: Number(row.dev_count),
    holdoutCount: Number(row.holdout_count),
    metricId: String(row.metric_id),
    frozenAt: String(row.frozen_at),
    splitHash: String(row.split_hash),
    manifestHash: String(row.manifest_hash),
    createdAt: String(row.created_at),
  };
}

function mapCase(row: Record<string, unknown>): EvalCaseRow {
  return {
    caseId: String(row.case_id),
    suiteId: String(row.suite_id),
    split: String(row.split) as 'dev' | 'holdout',
    brief: String(row.brief),
    fixtureJson: String(row.fixture_json),
    expectedJson: String(row.expected_json),
    provenance: String(row.provenance),
    hash: String(row.hash),
    contentHash: String(row.content_hash),
    redactionScan: String(row.redaction_scan),
    tombstonedAt: row.tombstoned_at == null ? null : String(row.tombstoned_at),
  };
}

function mapUse(row: Record<string, unknown>): SuiteUse {
  return {
    suiteUseId: String(row.suite_use_id),
    suiteId: String(row.suite_id),
    suiteVersion: Number(row.suite_version),
    blockId: String(row.block_id),
    candidateId: String(row.candidate_id),
    evalRunId: String(row.eval_run_id),
    claimedAt: String(row.claimed_at),
    status: String(row.status),
  };
}

export function createSealedBlock(
  db: DatabaseSync,
  input: {
    blockId: string;
    cases: SealedCase[];
    consentId?: string;
    rootDir?: string;
  },
): SealedBlock {
  assertId(input.blockId, 'block id');
  const parsed = input.cases.map((item) => SealedCaseSchema.parse(item));
  if (parsed.length !== BLOCK_CASES) {
    refuse('E_LEARNING_DATASET_EMPTY', `sealed block requires exactly ${BLOCK_CASES} cases`, {
      count: parsed.length,
    });
  }
  const dev = parsed.filter((item) => item.split === 'dev');
  const holdout = parsed.filter((item) => item.split === 'holdout');
  if (dev.length !== DEV_TARGET || holdout.length !== HOLDOUT_TARGET) {
    refuse('E_LEARNING_DATASET_EMPTY', 'sealed block requires 15 dev + 50 holdout cases', {
      dev: dev.length,
      holdout: holdout.length,
    });
  }
  const caseIds = new Set<string>();
  const contentHashes = new Set<string>();
  for (const item of [...dev, ...holdout]) {
    if (caseIds.has(item.caseId)) {
      refuse('E_LEARNING_EVIDENCE_TAMPERED', 'duplicate case id in sealed block', { caseId: item.caseId });
    }
    caseIds.add(item.caseId);
    const hash = sealedCaseHash(item);
    if (contentHashes.has(hash)) {
      refuse('E_LEARNING_EVIDENCE_TAMPERED', 'duplicate case content in sealed block', {
        caseId: item.caseId,
      });
    }
    contentHashes.add(hash);
    if (containsSecret(JSON.stringify({ brief: item.brief, fixture: item.fixture, expected: item.expected }))) {
      refuse('E_LEARNING_REDACTION_BLOCKED', 'sealed case contains a secret-shaped value', {
        caseId: item.caseId,
      });
    }
  }
  const consent = requireConsent(db, 'case_to_provider_eval');
  const consentId = input.consentId ?? consent.id;
  const existing = db
    .prepare('SELECT block_id FROM sealed_pool_blocks WHERE block_id = ?')
    .get(input.blockId);
  if (existing) {
    refuse('E_LEARNING_DATASET_EMPTY', 'sealed block id already exists', {
      blockId: input.blockId,
    });
  }

  const root = poolRoot(input.rootDir);
  fs.mkdirSync(blockDir(root, input.blockId), { recursive: true });
  const ordered = [...dev, ...holdout];
  tx((database) => {
    database.prepare(
      `INSERT INTO sealed_pool_blocks (block_id, status, dev_count, holdout_count, used_by_suite_id, created_at)
       VALUES (?, 'ready', ?, ?, NULL, ?)`,
    ).run(input.blockId, DEV_TARGET, HOLDOUT_TARGET, nowIso());
    const insertCase = database.prepare(
      `INSERT INTO sealed_pool
       (case_id, block_id, case_index, source, license, consent_id, captured_at, hash, redaction_scan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'clean')`,
    );
    for (const [index, item] of ordered.entries()) {
      const hash = sealedCaseHash(item);
      insertCase.run(
        item.caseId,
        input.blockId,
        index,
        item.source,
        item.license,
        consentId,
        item.capturedAt,
        hash,
      );
      fs.writeFileSync(
        caseFile(root, input.blockId, item.caseId),
        JSON.stringify({ case: item, hash }),
        { mode: 0o600, encoding: 'utf8' },
      );
    }
  });
  return getSealedBlock(db, input.blockId)!;
}

export function getSealedBlock(db: DatabaseSync, blockId: string): SealedBlock | null {
  const row = db
    .prepare('SELECT * FROM sealed_pool_blocks WHERE block_id = ?')
    .get(blockId) as Record<string, unknown> | undefined;
  return row ? mapBlock(row) : null;
}

export function listSealedBlocks(db: DatabaseSync): SealedBlock[] {
  const rows = db
    .prepare('SELECT * FROM sealed_pool_blocks ORDER BY created_at ASC')
    .all() as Array<Record<string, unknown>>;
  return rows.map(mapBlock);
}

export function ensureSealedPoolReady(
  db: DatabaseSync,
  required = MIN_SEALED_BLOCKS,
): SealedBlock[] {
  const blocks = listSealedBlocks(db).filter((block) => block.status === 'ready');
  const complete = blocks.filter((block) => {
    const row = db
      .prepare('SELECT COUNT(*) AS n FROM sealed_pool WHERE block_id = ?')
      .get(block.blockId) as { n: number };
    return row.n === BLOCK_CASES;
  });
  if (complete.length < required) {
    refuse('E_LEARNING_POOL_EXHAUSTED', 'sealed pool is below the 6-block minimum', {
      required,
      available: complete.length,
    });
  }
  return complete;
}

export function loadSealedCase(
  db: DatabaseSync,
  caseId: string,
  rootDir?: string,
): { entry: SealedCase; hash: string; row: SealedPoolCaseRow } {
  const row = db
    .prepare('SELECT * FROM sealed_pool WHERE case_id = ?')
    .get(caseId) as Record<string, unknown> | undefined;
  if (!row) refuse('E_LEARNING_DATASET_EMPTY', 'sealed case not found', { caseId });
  const record: SealedPoolCaseRow = {
    caseId: String(row.case_id),
    blockId: String(row.block_id),
    caseIndex: Number(row.case_index),
    source: String(row.source),
    license: String(row.license),
    consentId: row.consent_id == null ? null : String(row.consent_id),
    capturedAt: String(row.captured_at),
    hash: String(row.hash),
    redactionScan: String(row.redaction_scan),
  };
  const root = poolRoot(rootDir);
  const raw = fs.readFileSync(caseFile(root, record.blockId, record.caseId), 'utf8');
  const parsed = JSON.parse(raw) as { case: SealedCase; hash: string };
  if (parsed.hash !== record.hash || sealedCaseHash(parsed.case) !== record.hash) {
    refuse('E_LEARNING_EVIDENCE_TAMPERED', 'sealed case hash mismatch', { caseId });
  }
  return { entry: SealedCaseSchema.parse(parsed.case), hash: record.hash, row: record };
}

export function createSuiteFromBlock(
  db: DatabaseSync,
  input: {
    blockId: string;
    name: string;
    version: number;
    rootDir?: string;
  },
): { suite: EvalSuite; cases: EvalCaseRow[] } {
  const block = getSealedBlock(db, input.blockId);
  if (!block) refuse('E_LEARNING_DATASET_EMPTY', 'sealed block not found', { blockId: input.blockId });
  if (block.usedBySuiteId) {
    refuse('E_LEARNING_SUITE_ALREADY_USED', 'sealed block already claimed by a suite', {
      blockId: input.blockId,
      suiteId: block.usedBySuiteId,
    });
  }
  requireConsent(db, 'case_to_provider_eval');
  const rows = db
    .prepare('SELECT case_id FROM sealed_pool WHERE block_id = ? ORDER BY case_index ASC')
    .all(input.blockId) as Array<{ case_id: string }>;
  if (rows.length !== BLOCK_CASES) {
    refuse('E_LEARNING_DATASET_EMPTY', 'sealed block is incomplete', {
      blockId: input.blockId,
      count: rows.length,
    });
  }
  const loaded = rows.map((row) => loadSealedCase(db, row.case_id, input.rootDir));
  const dev = loaded.filter((item) => item.entry.split === 'dev');
  const holdout = loaded.filter((item) => item.entry.split === 'holdout');
  if (dev.length !== DEV_TARGET || holdout.length !== HOLDOUT_TARGET) {
    refuse('E_LEARNING_DATASET_EMPTY', 'sealed block split is invalid');
  }
  const suiteId = `suite_${crypto.randomUUID()}`;
  const splitHash = sha256(
    JSON.stringify({
      dev: dev.map((item) => item.hash),
      holdout: holdout.map((item) => item.hash),
    }),
  );
  const manifestHash = sha256(
    JSON.stringify({
      blockId: input.blockId,
      splitHash,
      cases: loaded.map((item) => item.hash),
      consentIds: [...new Set(loaded.map((item) => item.row.consentId))],
    }),
  );
  const frozenAt = nowIso();
  const created: EvalCaseRow[] = [];

  try {
    tx((database) => {
      database.prepare(
        `INSERT INTO eval_suites
         (id, name, version, block_id, dev_count, holdout_count, metric_id, frozen_at, split_hash, manifest_hash, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'gatePass', ?, ?, ?, ?)`,
      ).run(
        suiteId,
        input.name,
        input.version,
        input.blockId,
        DEV_TARGET,
        HOLDOUT_TARGET,
        frozenAt,
        splitHash,
        manifestHash,
        frozenAt,
      );
      const insert = database.prepare(
        `INSERT INTO eval_cases
         (case_id, suite_id, split, brief, fixture_json, expected_json, provenance, hash, content_hash, redaction_scan, tombstoned_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'clean', NULL)`,
      );
      for (const [index, item] of loaded.entries()) {
        const split = index < DEV_TARGET ? 'dev' : 'holdout';
        const caseId = `case_${crypto.randomUUID()}`;
        const contentHash = sha256(JSON.stringify({
          brief: item.entry.brief,
          fixture: item.entry.fixture,
          expected: item.entry.expected,
        }));
        insert.run(
          caseId,
          suiteId,
          split,
          item.entry.brief,
          JSON.stringify(item.entry.fixture),
          JSON.stringify(item.entry.expected),
          'human',
          item.hash,
          contentHash,
        );
        created.push({
          caseId,
          suiteId,
          split,
          brief: item.entry.brief,
          fixtureJson: JSON.stringify(item.entry.fixture),
          expectedJson: JSON.stringify(item.entry.expected),
          provenance: 'human',
          hash: item.hash,
          contentHash,
          redactionScan: 'clean',
          tombstonedAt: null,
        });
      }
      const updated = database
        .prepare("UPDATE sealed_pool_blocks SET status = 'used', used_by_suite_id = ? WHERE block_id = ? AND used_by_suite_id IS NULL")
        .run(suiteId, input.blockId);
      if (updated.changes !== 1) {
        refuse('E_LEARNING_SUITE_ALREADY_USED', 'sealed block was claimed concurrently', {
          blockId: input.blockId,
        });
      }
    });
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed: eval_cases\.content_hash/i.test(error.message)) {
      refuse('E_LEARNING_EVIDENCE_TAMPERED', 'a sealed case content hash already exists in another suite');
    }
    throw error;
  }
  return { suite: getSuite(db, suiteId)!, cases: created };
}

export function getSuite(db: DatabaseSync, suiteId: string): EvalSuite | null {
  const row = db.prepare('SELECT * FROM eval_suites WHERE id = ?').get(suiteId) as
    | Record<string, unknown>
    | undefined;
  return row ? mapSuite(row) : null;
}

export function getSuiteUse(db: DatabaseSync, suiteId: string): SuiteUse | null {
  const row = db.prepare('SELECT * FROM suite_uses WHERE suite_id = ?').get(suiteId) as
    | Record<string, unknown>
    | undefined;
  return row ? mapUse(row) : null;
}

export type SuiteReadPurpose = 'eval' | 'mining' | 'inspect';

export function getSuiteCases(
  db: DatabaseSync,
  suiteId: string,
  purpose: SuiteReadPurpose = 'inspect',
): EvalCaseRow[] {
  const suite = getSuite(db, suiteId);
  if (!suite) refuse('E_LEARNING_DATASET_EMPTY', 'suite not found', { suiteId });
  if (purpose !== 'eval') {
    const rows = db
      .prepare(
        "SELECT * FROM eval_cases WHERE suite_id = ? AND split = 'dev' AND tombstoned_at IS NULL ORDER BY case_id ASC",
      )
      .all(suiteId) as Array<Record<string, unknown>>;
    return rows.map(mapCase);
  }
  requireConsent(db, 'case_to_provider_eval');
  const rows = db
    .prepare('SELECT * FROM eval_cases WHERE suite_id = ? ORDER BY split ASC, case_id ASC')
    .all(suiteId) as Array<Record<string, unknown>>;
  const cases = rows.map(mapCase);
  if (cases.some((item) => item.tombstonedAt !== null)) {
    refuse('E_LEARNING_CONSENT_REQUIRED', 'suite contains withdrawn cases', { suiteId });
  }
  return cases;
}

export function claimSuite(
  db: DatabaseSync,
  input: {
    suiteId: string;
    candidateId: string;
    evalRunId: string;
  },
): SuiteUse {
  const suite = getSuite(db, input.suiteId);
  if (!suite) refuse('E_LEARNING_DATASET_EMPTY', 'suite not found', { suiteId: input.suiteId });
  const existing = getSuiteUse(db, input.suiteId);
  if (existing) refuse('E_LEARNING_SUITE_ALREADY_USED', undefined, { suiteId: input.suiteId });
  try {
    return tx((database) => {
      database.prepare(
        `INSERT INTO suite_uses
         (suite_use_id, suite_id, suite_version, block_id, candidate_id, eval_run_id, claimed_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'claimed')`,
      ).run(
        `su_${crypto.randomUUID()}`,
        input.suiteId,
        suite.version,
        suite.blockId,
        input.candidateId,
        input.evalRunId,
        nowIso(),
      );
      return getSuiteUse(db, input.suiteId)!;
    });
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed: suite_uses\.suite_id/i.test(error.message)) {
      refuse('E_LEARNING_SUITE_ALREADY_USED', undefined, { suiteId: input.suiteId });
    }
    throw error;
  }
}

export function assertHoldoutTarget(suite: EvalSuite): void {
  if (suite.holdoutCount !== HOLDOUT_TARGET) {
    refuse('E_LEARNING_INSUFFICIENT_SAMPLE', undefined, {
      holdoutCount: suite.holdoutCount,
      target: HOLDOUT_TARGET,
    });
  }
}
