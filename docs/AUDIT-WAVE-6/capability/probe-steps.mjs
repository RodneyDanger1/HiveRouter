import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('data/hive.db', { readOnly: true });

console.log('### abf5 steps 6-9');
console.log(JSON.stringify(db.prepare('SELECT seq, phase, agent_id, status, started_at, finished_at FROM steps WHERE run_id = ? AND seq BETWEEN 6 AND 9 ORDER BY seq').all('run_abf5fe78aab1e932ff'), null, 1));
console.log('### abf5 run row');
console.log(JSON.stringify(db.prepare('SELECT id, status, phase, started_at, finished_at, cost_usd, error_code FROM runs WHERE id = ?').get('run_abf5fe78aab1e932ff'), null, 1));
console.log('### abf5 step count');
console.log(JSON.stringify(db.prepare('SELECT COUNT(*) AS n FROM steps WHERE run_id = ?').get('run_abf5fe78aab1e932ff')));

console.log('### run.failed payload shapes');
const rows = db.prepare("SELECT run_id, seq, type, payload_json FROM events WHERE type = 'run.failed' ORDER BY seq").all();
for (const r of rows) console.log(`${r.run_id} seq=${r.seq} ${r.payload_json}`);

console.log('### run.cancelled rows');
console.log(JSON.stringify(db.prepare("SELECT COUNT(*) AS n FROM events WHERE type='run.cancelled'").get()));
console.log('### interrupted runs');
console.log(JSON.stringify(db.prepare("SELECT COUNT(*) AS n FROM runs WHERE status='interrupted'").get()));
console.log('### reviewed/badges: agent_evidence distinct agents');
console.log(JSON.stringify(db.prepare('SELECT COUNT(DISTINCT agent_id) AS n FROM agent_evidence').get()));
db.close();
