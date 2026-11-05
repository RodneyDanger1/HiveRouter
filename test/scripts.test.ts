import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  evaluatePreflight,
  type PreflightConstraints,
  type PreflightEnvironment,
} from '../scripts/preflight';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const TSX = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const NODE = process.execPath;

function tempRoot(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `hive-${prefix}-`));
}

function write(root: string, relative: string, content: string): void {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

function runNode(script: string, args: string[], cwd = ROOT) {
  return spawnSync(NODE, [path.join(ROOT, script), ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 30_000,
    windowsHide: true,
  });
}

function runTs(script: string, args: string[], cwd = ROOT) {
  return spawnSync(NODE, [TSX, path.join(ROOT, script), ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 30_000,
    windowsHide: true,
  });
}

function parseJson(result: ReturnType<typeof runNode>): Record<string, any> {
  return JSON.parse(result.stdout) as Record<string, any>;
}

describe('preflight', () => {
  const constraints: PreflightConstraints = {
    minDiskGb: 4.5,
    minRamGb: 1.5,
    nodeVersion: '26.7.0',
    npmVersion: '11.19.0',
    chromePaths: ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'],
    port: 8787,
    host: '127.0.0.1',
  };
  const good: PreflightEnvironment = {
    nodeVersion: 'v26.7.0',
    npmVersion: '11.19.0',
    freeDiskGb: 4.5,
    freeRamGb: 1.5,
    chromePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    portFree: true,
  };

  it('passes at the exact floors and fails each floor by name', () => {
    expect(evaluatePreflight(good, constraints).ok).toBe(true);
    const lowDisk = evaluatePreflight({ ...good, freeDiskGb: 4.49 }, constraints);
    expect(lowDisk.ok).toBe(false);
    expect(lowDisk.code).toBe('E_RESOURCE_INSUFFICIENT');
    const lowRam = evaluatePreflight({ ...good, freeRamGb: 1.49 }, constraints);
    expect(lowRam.code).toBe('E_RESOURCE_INSUFFICIENT');
    const missingChrome = evaluatePreflight({ ...good, chromePath: null }, constraints);
    expect(missingChrome.code).toBe('E_E2E_BROWSER_MISSING');
    const badNode = evaluatePreflight({ ...good, nodeVersion: 'v26.6.0' }, constraints);
    expect(badNode.ok).toBe(false);
  });

  it('refuses a low RAM floor through the real CLI with exit 7', () => {
    const result = runTs('scripts/preflight.ts', [
      '--json',
      '--min-ram-gb',
      '999',
      '--port',
      '0',
      '--root',
      ROOT,
    ]);
    expect(result.status).toBe(7);
    const report = JSON.parse(result.stdout) as Record<string, any>;
    expect(report.ok).toBe(false);
    expect(report.code).toBe('E_RESOURCE_INSUFFICIENT');
  }, 20_000);

  it('passes the real host preflight (Chrome, Node, npm, free port)', () => {
    const result = runTs('scripts/preflight.ts', [
      '--json',
      '--min-disk-gb',
      '0',
      '--min-ram-gb',
      '0',
      '--port',
      '0',
      '--root',
      ROOT,
    ]);
    expect(result.status, result.stderr || result.stdout).toBe(0);
    const report = JSON.parse(result.stdout) as Record<string, any>;
    expect(report.ok).toBe(true);
    expect(report.data.measurements.chromePath).toContain('chrome.exe');
  }, 20_000);
});

describe('stub-sweep', () => {
  it('finds a planted TODO in source and exits 4', () => {
    const root = tempRoot('stub');
    try {
      write(root, 'src/bad.ts', 'export const x = 1; // TODO: finish this\n');
      const result = runNode('scripts/stub-sweep.mjs', ['--json', '--root', root]);
      expect(result.status).toBe(4);
      const report = parseJson(result);
      expect(report.ok).toBe(false);
      expect(report.data.hits[0].file).toBe('src/bad.ts');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('passes clean source and classifies test-double markers when requested', () => {
    const root = tempRoot('stub-clean');
    try {
      write(root, 'src/good.ts', 'export const x = 1;\n');
      let result = runNode('scripts/stub-sweep.mjs', ['--json', '--root', root]);
      expect(result.status).toBe(0);
      write(root, 'test/a.test.ts', '// TODO: test double marker\n');
      result = runNode('scripts/stub-sweep.mjs', ['--json', '--root', root, '--include-tests', '--dirs', 'test']);
      expect(result.status).toBe(0);
      const report = parseJson(result);
      expect(report.data.allowed.length).toBeGreaterThan(0);
      expect(report.warnings[0].code).toBe('TEST_DOUBLES_CLASSIFIED');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('check-secrets', () => {
  it('fails on a fake DeepSeek key without printing it', () => {
    const root = tempRoot('secret');
    const fake = `sk-${'a'.repeat(20)}_${'b'.repeat(10)}`;
    try {
      write(root, 'src/key.ts', `export const k = '${fake}';\n`);
      const result = runNode('scripts/check-secrets.mjs', ['--json', '--root', root, '--dirs', 'src']);
      expect(result.status).toBe(4);
      const report = parseJson(result);
      expect(report.ok).toBe(false);
      expect(report.data.hits[0].pattern).toBe('deepseek');
      expect(JSON.stringify(report)).not.toContain(fake);
      expect(report.data.hits[0].preview).toContain('[REDACTED:deepseek]');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('passes a clean source file', () => {
    const root = tempRoot('secret-clean');
    try {
      write(root, 'src/ok.ts', 'export const ok = true;\n');
      const result = runNode('scripts/check-secrets.mjs', ['--json', '--root', root, '--dirs', 'src']);
      expect(result.status).toBe(0);
      expect(parseJson(result).ok).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('classifies a clearly synthetic test fixture instead of failing the gate', () => {
    const root = tempRoot('secret-test');
    const fake = `sk-${'b'.repeat(32)}`;
    try {
      write(root, 'test/unit/key.test.ts', `// synthetic test fixture, not a real key\nconst fake = '${fake}';\n`);
      const result = runNode('scripts/check-secrets.mjs', ['--json', '--root', root, '--dirs', 'test']);
      expect(result.status).toBe(0);
      const report = parseJson(result);
      expect(report.ok).toBe(true);
      expect(report.data.allowed.length).toBe(1);
      expect(report.warnings[0].code).toBe('TEST_DOUBLES_CLASSIFIED');
      expect(JSON.stringify(report)).not.toContain(fake);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('assert-stage', () => {
  function manifestRoot(): string {
    const root = tempRoot('stage');
    write(root, 'package.json', JSON.stringify({ scripts: { typecheck: 'tsc --noEmit' } }));
    write(root, 'config/releases/a.json', JSON.stringify({
      paths: ['src/shared/', 'src/server/db/', 'src/server/routes/', 'web/src/'],
      tables: ['runs'],
      routes: ['/api/health'],
      uiRoutes: ['/agents'],
      scripts: ['typecheck'],
    }));
    write(root, 'src/shared/a.ts', 'export const a = 1;\n');
    write(root, 'src/server/db/migrations.ts', 'CREATE TABLE IF NOT EXISTS runs (id TEXT);\n');
    write(root, 'src/server/routes/health.ts', "fastify.get('/api/health', async () => ({ ok: true }));\n");
    write(root, 'web/src/App.tsx', "export const route = <Route path=\"/agents\" />;\n");
    return root;
  }

  it('passes a compliant A manifest and refuses a planted P7 path/table/script', () => {
    const root = manifestRoot();
    try {
      let result = runNode('scripts/assert-stage.mjs', ['--stage=a', '--root', root, '--json']);
      expect(result.status, result.stdout).toBe(0);
      expect(parseJson(result).data.fallback).toBe(false);

      write(root, 'src/server/learning/leak.ts', 'export const leak = true;\n');
      write(root, 'src/server/db/migrations.ts', 'CREATE TABLE IF NOT EXISTS traces (id TEXT);\n');
      fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { typecheck: 'tsc', learn: 'tsx scripts/learn.ts' } }));

      result = runNode('scripts/assert-stage.mjs', ['--stage', 'a', '--root', root, '--json']);
      expect(result.status).toBe(9);
      const report = parseJson(result);
      expect(report.code).toBe('E_STAGE_LEAK');
      const kinds = report.data.violations.map((v: { kind: string }) => v.kind);
      expect(kinds).toContain('path');
      expect(kinds).toContain('table');
      expect(kinds).toContain('script');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('falls back to the bootstrap allowlist when manifests are absent', () => {
    const root = tempRoot('stage-fallback');
    try {
      write(root, 'package.json', JSON.stringify({ scripts: { typecheck: 'tsc --noEmit' } }));
      write(root, 'src/shared/a.ts', 'export const a = 1;\n');
      const result = runNode('scripts/assert-stage.mjs', ['--stage', 'a', '--root', root, '--json']);
      expect(result.status).toBe(0);
      const report = parseJson(result);
      expect(report.data.fallback).toBe(true);
      expect(report.warnings.some((w: { code: string }) => w.code === 'STAGE_MANIFEST_MISSING')).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
