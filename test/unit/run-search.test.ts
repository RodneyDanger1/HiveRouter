import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, initDb } from '../../src/server/db/database.js';
import { searchRunWorkspace } from '../../src/server/search/run-search.js';

let root: string;

beforeEach(() => {
  initDb(':memory:', 'B2');
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-search-'));
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'a.ts'), 'export function needleInHaystack() { return 1; }\n', 'utf8');
  fs.writeFileSync(path.join(root, 'src', 'b.md'), 'The searchable guide mentions a haystack.\n', 'utf8');
  fs.writeFileSync(path.join(root, 'RUN_REPORT.md'), 'needle in a reserved report must not be indexed\n', 'utf8');
  fs.writeFileSync(path.join(root, 'binary.bin'), Buffer.from([0, 1, 2, 3]));
});

afterEach(() => {
  closeDb();
  fs.rmSync(root, { recursive: true, force: true });
});

describe('run workspace search', () => {
  it('builds a bounded FTS index and returns a snippet with markers', () => {
    const first = searchRunWorkspace('run_search_test', root, 'needle');
    expect(first.indexed).toBe(true);
    expect(first.indexState).toBe('built');
    expect(first.indexedFiles).toBe(2);
    expect(first.matches.map((row) => row.path)).toContain('src/a.ts');
    expect(first.matches.find((row) => row.path === 'src/a.ts')?.snippet).toContain('⟦needle⟧');
    expect(first.matches.some((row) => row.path === 'RUN_REPORT.md')).toBe(false);

    const second = searchRunWorkspace('run_search_test', root, 'haystack');
    expect(second.indexed).toBe(false);
    expect(second.indexState).toBe('reused');
    expect(second.matches.map((row) => row.path).sort()).toEqual(['src/a.ts', 'src/b.md']);
  });

  it('rebuilds when a published file changes instead of serving stale matches', () => {
    const first = searchRunWorkspace('run_search_test', root, 'needle');
    expect(first.indexState).toBe('built');

    fs.writeFileSync(path.join(root, 'src', 'a.ts'), 'export function freshTokenOnly() { return 2; }\n', 'utf8');
    const changed = searchRunWorkspace('run_search_test', root, 'freshTokenOnly');
    expect(changed.indexed).toBe(true);
    expect(changed.indexState).toBe('rebuilt');
    expect(changed.matches.map((row) => row.path)).toContain('src/a.ts');

    const removed = searchRunWorkspace('run_search_test', root, 'needleInHaystack');
    expect(removed.indexState).toBe('reused');
    expect(removed.matches).toEqual([]);
  });

  it('rebuilds when a published file is deleted', () => {
    const first = searchRunWorkspace('run_search_test', root, 'haystack');
    expect(first.indexState).toBe('built');
    expect(first.indexedFiles).toBe(2);

    fs.rmSync(path.join(root, 'src', 'b.md'));
    const afterDelete = searchRunWorkspace('run_search_test', root, 'searchable guide');
    expect(afterDelete.indexState).toBe('rebuilt');
    expect(afterDelete.indexedFiles).toBe(1);
    expect(afterDelete.matches.some((row) => row.path === 'src/b.md')).toBe(false);
  });

  it('falls back to LIKE for queries shorter than a trigram', () => {
    const result = searchRunWorkspace('run_search_test', root, 'ne', 1);
    expect(result.matches).toHaveLength(1);
    expect(result.truncated).toBe(true);
    expect(result.matches[0]?.path).toBe('src/a.ts');
  });

  it('returns an empty result instead of inventing matches for a missing workspace', () => {
    const result = searchRunWorkspace('run_search_missing', path.join(root, 'does-not-exist'), 'needle');
    expect(result.indexed).toBe(true);
    expect(result.indexState).toBe('built');
    expect(result.indexedFiles).toBe(0);
    expect(result.matches).toEqual([]);
    const repeat = searchRunWorkspace('run_search_missing', path.join(root, 'does-not-exist'), 'needle');
    expect(repeat.indexed).toBe(false);
    expect(repeat.indexState).toBe('reused');
    expect(repeat.matches).toEqual([]);
  });
});
