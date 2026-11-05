/**
 * Forge W6 read-only cost-truth probe: runs.cost_usd / prompt / completion
 * vs the measured `usage` rows the same run committed.
 * READ-ONLY: node:sqlite { readOnly: true } against data/hive.db.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FORGE = path.resolve(HERE, '..');
const EVIDENCE = path.join(FORGE, 'evidence');
const REPO = path.resolve(FORGE, '..', '..', '..');

const db = new DatabaseSync(path.join(REPO, 'data', 'hive.db'), { readOnly: true });
let result;
try {
  const runs = db.prepare(`
    SELECT r.id, r.status, r.error_code, r.cost_usd, r.prompt_tokens, r.completion_tokens,
           (SELECT COUNT(*) FROM usage u WHERE u.run_id = r.id) AS usage_rows,
           (SELECT SUM(u.cost_usd) FROM usage u WHERE u.run_id = r.id) AS usage_cost,
           (SELECT SUM(u.prompt_tokens) FROM usage u WHERE u.run_id = r.id) AS usage_prompt,
           (SELECT SUM(u.completion_tokens) FROM usage u WHERE u.run_id = r.id) AS usage_completion,
           (SELECT SUM(CASE WHEN u.source = 'unknown' THEN 1 ELSE 0 END) FROM usage u WHERE u.run_id = r.id) AS unknown_rows,
           (SELECT SUM(CASE WHEN u.source = 'provider' THEN 1 ELSE 0 END) FROM usage u WHERE u.run_id = r.id) AS provider_rows,
           (SELECT COUNT(*) FROM traces t WHERE t.run_id = r.id) AS trace_rows,
           (SELECT SUM(t.cost_usd) FROM traces t WHERE t.run_id = r.id) AS trace_cost,
           (SELECT SUM(t.prompt_tokens) FROM traces t WHERE t.run_id = r.id) AS trace_prompt,
           (SELECT SUM(t.completion_tokens) FROM traces t WHERE t.run_id = r.id) AS trace_completion
    FROM runs r ORDER BY r.created_at ASC
  `).all();
  const rows = runs.map((run) => {
    const measured = run.usage_rows > 0;
    const runCostNull = run.cost_usd == null;
    const runTokensNull = run.prompt_tokens == null || run.completion_tokens == null;
    return {
      runId: run.id,
      status: run.status,
      errorCode: run.error_code,
      usageRows: run.usage_rows,
      providerRows: run.provider_rows,
      unknownRows: run.unknown_rows,
      measuredCostUsd: run.usage_cost == null ? null : Number(run.usage_cost),
      measuredPromptTokens: run.usage_prompt == null ? null : Number(run.usage_prompt),
      measuredCompletionTokens: run.usage_completion == null ? null : Number(run.usage_completion),
      runCostUsd: run.cost_usd == null ? null : Number(run.cost_usd),
      runPromptTokens: run.prompt_tokens == null ? null : Number(run.prompt_tokens),
      runCompletionTokens: run.completion_tokens == null ? null : Number(run.completion_tokens),
      measuredButRunRowNull: measured && runCostNull,
      traceRows: run.trace_rows,
      traceCostUsd: run.trace_cost == null ? null : Number(run.trace_cost),
      tracePromptTokens: run.trace_prompt == null ? null : Number(run.trace_prompt),
      traceCompletionTokens: run.trace_completion == null ? null : Number(run.trace_completion),
      tokensDropped: measured && runTokensNull,
      costAgrees: !runCostNull && run.usage_cost != null && Math.abs(Number(run.cost_usd) - Number(run.usage_cost)) < 1e-9,
    };
  });
  const affected = rows.filter((row) => row.measuredButRunRowNull);
  result = {
    capturedAt: new Date().toISOString(),
    runs: rows.length,
    measuredWithNullRunCost: affected.length,
    unreportedMeasuredCostUsd: Math.round(affected.reduce((sum, row) => sum + (row.measuredCostUsd ?? 0), 0) * 1e9) / 1e9,
    affected: affected.map((row) => ({ runId: row.runId, status: row.status, errorCode: row.errorCode, usageRows: row.usageRows, measuredCostUsd: row.measuredCostUsd, runCostUsd: row.runCostUsd })),
    abf5: rows.find((row) => row.runId === 'run_abf5fe78aab1e932ff') ?? null,
    rows,
  };
} finally {
  db.close();
}

fs.mkdirSync(EVIDENCE, { recursive: true });
fs.writeFileSync(path.join(EVIDENCE, 'cost-truth.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({
  runs: result.runs,
  measuredWithNullRunCost: result.measuredWithNullRunCost,
  unreportedMeasuredCostUsd: result.unreportedMeasuredCostUsd,
  affected: result.affected,
  abf5: result.abf5,
}, null, 2));
