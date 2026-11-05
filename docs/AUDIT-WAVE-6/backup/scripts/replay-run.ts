/**
 * replay-run.ts
 * Reconstruct a run from persisted events and artifacts. Never calls the LLM.
 * Exit 0 pass, 2 usage, 3 not found, 4 integrity failure, 9 internal.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../src/server/config.js';
import { initDb, getDb, nowIso } from '../src/server/db/database.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const runIndex = args.indexOf('--run');
const runId = runIndex >= 0 ? args[runIndex + 1] : undefined;

function fail(code: number, message: string): never {
  console.error(message);
  process.exit(code);
}

async function main() {
  if (!runId || runId.startsWith('--')) fail(2, 'usage: replay-run --run <runId> [--json]');
  initDb();
  const db = getDb();
  const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(runId) as Record<string, unknown> | undefined;
  if (!run) fail(3, `E_RUN_NOT_FOUND ${runId}`);
  const events = db.prepare('SELECT seq, type, created_at FROM events WHERE run_id = ? ORDER BY seq ASC').all(runId) as Array<{ seq: number; type: string; created_at: string }>;
  const artifacts = db.prepare('SELECT path, sha256, bytes FROM artifacts WHERE run_id = ? ORDER BY path ASC').all(runId) as Array<{ path: string; sha256: string; bytes: number }>;
  let contiguous = true;
  for (let i = 1; i < events.length; i += 1) if (events[i].seq !== events[i - 1].seq + 1) contiguous = false;
  const workspace = path.resolve(String(run.workspace_path));
  const integrity = artifacts.map((artifact) => {
    try {
      const full = path.resolve(workspace, artifact.path);
      if (!full.startsWith(workspace + path.sep)) return { path: artifact.path, exists: false, sha256: artifact.sha256, actual: null, ok: false, code: 'E_PATH_ESCAPE' };
      const exists = fs.existsSync(full);
      const sha = exists ? crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex') : null;
      return { path: artifact.path, exists, sha256: artifact.sha256, actual: sha, ok: exists && sha === artifact.sha256 };
    } catch {
      return { path: artifact.path, exists: false, sha256: artifact.sha256, actual: null, ok: false };
    }
  });
  const ok = contiguous && integrity.every((i) => i.ok);
  const result = {
    schema: 'hive.cli.v1',
    command: 'hive.replay',
    ok,
    runId,
    status: run.status,
    phase: run.phase,
    snapshotHash: run.snapshot_hash,
    events: events.length,
    contiguous,
    artifacts: integrity,
    generatedAt: nowIso(),
  };
  const outDir = `${config.dataDir}\\replay`;
  fs.mkdirSync(outDir, { recursive: true });
  const reportPath = `${outDir}\\replay-${runId}.json`;
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2), 'utf8');
  if (json) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  else process.stdout.write(`replay ${runId}: ${ok ? 'PASS' : 'FAIL'} (${events.length} events, ${artifacts.length} artifacts)\nreport: ${reportPath}\n`);
  process.exit(ok ? 0 : 4);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(9);
});
