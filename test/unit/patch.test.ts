import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { applyPatch, changedNodeCount } from '../../src/server/pipeline/patch.js';
import ts from 'typescript';

const dirs: string[] = [];

function tempRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-patch-'));
  dirs.push(dir);
  return dir;
}

function sha(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('exact text patches', () => {
  it('applies a unique exact match atomically, returns hashes, and keeps a backup', () => {
    const root = tempRoot();
    const before = 'export const value = 1;\n';
    fs.writeFileSync(path.join(root, 'sample.ts'), before, 'utf8');
    const result = applyPatch(root, {
      filePath: 'sample.ts',
      expectedSha256: sha(before),
      patches: [{ oldText: 'value = 1', newText: 'value = 2' }],
    });
    expect(result.ok).toBe(true);
    expect(result.verified).toBe(true);
    expect(result.changed).toBe(true);
    expect(result.language).toBe('typescript');
    expect(result.sha256Before).toBe(sha(before));
    expect(result.sha256After).toBe(sha('export const value = 2;\n'));
    expect(fs.readFileSync(path.join(root, 'sample.ts'), 'utf8')).toBe('export const value = 2;\n');
    expect(fs.readFileSync(result.backupPath!, 'utf8')).toBe(before);
    expect(fs.readdirSync(root).filter((name) => name.includes('.tmp-'))).toEqual([]);
  });

  it('rejects a missing oldText without writing or creating a backup', () => {
    const root = tempRoot();
    const before = 'const x = 1;\n';
    fs.writeFileSync(path.join(root, 'missing.ts'), before);
    const result = applyPatch(root, { filePath: 'missing.ts', patches: [{ oldText: 'not-present', newText: 'x' }] });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('E_PATCH_NOT_FOUND');
    expect(fs.readFileSync(path.join(root, 'missing.ts'), 'utf8')).toBe(before);
    expect(fs.existsSync(path.join(root, 'missing.ts.bak'))).toBe(false);
  });

  it('rejects a non-unique oldText without writing', () => {
    const root = tempRoot();
    const before = 'const a = 1;\nconst b = 1;\n';
    fs.writeFileSync(path.join(root, 'ambiguous.ts'), before);
    const result = applyPatch(root, { filePath: 'ambiguous.ts', patches: [{ oldText: '1', newText: '2' }] });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('E_PATCH_AMBIGUOUS');
    expect(fs.readFileSync(path.join(root, 'ambiguous.ts'), 'utf8')).toBe(before);
  });

  it('rejects an expected hash mismatch before parsing/writing', () => {
    const root = tempRoot();
    fs.writeFileSync(path.join(root, 'hash.ts'), 'const x = 1;\n');
    const result = applyPatch(root, { filePath: 'hash.ts', expectedSha256: '0'.repeat(64), patches: [{ oldText: '1', newText: '2' }] });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('E_PATCH_HASH_MISMATCH');
  });

  it('rejects path traversal and absolute paths', () => {
    const root = tempRoot();
    fs.writeFileSync(path.join(root, 'safe.ts'), 'const x = 1;\n');
    const traversal = applyPatch(root, { filePath: '../safe.ts', patches: [{ oldText: '1', newText: '2' }] });
    const absolute = applyPatch(root, { filePath: path.join(root, 'safe.ts'), patches: [{ oldText: '1', newText: '2' }] });
    expect(traversal.errorCode).toBe('E_PATCH_PATH');
    expect(absolute.errorCode).toBe('E_PATCH_PATH');
    expect(fs.readFileSync(path.join(root, 'safe.ts'), 'utf8')).toBe('const x = 1;\n');
  });

  it('enforces file and patch size limits', () => {
    const root = tempRoot();
    fs.writeFileSync(path.join(root, 'large.ts'), 'const value = 123456789;\n');
    const tooLarge = applyPatch(root, { filePath: 'large.ts', patches: [{ oldText: '1', newText: '2' }] }, { maxFileBytes: 5 });
    expect(tooLarge.errorCode).toBe('E_PATCH_TOO_LARGE');
    const tooMany = applyPatch(root, { filePath: 'large.ts', patches: [
      { oldText: '123456789', newText: '1' },
      { oldText: '1', newText: '2' },
    ] }, { maxPatches: 1 });
    expect(tooMany.errorCode).toBe('E_PATCH_TOO_LARGE');
  });

  it('rejects a syntax-invalid TypeScript result and leaves the file untouched', () => {
    const root = tempRoot();
    const before = 'export const value = 1;\n';
    fs.writeFileSync(path.join(root, 'syntax.ts'), before);
    const result = applyPatch(root, { filePath: 'syntax.ts', patches: [{ oldText: '1', newText: '(' }] });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('E_PATCH_SYNTAX');
    expect(fs.readFileSync(path.join(root, 'syntax.ts'), 'utf8')).toBe(before);
  });

  it('rejects a patch above the changed-node bound', () => {
    const root = tempRoot();
    const before = 'export const a = 1;\nexport const b = 2;\nexport const c = 3;\n';
    fs.writeFileSync(path.join(root, 'nodes.ts'), before);
    const result = applyPatch(root, {
      filePath: 'nodes.ts',
      patches: [{ oldText: before, newText: 'export const z = 9;\n' }],
      maxChangedNodes: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('E_PATCH_TOO_MANY_NODES');
    expect(result.changedNodes).toBeGreaterThan(1);
    expect(fs.readFileSync(path.join(root, 'nodes.ts'), 'utf8')).toBe(before);
  });

  it('applies unsupported-language text but reports verified:false', () => {
    const root = tempRoot();
    const before = 'value = 1\n';
    fs.writeFileSync(path.join(root, 'sample.py'), before);
    const result = applyPatch(root, { filePath: 'sample.py', patches: [{ oldText: '1', newText: '2' }] });
    expect(result.ok).toBe(true);
    expect(result.verified).toBe(false);
    expect(result.language).toBe('unsupported');
    expect(result.changed).toBe(true);
    expect(fs.readFileSync(path.join(root, 'sample.py'), 'utf8')).toBe('value = 2\n');
  });

  it('counts changed AST leaf nodes deterministically', () => {
    const before = ts.createSourceFile('x.ts', 'const x = 1;\n', ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const after = ts.createSourceFile('x.ts', 'const x = 2;\n', ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const noChange = ts.createSourceFile('x.ts', 'const x = 1;\n', ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    expect(changedNodeCount(before, noChange)).toBe(0);
    expect(changedNodeCount(before, after)).toBeGreaterThan(0);
  });
});
