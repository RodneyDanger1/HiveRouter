/**
 * bench-suite.ts
 * Deterministic smoke bench for the HiveRouter registry and algorithms.
 * Default mode performs no provider calls. --live only verifies /models and /user/balance
 * (zero-cost endpoints) and never generates content.
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../src/server/config.js';
import { REGISTRY } from '../src/server/agents/registry.js';
import { ROUTE_WEIGHT_PRESETS } from '../src/shared/algorithms.js';
import { resolveKey } from '../src/server/security/keys.js';

const args = new Set(process.argv.slice(2));
const json = args.has('--json');
const live = args.has('--live');

async function main() {
  const started = Date.now();
  const result: Record<string, unknown> = {
    schema: 'hive.cli.v1',
    command: 'hive.bench',
    mode: live ? 'live' : 'mock',
    ok: true,
    agents: REGISTRY.length,
    routePresets: Object.keys(ROUTE_WEIGHT_PRESETS),
    checks: [] as Array<{ name: string; ok: boolean; detail: string }>,
  };
  const checks = result.checks as Array<{ name: string; ok: boolean; detail: string }>;
  checks.push({ name: 'registry-count', ok: REGISTRY.length === 37, detail: `${REGISTRY.length} agents` });
  checks.push({ name: 'unique-ids', ok: new Set(REGISTRY.map((a) => a.id)).size === 37, detail: '37 unique ids' });
  checks.push({ name: 'prompt-nonempty', ok: REGISTRY.every((a) => a.prompt.trim().length > 40), detail: 'all prompts present' });
  if (live) {
    if (!args.has('--yes')) {
      console.error('bench-suite: --live requires --yes (explicit approval)');
      process.exit(2);
    }
    const key = resolveKey();
    if (!key.key) {
      console.error('bench-suite: E_KEY_NOT_CONFIGURED');
      process.exit(7);
    }
    for (const endpoint of ['/models', '/user/balance']) {
      const response = await fetch(`${config.baseUrl}${endpoint}`, { headers: { Authorization: `Bearer ${key.key}` } });
      checks.push({ name: `live${endpoint}`, ok: response.ok, detail: `HTTP ${response.status}` });
      if (!response.ok) result.ok = false;
    }
  }
  const reportDir = path.join(config.dataDir, 'reports');
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `bench-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2), 'utf8');
  result.reportPath = reportPath;
  result.durationMs = Date.now() - started;
  if (json) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  else {
    process.stdout.write(`bench ${result.mode}: ${checks.filter((c) => c.ok).length}/${checks.length} checks, ${REGISTRY.length} agents\n`);
    process.stdout.write(`report: ${reportPath}\n`);
  }
  const failed = checks.filter((c) => !c.ok).length;
  process.exit(failed === 0 ? 0 : 4);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(9);
});
