// Builds payloads.json: server event catalog vs client subscriptions, with live payload samples.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const evAbf5 = JSON.parse(fs.readFileSync(path.join(HERE, 'api', 'run_abf5fe78aab1e932ff_events.json'), 'utf8')).events;
const ev95 = JSON.parse(fs.readFileSync(path.join(HERE, 'api', 'run_95c11797b4923b4277_events.json'), 'utf8')).events;
const sse = fs.readFileSync(path.join(HERE, 'logs', 'sse_abf5.txt'), 'utf8');

const sample = (type, events = evAbf5) => events.find((e) => e.type === type) ?? ev95.find((e) => e.type === type) ?? null;
const count = (type, events) => events.filter((e) => e.type === type).length;

const emitted = [
  { type: 'run.queued', emitter: 'src/server/runs/manager.ts:135', trigger: 'createRun after idempotency row insert', payloadKeys: ['runId', 'preset'], clientSubscribed: false, uiConsumer: 'Events tab only when persisted; live feed drops it', persistedInSample: count('run.queued', evAbf5), sseReplayInSample: (sse.match(/^event: run\.queued$/gm) || []).length, note: 'Emitted before navigation to /runs/:id; a live SSE opened after create can replay it, but the listener is absent.' },
  { type: 'run.started', emitter: 'src/server/pipeline/run.ts:451', trigger: 'executeRun after markRunning', payloadKeys: ['runId', 'preset'], clientSubscribed: true, uiConsumer: 'Events tab', persistedInSample: count('run.started', evAbf5), sseReplayInSample: (sse.match(/^event: run\.started$/gm) || []).length },
  { type: 'run.failed', emitter: 'src/server/pipeline/run.ts:858 (gate fail), :885 (exception), src/server/runs/manager.ts:157 (executor rejection)', trigger: 'mandatory gate failure or thrown error', payloadKeys: ['code', 'checks?', 'message?', 'timedOut?'], clientSubscribed: true, uiConsumer: 'Events tab + 250ms snapshot reload; StatusBadge from snapshot', persistedInSample: count('run.failed', evAbf5), sseReplayInSample: (sse.match(/^event: run\.failed$/gm) || []).length },
  { type: 'run.cancelled', emitter: 'src/server/pipeline/run.ts:885; src/server/runs/manager.ts:186', trigger: 'abort/cancel', payloadKeys: ['code', 'message?', 'source?'], clientSubscribed: true, uiConsumer: 'Events tab', persistedInSample: count('run.cancelled', evAbf5), sseReplayInSample: 0, note: 'No cancelled run in this DB sample.' },
  { type: 'run.completed', emitter: 'src/server/pipeline/run.ts:1088', trigger: 'finalize success', payloadKeys: ['runId', 'status', 'files', 'costUsd'], clientSubscribed: true, uiConsumer: 'Events tab + snapshot reload', persistedInSample: count('run.completed', evAbf5), sseReplayInSample: 0, note: 'Present in the completed run: 1.' },
  { type: 'agent.started', emitter: 'src/server/pipeline/run.ts:224', trigger: 'agentStep begin', payloadKeys: ['stepId', 'agentId', 'phase'], clientSubscribed: true, uiConsumer: 'Events tab', persistedInSample: count('agent.started', evAbf5), sseReplayInSample: (sse.match(/^event: agent\.started$/gm) || []).length },
  { type: 'agent.completed', emitter: 'src/server/pipeline/run.ts:229', trigger: 'agentStep success', payloadKeys: ['stepId', 'agentId', 'phase', 'usage{promptTokens,completionTokens,cacheHitTokens,cacheMissTokens,reasoningTokens,costUsd,source,model}'], clientSubscribed: true, uiConsumer: 'Events tab', persistedInSample: count('agent.completed', evAbf5), sseReplayInSample: (sse.match(/^event: agent\.completed$/gm) || []).length },
  { type: 'agent.failed', emitter: 'src/server/pipeline/run.ts:234', trigger: 'agentStep catch', payloadKeys: ['stepId', 'agentId', 'phase', 'code', 'message'], clientSubscribed: false, uiConsumer: 'NONE live; persisted ledger still renders it after terminal', persistedInSample: count('agent.failed', evAbf5), sseReplayInSample: (sse.match(/^event: agent\.failed$/gm) || []).length, note: 'HIGH: a live watcher never sees the individual agent failure event.' },
  { type: 'phase.started', emitter: 'src/server/pipeline/run.ts:293,304,316,332,367,426,464,501,608,724,735,749,767,825,833,978', trigger: 'phase transitions', payloadKeys: ['phase', 'agentId?', 'adhoc?', 'attempt?', 'signature?'], clientSubscribed: true, uiConsumer: 'Events tab', persistedInSample: count('phase.started', evAbf5), sseReplayInSample: (sse.match(/^event: phase\.started$/gm) || []).length },
  { type: 'phase.completed', emitter: 'src/server/pipeline/run.ts:300,310,327,336,423,430,481,603,719,731,742,762,811,831,848,1087', trigger: 'phase end (includes revision attempts)', payloadKeys: ['phase', 'status?', 'checks?', 'failed?', 'files?', 'findings?', 'revised?', 'attempt?', 'confidence?', 'verifyPlanChecks?'], clientSubscribed: true, uiConsumer: 'Events tab', persistedInSample: count('phase.completed', evAbf5), sseReplayInSample: (sse.match(/^event: phase\.completed$/gm) || []).length },
  { type: 'phase.skipped', emitter: 'src/server/pipeline/run.ts:497 (routing), :788 (verification.plan)', trigger: 'pipelineCapabilities gate off', payloadKeys: ['phase', 'reason', 'fallback'], clientSubscribed: false, uiConsumer: 'NONE live; this B2 build has routing on, so not emitted in sample', persistedInSample: 0, sseReplayInSample: 0, note: 'No live sample: FEATURES.routing=true in B2.' },
  { type: 'route.decided', emitter: 'src/server/pipeline/run.ts:601', trigger: 'per planned file after routeTasks', payloadKeys: ['taskId', 'agentId', 'model', 'thinking', 'score'], clientSubscribed: true, uiConsumer: 'Events tab; Routing tab uses GET /routing', persistedInSample: count('route.decided', evAbf5), sseReplayInSample: (sse.match(/^event: route\.decided$/gm) || []).length },
  { type: 'context.packed', emitter: 'src/server/pipeline/run.ts:669', trigger: 'per file context pack', payloadKeys: ['taskId', 'tokens', 'prefixHash', 'degraded'], clientSubscribed: true, uiConsumer: 'Events tab; Context tab uses GET /context', persistedInSample: count('context.packed', evAbf5), sseReplayInSample: (sse.match(/^event: context\.packed$/gm) || []).length },
  { type: 'context.skipped', emitter: 'src/server/pipeline/run.ts:679', trigger: 'pipelineCaps.contextPacker false', payloadKeys: ['taskId', 'reason', 'fallback'], clientSubscribed: false, uiConsumer: 'NONE live; not emitted in B2 sample', persistedInSample: 0, sseReplayInSample: 0 },
  { type: 'file.written', emitter: 'src/server/pipeline/run.ts:717', trigger: 'per accepted generated file', payloadKeys: ['path', 'agentId', 'bytes'], clientSubscribed: true, uiConsumer: 'Events tab; Files tab uses snapshot artifacts', persistedInSample: count('file.written', evAbf5), sseReplayInSample: (sse.match(/^event: file\.written$/gm) || []).length },
  { type: 'repair.stalled', emitter: 'src/server/pipeline/run.ts:820 (same signature twice), :851 (attempt budget exhausted)', trigger: 'repair loop stop', payloadKeys: [['signature'], ['reason', 'attempts']], clientSubscribed: false, uiConsumer: 'NONE live; persisted ledger renders it after terminal', persistedInSample: count('repair.stalled', evAbf5), sseReplayInSample: (sse.match(/^event: repair\.stalled$/gm) || []).length, note: 'HIGH: stall is the explanation for many failed runs and is invisible live.' },
];

for (const item of emitted) {
  const s = sample(item.type);
  item.samplePersisted = s ? { seq: s.seq, runId: s.runId, payload: s.payload, createdAt: s.createdAt } : null;
}

const clientTypes = [
  'run.started', 'run.updated', 'run.paused', 'run.cancelled', 'run.completed', 'run.failed', 'run.needs_review',
  'phase.started', 'phase.completed', 'step.started', 'step.completed', 'agent.started', 'agent.delta', 'agent.completed',
  'file.written', 'file.revised', 'check.completed', 'review.completed', 'route.decided', 'context.packed',
  'failure.clustered', 'repair.completed', 'confidence.recorded', 'learning.trace', 'learning.eval', 'learning.promotion', 'heartbeat',
];
const emittedSet = new Set(emitted.map((e) => e.type));
const deadSubscriptions = clientTypes.filter((t) => !emittedSet.has(t)).map((type) => ({
  type,
  listener: 'web/src/hooks/useApi.ts:72-100 -> source.addEventListener(type, handler) at :143',
  emitter: 'NONE (grep of src/ for emitEvent with this type returns 0)',
  UIconsumer: type === 'heartbeat' ? 'handler drops it at useApi.ts:134' : 'Events tab (never receives); no other consumer',
  verdict: 'WIRED-BUT-DEAD',
  note: type === 'heartbeat' ? 'Server sends SSE comment lines ": ping" (app.ts:860); EventSource never dispatches a named heartbeat event.' : 'Listener is inert; no producer exists.',
}));

const missing = [...emittedSet].filter((t) => !clientTypes.includes(t));

const result = {
  schema: 'hive.audit.payloads.v1',
  task: 'task-1 / W6-AUD-01',
  seat: 'weaver (read-only)',
  transport: {
    sseRoute: 'src/server/app.ts:835-865',
    sseFrame: 'id: <seq>\\nevent: <type>\\ndata: {"schema":"hive.api.v1","type":"<type>","data":<payload>,"meta":{"seq":..,"runId":"..","replay":bool}}',
    sseHeartbeat: 'src/server/app.ts:860 writes ": ping\\n\\n" (SSE comment, not an event)',
    persistedRoute: 'src/server/app.ts:818-833 -> src/server/runs/recorder.ts:58-69',
    persistedRow: '{seq, runId, type, payload, createdAt}',
    clientSubscribe: 'web/src/hooks/useApi.ts:72-100 (27 names), :142-143 addEventListener; :144 onmessage only covers unnamed events',
    clientTransformLive: 'web/src/hooks/useApi.ts:124-139 -> {type, data: <whole envelope>, receivedAt}',
    clientTransformPersisted: 'src/shared/run-events.ts:19-24 -> {type, data: payload, receivedAt}',
    terminalBehavior: 'RunDetailPage.tsx:135 passes null when terminal -> no EventSource; persisted ledger fetched at :129-132. Verified: 0 /stream requests for terminal runs.',
    sseEvidence: 'evidence/logs/sse_abf5.txt (108 frames, includes run.queued and repair.stalled)',
  },
  summary: {
    serverEmittedTypes: emitted.length,
    clientSubscribedTypes: clientTypes.length,
    intersection: emitted.length - missing.length,
    emittedButNotSubscribed: missing,
    subscribedButNeverEmittedCount: deadSubscriptions.length,
    subscribedButNeverEmitted: deadSubscriptions.map((d) => d.type),
    rawSseFramesAb5: (sse.match(/^event: /gm) || []).length,
    persistedEventsAb5: evAbf5.length,
    persistedEvents95: ev95.length,
  },
  serverEmitted: emitted,
  clientSubscribedOnly: deadSubscriptions,
  missingSubscriptions: missing.map((type) => ({
    type,
    serverEmitter: emitted.find((e) => e.type === type).emitter,
    impact: emitted.find((e) => e.type === type).note ?? 'Live feed omits this event.',
    evidence: ['web/src/hooks/useApi.ts:72-100', 'evidence/logs/sse_abf5.txt'],
  })),
  rawFrames: {
    first: sse.split(/\r?\n\r?\n/)[0],
    repairStalled: (sse.match(/id: \d+\r?\nevent: repair\.stalled\r?\ndata: .+/) || [''])[0],
    runFailed: (sse.match(/id: \d+\r?\nevent: run\.failed\r?\ndata: .+/) || [''])[0],
    last: sse.trim().split(/\r?\n\r?\n/).slice(-1)[0],
  },
  evidence: {
    persistedEvents: ['evidence/api/run_abf5fe78aab1e932ff_events.json', 'evidence/api/run_95c11797b4923b4277_events.json'],
    sseRaw: 'evidence/logs/sse_abf5.txt',
    clientList: 'web/src/hooks/useApi.ts:72-100',
    emittersGrep: 'evidence/logs/emitters.txt',
  },
};

const out = path.join(path.resolve(HERE, '..'), 'payloads.json');
fs.writeFileSync(out, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ file: out, bytes: fs.statSync(out).size, summary: result.summary, samplesMissing: emitted.filter((e) => !e.samplePersisted).map((e) => e.type) }, null, 2));


