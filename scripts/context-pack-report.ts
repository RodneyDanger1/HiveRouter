/**
 * context-pack-report.ts
 * Summarize persisted context packs for a run. Read-only.
 * Exit 0 pass, 2 usage, 3 not found, 9 internal.
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/server/config.js';
import { initDb, getDb } from '../src/server/db/database.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const runArg = args.indexOf('--run');
const runId = runArg >= 0 ? args[runArg + 1] : undefined;

async function main() {
  if (!runId || runId.startsWith('--')) {
    console.error('usage: context-pack-report --run <runId> [--json]');
    process.exit(2);
  }
  initDb();
  const db = getDb();
  const run = db.prepare('SELECT id FROM runs WHERE id = ?').get(runId);
  if (!run) {
    console.error(`E_RUN_NOT_FOUND ${runId}`);
    process.exit(3);
  }
  const rows = db.prepare('SELECT * FROM context_packs WHERE run_id = ? ORDER BY created_at ASC').all(runId) as Array<Record<string, unknown>>;
  const result = {
    schema: 'hive.cli.v1',
    command: 'hive.context-report',
    ok: true,
    runId,
    packs: rows.map((row) => ({
      id: row.id,
      taskId: row.task_id,
      strategy: row.strategy,
      estimatedTokens: row.est_tokens,
      prefixHash: row.prefix_hash,
      converged: Boolean(row.converged),
      degraded: Boolean(row.degraded),
      included: JSON.parse(String(row.included_json ?? '[]')),
      excluded: JSON.parse(String(row.excluded_json ?? '[]')),
    })),
  };
  const dir = path.join(config.dataDir, 'reports');
  fs.mkdirSync(dir, { recursive: true });
  const reportPath = path.join(dir, `context-${runId}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2), 'utf8');
  if (json) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  else process.stdout.write(`context ${runId}: ${rows.length} packs\nreport: ${reportPath}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(9);
});
