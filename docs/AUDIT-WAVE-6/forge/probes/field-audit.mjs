/**
 * Forge W6 read-only field audit: which fields RunDetailPage reads vs which
 * fields the routes actually return. Also records the spend contradiction
 * between /api/stats (usage-based) and the run rows.
 * READ-ONLY: GET routes + node:sqlite { readOnly: true }.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FORGE = path.resolve(HERE, '..');
const EVIDENCE = path.join(FORGE, 'evidence');
const REPO = path.resolve(FORGE, '..', '..', '..');
const BASE = process.env.HIVE_BASE ?? 'http://127.0.0.1:8787';

const get = async (pathname) => (await fetch(`${BASE}${pathname}`)).json();

const snapshot = await get('/api/runs/run_abf5fe78aab1e932ff/snapshot');
const stats = await get('/api/stats');
const abf5Checks = snapshot.checks ?? [];
const db = new DatabaseSync(path.join(REPO, 'data', 'hive.db'), { readOnly: true });
let result;
try {
  const checksParts = db.prepare('PRAGMA table_info(checks)').all().map((column) => `${column.name}:${column.type}`);
  const checkRows = db.prepare("SELECT * FROM checks WHERE run_id = 'run_abf5fe78aab1e932ff' LIMIT 1").all();
  const run = db.prepare("SELECT id, status, cost_usd, prompt_tokens, completion_tokens FROM runs WHERE id = 'run_abf5fe78aab1e932ff'").get();
  const usage = db.prepare("SELECT COUNT(*) n, SUM(cost_usd) cost, SUM(prompt_tokens) p, SUM(completion_tokens) c FROM usage WHERE run_id = 'run_abf5fe78aab1e932ff'").get();
  const runsSum = db.prepare('SELECT SUM(cost_usd) c FROM runs').get();
  const usageSum = db.prepare('SELECT SUM(cost_usd) c FROM usage').get();
  const interrupted = db.prepare("SELECT COUNT(*) n FROM runs WHERE status IN ('interrupted','cancelled','paused','needs_review')").get();
  result = {
    capturedAt: new Date().toISOString(),
    snapshotKeys: Object.keys(snapshot).sort(),
    runKeys: Object.keys(snapshot.run).sort(),
    snapshotHasLimits: Object.prototype.hasOwnProperty.call(snapshot, 'limits'),
    stats,
    db: {
      runsSumCostUsd: runsSum.c,
      usageSumCostUsd: usageSum.c,
      abf5Run: run,
      abf5Usage: usage,
      checksTableColumns: checksParts,
      firstCheckRow: checkRows[0] ?? null,
      nonTerminalOtherCount: interrupted.n,
    },
    uiReads: {
      capReadPath: 'RunDetailPage.tsx:199-201 reads snapshot.data.limits.maxCostUsd',
      checkReadPath: 'RunDetailPage.tsx:655-658 reads check.file/check.code/check.durationMs',
      routeProvides: {
        snapshotLimits: false,
        checkFileAny: abf5Checks.some((check) => Object.prototype.hasOwnProperty.call(check, 'file')),
        checkCodeAny: abf5Checks.some((check) => Object.prototype.hasOwnProperty.call(check, 'code')),
        checkDurationMsAny: abf5Checks.some((check) => Object.prototype.hasOwnProperty.call(check, 'durationMs')),
      },
      checkSample: abf5Checks[0] ?? null,
    },
    spendContradiction: {
      statsTotalCostUsd: stats.totalCostUsd,
      sumOfRunRowsUsd: runsSum.c,
      differenceUsd: Math.round((stats.totalCostUsd - runsSum.c) * 1e9) / 1e9,
      abf5RunCostUsd: run.cost_usd,
      abf5MeasuredUsageUsd: usage.cost,
    },
  };
} finally {
  db.close();
}

fs.mkdirSync(EVIDENCE, { recursive: true });
fs.writeFileSync(path.join(EVIDENCE, 'api-field-audit.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
