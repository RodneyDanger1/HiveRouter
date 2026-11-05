/**
 * Forge W6 read-only probe: API route truth, raw event payloads, SSE replay,
 * source-derived subscription diff, and /events truncation semantics.
 *
 * READ-ONLY: GET routes + node:sqlite opened with { readOnly: true }.
 * Writes only under docs/AUDIT-WAVE-6/forge/evidence/.
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
const DB_PATH = path.join(REPO, 'data', 'hive.db');

fs.mkdirSync(EVIDENCE, { recursive: true });

const out = { capturedAt: new Date().toISOString(), base: BASE, routes: {}, sse: {}, source: {}, db: {}, findings: {} };
const save = (name, value) => fs.writeFileSync(path.join(EVIDENCE, name), JSON.stringify(value, null, 2));

async function getJson(pathname) {
  const response = await fetch(`${BASE}${pathname}`, { headers: { Accept: 'application/json' } });
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 2000) }; }
  return { status: response.status, body };
}

/** Read the SSE stream for `ms` and return parsed frames + raw text. */
async function readSse(pathname, headers = {}, ms = 2500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  let text = '';
  try {
    const response = await fetch(`${BASE}${pathname}`, {
      headers: { Accept: 'text/event-stream', ...headers },
      signal: controller.signal,
    });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
  } catch (error) {
    if (!(error instanceof DOMException && error.name === 'AbortError')) throw error;
  } finally {
    clearTimeout(timer);
  }
  const frames = [];
  for (const block of text.split('\n\n')) {
    const lines = block.trim().split('\n').filter(Boolean);
    if (lines.length === 0) continue;
    const frame = { id: null, event: null, data: null, comments: [] };
    for (const line of lines) {
      if (line.startsWith(':')) frame.comments.push(line);
      else if (line.startsWith('id:')) frame.id = Number(line.slice(3).trim());
      else if (line.startsWith('event:')) frame.event = line.slice(6).trim();
      else if (line.startsWith('data:')) {
        const raw = line.slice(5).trim();
        try { frame.data = JSON.parse(raw); } catch { frame.data = raw; }
      }
    }
    if (frame.event || frame.id !== null) frames.push(frame);
  }
  return { text, frames };
}

function countBy(items, key) {
  const counts = {};
  for (const item of items) {
    const value = typeof key === 'function' ? key(item) : item[key];
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

// ---------------------------------------------------------------- 1. health / runs
out.routes.health = await getJson('/api/health');
out.routes.active = await getJson('/api/runs/active');
const runs = await getJson('/api/runs?limit=100');
out.routes.runs = {
  status: runs.status,
  count: runs.body?.runs?.length ?? null,
  statuses: countBy(runs.body?.runs ?? [], 'status'),
  ids: (runs.body?.runs ?? []).map((run) => ({ id: run.id, status: run.status, phase: run.phase })),
};

// ---------------------------------------------------------------- 2. run routes
const TARGETS = [
  { label: 'abf5', id: 'run_abf5fe78aab1e932ff' },
  { label: '2bb2', id: 'run_2bb2f8edf3043fe89e' },
];
for (const target of TARGETS) {
  const snapshot = await getJson(`/api/runs/${target.id}/snapshot`);
  const detail = await getJson(`/api/runs/${target.id}`);
  const events = await getJson(`/api/runs/${target.id}/events`);
  const rows = events.body?.events ?? [];
  const types = countBy(rows, 'type');
  const payloadKeys = {};
  for (const row of rows) payloadKeys[row.type] = Object.keys(row.payload ?? {}).sort();
  const summary = {
    snapshot: {
      status: snapshot.body?.run?.status,
      phase: snapshot.body?.run?.phase,
      createdAt: snapshot.body?.run?.createdAt,
      finishedAt: snapshot.body?.run?.finishedAt,
      errorCode: snapshot.body?.run?.errorCode,
      steps: snapshot.body?.steps?.length,
      checks: snapshot.body?.checks?.length,
      artifacts: snapshot.body?.artifacts?.length,
      lastEventId: snapshot.body?.lastEventId,
      truncated: snapshot.body?.truncated,
    },
    detail: {
      steps: detail.body?.steps?.length,
      lastEventId: detail.body?.lastEventId,
      artifacts: detail.body?.artifacts?.length,
    },
    events: {
      status: events.status,
      count: rows.length,
      firstSeq: rows[0]?.seq ?? null,
      lastSeq: rows[rows.length - 1]?.seq ?? null,
      truncated: events.body?.truncated,
      lastEventId: events.body?.lastEventId,
      types,
      payloadKeys,
    },
  };
  out.routes[target.label] = summary;
  save(`route-${target.label}-snapshot.json`, snapshot.body);
  save(`route-${target.label}-events.json`, events.body);
  save(`route-${target.label}-detail.json`, detail.body);
}

// ---------------------------------------------------------------- 3. SSE replay (raw named events)
for (const target of TARGETS) {
  const replay = await readSse(`/api/runs/${target.id}/stream`);
  const names = countBy(replay.frames, 'event');
  const metaOk = replay.frames.every((frame) => frame.data?.meta?.runId === target.id);
  out.sse[target.label] = {
    frameCount: replay.frames.length,
    first: replay.frames[0] ? { id: replay.frames[0].id, event: replay.frames[0].event, replay: replay.frames[0].data?.meta?.replay } : null,
    last: replay.frames.at(-1) ? { id: replay.frames.at(-1).id, event: replay.frames.at(-1).event, replay: replay.frames.at(-1).data?.meta?.replay } : null,
    names,
    contains: {
      'run.queued': replay.frames.some((frame) => frame.event === 'run.queued'),
      'repair.stalled': replay.frames.some((frame) => frame.event === 'repair.stalled'),
      'agent.failed': replay.frames.some((frame) => frame.event === 'agent.failed'),
    },
    allMetaRunIdMatch: metaOk,
    heartbeatFrames: replay.text.includes(': ping\n\n'),
  };
  fs.writeFileSync(path.join(EVIDENCE, `sse-${target.label}-raw.txt`), replay.text);
}

// Also fetch the raw frame for agent.failed to preserve the exact bytes.
{
  const replay = await readSse('/api/runs/run_2bb2f8edf3043fe89e/stream');
  const frame = replay.frames.find((candidate) => candidate.event === 'agent.failed');
  out.sse.agentFailedFrame = frame ?? null;
}

// ---------------------------------------------------------------- 4. source-derived emitted vs subscribed
const readSource = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');
const walkTs = (dir, acc = []) => {
  for (const entry of fs.readdirSync(path.join(REPO, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) walkTs(rel, acc);
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) acc.push(rel);
  }
  return acc;
};
const emitted = new Set();
const emitSites = {};
for (const rel of walkTs('src')) {
  const source = readSource(rel);
  for (const match of source.matchAll(/emitEvent\([^,]+,\s*'([^']+)'/g)) {
    emitted.add(match[1]);
    (emitSites[match[1]] ??= []).push(rel);
  }
  for (const match of source.matchAll(/emitEvent\([^,]+,\s*[^,]*\?\s*'([^']+)'\s*:\s*'([^']+)'/g)) {
    for (const name of [match[1], match[2]]) {
      emitted.add(name);
      (emitSites[name] ??= []).push(rel);
    }
  }
}
const useApiSource = readSource('web/src/hooks/useApi.ts');
const listMatch = /const STREAM_EVENT_TYPES = \[([\s\S]*?)\];/.exec(useApiSource);
if (!listMatch) throw new Error('STREAM_EVENT_TYPES not found');
const subscribed = new Set([...listMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1]));
const emittedNotSubscribed = [...emitted].filter((type) => !subscribed.has(type)).sort();
const subscribedNotEmitted = [...subscribed].filter((type) => !emitted.has(type)).sort();
out.source = {
  emitted: [...emitted].sort(),
  subscribed: [...subscribed].sort(),
  emittedSites: emitSites,
  emittedNotSubscribed,
  subscribedNotEmitted,
  useApiListLine: useApiSource.split('\n').findIndex((line) => line.includes('STREAM_EVENT_TYPES')) + 1,
};

// ---------------------------------------------------------------- 5. DB read-only census
const db = new DatabaseSync(DB_PATH, { readOnly: true });
try {
  out.db.eventTypeCensus = db.prepare('SELECT type, COUNT(*) AS n FROM events GROUP BY type ORDER BY n DESC').all();
  out.db.perRun = db.prepare('SELECT run_id, COUNT(*) AS n, MIN(seq) AS first, MAX(seq) AS last FROM events GROUP BY run_id ORDER BY n DESC LIMIT 10').all();
  out.db.runsTotal = db.prepare('SELECT COUNT(*) AS n FROM runs').get();
  out.db.active = db.prepare("SELECT id, status FROM runs WHERE status IN ('queued','running','paused','needs_review')").all();
  out.db.eventExamples = db.prepare("SELECT run_id, seq, type, payload_json, created_at FROM events WHERE type IN ('agent.failed','repair.stalled','run.queued','run.cancelled','phase.skipped','context.skipped') ORDER BY seq").all()
    .map((row) => ({ ...row, payload_json: row.payload_json.slice(0, 300) }));
  out.db.abf5 = db.prepare("SELECT COUNT(*) AS n, MIN(seq) AS first, MAX(seq) AS last FROM events WHERE run_id = 'run_abf5fe78aab1e932ff'").get();
  out.db.abf5First = db.prepare("SELECT seq, type, payload_json, created_at FROM events WHERE run_id = 'run_abf5fe78aab1e932ff' ORDER BY seq ASC LIMIT 2").all();
  out.db.abf5Last = db.prepare("SELECT seq, type, payload_json, created_at FROM events WHERE run_id = 'run_abf5fe78aab1e932ff' ORDER BY seq DESC LIMIT 2").all();
  out.db.truncatedPayloads = db.prepare("SELECT COUNT(*) AS n FROM events WHERE payload_json LIKE '%truncated%'").get();
  out.db.abf5Steps = db.prepare("SELECT seq, phase, agent_id, status, started_at, finished_at FROM steps WHERE run_id = 'run_abf5fe78aab1e932ff' ORDER BY seq").all();
} finally {
  db.close();
}

// ---------------------------------------------------------------- 6. conclusions / contradiction checks
const abf5 = out.routes.abf5;
const abf5Db = out.db.abf5;
out.findings = {
  abf5ApiStateMatchesMandate: abf5.snapshot.status === 'failed' && abf5.snapshot.steps === 20 && abf5.events.count === 108 && abf5.snapshot.lastEventId === 659,
  eventsRouteDroppedNothing: abf5.events.count === abf5Db.n && abf5.events.firstSeq === abf5Db.first && abf5.events.lastSeq === abf5Db.last && ['run.queued', 'run.started'].includes(out.db.abf5First?.[0]?.type),
  eventsRouteTruncatedFlagFalsePositive: abf5.events.truncated === true && abf5.events.count === abf5Db.n,
  sseReplaysUnsubscribedTypes: out.sse.abf5.contains['run.queued'] && out.sse.abf5.contains['repair.stalled'] && out.sse['2bb2'].contains['agent.failed'],
  appSubscribedCount: subscribed.size,
  emittedCount: emitted.size,
  emittedNotSubscribed,
  subscribedNotEmitted,
  agentFailedObservedInDb: out.db.eventTypeCensus.find((row) => row.type === 'agent.failed')?.n ?? 0,
  phaseSkippedObservedInDb: out.db.eventTypeCensus.find((row) => row.type === 'phase.skipped')?.n ?? 0,
  contextSkippedObservedInDb: out.db.eventTypeCensus.find((row) => row.type === 'context.skipped')?.n ?? 0,
  runCancelledObservedInDb: out.db.eventTypeCensus.find((row) => row.type === 'run.cancelled')?.n ?? 0,
};

save('probe-api.json', out);
console.log(JSON.stringify({
  health: { phase: out.routes.health.body?.phase, features: out.routes.health.body?.features },
  active: out.routes.active.body,
  runs: { count: out.routes.runs.count, statuses: out.routes.runs.statuses },
  abf5: abf5,
  sse: out.sse,
  source: { emittedNotSubscribed, subscribedNotEmitted, emittedCount: emitted.size, subscribedCount: subscribed.size },
  db: {
    runsTotal: out.db.runsTotal,
    eventTypeCensus: out.db.eventTypeCensus,
    abf5: out.db.abf5,
    abf5First: out.db.abf5First,
    abf5Last: out.db.abf5Last,
    truncatedPayloads: out.db.truncatedPayloads,
  },
  findings: out.findings,
}, null, 2));
