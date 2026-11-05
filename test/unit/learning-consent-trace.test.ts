import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initDb } from '../../src/server/db/database.js';
import {
  consentMatrix,
  getTraceByRun,
  grantConsent,
  isConsentActive,
  readTracePreview,
  recordTrace,
  recordUserVerdict,
  requireConsent,
  revokeConsent,
} from '../../src/server/learning/index.js';

let previewRoot: string;

function insertRun(id: string, status = 'completed'): void {
  getDb()
    .prepare(
      `INSERT INTO runs (id, brief, preset, status, phase, model, thinking, created_at, workspace_path)
       VALUES (?, 'brief', 'full-build', ?, 'done', 'deepseek-flash', 'disabled', ?, '/tmp/run')`,
    )
    .run(id, status, new Date().toISOString());
}

beforeEach(() => {
  closeDb();
  initDb(':memory:', 'B2');
  previewRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-learning-trace-'));
});

afterEach(() => {
  closeDb();
  fs.rmSync(previewRoot, { recursive: true, force: true });
});

describe('learning consent', () => {
  it('grants, revokes, and requires each scope independently', () => {
    const db = getDb();
    grantConsent(db, 'trace_retention');
    grantConsent(db, 'case_to_provider_eval');
    expect(isConsentActive(db, 'trace_retention')).toBe(true);
    expect(isConsentActive(db, 'trace_to_provider_reflection')).toBe(false);
    expect(() => requireConsent(db, 'trace_to_provider_reflection')).toThrow(
      /Learning consent is required/,
    );
    revokeConsent(db, 'trace_retention');
    expect(isConsentActive(db, 'trace_retention')).toBe(false);
    const matrix = consentMatrix(db);
    expect(Object.keys(matrix)).toEqual([
      'trace_retention',
      'trace_to_provider_reflection',
      'case_to_provider_eval',
      'dsh_key',
    ]);
    expect(matrix.case_to_provider_eval.active).toBe(true);
  });

  it('tombstones unclaimed eval cases when eval consent is revoked', () => {
    const db = getDb();
    grantConsent(db, 'case_to_provider_eval');
    db.prepare(
      "INSERT INTO sealed_pool_blocks (block_id, status, dev_count, holdout_count, used_by_suite_id, created_at) VALUES ('block-x','ready',15,50,NULL,'now')",
    ).run();
    db.prepare(
      "INSERT INTO eval_suites (id, name, version, block_id, dev_count, holdout_count, metric_id, frozen_at, split_hash, manifest_hash, created_at) VALUES ('suite-x','x',1,'block-x',15,50,'gatePass','now','split','manifest','now')",
    ).run();
    db.prepare(
      "INSERT INTO eval_cases (case_id, suite_id, split, brief, fixture_json, expected_json, provenance, hash, content_hash, redaction_scan, tombstoned_at) VALUES ('case-x','suite-x','holdout','b','{}','{}','human','h','c','clean',NULL)",
    ).run();
    revokeConsent(db, 'case_to_provider_eval');
    const row = db.prepare('SELECT tombstoned_at FROM eval_cases WHERE case_id = ?').get('case-x') as {
      tombstoned_at: string | null;
    };
    expect(row.tombstoned_at).not.toBeNull();
  });
});

describe('learning trace store', () => {
  it('stores redacted previews only and masks a secret', () => {
    insertRun('run-1');
    const secret = ['sk', '12345678901234567890123456789012'].join('-');
    const trace = recordTrace(
      getDb(),
      {
        runId: 'run-1',
        model: 'deepseek-flash',
        thinking: 'disabled',
        outcome: 'failure',
        errorMessage: 'Error: line 12 failed',
        inputPreview: `api key ${secret}`,
        outputPreview: 'boom',
        provenance: 'live',
      },
      { previewRoot },
    );
    expect(trace.redactionStatus).toBe('redacted');
    const preview = readTracePreview(trace.id, { previewRoot });
    expect(preview).not.toBeNull();
    expect(preview!.inputPreview).not.toContain(secret);
    expect(preview!.inputPreview).toContain('[REDACTED_SYSTEM_SECRET]');
    expect(trace.failureSignature).toMatch(/^[0-9a-f]{16}$/);
  });

  it('upserts one trace per run and refuses non-terminal runs', () => {
    insertRun('run-2');
    recordTrace(
      getDb(),
      {
        runId: 'run-2',
        model: 'deepseek-flash',
        thinking: 'disabled',
        outcome: 'warning',
        provenance: 'live',
      },
      { previewRoot },
    );
    recordTrace(
      getDb(),
      {
        runId: 'run-2',
        model: 'deepseek-flash',
        thinking: 'disabled',
        outcome: 'success',
        provenance: 'human',
      },
      { previewRoot },
    );
    const trace = getTraceByRun(getDb(), 'run-2');
    expect(trace?.outcome).toBe('success');
    expect(trace?.provenance).toBe('human');

    insertRun('run-3', 'running');
    expect(() =>
      recordTrace(
        getDb(),
        {
          runId: 'run-3',
          model: 'deepseek-flash',
          thinking: 'disabled',
          outcome: 'failure',
          provenance: 'live',
        },
        { previewRoot },
      ),
    ).toThrow(/Only terminal traces can enter learning/);
  });

  it('records a human verdict without changing the trace preview', () => {
    insertRun('run-4');
    recordTrace(
      getDb(),
      {
        runId: 'run-4',
        model: 'deepseek-flash',
        thinking: 'disabled',
        outcome: 'success',
        provenance: 'live',
      },
      { previewRoot },
    );
    recordUserVerdict(getDb(), { runId: 'run-4', verdict: 'edited', editDistance: 12 });
    const trace = getTraceByRun(getDb(), 'run-4');
    expect(trace?.userVerdict).toBe('edited');
    expect(trace?.editDistance).toBe(12);
    const feedback = getDb().prepare('SELECT rating FROM feedback WHERE run_id = ?').get('run-4') as {
      rating: number;
    };
    expect(feedback.rating).toBe(0);
  });
});
