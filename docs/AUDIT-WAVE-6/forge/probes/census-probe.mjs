/**
 * Forge W6 read-only census: /events truncation semantics for all persisted runs,
 * and the per-run size of the live-ledger loss implied by STREAM_EVENT_TYPES.
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

const useApiSource = fs.readFileSync(path.join(REPO, 'web/src/hooks/useApi.ts'), 'utf8');
const listMatch = /const STREAM_EVENT_TYPES = \[([\s\S]*?)\];/.exec(useApiSource);
const subscribed = new Set([...listMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1]));

const db = new DatabaseSync(path.join(REPO, 'data', 'hive.db'), { readOnly: true });
let result;
try {
  const runIds = db.prepare('SELECT id FROM runs ORDER BY created_at ASC').all().map((row) => row.id);
  const rows = [];
  for (const runId of runIds) {
    const dbStats = db.prepare('SELECT COUNT(*) AS n, MIN(seq) AS first, MAX(seq) AS last FROM events WHERE run_id = ?').get(runId);
    const dbTypes = db.prepare('SELECT type, COUNT(*) AS n FROM events WHERE run_id = ? GROUP BY type').all(runId);
    const response = await fetch(`${BASE}/api/runs/${encodeURIComponent(runId)}/events`);
    const body = await response.json();
    const events = body.events ?? [];
    const returnedTypes = {};
    for (const event of events) returnedTypes[event.type] = (returnedTypes[event.type] ?? 0) + 1;
    const dropped = dbStats.n - events.length;
    const missedLive = dbTypes
      .filter((row) => !subscribed.has(row.type))
      .map((row) => ({ type: row.type, n: row.n }));
    const missedLiveCount = missedLive.reduce((sum, row) => sum + row.n, 0);
    const subscribedRows = dbStats.n - missedLiveCount;
    const dbTypeCounts = Object.fromEntries(dbTypes.map((row) => [row.type, row.n]));
    const sameCounts = [...new Set([...Object.keys(returnedTypes), ...Object.keys(dbTypeCounts)])]
      .every((type) => (returnedTypes[type] ?? 0) === (dbTypeCounts[type] ?? 0));
    rows.push({
      runId,
      dbCount: dbStats.n,
      dbFirstSeq: dbStats.first,
      dbLastSeq: dbStats.last,
      httpStatus: response.status,
      returnedCount: events.length,
      firstSeq: events[0]?.seq ?? null,
      lastSeq: events[events.length - 1]?.seq ?? null,
      apiTruncated: body.truncated,
      reportedLastEventId: body.lastEventId,
      rowsActuallyDropped: dropped,
      falsePositiveTruncation: body.truncated === true && dropped === 0,
      falseNegativeTruncation: body.truncated === false && dropped > 0,
      returnedTypesMatchDb: sameCounts,
      liveLedgerMissedTypes: missedLive,
      liveLedgerMissedCount: missedLiveCount,
      liveLedgerWouldCap: subscribedRows > 100,
      subscribedRows,
    });
  }
  result = {
    capturedAt: new Date().toISOString(),
    runs: rows.length,
    falsePositiveTruncationCount: rows.filter((row) => row.falsePositiveTruncation).length,
    falseNegativeTruncationCount: rows.filter((row) => row.falseNegativeTruncation).length,
    runsLosingLiveRows: rows.filter((row) => row.liveLedgerMissedCount > 0).length,
    runsOver100Subscribed: rows.filter((row) => row.liveLedgerWouldCap).map((row) => row.runId),
    lossTypes: [...new Set(rows.flatMap((row) => row.liveLedgerMissedTypes.map((type) => type.type)))].sort(),
    rows,
  };
} finally {
  db.close();
}

fs.writeFileSync(path.join(EVIDENCE, 'events-route-census.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({
  runs: result.runs,
  falsePositiveTruncationCount: result.falsePositiveTruncationCount,
  falseNegativeTruncationCount: result.falseNegativeTruncationCount,
  runsLosingLiveRows: result.runsLosingLiveRows,
  runsOver100Subscribed: result.runsOver100Subscribed,
  lossTypes: result.lossTypes,
  sample: result.rows.slice(0, 4),
  allTruncationFlags: result.rows.map((row) => ({ runId: row.runId, dbCount: row.dbCount, returned: row.returnedCount, dropped: row.rowsActuallyDropped, apiTruncated: row.apiTruncated })),
}, null, 2));
