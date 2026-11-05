/**
 * eval-router.ts
 * Offline summary of deterministic route decisions. Read-only; no provider calls.
 * Exit 0 pass, 6 insufficient data, 9 internal.
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/server/config.js';
import { initDb, getDb } from '../src/server/db/database.js';

const args = process.argv.slice(2);
const json = args.includes('--json');

async function main() {
  initDb();
  const db = getDb();
  const rows = db.prepare('SELECT agent_id, COUNT(*) AS n, AVG(score) AS avg_score FROM route_decisions GROUP BY agent_id ORDER BY n DESC').all() as Array<{ agent_id: string; n: number; avg_score: number }>;
  const total = rows.reduce((sum, row) => sum + Number(row.n), 0);
  const result = {
    schema: 'hive.cli.v1',
    command: 'hive.eval-router',
    ok: true,
    decisions: total,
    agents: rows.map((row) => ({ agentId: row.agent_id, decisions: Number(row.n), meanScore: Number(row.avg_score) })),
    metrics: {
      feasibilityRate: null,
      refusalRate: null,
      note: 'No persisted refusal field in this view; rates require a labelled dataset.',
    },
    refused: total === 0 ? { code: 'E_LEARNING_INSUFFICIENT_SAMPLE', message: 'No route decisions recorded yet.' } : null,
  };
  const dir = path.join(config.dataDir, 'reports');
  fs.mkdirSync(dir, { recursive: true });
  const reportPath = path.join(dir, `eval-router-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2), 'utf8');
  if (json) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  else process.stdout.write(`eval-router: ${total} decisions\nreport: ${reportPath}\n`);
  process.exit(total === 0 ? 6 : 0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(9);
});
