import fs from 'node:fs';
import path from 'node:path';
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
  truncated: boolean;
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

function indexRun(runId: string, workspacePath: string): number {
  if (!workspacePath || !fs.existsSync(workspacePath)) return 0;
  const files = listFiles(workspacePath).filter(shouldIndex).slice(0, MAX_INDEXED_FILES);
  tx((db) => {
    clearRun(runId);
    const insertDoc = db.prepare('INSERT INTO run_search_docs (run_id, path, content) VALUES (?, ?, ?)');
    const insertFts = db.prepare('INSERT INTO run_search_fts (rowid, content) VALUES (?, ?)');
    for (const rel of files) {
      const full = path.resolve(workspacePath, rel);
      const relative = path.relative(workspacePath, full);
      if (relative.startsWith('..') || path.isAbsolute(relative)) continue;
      const stat = fs.statSync(full);
      if (!stat.isFile() || stat.size > MAX_FILE_BYTES) continue;
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes('\0') || content.trim().length === 0) continue;
      const info = insertDoc.run(runId, rel.replace(/\\/g, '/'), content);
      insertFts.run(Number(info.lastInsertRowid), content);
    }
  });
  const count = getDb().prepare('SELECT COUNT(*) AS n FROM run_search_docs WHERE run_id = ?').get(runId) as { n: number };
  return Number(count.n);
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
 * Search a run workspace. The first search builds the disposable index; later
 * searches reuse it because a terminal run's published workspace is immutable.
 */
export function searchRunWorkspace(runId: string, workspacePath: string, query: string, limit = 20): WorkspaceSearchResult {
  const existing = getDb().prepare('SELECT COUNT(*) AS n FROM run_search_docs WHERE run_id = ?').get(runId) as { n: number };
  let indexedFiles = Number(existing.n);
  let indexed = false;
  if (indexedFiles === 0) {
    indexedFiles = indexRun(runId, workspacePath);
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
    truncated: matches.length >= boundedLimit,
  };
}
