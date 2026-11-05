import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { A_SQL, CHAT_SQL, P6A_SQL, P7_SQL, SEARCH_SQL } from './migrations.js';
import { config, ensureRuntimeDirs } from '../config.js';
import { PHASE } from '../../shared/features.js';

let db: DatabaseSync | null = null;

export type Stage = 'A' | 'B1' | 'B2';

export function nowIso(): string {
  return new Date().toISOString();
}

function ensureColumn(database: DatabaseSync, table: string, column: string, sqlType: string): void {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (columns.some((row) => row.name === column)) return;
  database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${sqlType}`);
}

/**
 * Old route_candidates rows were written before model/thinking/effort/chosen
 * existed. The corresponding route_decisions.features_json still holds the
 * chosen runtime, so backfill only what the historical evidence proves.
 */
export function backfillRouteCandidateDisclosure(database: DatabaseSync): number {
  const rows = database
    .prepare(
      `SELECT rc.id, rc.agent_id, rd.agent_id AS decision_agent, rd.features_json,
              r.model AS run_model, r.thinking AS run_thinking, r.effort AS run_effort
       FROM route_candidates rc
       JOIN runs r ON r.id = rc.run_id
       LEFT JOIN route_decisions rd ON rd.run_id = rc.run_id AND rd.task_id = rc.task_id
       WHERE rc.model IS NULL OR rc.thinking IS NULL`,
    )
    .all() as Array<{
      id: string;
      agent_id: string;
      decision_agent: string | null;
      features_json: string | null;
      run_model: string;
      run_thinking: string;
      run_effort: string | null;
    }>;
  let updated = 0;
  for (const row of rows) {
    let features: { model?: unknown; thinking?: unknown; effort?: unknown } = {};
    if (row.features_json) {
      try {
        features = JSON.parse(row.features_json) as typeof features;
      } catch {
        features = {};
      }
    }
    // Historical rows predate route-candidate runtime columns. The route was
    // not applied at that time, so the run snapshot is the truthful fallback.
    const model = typeof features.model === 'string' ? features.model : row.run_model;
    const thinking = typeof features.thinking === 'string' ? features.thinking : row.run_thinking;
    const effort = typeof features.effort === 'string' ? features.effort : row.run_effort;
    if (!model || !thinking) continue;
    const chosen = row.decision_agent === row.agent_id ? 1 : 0;
    const result = database
      .prepare('UPDATE route_candidates SET model = ?, thinking = ?, effort = ?, chosen = ? WHERE id = ?')
      .run(model, thinking, effort, chosen, row.id);
    updated += Number(result.changes);
  }
  return updated;
}

export function initDb(dbPath?: string, stage: Stage = PHASE as Stage): DatabaseSync {
  ensureRuntimeDirs();
  const file = dbPath ?? path.join(config.dataDir, 'hive.db');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const instance = new DatabaseSync(file);
  instance.exec('PRAGMA journal_mode=WAL;');
  instance.exec('PRAGMA synchronous=NORMAL;');
  instance.exec('PRAGMA foreign_keys=ON;');
  instance.exec('PRAGMA busy_timeout=5000;');
  const groups: Array<{ version: string; sql: string }> = [{ version: '001_a_core', sql: A_SQL }];
  if (stage === 'B1' || stage === 'B2') groups.push({ version: '010_p6a_decision', sql: P6A_SQL });
  if (stage === 'B2') groups.push({ version: '020_p7_learning', sql: P7_SQL });
  if (stage === 'B2') groups.push({ version: '030_p7_chat', sql: CHAT_SQL });
  if (stage === 'B2') groups.push({ version: '040_p7_search', sql: SEARCH_SQL });
  for (const group of groups) {
    instance.exec(group.sql);
    instance
      .prepare('INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)')
      .run(group.version, nowIso());
  }
  ensureColumn(instance, 'artifacts', 'status', "TEXT NOT NULL DEFAULT 'accepted'");
  ensureColumn(instance, 'artifacts', 'mime', 'TEXT');
  if (stage === 'B2') ensureColumn(instance, 'chat_messages', 'request_hash', 'TEXT');
  if (stage === 'B1' || stage === 'B2') {
    ensureColumn(instance, 'route_candidates', 'model', 'TEXT');
    ensureColumn(instance, 'route_candidates', 'thinking', 'TEXT');
    ensureColumn(instance, 'route_candidates', 'effort', 'TEXT');
    ensureColumn(instance, 'route_candidates', 'chosen', 'INTEGER NOT NULL DEFAULT 0');
    backfillRouteCandidateDisclosure(instance);
  }
  if (stage === 'B2') {
    // The historical flag was written before the trace row existed and is not
    // a claim we can keep. Reconcile it to physical evidence at open time.
    instance.exec(
      `UPDATE runs
       SET trace_complete = CASE
         WHEN EXISTS (SELECT 1 FROM traces WHERE traces.run_id = runs.id AND traces.complete = 1) THEN 1
         ELSE 0
       END`,
    );
  }
  db = instance;
  return instance;
}

export function getDb(): DatabaseSync {
  if (!db) throw new Error('database not initialized');
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function tx<T>(fn: (database: DatabaseSync) => T): T {
  const database = getDb();
  database.exec('BEGIN IMMEDIATE;');
  try {
    const result = fn(database);
    database.exec('COMMIT;');
    return result;
  } catch (error) {
    try {
      database.exec('ROLLBACK;');
    } catch {
      // preserve the original failure
    }
    throw error;
  }
}

export function openDatabase(file: string, stage: Stage = PHASE as Stage): DatabaseSync {
  if (db) closeDb();
  return initDb(file, stage);
}

export function tableNames(database: DatabaseSync = getDb()): string[] {
  const rows = database
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as Array<{ name: string }>;
  return rows.map((r) => r.name);
}
