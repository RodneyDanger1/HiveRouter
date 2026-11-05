import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initDb } from '../../src/server/db/database.js';
import { createRunRow, getArtifacts, getRun, insertUsage, updateRun } from '../../src/server/runs/recorder.js';
import { setTraceComplete } from '../../src/server/runs/manager.js';
import { persistStagedArtifacts, recordRunTrace, reviewGateChecks, completionStatus } from '../../src/server/pipeline/run.js';

let tmp = '';

function run(id: string, workspacePath = tmp): void {
  createRunRow({
    id,
    brief: 'p0 truth test',
    preset: 'docs',
    model: 'deepseek-flash',
    thinking: 'disabled',
    effort: null,
    workspacePath,
  });
}

beforeEach(() => {
  closeDb();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-p0-'));
  initDb(':memory:', 'B2');
});

afterEach(() => {
  closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('P0 review gate', () => {
  it('fails on a grounded critical finding and records the review row', () => {
    run('run_review');
    const checks = reviewGateChecks('run_review', 'cleaning', {
      verdict: 'changes_required',
      summary: '',
      findings: [{ severity: 'critical', file: 'src/a.ts', line: 3, issue: 'bug', fix: 'fix' }],
      files: [],
    }, ['src/a.ts']);
    expect(checks[0]?.status).toBe('fail');
    expect(checks[0]?.mandatory).toBe(true);
    expect((getDb().prepare('SELECT COUNT(*) AS n FROM reviews WHERE run_id = ?').get('run_review') as { n: number }).n).toBe(1);
  });

  it('fails a critical finding that cites a path outside the plan', () => {
    run('run_review_ungrounded');
    const checks = reviewGateChecks('run_review_ungrounded', 'cleaning', {
      verdict: 'changes_required',
      summary: '',
      findings: [{ severity: 'critical', file: '../secret.ts', issue: 'bug', fix: 'fix' }],
      files: [],
    }, ['src/a.ts']);
    expect(checks[0]?.status).toBe('fail');
    expect(checks[0]?.code).toBe('REVIEW_UNGROUNDED');
  });

  it('flags a non-critical ungrounded finding without silently passing it', () => {
    run('run_review_warn');
    const checks = reviewGateChecks('run_review_warn', 'cleaning', {
      verdict: 'changes_required',
      summary: '',
      findings: [{ severity: 'warn', file: '../outside.ts', issue: 'weak', fix: 'fix' }],
      files: [],
    }, ['src/a.ts']);
    expect(checks[0]?.status).toBe('warn');
    expect(checks[0]?.code).toBe('REVIEW_UNGROUNDED_WARNING');
  });

  it('does not create a false critical gate for a clean review', () => {
    run('run_review_clean');
    const checks = reviewGateChecks('run_review_clean', 'cleaning', {
      verdict: 'pass',
      summary: '',
      findings: [],
      files: [],
    }, ['src/a.ts']);
    expect(checks[0]?.status).toBe('pass');
  });

  it('keeps a fully covered clean review as a single pass', () => {
    run('run_review_covered');
    const checks = reviewGateChecks('run_review_covered', 'cleaning', {
      verdict: 'pass',
      summary: '',
      findings: [],
      files: [],
      reviewedFiles: ['src/a.ts', 'src/b.ts'],
    }, ['src/a.ts', 'src/b.ts']);
    expect(checks).toHaveLength(1);
    expect(checks[0]?.status).toBe('pass');
  });

  it('names every allowed file the clean reviewer did not declare as REVIEW_UNREVIEWED', () => {
    run('run_review_uncovered');
    const checks = reviewGateChecks('run_review_uncovered', 'cleaning', {
      verdict: 'pass',
      summary: '',
      findings: [],
      files: [],
      reviewedFiles: ['src/a.ts', '../outside.ts'],
    }, ['src/a.ts', 'src/b.ts']);
    const primary = checks.find((check) => check.id === 'review.cleaning');
    const coverage = checks.find((check) => check.id === 'review.cleaning.coverage');
    expect(primary?.status).toBe('pass');
    expect(coverage?.status).toBe('warn');
    expect(coverage?.code).toBe('REVIEW_UNREVIEWED');
    expect(coverage?.detail).toContain('src/b.ts');
    expect(coverage?.detail).not.toContain('../outside.ts');
    expect(completionStatus(checks)).toBe('completed_with_warnings');
  });

  it('keeps a critical review fail while appending the coverage warning', () => {
    run('run_review_critical_uncovered');
    const checks = reviewGateChecks('run_review_critical_uncovered', 'cleaning', {
      verdict: 'changes_required',
      summary: '',
      findings: [{ severity: 'critical', file: 'src/a.ts', issue: 'bug', fix: 'fix' }],
      files: [],
      reviewedFiles: ['src/a.ts'],
    }, ['src/a.ts', 'src/b.ts']);
    expect(checks[0]?.status).toBe('fail');
    expect(checks[0]?.mandatory).toBe(true);
    expect(checks.some((check) => check.code === 'REVIEW_UNREVIEWED')).toBe(true);
  });
});

describe('P0 staged artifact retention', () => {
  it('retains failed staged files as staged, not accepted', () => {
    run('run_staged');
    const staging = path.join(tmp, '.staging', 'attempt-1', 'src');
    fs.mkdirSync(staging, { recursive: true });
    fs.writeFileSync(path.join(staging, 'a.ts'), 'export const a = 1;\n', 'utf8');
    expect(persistStagedArtifacts('run_staged')).toBe(1);
    const artifacts = getArtifacts('run_staged');
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]?.status).toBe('staged');
    expect(artifacts[0]?.path).toBe('staged/src/a.ts');
    expect(fs.existsSync(path.join(tmp, 'staged', 'src', 'a.ts'))).toBe(true);
  });
});

describe('P0 phase matrix wiring', () => {
  it('allows the real review/adhoc entry phases and refuses an illegal skip', () => {
    run('run_phase_cleaning');
    expect(() => updateRun('run_phase_cleaning', { status: 'running', phase: 'cleaning' })).not.toThrow();
    run('run_phase_illegal');
    expect(() => updateRun('run_phase_illegal', { status: 'running', phase: 'verifying' })).toThrow('E_ILLEGAL_RUN_TRANSITION');
  });
});

describe('P0 trace truth', () => {
  it('records a trace row and can stamp the flag from evidence', () => {
    run('run_trace');
    insertUsage('run_trace', null, 'architect', {
      promptTokens: 10,
      completionTokens: 5,
      cacheHitTokens: 0,
      cacheMissTokens: 10,
      reasoningTokens: 0,
      costUsd: 0.001,
      source: 'provider',
      model: 'deepseek-flash',
    });
    updateRun('run_trace', { status: 'failed', phase: 'done', error_code: 'E_TEST', error_message: 'test' });
    const traced = recordRunTrace('run_trace', 'failure');
    expect(traced).toBe(true);
    expect((getDb().prepare('SELECT COUNT(*) AS n FROM traces WHERE run_id = ?').get('run_trace') as { n: number }).n).toBe(1);
    setTraceComplete('run_trace', traced);
    expect(getRun('run_trace')?.traceComplete).toBe(true);
  });
});
