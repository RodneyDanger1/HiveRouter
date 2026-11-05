// Read-only: compare runs.cost_usd/prompt_tokens to the usage ledger per run.
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data/hive.db', { readOnly: true });
const rows = db.prepare(`
  SELECT r.id, r.status, r.cost_usd AS run_cost, r.prompt_tokens AS run_prompt, r.completion_tokens AS run_completion,
         (SELECT COUNT(*) FROM usage u WHERE u.run_id = r.id) AS usage_rows,
         (SELECT SUM(u.cost_usd) FROM usage u WHERE u.run_id = r.id) AS usage_cost,
         (SELECT SUM(u.prompt_tokens) FROM usage u WHERE u.run_id = r.id) AS usage_prompt,
         (SELECT SUM(u.completion_tokens) FROM usage u WHERE u.run_id = r.id) AS usage_completion,
         (SELECT SUM(u.source = 'unknown') FROM usage u WHERE u.run_id = r.id) AS unknown_rows
  FROM runs r
  WHERE r.status IN ('failed','budget_exceeded','cancelled','interrupted')
  ORDER BY r.created_at DESC
`).all();
console.log(JSON.stringify(rows, null, 2));
const ok = db.prepare(`
  SELECT r.id, r.status, r.cost_usd AS run_cost,
         (SELECT SUM(u.cost_usd) FROM usage u WHERE u.run_id = r.id) AS usage_cost
  FROM runs r WHERE r.status IN ('completed','completed_with_warnings') ORDER BY r.created_at DESC LIMIT 3
`).all();
console.log('completed comparison:', JSON.stringify(ok, null, 2));
db.close();
