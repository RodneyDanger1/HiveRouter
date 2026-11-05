// Read-only census of the production DB for the Wave 7 audit.
// Opens data/hive.db with readOnly:true and never writes.
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/hive.db', { readOnly: true });
const all = (sql, ...params) => db.prepare(sql).all(...params);

const out = {
  runs: all('SELECT COUNT(*) AS n FROM runs')[0].n,
  statuses: all('SELECT status, COUNT(*) AS n FROM runs GROUP BY status ORDER BY status'),
  latestRuns: all('SELECT id, status, created_at FROM runs ORDER BY created_at DESC LIMIT 5'),
  learningTables: {},
  p7Counts: {},
  migrationVersions: all('SELECT version, applied_at FROM schema_migrations ORDER BY version'),
};

const tables = all(
  "SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE '%learning%' OR name LIKE '%promotion%' OR name LIKE '%consent%' OR name LIKE '%sealed%' OR name LIKE '%evaluation%' OR name LIKE '%candidate%' OR name LIKE '%dataset%' OR name LIKE '%trace%') ORDER BY name",
).map((r) => r.name);
for (const t of tables) out.learningTables[t] = all(`SELECT COUNT(*) AS n FROM ${t}`)[0].n;

db.close();
console.log(JSON.stringify(out, null, 2));
