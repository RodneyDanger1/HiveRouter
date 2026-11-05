import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getDb, tx } from '../db/database.js';
import { isAllowedExtension, listFiles } from '../security/paths.js';

/**
 * Derived full-text search over one terminal run's published workspace.
 *
 * This module never accepts a caller-supplied filesystem path. The run row owns
 * the workspace, `listFiles` skips symlinks, and only known text extensions are
 * indexed. The index is disposable: deleting `run_search_docs`/`run_search_fts`
 * loses no run data and the next search rebuilds it.
 */

const MAX_FILE_BYTES = 256 * 1024;
const MAX_INDEXED_FILES = 2_000;
const RESERVED_NAMES = new Set(['RUN_REPORT.md', 'manifest.json']);

export interface WorkspaceSearchMatch {
  path: string;
  snippet: string;
  score: number;
}

export interface WorkspaceSearchResult {
  runId: string;
  query: string;
  matches: WorkspaceSearchMatch[];
  indexedFiles: number;
  indexed: boolean;
  indexState: 'built' | 'reused' | 'rebuilt';
  truncated: boolean;
}

interface WorkspaceIndexInput {
  signature: string;
  files: string[];
}

interface IndexStateRow {
  workspace_signature: string;
  indexed_files: number;
}

function shouldIndex(rel: string): boolean {
  if (rel.startsWith('.staging/') || rel.startsWith('staged/')) return false;
  if (rel.split('/').some((part) => RESERVED_NAMES.has(part))) return false;
  return isAllowedExtension(rel);
}

function clearRun(runId: string): void {
  const db = getDb();
  const rows = db.prepare('SELECT id FROM run_search_docs WHERE run_id = ?').all(runId) as Array<{ id: number }>;
  const deleteFts = db.prepare('DELETE FROM run_search_fts WHERE rowid = ?');
  const deleteDoc = db.prepare('DELETE FROM run_search_docs WHERE id = ?');
  for (const row of rows) {
    deleteFts.run(row.id);
    deleteDoc.run(row.id);
  }
}

/**
 * A cheap freshness signal for the eligible file set. The index remains the
 * content source of truth; this only decides whether the cached rows are still
 * valid. Content hashing every file on every search would defeat the cache.
 */
function workspaceIndexInput(workspacePath: string): WorkspaceIndexInput {
  if (!workspacePath || !fs.existsSync(workspacePath)) {
    return { signature: 'missing', files: [] };
  }
  const files = listFiles(workspacePath).filter(shouldIndex).sort();
  const hash = crypto.createHash('sha256');
  hash.update('present\n');
  for (const rel of files) {
    const full = path.resolve(workspacePath, rel);
    const relative = path.relative(workspacePath, full);
    if (relative.startsWith('..') || path.isAbsolute(relative)) continue;
    let size = -1;
    let mtimeMs = 0;
    try {
      const stat = fs.statSync(full);
      if (stat.isFile()) {
        size = stat.size;
        mtimeMs = stat.mtimeMs;
      }
    } catch {
      // A transient stat failure still contributes the path; the next search
      // will notice when metadata becomes readable.
    }
    hash.update(`${rel}\0${size}\0${mtimeMs}\n`);
  }
  return { signature: hash.digest('hex'), files };
}

function readIndexState(runId: string): IndexStateRow | null {
  return (
    (getDb()
      .prepare('SELECT workspace_signature, indexed_files FROM run_search_index WHERE run_id = ?')
      .get(runId) as IndexStateRow | undefined) ?? null
  );
}

function countIndexedDocs(runId: string): number {
  const row = getDb().prepare('SELECT COUNT(*) AS n FROM run_search_docs WHERE run_id = ?').get(runId) as { n: number };
  return Number(row.n);
}

function indexRun(runId: string, workspacePath: string, input: WorkspaceIndexInput): number {
  const files = workspacePath && fs.existsSync(workspacePath) ? input.files : [];
  tx((db) => {
    clearRun(runId);
    const insertDoc = db.prepare('INSERT INTO run_search_docs (run_id, path, content) VALUES (?, ?, ?)');
    const insertFts = db.prepare('INSERT INTO run_search_fts (rowid, content) VALUES (?, ?)');
    for (const rel of files.slice(0, MAX_INDEXED_FILES)) {
      const full = path.resolve(workspacePath, rel);
      const relative = path.relative(workspacePath, full);
      if (relative.startsWith('..') || path.isAbsolute(relative)) continue;
      let stat: fs.Stats;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      if (!stat.isFile() || stat.size > MAX_FILE_BYTES) continue;
      let content: string;
      try {
        content = fs.readFileSync(full, 'utf8');
      } catch {
        continue;
      }
      if (content.includes('\0') || content.trim().length === 0) continue;
      const info = insertDoc.run(runId, rel.replace(/\\/g, '/'), content);
      insertFts.run(Number(info.lastInsertRowid), content);
    }
    const count = db.prepare('SELECT COUNT(*) AS n FROM run_search_docs WHERE run_id = ?').get(runId) as { n: number };
    db.prepare(
      `INSERT INTO run_search_index (run_id, workspace_signature, indexed_files, indexed_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(run_id) DO UPDATE SET
         workspace_signature = excluded.workspace_signature,
         indexed_files = excluded.indexed_files,
         indexed_at = excluded.indexed_at`,
    ).run(runId, input.signature, Number(count.n), new Date().toISOString());
  });
  return countIndexedDocs(runId);
}

function escapeLike(query: string): string {
  return query.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function excerpt(content: string, query: string): string {
  const at = content.toLowerCase().indexOf(query.toLowerCase());
  if (at < 0) return content.slice(0, 220);
  const start = Math.max(0, at - 80);
  const end = Math.min(content.length, at + query.length + 120);
  return `${start > 0 ? '…' : ''}${content.slice(start, at)}⟦${content.slice(at, at + query.length)}⟧${content.slice(at + query.length, end)}${end < content.length ? '…' : ''}`;
}

function shortQueryMatches(runId: string, query: string, limit: number): WorkspaceSearchMatch[] {
  const rows = getDb()
    .prepare(
      `SELECT path, content FROM run_search_docs
       WHERE run_id = ? AND content LIKE ? ESCAPE '\\'
       ORDER BY path LIMIT ?`,
    )
    .all(runId, `%${escapeLike(query)}%`, limit) as Array<{ path: string; content: string }>;
  return rows.map((row) => ({
    path: row.path,
    snippet: excerpt(row.content, query),
    score: 0,
  }));
}

/**
 * Search a run workspace. A changed eligible file set invalidates the cached
 * index and forces a rebuild before results are served. An unchanged workspace
 * reuses it; a missing workspace is an honest empty index, not stale success.
 */
export function searchRunWorkspace(runId: string, workspacePath: string, query: string, limit = 20): WorkspaceSearchResult {
  const input = workspaceIndexInput(workspacePath);
  const state = readIndexState(runId);
  const docCount = countIndexedDocs(runId);
  const stateMatches =
    state !== null &&
    state.workspace_signature === input.signature &&
    state.indexed_files === docCount;
  let indexedFiles = docCount;
  let indexed = false;
  let indexState: WorkspaceSearchResult['indexState'] = 'reused';
  if (!stateMatches) {
    indexedFiles = indexRun(runId, workspacePath, input);
    indexState = state !== null || docCount > 0 ? 'rebuilt' : 'built';
    indexed = true;
  }
  const boundedLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
  let matches: WorkspaceSearchMatch[];
  if (query.length < 3) {
    matches = shortQueryMatches(runId, query, boundedLimit);
  } else {
    const phrase = `"${query.replace(/"/g, '""')}"`;
    const rows = getDb()
      .prepare(
        `SELECT d.path AS path, d.content AS content, bm25(run_search_fts) AS score
         FROM run_search_fts
         JOIN run_search_docs d ON d.id = run_search_fts.rowid
         WHERE run_search_fts MATCH ? AND d.run_id = ?
         ORDER BY score, d.path
         LIMIT ?`,
      )
      .all(phrase, runId, boundedLimit) as Array<{ path: string; content: string; score: number }>;
    matches = rows.map((row) => ({ path: row.path, snippet: excerpt(row.content, query), score: -Number(row.score) }));
  }
  return {
    runId,
    query,
    matches,
    indexedFiles,
    indexed,
    indexState,
    truncated: matches.length >= boundedLimit,
  };
}
