import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('data/hive.db', { readOnly: true });
const rows = db.prepare('SELECT run_id, snapshot_json FROM run_snapshots WHERE run_id IN (?,?)').all('run_23af9b7837448cb24a', 'run_abf5fe78aab1e932ff');
for (const r of rows) {
  const s = JSON.parse(r.snapshot_json);
  console.log(`${r.run_id} snapshot.limits.maxRunCostUsd=${s.limits?.maxRunCostUsd} (keys=${Object.keys(s.limits ?? {}).length})`);
}
const limits = db.prepare("SELECT key, value_json FROM settings WHERE key LIKE 'run_limit:%'").all();
console.log('run_limit rows:', limits.length);
const two = db.prepare("SELECT key, value_json FROM settings WHERE key IN ('run_limit:run_23af9b7837448cb24a','run_limit:run_abf5fe78aab1e932ff')").all();
console.log(JSON.stringify(two));
db.close();
