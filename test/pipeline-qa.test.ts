/**
 * Filename: test/pipeline-qa.test.ts
 * Dependencies: vitest, node:fs/os/path, pipeline/verify modules
 * Run: npm.cmd test -- --run test/pipeline-qa.test.ts
 *
 * QA RED/GREEN coverage for pipeline finalize/verify seams.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { CheckResult, GeneratedFile } from '../src/shared/types.js';
import { applyRevisions, artifactAgentId, completionStatus, plannedTestFiles } from '../src/server/pipeline/run.js';
import { contentHash } from '../src/server/security/paths.js';
import { syntaxChildEnv } from '../src/server/verify/syntax.js';
import { gateStatus, verifyStaged } from '../src/server/verify/verifier.js';

const tempDirs: string[] = [];

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-pipeline-qa-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function generated(file: string, content: string): GeneratedFile {
  return {
    path: file,
    language: 'javascript',
    content,
    summary: '',
    execution: '',
    complete: true,
    agentId: 'js-engine',
    sha256: contentHash(content),
    bytes: Buffer.byteLength(content),
  };
}

describe('pipeline finalize and revision invariants', () => {
  it('rejects a revision outside the allowed plan instead of silently ignoring it', () => {
    const staging = tempDir();
    fs.writeFileSync(path.join(staging, 'a.js'), 'const a = 1;\n', 'utf8');
    expect(() => applyRevisions(staging, ['a.js'], [{ path: 'b.js', content: 'const b = 1;\n' }], [])).toThrow(
      'E_AGENT_OUTPUT_MISMATCH',
    );
  });

  it('attributes an artifact to the actual routed agent, not the path fallback', () => {
    const routed = new Map([['src/app.py', 'polyglot-engine']]);
    expect(artifactAgentId('src/app.py', routed)).toBe('polyglot-engine');
    expect(artifactAgentId('src/app.py')).toBe('python-engine');
  });

  it('records the stripped revision hash, not the fenced payload hash', () => {
    const staging = tempDir();
    const file = 'a.js';
    const original = 'const a = 1;\n';
    fs.writeFileSync(path.join(staging, file), original, 'utf8');
    const current = [generated(file, original)];

    applyRevisions(staging, [file], [{ path: file, content: '```js\nconst a = 2;\n```' }], current);

    const onDisk = fs.readFileSync(path.join(staging, file), 'utf8');
    expect(onDisk).toBe('const a = 2;');
    expect(current[0]?.sha256).toBe(contentHash(onDisk));
    expect(current[0]?.bytes).toBe(Buffer.byteLength(onDisk));
  });

  it('reports warning-only gates as completed_with_warnings', () => {
    const pass: CheckResult = { id: 'syntax.all', status: 'pass', detail: 'ok', mandatory: true };
    const warn: CheckResult = { id: 'syntax.unverified', status: 'unverified', detail: 'static only', mandatory: false };
    expect(completionStatus([pass])).toBe('completed');
    expect(completionStatus([pass, warn])).toBe('completed_with_warnings');
  });

  it('keeps tests written outside tests/ in the final plan', () => {
    const paths = plannedTestFiles({
      files: [{ path: 'test/foo.test.ts' }, { path: 'tests/unit/a.test.ts' }, { path: 'test/foo.test.ts' }],
    });
    expect(paths).toContain('test/foo.test.ts');
    expect(paths).toContain('tests/unit/a.test.ts');
    expect(paths).toHaveLength(2);
  });

  it('passes a valid TSX file when the RVS plan schedules syntax.tsx', async () => {
    const staging = tempDir();
    fs.writeFileSync(path.join(staging, 'App.tsx'), 'export function App() { return <main>ok</main>; }\n', 'utf8');
    const checks = await verifyStaged(staging, ['App.tsx'], { checks: [{ checkId: 'path.safety', status: 'planned' }, { checkId: 'plan.coverage', status: 'planned' }, { checkId: 'syntax.tsx', status: 'planned' }] });
    expect(checks.some((check) => check.id === 'syntax.tsx' && check.status !== 'unverified')).toBe(false);
    expect(gateStatus(checks)).not.toBe('fail');
  });

  it('does not pass a file whose syntax check was skipped by the RVS plan', async () => {
    const staging = tempDir();
    fs.writeFileSync(path.join(staging, 'bad.py'), 'def broken(:\n', 'utf8');
    const checks = await verifyStaged(staging, ['bad.py'], { checks: [{ checkId: 'path.safety', status: 'planned' }, { checkId: 'plan.coverage', status: 'planned' }] });
    expect(checks.some((check) => check.id === 'syntax.all' && check.status === 'pass')).toBe(false);
    expect(checks.some((check) => check.id === 'syntax.python' && check.status === 'unverified' && check.mandatory)).toBe(true);
    expect(gateStatus(checks)).toBe('fail');
  });

  it('does not forward provider secrets to the Python syntax checker', () => {
    const env = syntaxChildEnv({
      PATH: 'C:\\Windows\\System32',
      SystemRoot: 'C:\\Windows',
      TEMP: 'C:\\Temp',
      DEEPSEEK_API_KEY: 'sk-test-secret',
      OPENROUTER_API_KEY: 'sk-or-test-secret',
      AWS_SECRET_ACCESS_KEY: 'aws-secret',
      GITHUB_TOKEN: 'ghp_secret',
      RANDOM_UNRELATED: 'drop-me',
    });
    expect(env.PATH).toBe('C:\\Windows\\System32');
    expect(env.SystemRoot).toBe('C:\\Windows');
    expect(env.TEMP).toBe('C:\\Temp');
    expect(env.DEEPSEEK_API_KEY).toBeUndefined();
    expect(env.OPENROUTER_API_KEY).toBeUndefined();
    expect(env.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    expect(env.GITHUB_TOKEN).toBeUndefined();
    expect(env.RANDOM_UNRELATED).toBeUndefined();
  });
});
