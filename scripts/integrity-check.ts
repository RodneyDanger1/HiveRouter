/**
 * integrity-check.ts
 * Recompute artifact hashes and compare against the stored manifest/registry.
 * Exit 0 pass, 2 usage, 3 not found, 5 mismatch, 9 internal.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../src/server/config.js';
import { initDb, getDb } from '../src/server/db/database.js';

const args = process.argv.slice(2);
const json = args.includes('--json');
const runArg = args.indexOf('--run');
const runId = runArg >= 0 ? args[runArg + 1] : undefined;

async function main() {
  if (!runId || runId.startsWith('--')) {
    console.error('usage: integrity-check --run <runId> [--json]');
    process.exit(2);
  }
  initDb();
  const db = getDb();
  const run = db.prepare('SELECT * FROM runs WHERE id = ?').get(runId) as Record<string, unknown> | undefined;
  if (!run) {
    console.error(`E_RUN_NOT_FOUND ${runId}`);
    process.exit(3);
  }
  const workspace = path.resolve(String(run.workspace_path));
  const artifacts = db.prepare('SELECT path, sha256, bytes FROM artifacts WHERE run_id = ? ORDER BY path ASC').all(runId) as Array<{ path: string; sha256: string; bytes: number }>;
  const results = artifacts.map((artifact) => {
    const full = path.resolve(workspace, artifact.path);
    if (!full.startsWith(workspace + path.sep)) {
      return { path: artifact.path, bytes: artifact.bytes, expected: artifact.sha256, actual: null, ok: false, code: 'E_PATH_ESCAPE' };
    }
    const exists = fs.existsSync(full);
    const actual = exists ? crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex') : null;
    return { path: artifact.path, bytes: artifact.bytes, expected: artifact.sha256, actual, ok: exists && actual === artifact.sha256 };
  });
  let manifestParity: { ok: boolean; expected: number; actual: number; missing: string[]; extra: string[] } | null = null;
  const manifestPath = path.join(workspace, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { files?: Array<{ path: string; sha256?: string }> };
      const manifestFiles = (manifest.files ?? []).map((file) => file.path).sort();
      const dbFiles = artifacts.map((artifact) => artifact.path).sort();
      manifestParity = {
        ok: JSON.stringify(manifestFiles) === JSON.stringify(dbFiles),
        expected: manifestFiles.length,
        actual: dbFiles.length,
        missing: dbFiles.filter((file) => !manifestFiles.includes(file)),
        extra: manifestFiles.filter((file) => !dbFiles.includes(file)),
      };
    } catch {
      manifestParity = { ok: false, expected: 0, actual: artifacts.length, missing: [], extra: [] };
    }
  }
  const ok = results.every((r) => r.ok) && (manifestParity?.ok ?? true);
  const report = { schema: 'hive.cli.v1', command: 'hive.integrity', ok, runId, artifacts: results, manifestParity, checkedAt: new Date().toISOString() };
  const dir = path.join(config.dataDir, 'reports');
  fs.mkdirSync(dir, { recursive: true });
  const reportPath = path.join(dir, `integrity-${runId}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  if (json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  else process.stdout.write(`integrity ${runId}: ${ok ? 'PASS' : 'MISMATCH'} (${results.length} artifacts)\nreport: ${reportPath}\n`);
  process.exit(ok ? 0 : 5);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(9);
});
