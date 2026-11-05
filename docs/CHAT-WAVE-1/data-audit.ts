import { initDb, getDb, closeDb } from '../../src/server/db/database.js';

initDb('data/hive.db', 'B2');
const db = getDb();
const all = (sql: string): Array<Record<string, unknown>> => db.prepare(sql).all() as Array<Record<string, unknown>>;
const one = (sql: string): Record<string, unknown> => db.prepare(sql).get() as Record<string, unknown>;
const result = {
  tables: all("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'chat_%' ORDER BY name"),
  threads: one('SELECT COUNT(*) AS n FROM chat_threads'),
  messages: one('SELECT COUNT(*) AS n FROM chat_messages'),
  jobsByStatus: all(
    'SELECT status, COUNT(*) AS n, SUM(cost_usd) AS cost, SUM(prompt_tokens) AS prompt_tokens, SUM(completion_tokens) AS completion_tokens FROM chat_jobs GROUP BY status',
  ),
  events: one('SELECT COUNT(*) AS n FROM chat_events'),
  measuredJobs: one(
    'SELECT COUNT(*) AS n, SUM(cost_usd) AS measured_cost, SUM(prompt_tokens) AS prompt_tokens, SUM(completion_tokens) AS completion_tokens FROM chat_jobs WHERE cost_usd IS NOT NULL',
  ),
  unmeasuredJobs: one('SELECT COUNT(*) AS n FROM chat_jobs WHERE cost_usd IS NULL'),
  cycleBudget: all(
    "SELECT state, COUNT(*) AS n, SUM(amount_micro_usd) AS amount_micro_usd, SUM(committed_micro_usd) AS committed_micro_usd FROM budget_reservations WHERE scope = 'cycle' GROUP BY state",
  ),
  sample: one('SELECT id, thread_id, agent_id, status, attempts, max_attempts, cost_usd, prompt_tokens, completion_tokens, last_error_code FROM chat_jobs ORDER BY created_at DESC LIMIT 1'),
};
console.log(JSON.stringify(result, null, 2));
closeDb();
