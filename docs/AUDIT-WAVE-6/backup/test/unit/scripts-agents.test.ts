import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve('.');
const TSX = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');

function run(script: string, args: string[]) {
  return spawnSync(process.execPath, [TSX, path.join(ROOT, script), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 30_000,
    windowsHide: true,
  });
}

it('bench-suite exits 7, not 3, when live is requested without a key', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-bench-'));
  const env = { ...process.env };
  delete env.DEEPSEEK_API_KEY;
  const result = spawnSync(
    process.execPath,
    [TSX, path.join(ROOT, 'scripts/bench-suite.ts'), '--live', '--yes', '--json'],
    { cwd, encoding: 'utf8', timeout: 30_000, windowsHide: true, env },
  );
  expect(result.status).toBe(7);
});

describe('owned P6a scripts — usage refusals', () => {
  it.each([
    ['scripts/build-repo-map.ts'],
    ['scripts/context-pack-report.ts'],
    ['scripts/integrity-check.ts'],
  ])('%s exits 2 when --run is absent, even with --json', (script) => {
    const result = run(script, ['--json']);
    expect(result.status).toBe(2);
    expect(`${result.stdout}${result.stderr}`).toContain('usage:');
  });

  it.each([
    ['scripts/build-repo-map.ts'],
    ['scripts/context-pack-report.ts'],
    ['scripts/integrity-check.ts'],
  ])('%s exits 2 when --run has no value', (script) => {
    const result = run(script, ['--run', '--json']);
    expect(result.status).toBe(2);
    expect(`${result.stdout}${result.stderr}`).toContain('usage:');
  });
});
