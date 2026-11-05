import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initDb } from '../../src/server/db/database.js';
import { createRunRow } from '../../src/server/runs/recorder.js';
import { completionStatus, reviewGateChecks } from '../../src/server/pipeline/run.js';
import type { ReviewResult } from '../../src/shared/types.js';

/**
 * Wave 17 Seat B — review coverage/eligibility audit (adjacent surface).
 *
 * Invariant: a finding's `file` and a `reviewedFiles` entry are the same kind of
 * path declaration and must be classified by the same path identity. The gate
 * already normalizes declared coverage through `normalizeRel`; grounding a
 * finding must use the same normalization. Unsafe or non-plan paths stay
 * ungrounded — normalization must never turn an outside path into a plan path.
 */

let tmp = '';

function seedRun(id: string): void {
  createRunRow({
    id,
    brief: 'review coverage fixture',
    preset: 'docs',
    model: 'deepseek-flash',
    thinking: 'disabled',
    effort: null,
    workspacePath: path.join(tmp, id),
  });
}

function review(partial: Partial<ReviewResult> & Pick<ReviewResult, 'verdict'>): ReviewResult {
  return { summary: '', findings: [], files: [], ...partial };
}

beforeEach(() => {
  closeDb();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-review-coverage-'));
  initDb(':memory:', 'B2');
});

afterEach(() => {
  closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('review coverage/eligibility', () => {
  it('grounds a critical finding whose path differs only by separator, and counts the same declaration as coverage', () => {
    seedRun('run_review_separator_critical');
    const checks = reviewGateChecks(
      'run_review_separator_critical',
      'cleaning',
      review({
        verdict: 'changes_required',
        findings: [{ severity: 'critical', file: 'src\\app.ts', line: 2, issue: 'unsafe cast', fix: 'validate input' }],
        reviewedFiles: ['src\\app.ts'],
      }),
      ['src/app.ts'],
    );

    // The same declared path already proves coverage in the reviewedFiles branch,
    // so it cannot also be "outside the plan" as a finding.
    expect(checks).toHaveLength(1);
    expect(checks[0]?.status).toBe('fail');
    expect(checks[0]?.code).toBe('REVIEW_CRITICAL');
    expect(checks[0]?.detail).not.toContain('ungrounded');
  });

  it('does not raise an ungrounded warning for a non-critical finding whose path differs only by separator', () => {
    seedRun('run_review_separator_warning');
    const checks = reviewGateChecks(
      'run_review_separator_warning',
      'cleaning',
      review({
        verdict: 'pass',
        findings: [{ severity: 'warn', file: 'src\\app.ts', line: 7, issue: 'weak name', fix: 'rename' }],
        reviewedFiles: ['src\\app.ts'],
      }),
      ['src/app.ts'],
    );

    expect(checks).toHaveLength(1);
    expect(checks[0]?.status).toBe('pass');
    expect(checks[0]?.code).toBeUndefined();
    expect(completionStatus(checks)).toBe('completed');
  });

  it('names only the truly missing file when a normalized declaration already covers its path', () => {
    seedRun('run_review_separator_coverage');
    const checks = reviewGateChecks(
      'run_review_separator_coverage',
      'cleaning',
      review({ verdict: 'pass', reviewedFiles: ['src\\a.ts'] }),
      ['src/a.ts', 'src/b.ts'],
    );

    const coverage = checks.find((check) => check.code === 'REVIEW_UNREVIEWED');
    expect(coverage?.status).toBe('warn');
    expect(coverage?.detail).toContain('src/b.ts');
    expect(coverage?.detail).not.toContain('src/a.ts');
    expect(completionStatus(checks)).toBe('completed_with_warnings');
  });

  it('still refuses findings that cite paths outside the plan, including separator-only lookalikes', () => {
    seedRun('run_review_untrusted_paths');
    const outside = reviewGateChecks(
      'run_review_untrusted_paths',
      'cleaning',
      review({
        verdict: 'changes_required',
        findings: [{ severity: 'critical', file: '../secret.ts', issue: 'escape', fix: 'remove' }],
        reviewedFiles: ['src/app.ts'],
      }),
      ['src/app.ts'],
    );
    expect(outside[0]?.status).toBe('fail');
    expect(outside[0]?.code).toBe('REVIEW_UNGROUNDED');

    const lookalike = reviewGateChecks(
      'run_review_untrusted_paths',
      'hardening',
      review({
        verdict: 'changes_required',
        findings: [{ severity: 'critical', file: 'src\\outside.ts', issue: 'escape', fix: 'remove' }],
        reviewedFiles: ['src/app.ts'],
      }),
      ['src/app.ts'],
    );
    expect(lookalike[0]?.status).toBe('fail');
    expect(lookalike[0]?.code).toBe('REVIEW_UNGROUNDED');
  });
});
