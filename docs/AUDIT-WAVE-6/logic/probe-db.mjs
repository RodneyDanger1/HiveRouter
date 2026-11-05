#!/usr/bin/env node
// W6-AUD-02 logic audit — READ-ONLY production DB evidence collector.
// Opens data/hive.db with readOnly:true. Never writes, never deletes, never restarts.
// Usage: node docs/AUDIT-WAVE-6/logic/probe-db.mjs [runId...]
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const ROOT = process.cwd();
const file = path.join(ROOT, 'data', 'hive.db');
const db = new DatabaseSync(file, { readOnly: true });
const args = process.argv.slice(2);

function q(sql, ...params) {
  return db.prepare(sql).all(...params);
}
function one(sql, ...params) {
  return db.prepare(sql).get(...params);
}
function show(title, rows) {
  console.log(`\n### ${title}`);
  for (const row of rows) console.log(JSON.stringify(row));
}

show('schema_version', q("SELECT version, applied_at FROM schema_migrations ORDER BY version"));
show('counts', [
  {
    runs: one('SELECT COUNT(*) n FROM runs').n,
    events: one('SELECT COUNT(*) n FROM events').n,
    steps: one('SELECT COUNT(*) n FROM steps').n,
    artifacts: one('SELECT COUNT(*) n FROM artifacts').n,
    checks: one('SELECT COUNT(*) n FROM checks').n,
    usage: one('SELECT COUNT(*) n FROM usage').n,
    reservations: one('SELECT COUNT(*) n FROM budget_reservations').n,
    idempotency: one('SELECT COUNT(*) n FROM idempotency_keys').n,
    traces: one('SELECT COUNT(*) n FROM traces').n,
    maxEventSeq: one('SELECT COALESCE(MAX(seq),0) m FROM events').m,
  },
]);

show(
  'runs',
  q(`SELECT id, status, phase, error_code, trace_complete, cost_usd,
            created_at, finished_at
     FROM runs ORDER BY created_at ASC`),
);

show('run_status_histogram', q('SELECT status, COUNT(*) n FROM runs GROUP BY status'));
show('step_status_histogram', q('SELECT status, COUNT(*) n FROM steps GROUP BY status'));
show('step_error_codes', q("SELECT error_code, COUNT(*) n FROM steps WHERE error_code IS NOT NULL GROUP BY error_code"));
show('usage_sources_by_run', q('SELECT run_id, source, COUNT(*) n, ROUND(SUM(cost_usd),9) cost FROM usage GROUP BY run_id, source ORDER BY run_id'));

show(
  'event_window_per_run',
  q(`SELECT r.id,
            (SELECT COUNT(*) FROM events e WHERE e.run_id = r.id) AS events,
            (SELECT MIN(seq) FROM events e WHERE e.run_id = r.id) AS first_seq,
            (SELECT MAX(seq) FROM events e WHERE e.run_id = r.id) AS last_seq,
            (SELECT COUNT(*) FROM events e WHERE e.run_id = r.id AND e.type IN ('run.failed','run.cancelled','run.completed')) AS terminal_events,
            (SELECT type FROM events e WHERE e.run_id = r.id ORDER BY seq DESC LIMIT 1) AS last_type
     FROM runs r ORDER BY r.created_at ASC`),
);

show(
  'terminal_event_payloads',
  q(`SELECT run_id, seq, type, payload_json FROM events
     WHERE type IN ('run.failed','run.cancelled','run.completed') ORDER BY seq`),
);

show('run_failed_payload_shapes', q("SELECT run_id, type, json_extract(payload_json,'$.code') code, json_extract(payload_json,'$.message') message, json_extract(payload_json,'$.timedOut') timedOut, json_extract(payload_json,'$.checks[0].id') firstCheck FROM events WHERE type='run.failed'"));

show('reservation_states', q('SELECT state, COUNT(*) n, ROUND(SUM(amount_micro_usd)/1e6,6) reserved_usd, ROUND(SUM(COALESCE(committed_micro_usd,0))/1e6,6) committed_usd FROM budget_reservations GROUP BY state'));
show('stale_reservations', q("SELECT id, scope, owner_run_id, state, amount_micro_usd, expires_at FROM budget_reservations WHERE state='reserved' AND expires_at < strftime('%Y-%m-%dT%H:%M:%fZ','now')"));
show('reservations_by_run', q("SELECT owner_run_id, state, COUNT(*) n FROM budget_reservations WHERE owner_run_id IS NOT NULL GROUP BY owner_run_id, state ORDER BY owner_run_id"));

show('event_type_histogram', q('SELECT type, COUNT(*) n FROM events GROUP BY type ORDER BY n DESC'));
show('agent_failed_events', q("SELECT run_id, seq, created_at, payload_json FROM events WHERE type = 'agent.failed' ORDER BY seq"));
show('repair_stalled_events', q("SELECT run_id, seq, payload_json FROM events WHERE type = 'repair.stalled' ORDER BY seq"));
show('skipped_events', q("SELECT type, COUNT(*) n FROM events WHERE type IN ('phase.skipped','context.skipped') GROUP BY type"));

show('reservation_total', q("SELECT state, COUNT(*) n, ROUND(SUM(amount_micro_usd)/1e6,9) reserved_usd, ROUND(SUM(COALESCE(committed_micro_usd,0))/1e6,9) committed_usd FROM budget_reservations GROUP BY state"));
show('run_cost_vs_usage', q(`SELECT r.id, r.status, r.cost_usd,
       (SELECT ROUND(SUM(u.cost_usd),9) FROM usage u WHERE u.run_id = r.id) AS usage_cost,
       (SELECT ROUND(SUM(COALESCE(br.committed_micro_usd, br.amount_micro_usd))/1e6,9)
          FROM budget_reservations br WHERE br.owner_run_id = r.id AND br.state='committed') AS committed_usd
     FROM runs r WHERE r.cost_usd IS NULL ORDER BY r.created_at`));
show('traces', q('SELECT run_id, outcome, complete, ROUND(cost_usd,9) cost FROM traces ORDER BY created_at'));
show('runs_without_trace', q('SELECT r.id, r.status, r.trace_complete FROM runs r LEFT JOIN traces t ON t.run_id = r.id WHERE t.run_id IS NULL ORDER BY r.created_at'));
show('learning_tables', [
  {
    sealed_blocks: one('SELECT COUNT(*) n FROM eval_suites').n,
    candidates: one('SELECT COUNT(*) n FROM variants').n,
    evaluations: one('SELECT COUNT(*) n FROM eval_runs').n,
    promotions: one('SELECT COUNT(*) n FROM promotions').n,
    audit: one('SELECT COUNT(*) n FROM learning_audit').n,
    consent: one('SELECT COUNT(*) n FROM consent_records').n,
  },
]);

for (const runId of args) {
  show(`events:${runId}`, q('SELECT seq, type, created_at, substr(payload_json,1,400) payload FROM events WHERE run_id = ? ORDER BY seq', runId));
  show(`steps:${runId}`, q('SELECT seq, phase, agent_id, status, error_code, cost_usd, started_at, finished_at FROM steps WHERE run_id = ? ORDER BY seq', runId));
}

db.close();
