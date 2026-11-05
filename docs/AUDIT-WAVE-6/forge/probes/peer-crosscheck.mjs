/**
 * Forge W6 read-only cross-check of peer W6-AUD-02 findings that touch the
 * UI/API truth surface: error registry, gate-failure logging, trace flag, and
 * run.failed payload shapes. READ-ONLY: node:sqlite { readOnly: true } + fs reads.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FORGE = path.resolve(HERE, '..');
const EVIDENCE = path.join(FORGE, 'evidence');
const REPO = path.resolve(FORGE, '..', '..', '..');

const refusals = fs.readFileSync(path.join(REPO, 'src/shared/refusals.ts'), 'utf8');
const errorCodes = [...refusals.matchAll(/^\s{2}([A-Z][A-Z0-9_]*):\s*\{/gm)].map((match) => match[1]);
const db = new DatabaseSync(path.join(REPO, 'data/hive.db'), { readOnly: true });
let result;
try {
  const log = fs.existsSync(path.join(REPO, 'data/logs/errors.jsonl'))
    ? fs.readFileSync(path.join(REPO, 'data/logs/errors.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line))
    : [];
  const traceMismatch = db.prepare(`
    SELECT r.id, r.status, r.trace_complete,
           (SELECT COUNT(*) FROM traces t WHERE t.run_id = r.id) AS trace_rows
    FROM runs r WHERE r.trace_complete = 1
  `).all().filter((row) => row.trace_rows === 0);
  const failedShapes = db.prepare(`
    SELECT run_id, payload_json FROM events WHERE type = 'run.failed' ORDER BY seq
  `).all().map((row) => ({ runId: row.run_id, keys: Object.keys(JSON.parse(row.payload_json)).sort() }));
  const gateFailures = db.prepare(`
    SELECT id, status, error_code, error_message FROM runs WHERE error_code = 'GATE_FAILED'
  `).all();
  result = {
    capturedAt: new Date().toISOString(),
    errorRegistry: {
      refusalCodeCount: errorCodes.length,
      missingOnRunRows: ['GATE_FAILED', 'E_CANCELLED', 'E_RUN_TIMEOUT', 'E_LLM_RATE_LIMIT', 'E_PROVIDER_EMPTY'].filter((code) => !errorCodes.includes(code)),
      present: {
        E_CANCELLED: errorCodes.includes('E_CANCELLED'),
        E_RUN_TIMEOUT: errorCodes.includes('E_RUN_TIMEOUT'),
        GATE_FAILED: errorCodes.includes('GATE_FAILED'),
      },
    },
    errorsLog: {
      rows: log.length,
      byCode: log.reduce((acc, row) => { acc[row.code] = (acc[row.code] ?? 0) + 1; return acc; }, {}),
      gateFailedRows: log.filter((row) => String(row.code).includes('GATE_FAILED')).length,
    },
    gateFailures,
    traceCompleteWithoutTrace: traceMismatch,
    runFailedPayloadShapes: failedShapes,
  };
} finally {
  db.close();
}

fs.mkdirSync(EVIDENCE, { recursive: true });
fs.writeFileSync(path.join(EVIDENCE, 'peer-crosscheck.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
