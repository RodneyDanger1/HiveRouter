// Read-only audit probe. Opens the production DB with readOnly: true; performs no writes.
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/hive.db', { readOnly: true });
const runIds = ['run_abf5fe78aab1e932ff', 'run_95c11797b4923b4277'];

console.log('== run_limit settings (latest 6) ==');
console.log(JSON.stringify(db.prepare("SELECT key, value_json, updated_at FROM settings WHERE key LIKE 'run_limit:%' ORDER BY updated_at DESC LIMIT 6").all(), null, 2));

for (const id of runIds) {
  console.log(`== context_packs ${id} ==`);
  const rows = db.prepare('SELECT id, task_id, included_json, excluded_json, est_tokens, prefix_hash FROM context_packs WHERE run_id = ?').all(id);
  console.log('count=', rows.length);
  if (rows[0]) {
    console.log('included_json sample:', String(rows[0].included_json).slice(0, 700));
    console.log('excluded_json sample:', String(rows[0].excluded_json).slice(0, 900));
  }
  console.log(`== run_snapshots ${id} ==`);
  const snap = db.prepare('SELECT snapshot_json FROM run_snapshots WHERE run_id = ?').get(id);
  if (snap) {
    const parsed = JSON.parse(String(snap.snapshot_json));
    console.log('snapshot has limits:', Boolean(parsed.limits), 'maxRunCostUsd=', parsed.limits?.maxRunCostUsd);
  } else {
    console.log('no snapshot row');
  }
  console.log(`== events ${id} range ==`);
  const ev = db.prepare('SELECT MIN(seq) lo, MAX(seq) hi, COUNT(*) n FROM events WHERE run_id = ?').get(id);
  console.log(ev);
  console.log(`== checks/artifacts/steps ${id} ==`);
  console.log(db.prepare('SELECT (SELECT COUNT(*) FROM checks WHERE run_id=?) c, (SELECT COUNT(*) FROM artifacts WHERE run_id=?) a, (SELECT COUNT(*) FROM steps WHERE run_id=?) s').get(id, id, id));
  const usage = db.prepare("SELECT COUNT(*) n, SUM(source='unknown') unknown_rows, SUM(cost_usd) known_cost FROM usage WHERE run_id=?").get(id);
  console.log('usage:', usage);
}
db.close();
