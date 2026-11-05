import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('C:/Users/Riley/Desktop/HiveRouter/data/hive.db', { readOnly: true });
const q = (sql, ...params) => db.prepare(sql).all(...params);

const tables = q("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").map((r) => r.name);
const out = { tables: tables.length, tableNames: tables };

const runs = q('SELECT status, COUNT(*) AS n FROM runs GROUP BY status ORDER BY status');
out.runsByStatus = runs;
out.runsTotal = q('SELECT COUNT(*) AS n FROM runs')[0].n;
out.latestRuns = q('SELECT id, status, created_at, finished_at FROM runs ORDER BY created_at DESC LIMIT 8');
const since = '2026-11-04T06:26:29.000Z';
out.runsCreatedSinceFreeze = q('SELECT id, status, created_at FROM runs WHERE created_at > ? ORDER BY created_at DESC', since);
out.usageSinceFreeze = q('SELECT COUNT(*) AS n, COALESCE(SUM(cost_usd),0) AS usd FROM usage WHERE created_at > ?', since);
out.usageTotal = q('SELECT COUNT(*) AS n, COALESCE(SUM(cost_usd),0) AS usd, MAX(created_at) AS latest FROM usage')[0];

out.schemaMigrations = q('SELECT version, applied_at FROM schema_migrations ORDER BY version');
for (const t of ['sealed_pool', 'sealed_pool_blocks', 'learning_jobs', 'learning_audit', 'eval_runs', 'eval_results', 'promotions', 'consent_records', 'approval_tokens', 'feedback', 'user_edits']) {
  out[`count_${t}`] = q(`SELECT COUNT(*) AS n FROM ${t}`)[0].n;
}
out.routeCandidates = q('SELECT COUNT(*) AS n, SUM(CASE WHEN model IS NULL OR thinking IS NULL THEN 1 ELSE 0 END) AS missing_runtime FROM route_candidates')[0];
out.settingsKeys = q('SELECT key FROM settings ORDER BY key').map((r) => (r.key.startsWith('run_') ? 'run_<id>' : r.key));
out.learningAuditLatest = q('SELECT COUNT(*) AS n, MAX(created_at) AS latest FROM learning_audit')[0];
out.eventsLatest = q('SELECT COUNT(*) AS n, MAX(created_at) AS latest FROM events')[0];
out.usageSinceMidnight = q("SELECT COUNT(*) AS n FROM usage WHERE created_at >= '2026-11-04T06:00:00.000Z'")[0];
out.runsSinceMidnight = q("SELECT COUNT(*) AS n FROM runs WHERE created_at >= '2026-11-04T06:00:00.000Z'")[0];

console.log(JSON.stringify(out, null, 2));
db.close();
