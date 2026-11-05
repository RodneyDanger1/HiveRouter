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
    expect(first.indexedFiles).toBe(2);
    expect(first.matches.map((row) => row.path)).toContain('src/a.ts');
    expect(first.matches.find((row) => row.path === 'src/a.ts')?.snippet).toContain('⟦needle⟧');
    expect(first.matches.some((row) => row.path === 'RUN_REPORT.md')).toBe(false);

    const second = searchRunWorkspace('run_search_test', root, 'haystack');
    expect(second.indexed).toBe(false);
    expect(second.matches.map((row) => row.path).sort()).toEqual(['src/a.ts', 'src/b.md']);
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
    expect(result.indexedFiles).toBe(0);
    expect(result.matches).toEqual([]);
  });
});
