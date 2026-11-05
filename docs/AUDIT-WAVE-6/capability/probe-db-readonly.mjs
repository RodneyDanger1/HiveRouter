// W6-AUD-04 capability auditor — READ-ONLY DB probe.
// Opens data/hive.db with node:sqlite in readonly mode. No writes. No mutations.
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const dbPath = path.resolve('data/hive.db');
const db = new DatabaseSync(dbPath, { readOnly: true });

const out = {};
const q = (sql, ...params) => db.prepare(sql).all(...params);

// --- census -------------------------------------------------------------
out.runsTotal = q('SELECT COUNT(*) AS n FROM runs')[0].n;
out.runsByStatus = q('SELECT status, COUNT(*) AS n FROM runs GROUP BY status ORDER BY n DESC');
out.agents = q('SELECT COUNT(*) AS n FROM agent_evidence')[0].n;

// --- cost truth: run row vs usage ledger --------------------------------
out.runCostVsUsage = q(`
  SELECT r.id, r.status, r.error_code,
         r.cost_usd AS run_cost, r.prompt_tokens AS run_p,
         (SELECT COUNT(*) FROM usage u WHERE u.run_id = r.id) AS usage_rows,
         (SELECT COUNT(*) FROM usage u WHERE u.run_id = r.id AND u.source='unknown') AS unknown_rows,
         (SELECT ROUND(SUM(u.cost_usd),9) FROM usage u WHERE u.run_id = r.id) AS usage_cost,
         (SELECT COUNT(*) FROM traces t WHERE t.run_id = r.id) AS trace_rows
  FROM runs r ORDER BY r.created_at ASC`);

out.measuredWithNullRunCost = out.runCostVsUsage.filter(
  (r) => r.run_cost == null && r.usage_rows > 0 && r.unknown_rows === 0 && r.usage_cost != null,
).length;
out.unreportedMeasuredCostUsd = out.runCostVsUsage
  .filter((r) => r.run_cost == null && r.unknown_rows === 0 && r.usage_cost != null)
  .reduce((s, r) => s + Number(r.usage_cost), 0);
out.sumRunCost = q('SELECT ROUND(SUM(cost_usd),9) AS s FROM runs')[0].s;
out.sumUsageCost = q('SELECT ROUND(SUM(cost_usd),9) AS s FROM usage')[0].s;

// --- events: per-run window vs returned count ---------------------------
out.eventTypes = q('SELECT type, COUNT(*) AS n FROM events GROUP BY type ORDER BY n DESC');
out.eventCount = q('SELECT COUNT(*) AS n FROM events')[0].n;

out.perRunEvents = q(`
  SELECT r.id, r.status,
         (SELECT COUNT(*) FROM events e WHERE e.run_id = r.id) AS event_count,
         (SELECT COALESCE(MIN(e.seq),0) FROM events e WHERE e.run_id = r.id) AS first_seq,
         (SELECT COALESCE(MAX(e.seq),0) FROM events e WHERE e.run_id = r.id) AS last_seq
  FROM runs r ORDER BY r.created_at ASC`);

// replicate /events math from app.ts:822-832 for window=500, after=0
const WINDOW = 500;
out.truncationCensus = out.perRunEvents.map((r) => {
  const current = Number(r.last_seq);
  const start = Math.max(0, Math.max(0, current - WINDOW));
  const returned = out.perRunEvents.find((x) => x.id === r.id)?.event_count ?? 0;
  const truncatedFlag = 0 < start || current - start > returned;
  return { id: r.id, dbCount: Number(returned), firstSeq: Number(r.first_seq), lastSeq: current, apiTruncated: truncatedFlag };
});
out.truncationFalsePositives = out.truncationCensus.filter(
  (r) => r.apiTruncated && r.dbCount <= WINDOW,
).length;

// --- checks: duplicate check_id per run ---------------------------------
out.checkDupes = q(`
  SELECT run_id, check_id, COUNT(*) AS n FROM checks GROUP BY run_id, check_id HAVING n > 1 ORDER BY n DESC`);
out.checksColumns = q("SELECT name, type FROM pragma_table_info('checks')");
out.checksSample = q('SELECT * FROM checks LIMIT 3');

// --- context packs ------------------------------------------------------
out.contextPackCols = q("SELECT name FROM pragma_table_info('context_packs')");
out.contextPackCount = q('SELECT COUNT(*) AS n FROM context_packs')[0].n;
out.contextItemTotals = (() => {
  const rows = q('SELECT run_id, included_json, excluded_json FROM context_packs');
  let items = 0, withTokens = 0, nonEmptyExcluded = 0, packs = rows.length;
  for (const row of rows) {
    try {
      const arr = JSON.parse(String(row.included_json ?? '[]'));
      if (Array.isArray(arr)) {
        items += arr.length;
        withTokens += arr.filter((i) => i && i.tokens != null).length;
      }
    } catch {}
    try {
      const ex = JSON.parse(String(row.excluded_json ?? '[]'));
      if (Array.isArray(ex) && ex.length > 0) nonEmptyExcluded += 1;
    } catch {}
  }
  return { packs, items, withTokens, nonEmptyExcluded };
})();

// --- run_limit settings / snapshot limits -------------------------------
out.runLimitRows = q("SELECT key, value_json FROM settings WHERE key LIKE 'run_limit:%'");
out.snapshotHasLimits = (() => {
  const rows = q('SELECT snapshot_json FROM run_snapshots');
  let withLimits = 0, total = rows.length, sampleKeys = [];
  for (const row of rows) {
    try {
      const parsed = JSON.parse(String(row.snapshot_json));
      if (parsed && parsed.limits) { withLimits += 1; if (sampleKeys.length === 0) sampleKeys = Object.keys(parsed.limits); }
    } catch {}
  }
  return { total, withLimits, sampleKeys };
})();

// --- steps / agent evidence --------------------------------------------
out.stepStatus = q('SELECT status, COUNT(*) AS n FROM steps GROUP BY status');
out.stepNullCost = q('SELECT COUNT(*) AS n FROM steps WHERE prompt_tokens IS NULL')[0].n;
out.stepTotal = q('SELECT COUNT(*) AS n FROM steps')[0].n;
out.agentEvidenceBadges = q('SELECT badge, COUNT(*) AS n FROM agent_evidence GROUP BY badge');

// --- traces -------------------------------------------------------------
out.traceCompleteFlag = q('SELECT trace_complete, COUNT(*) AS n FROM runs GROUP BY trace_complete');
out.traceCompleteWithoutRow = q(`
  SELECT r.id, r.status, r.trace_complete FROM runs r
  WHERE r.trace_complete = 1 AND NOT EXISTS (SELECT 1 FROM traces t WHERE t.run_id = r.id)`);

// --- interrupted / cancelled -------------------------------------------
out.terminalWithoutCode = q(`
  SELECT id, status, error_code FROM runs
  WHERE status IN ('failed','budget_exceeded','cancelled','interrupted') AND error_code IS NULL`);

// --- usage rows ---------------------------------------------------------
out.usageSources = q('SELECT source, COUNT(*) AS n FROM usage GROUP BY source');
out.usageCols = q("SELECT name FROM pragma_table_info('usage')");

console.log(JSON.stringify(out, null, 2));
db.close();
