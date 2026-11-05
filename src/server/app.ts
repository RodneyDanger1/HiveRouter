import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import path from 'node:path';
import fs from 'node:fs';
import { config } from './config.js';
import { keyStatus } from './security/keys.js';
import { REFUSALS, type RefusalDefinition } from '../shared/refusals.js';
import { FEATURES, VERSION } from '../shared/features.js';
import { getDb } from './db/database.js';
import { getEvents, lastEventId, listRuns, getRun, getSteps, getChecks, getArtifacts, emitEvent, subscribe, countEventsAfter, getRecentEvents } from './runs/recorder.js';
import { createRun, cancelRun, getActiveRunId } from './runs/manager.js';
import { runBudgetUsd } from './runs/budget.js';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { nowIso } from './db/database.js';
import { listFiles, safePath, normalizeRel, assertAllowedExtension } from './security/paths.js';
import { assertOpenApiResponses, decorateOpenApiDocument } from './verify/openapi-schema.js';
import { recordError } from './observability/error-log.js';
import { EFFORTS, MODEL_IDS, PRESETS, RUN_STATUSES, TERMINAL_STATUSES, THINKING_MODES, type AgentDefinition, type RunEvent, type RunStatus } from '../shared/types.js';
import { createChatThread, getChatEventProjection, getChatSnapshot, getChatThread, listChatThreads, sendChatMessage } from './chat/store.js';
import { subscribeChat } from './chat/events.js';
import { cancelChatJob } from './chat/worker.js';
import { computeDominators, DominatorInputError } from './analysis/dominators.js';
import { evaluateScorecards, ScorecardInputError } from './analysis/scorecards.js';
import { AnalysisInputError, parseDominatorRequest, parseScorecardsRequest } from './analysis/api.js';
import { searchRunWorkspace } from './search/run-search.js';
import { loadPromptOverrides, readPromptOverride } from './agents/overrides.js';
import { buildSystemPrompt } from './agents/prompts.js';

const REPRESENTATIVE_LIVE = new Set(['architect', 'python-engine', 'react-engine', 'cleaner', 'gatekeeper', 'powershell-core']);

interface AgentEvidenceRow extends Record<string, unknown> {
  agent_id: string;
  badge: string;
  provenance: string;
  run_id: string | null;
  created_at: string;
}

function toAgentView(
  agent: AgentDefinition,
  evidenceRows: AgentEvidenceRow[],
  stepped: Array<{ agent_id: string; run_id: string }>,
  promptOverride: string | null = null,
) {
  const evidence = evidenceRows.filter((row) => row.agent_id === agent.id);
  const badges: string[] = ['registered'];
  if (evidence.some((row) => row.badge === 'mock-run')) badges.push('mock-run');
  const live = evidence.some((row) => row.badge === 'representative-live') || (REPRESENTATIVE_LIVE.has(agent.id) && stepped.some((row) => row.agent_id === agent.id));
  if (live) badges.push('representative-live');
  if (evidence.some((row) => row.badge === 'schema-valid')) badges.push('schema-valid');
  const promptText = promptOverride ?? agent.prompt;
  const systemPrompt = buildSystemPrompt(agent, agent.outputKind, promptText);
  return {
    id: agent.id,
    name: agent.name,
    group: agent.group,
    role: agent.role,
    objective: agent.objective,
    outputKind: agent.outputKind,
    verificationSupport: agent.verificationSupport,
    languages: agent.languages,
    pathGlobs: agent.pathGlobs,
    rules: agent.rules,
    maxOutputTokens: agent.maxOutputTokens,
    staticPrior: agent.staticPrior,
    priorVersion: agent.priorVersion,
    promptVersion: agent.promptVersion,
    schemaId: agent.schemaId,
    prompt: promptText,
    systemPrompt,
    promptSource: promptOverride ? 'override' : 'registry',
    canWrite: agent.canWrite,
    canReview: agent.canReview,
    canTest: agent.canTest,
    badges,
    evidence: evidence.map((row) => ({ badge: row.badge, provenance: row.provenance, runId: row.run_id, createdAt: row.created_at })),
  };
}

function now(): string {
  return new Date().toISOString();
}

function refusal(reply: { code: (n: number) => { send: (b: unknown) => unknown } }, code: keyof typeof REFUSALS, details?: unknown) {
  const def = REFUSALS[code] as RefusalDefinition;
  return reply.code(def.http).send({ error: { code, message: def.message, hint: def.hint, retryable: def.retryable, details } });
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-api-key"]', 'res.headers["set-cookie"]'],
    },
    bodyLimit: 2 * 1024 * 1024,
  });

  // OpenAPI response schemas are added to the generated document only. Adding
  // them as Fastify route response schemas would make Fastify serialize array
  // responses through an object schema (arrays become {"0":...} objects).
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: { title: 'HiveRouter API', version: VERSION },
      servers: [{ url: `http://${config.host}:${config.port}` }],
      components: {
        schemas: {
          Error: {
            type: 'object',
            required: ['error'],
            properties: {
              error: {
                type: 'object',
                required: ['code', 'message'],
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                  hint: { type: 'string' },
                  retryable: { type: 'boolean' },
                  details: { type: 'object', additionalProperties: true },
                },
              },
            },
          },
          Run: {
            type: 'object',
            required: ['id', 'status', 'phase', 'preset', 'model'],
            properties: {
              id: { type: 'string' },
              status: { type: 'string' },
              phase: { type: 'string' },
              preset: { type: 'string' },
              model: { type: 'string' },
              costUsd: { type: ['number', 'null'] },
              errorCode: { type: ['string', 'null'] },
            },
          },
          RunEvent: {
            type: 'object',
            required: ['id', 'seq', 'type', 'createdAt'],
            properties: {
              id: { type: 'string' },
              seq: { type: 'integer' },
              type: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              data: { type: 'object', additionalProperties: true },
            },
          },
        },
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/api/docs' });
  app.get('/openapi.json', async () => {
    const doc = app.swagger() as {
      openapi?: string;
      paths?: Record<string, Record<string, unknown>>;
      components?: { schemas?: Record<string, unknown> };
    };
    assertOpenApiResponses(decorateOpenApiDocument(doc));
    return doc;
  });

  app.addHook('onRequest', async (request, reply) => {
    const url = request.url;
    if (!FEATURES.learning && url.startsWith('/api/learning')) {
      return refusal(reply as never, 'E_LEARNING_DISABLED');
    }
    if (!FEATURES.routing && (url.startsWith('/api/stats/router') || /^\/api\/runs\/[^/]+\/(routing|context|failures|retries|confidence)/.test(url))) {
      return refusal(reply as never, 'E_ROUTING_DISABLED');
    }
  });

  app.addHook('onRequest', async (request, reply) => {
    const host = request.headers.host ?? '';
    const allowed = new Set([`127.0.0.1:${config.port}`, `localhost:${config.port}`]);
    if (!allowed.has(host)) {
      return refusal(reply as never, 'E_ORIGIN_FORBIDDEN', { host });
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const origin = request.headers.origin;
      if (origin) {
        const ok = origin === `http://127.0.0.1:${config.port}` || origin === `http://localhost:${config.port}` || origin === 'http://127.0.0.1:5173' || origin === 'http://localhost:5173';
        if (!ok) return refusal(reply as never, 'E_ORIGIN_FORBIDDEN', { origin });
      }
      const fetchSite = request.headers['sec-fetch-site'];
      if (typeof fetchSite === 'string' && !['same-origin', 'none'].includes(fetchSite)) {
        return refusal(reply as never, 'E_ORIGIN_FORBIDDEN', { secFetchSite: fetchSite });
      }
      const ct = request.headers['content-type'] ?? '';
      const hasBody =
        (typeof request.headers['content-length'] === 'string' && request.headers['content-length'] !== '0') ||
        typeof request.headers['transfer-encoding'] === 'string';
      const bodylessDelete = request.method === 'DELETE' && !hasBody;
      if (!bodylessDelete && !ct.includes('application/json')) return refusal(reply as never, 'E_CONTENT_TYPE_REQUIRED');
    }
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Cross-Origin-Resource-Policy', 'same-origin');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",
    );
  });

  app.get('/api/health', async () => ({
    status: 'ok',
    version: VERSION,
    phase: config.phase,
    features: FEATURES,
    db: safeDbCheck(),
    key: keyStatus(),
    dataDir: config.dataDir,
    workspace: config.workspaceDir,
    time: now(),
  }));

  app.get('/api/meta', async () => ({
    version: VERSION,
    phase: config.phase,
    features: FEATURES,
    model: config.model,
    host: config.host,
    port: config.port,
    chatMaxAgents: config.chat.maxAgentsPerMessage,
  }));

  app.get('/api/settings', async () => ({
    model: config.model,
    thinking: 'disabled',
    limits: config.limits,
    features: FEATURES,
    key: keyStatus(),
  }));

  app.post('/api/settings/key', async (_request, reply) => refusal(reply as never, 'FORBIDDEN_PROVIDER_KEY_ACCESS'));
  app.put('/api/settings/key', async (_request, reply) => refusal(reply as never, 'FORBIDDEN_PROVIDER_KEY_ACCESS'));

  app.get('/api/settings/key-status', async () => keyStatus());

  app.post('/api/prompt/analyze', async (request, reply) => {
    const body = request.body as { prompt?: unknown } | null;
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    if (prompt.length < 8) {
      return refusal(reply as never, 'E_PROMPT_TOO_LARGE', { reason: 'prompt must be at least 8 characters', observed: prompt.length });
    }
    if (prompt.length > 8000) {
      return refusal(reply as never, 'E_PROMPT_TOO_LARGE', { limit: 8000, observed: prompt.length });
    }
    const { containsSecret } = await import('./security/redact.js');
    if (containsSecret(prompt)) {
      return refusal(reply as never, 'E_LEARNING_REDACTION_BLOCKED', { reason: 'secret pattern in prompt' });
    }
    if (!keyStatus().configured) return refusal(reply as never, 'E_KEY_NOT_CONFIGURED');
    try {
      const { analyzePrompt } = await import('./prompt/analyst.js');
      const result = await analyzePrompt(prompt);
      return {
        schema: 'hive.prompt-analysis.v1',
        analysis: result.analysis,
        repairAttempted: result.repairAttempted,
        model: result.model,
        promptChars: prompt.length,
      };
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        const code = String((error as Error & { code: unknown }).code);
        if (code in REFUSALS) {
          const details = (error as Error & { details?: unknown }).details;
          return refusal(reply as never, code as keyof typeof REFUSALS, details);
        }
      }
      throw error;
    }
  });

  app.get('/api/agents', async () => {
    const { REGISTRY } = await import('./agents/registry.js');
    const evidenceRows = getDb().prepare('SELECT agent_id, badge, provenance, run_id, created_at FROM agent_evidence').all() as AgentEvidenceRow[];
    const stepped = getDb()
      .prepare("SELECT DISTINCT s.agent_id AS agent_id, s.run_id AS run_id FROM steps s JOIN runs r ON r.id = s.run_id WHERE s.status = 'succeeded' AND r.status IN ('completed','completed_with_warnings')")
      .all() as Array<{ agent_id: string; run_id: string }>;
    const overrides = loadPromptOverrides();
    return REGISTRY.map((a) => toAgentView(a, evidenceRows, stepped, overrides.get(a.id) ?? null));
  });

  app.get('/api/agents/:id', async (request, reply) => {
    const { getAgent } = await import('./agents/registry.js');
    const agent = getAgent((request.params as { id: string }).id);
    if (!agent) return refusal(reply as never, 'E_UNSUPPORTED_AGENT');
    const evidenceRows = getDb().prepare('SELECT agent_id, badge, provenance, run_id, created_at FROM agent_evidence').all() as AgentEvidenceRow[];
    const stepped = getDb()
      .prepare("SELECT DISTINCT s.agent_id AS agent_id, s.run_id AS run_id FROM steps s JOIN runs r ON r.id = s.run_id WHERE s.status = 'succeeded' AND r.status IN ('completed','completed_with_warnings')")
      .all() as Array<{ agent_id: string; run_id: string }>;
    return toAgentView(agent, evidenceRows, stepped, readPromptOverride(agent.id));
  });

  app.put('/api/agents/:id/prompt', async (request, reply) => {
    const { getAgent } = await import('./agents/registry.js');
    const { id } = request.params as { id: string };
    const agent = getAgent(id);
    if (!agent) return refusal(reply as never, 'E_UNSUPPORTED_AGENT');
    const body = request.body as { prompt?: unknown } | null;
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    if (prompt.length === 0) return refusal(reply as never, 'E_PROMPT_TOO_LARGE', { reason: 'empty prompt' });
    if (prompt.length > 20_000) return refusal(reply as never, 'E_PROMPT_TOO_LARGE', { limit: 20_000, observed: prompt.length });
    const { assertPromptClean } = await import('./agents/prompts.js');
    try {
      assertPromptClean(id, prompt);
    } catch (error) {
      return refusal(reply as never, 'E_PROMPT_OVERRIDE_INVALID', {
        reason: error instanceof Error ? error.message : 'prompt contract validation failed',
      });
    }
    const { containsSecret } = await import('./security/redact.js');
    if (containsSecret(prompt)) return refusal(reply as never, 'E_LEARNING_REDACTION_BLOCKED', { reason: 'secret pattern in prompt' });
    getDb()
      .prepare('INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at')
      .run(`prompt_override:${id}`, JSON.stringify({ prompt }), nowIso());
    return { agentId: id, saved: true, chars: prompt.length, promptSource: 'override' };
  });

  app.delete('/api/agents/:id/prompt', async (request, reply) => {
    const { getAgent } = await import('./agents/registry.js');
    const { id } = request.params as { id: string };
    if (!getAgent(id)) return refusal(reply as never, 'E_UNSUPPORTED_AGENT');
    getDb().prepare('DELETE FROM settings WHERE key = ?').run(`prompt_override:${id}`);
    return { agentId: id, reset: true };
  });

  app.post('/api/agents/:id/run', async (request, reply) => {
    const { getAgent } = await import('./agents/registry.js');
    const { id } = request.params as { id: string };
    const agent = getAgent(id);
    if (!agent) return refusal(reply as never, 'E_UNSUPPORTED_AGENT');
    const body = request.body as { input?: unknown; mode?: unknown; targetPath?: unknown; maxCostUsd?: unknown } | null;
    const input = typeof body?.input === 'string' ? body.input.trim() : '';
    if (input.length === 0) return refusal(reply as never, 'E_INVALID_AGENT_RUN_INPUT', { reason: 'empty input' });
    if (body?.mode !== undefined && body.mode !== 'live' && body.mode !== 'mock') {
      return refusal(reply as never, 'E_INVALID_AGENT_RUN_INPUT', { field: 'mode', allowed: ['live', 'mock'], observed: body.mode });
    }
    if (body?.mode === 'mock') return refusal(reply as never, 'E_AGENT_MOCK_UNAVAILABLE');
    if (!keyStatus().configured) return refusal(reply as never, 'E_KEY_NOT_CONFIGURED');
    const targetPath = typeof body?.targetPath === 'string' && body.targetPath.trim() ? body.targetPath.trim() : undefined;
    if (agent.outputKind === 'files' && !targetPath) return refusal(reply as never, 'E_AGENT_TARGET_REQUIRED');
    if (targetPath) {
      try {
        normalizeRel(targetPath);
        assertAllowedExtension(targetPath);
      } catch {
        return refusal(reply as never, 'E_UNSAFE_PATH', { field: 'targetPath', path: targetPath });
      }
    }
    const rawMaxCost = body?.maxCostUsd;
    let maxCostUsd: number | undefined;
    if (rawMaxCost !== undefined && rawMaxCost !== null) {
      if (typeof rawMaxCost !== 'number' || !Number.isFinite(rawMaxCost) || rawMaxCost <= 0) {
        return refusal(reply as never, 'E_BUDGET_INVALID_LIMIT', { field: 'maxCostUsd', observed: rawMaxCost });
      }
      if (rawMaxCost > config.limits.maxRunCostUsd) {
        return refusal(reply as never, 'E_BUDGET_INVALID_LIMIT', { field: 'maxCostUsd', max: config.limits.maxRunCostUsd, observed: rawMaxCost });
      }
      maxCostUsd = rawMaxCost;
    }
    const idempotencyKey = request.headers['idempotency-key'];
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 16) return refusal(reply as never, 'E_IDEMPOTENCY_KEY_REQUIRED');
    try {
      const result = await createRun({
        brief: input,
        preset: 'adhoc',
        model: config.model,
        thinking: 'disabled',
        effort: null,
        idempotencyKey,
        runKind: 'adhoc',
        metadata: { agentId: id, input, targetPath: targetPath ?? null },
        maxCostUsd,
      });
      return reply.code(202).send({ runId: result.runId, replayed: result.replayed });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'E_INTERNAL';
      if (code in REFUSALS) return refusal(reply as never, code as keyof typeof REFUSALS);
      throw error;
    }
  });

  if (FEATURES.chat) {
    app.get('/api/chat/threads', async (request) => {
      const query = request.query as { limit?: string };
      const rawLimit = Number(query.limit ?? config.chat.maxThreadsPerList);
      const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : config.chat.maxThreadsPerList;
      return listChatThreads(limit);
    });

    app.post('/api/chat/threads', async (request, reply) => {
      const body = request.body as { title?: unknown; agentId?: unknown } | null;
      const agentId = typeof body?.agentId === 'string' ? body.agentId : '';
      const title = typeof body?.title === 'string' ? body.title : undefined;
      if (!agentId) return refusal(reply as never, 'E_CHAT_INVALID_INPUT', { field: 'agentId' });
      try {
        const thread = createChatThread({ agentId, title });
        return reply.code(201).send({ thread, snapshot: getChatSnapshot(thread.id) });
      } catch (error) {
        const code = error instanceof Error ? error.message : 'E_INTERNAL';
        if (code in REFUSALS) return refusal(reply as never, code as keyof typeof REFUSALS);
        throw error;
      }
    });

    app.get('/api/chat/threads/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      const snapshot = getChatSnapshot(id);
      if (!snapshot) return refusal(reply as never, 'E_CHAT_THREAD_NOT_FOUND');
      return snapshot;
    });

    app.post('/api/chat/threads/:id/messages', async (request, reply) => {
      const { id } = request.params as { id: string };
      const idempotencyKey = request.headers['idempotency-key'];
      if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
        return refusal(reply as never, 'E_IDEMPOTENCY_KEY_REQUIRED');
      }
      const body = request.body as { content?: unknown; agentIds?: unknown } | null;
      const content = typeof body?.content === 'string' ? body.content : '';
      const agentIds = Array.isArray(body?.agentIds)
        ? body.agentIds.filter((value): value is string => typeof value === 'string')
        : [];
      if (content.trim().length === 0 || agentIds.length === 0) {
        return refusal(reply as never, 'E_CHAT_INVALID_INPUT', { field: content.trim().length === 0 ? 'content' : 'agentIds' });
      }
      const { containsSecret } = await import('./security/redact.js');
      if (containsSecret(content)) {
        return refusal(reply as never, 'E_CHAT_INVALID_INPUT', { reason: 'secret pattern in message; nothing was stored' });
      }
      try {
        const result = sendChatMessage(id, { content, agentIds }, idempotencyKey);
        return reply.code(202).send(result);
      } catch (error) {
        const code = error instanceof Error ? error.message : 'E_INTERNAL';
        if (code in REFUSALS) return refusal(reply as never, code as keyof typeof REFUSALS);
        throw error;
      }
    });

    app.get('/api/chat/threads/:id/events', async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!getChatThread(id)) return refusal(reply as never, 'E_CHAT_THREAD_NOT_FOUND');
      const query = request.query as { after?: string };
      const after = Math.max(0, Number(query.after ?? 0) || 0);
      return getChatEventProjection(id, after);
    });

    app.get('/api/chat/threads/:id/stream', async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!getChatThread(id)) return refusal(reply as never, 'E_CHAT_THREAD_NOT_FOUND');
      const rawLastId = Number(request.headers['last-event-id'] ?? 0);
      const projection = getChatEventProjection(id, 0);
      // No Last-Event-ID means a fresh subscriber: replay the durable window
      // from the beginning. A reconnect carries the last delivered id.
      const lastId = Number.isFinite(rawLastId) && rawLastId > 0 ? rawLastId : 0;
      if (lastId > 0 && projection.lastEventId - lastId > config.limits.eventReplayWindow) {
        return refusal(reply as never, 'E_REPLAY_WINDOW_EXCEEDED', {
          snapshotUrl: `/api/chat/threads/${id}`,
          lastEventId: projection.lastEventId,
        });
      }
      reply.hijack();
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      const encode = (event: ReturnType<typeof getChatEventProjection>['events'][number], replay: boolean): string =>
        `id: ${event.seq}\ndata: ${JSON.stringify({
          schema: 'hive.api.v1',
          type: event.type,
          seq: event.seq,
          threadId: id,
          data: event.payload,
          meta: { replay, threadId: id },
        })}\n\n`;
      const catchUp = getChatEventProjection(id, lastId).events;
      for (const event of catchUp) reply.raw.write(encode(event, true));
      const unsubscribe = subscribeChat(id, (event) => reply.raw.write(encode(event, false)));
      const heartbeat = setInterval(() => reply.raw.write(': ping\n\n'), 15_000);
      request.raw.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
      });
    });

    app.post('/api/chat/jobs/:id/cancel', async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        return cancelChatJob(id);
      } catch (error) {
        const code = error instanceof Error ? error.message : 'E_INTERNAL';
        if (code in REFUSALS) return refusal(reply as never, code as keyof typeof REFUSALS);
        throw error;
      }
    });
  }

  app.get('/api/runs/:id/routing', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!getRun(id)) return refusal(reply as never, 'E_RUN_NOT_FOUND');
    const rows = getDb().prepare('SELECT * FROM route_decisions WHERE run_id = ? ORDER BY rank ASC, created_at ASC').all(id) as Array<Record<string, unknown>>;
    const candidateRows = getDb().prepare('SELECT * FROM route_candidates WHERE run_id = ? ORDER BY score DESC, agent_id ASC').all(id) as Array<Record<string, unknown>>;
    const byTask = new Map<string, Array<Record<string, unknown>>>();
    for (const candidate of candidateRows) {
      const taskId = String(candidate.task_id);
      const bucket = byTask.get(taskId) ?? [];
      bucket.push(candidate);
      byTask.set(taskId, bucket);
    }
    const decisions = rows.map((row) => {
      let features: Record<string, unknown> = {};
      let rejected: unknown[] = [];
      try {
        features = JSON.parse(String(row.features_json ?? '{}')) as Record<string, unknown>;
      } catch {
        features = {};
      }
      try {
        const parsed = JSON.parse(String(row.rejected_json ?? '[]'));
        rejected = Array.isArray(parsed) ? parsed : [];
      } catch {
        rejected = [];
      }
      const candidates = (byTask.get(String(row.task_id)) ?? []).map((candidate) => ({
        id: String(candidate.id),
        agentId: String(candidate.agent_id),
        model: (candidate.model as string | null) ?? null,
        thinking: (candidate.thinking as string | null) ?? null,
        effort: (candidate.effort as string | null) ?? null,
        quality: candidate.quality ?? null,
        qualitySource: candidate.quality_source ?? null,
        sampleSize: candidate.sample_size ?? null,
        costUsd: candidate.est_cost_usd ?? null,
        latencyMs: candidate.est_latency_ms ?? null,
        risk: candidate.risk ?? null,
        score: candidate.score ?? null,
        feasible: Boolean(candidate.feasible),
        chosen: Number(candidate.chosen ?? 0) === 1 || (candidate.agent_id === row.agent_id && candidate.model == null),
        rejectReasons: (() => {
          try {
            const parsed = JSON.parse(String(candidate.reject_reasons_json ?? '[]'));
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })(),
      }));
      const reasonText = typeof features.reason === 'string' && features.reason.trim().length > 0
        ? features.reason
        : typeof features.qualitySource === 'string' && features.qualitySource.trim().length > 0
          ? `${features.qualitySource}-based selection (n=${typeof features.sampleSize === 'number' && Number.isFinite(features.sampleSize) ? features.sampleSize : 0})` +
            (typeof features.model === 'string' && features.model.trim().length > 0 ? ` · model ${features.model}` : '') +
            (typeof features.thinking === 'string' && features.thinking.trim().length > 0 ? ` · thinking ${features.thinking}` : '')
          : undefined;
      return {
        id: String(row.id),
        taskId: String(row.task_id),
        agentId: String(row.agent_id),
        model: (features.model as string | undefined) ?? null,
        thinking: (features.thinking as string | undefined) ?? null,
        quality: features.quality ?? null,
        qualitySource: features.qualitySource ?? 'prior',
        sampleSize: features.sampleSize ?? 0,
        costUsd: features.costUsd ?? null,
        latencyMs: features.latencyMs ?? null,
        score: row.score ?? null,
        risk: features.risk ?? null,
        chosen: candidates.length === 0 || candidates.some((candidate) => candidate.chosen),
        ...(reasonText ? { reason: reasonText } : {}),
        candidates,
        refusals: rejected,
        fallbacks: [],
      };
    });
    return {
      decisions,
      candidatesTotal: candidateRows.length,
      refusals: decisions.flatMap((decision) => decision.refusals),
      allocatedCostUsd: rows.reduce((sum, row) => {
        try {
          return sum + Number((JSON.parse(String(row.features_json ?? '{}')) as Record<string, unknown>).costUsd ?? 0);
        } catch {
          return sum;
        }
      }, 0),
      reserveUsd: Number((runBudgetUsd(id) * 0.2).toFixed(6)),
      skippedTasks: [],
    };
  });

  app.get('/api/runs/:id/context', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!getRun(id)) return refusal(reply as never, 'E_RUN_NOT_FOUND');
    const rows = getDb().prepare('SELECT * FROM context_packs WHERE run_id = ? ORDER BY created_at ASC').all(id) as Array<Record<string, unknown>>;
    const packs = rows.map((row) => {
      let items: Array<Record<string, unknown>> = [];
      try {
        const parsed = JSON.parse(String(row.included_json ?? '[]')) as unknown;
        items = Array.isArray(parsed) ? parsed.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item)) : [];
      } catch {
        items = [];
      }
      let excludedItems: Array<Record<string, unknown>> = [];
      try {
        const parsed = JSON.parse(String(row.excluded_json ?? '[]')) as unknown;
        excludedItems = Array.isArray(parsed) ? parsed.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item)) : [];
      } catch {
        excludedItems = [];
      }
      const includedRows = items.map((item) => ({ id: item.id, path: item.path ?? null, kind: item.kind, tokens: item.tokens, mandatory: item.mandatory, included: true }));
      const excludedRows = excludedItems.map((item) => ({
        id: item.id ?? null,
        path: typeof item.path === 'string' ? item.path : null,
        kind: 'excluded',
        tokens: typeof item.tokens === 'number' ? item.tokens : null,
        mandatory: false,
        reason: String(item.reason ?? 'excluded'),
        included: false,
      }));
      return {
        id: row.id,
        taskId: row.task_id,
        agentId: null,
        maxTokens: null,
        usedTokens: row.est_tokens,
        prefixHash: row.prefix_hash,
        // Cacheability is not established by the persisted row; do not
        // present an unproved hash as a cacheable prefix.
        cacheable: false,
        converged: Boolean(row.converged),
        degraded: Boolean(row.degraded),
        items: [...includedRows, ...excludedRows],
      };
    });
    return { packs, items: packs.flatMap((pack) => pack.items) };
  });

  app.get('/api/runs/:id/failures', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!getRun(id)) return refusal(reply as never, 'E_RUN_NOT_FOUND');
    const rows = getDb()
      .prepare('SELECT fs.signature_hash, fs.category, fs.language, fs.severity, fs.count FROM failure_signatures fs JOIN failure_occurrences fo ON fo.signature_hash = fs.signature_hash WHERE fo.run_id = ? GROUP BY fs.signature_hash ORDER BY fs.count DESC')
      .all(id) as Array<Record<string, unknown>>;
    return { clusters: rows.map((row) => ({ id: row.signature_hash, signature: row.signature_hash, category: row.category, language: row.language, severity: row.severity, count: row.count })) };
  });

  app.get('/api/runs/:id/retries', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!getRun(id)) return refusal(reply as never, 'E_RUN_NOT_FOUND');
    const rows = getDb().prepare('SELECT * FROM retry_attempts WHERE run_id = ? ORDER BY created_at ASC').all(id) as Array<Record<string, unknown>>;
    return { attempts: rows.map((row) => ({ id: row.id, taskId: row.task_id, attempt: row.attempt, action: row.action, reason: row.reason, costUsd: row.expected_cost_usd, createdAt: row.created_at })) };
  });

  app.get('/api/runs/:id/checks', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!getRun(id)) return refusal(reply as never, 'E_RUN_NOT_FOUND');
    return { checks: getChecks(id) };
  });

  app.get('/api/runs/:id/confidence', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!getRun(id)) return refusal(reply as never, 'E_RUN_NOT_FOUND');
    const row = getDb().prepare('SELECT * FROM confidence_records WHERE run_id = ? ORDER BY created_at DESC LIMIT 1').get(id) as Record<string, unknown> | undefined;
    if (!row) return { decision: 'none_measured', score: null, provisional: true, components: {}, reasons: ['No confidence record; static verification only.'] };
    return { decision: row.decision, score: row.calibrated, provisional: Boolean(row.provisional), components: JSON.parse(String(row.components_json)), reasons: [] };
  });

  app.get('/api/stats/router', async () => {
    const db = getDb();
    const decisions = db.prepare('SELECT COUNT(*) AS n FROM route_decisions').get() as { n: number };
    const agents = db.prepare('SELECT COUNT(DISTINCT agent_id) AS n FROM route_decisions').get() as { n: number };
    return { decisions: Number(decisions.n), agentsUsed: Number(agents.n) };
  });

  // Read-only, bounded static analysis. These endpoints never read a caller-
  // supplied file path and never execute generated code. They make the
  // dominator/scorecard modules callable by an agent or operator over JSON.
  app.get('/api/analysis', async () => ({
    schema: 'hive.analysis.v1',
    operations: ['dominators', 'scorecards'],
    limits: { nodes: 2_000, edges: 5_000, maxIterations: 100_000, scorecards: 4 },
    semantics: {
      dominators: 'static file-level dependency heuristic; not a CFG, not dynamic execution data',
      scorecards: 'opinions with evidence refs; needsDebate is a scheduler hint, not a verdict',
    },
  }));

  app.post('/api/analysis/dominators', async (request, reply) => {
    try {
      const input = parseDominatorRequest(request.body);
      return { ok: true, analysis: computeDominators(input) };
    } catch (error) {
      if (error instanceof AnalysisInputError || error instanceof DominatorInputError) {
        return refusal(reply as never, 'E_ANALYSIS_INVALID_INPUT', { message: error.message, code: error.code });
      }
      throw error;
    }
  });

  app.post('/api/analysis/scorecards', async (request, reply) => {
    try {
      const input = parseScorecardsRequest(request.body);
      return { ok: true, result: evaluateScorecards(input) };
    } catch (error) {
      if (error instanceof AnalysisInputError || error instanceof ScorecardInputError) {
        return refusal(reply as never, 'E_ANALYSIS_INVALID_INPUT', { message: error.message, code: error.code });
      }
      throw error;
    }
  });

  app.get('/api/ops/reports/:kind', async (request, reply) => {
    const kind = (request.params as { kind: string }).kind;
    if (!['bench', 'context', 'integrity', 'repo-map', 'eval'].includes(kind)) return refusal(reply as never, 'E_REPORT_NOT_FOUND');
    const dir = path.join(config.dataDir, 'reports');
    if (!fs.existsSync(dir)) return { kind, reports: [] };
    const files = fs.readdirSync(dir).filter((f) => f.startsWith(kind)).sort().slice(-10);
    return { kind, reports: files.map((f) => ({ name: f, bytes: fs.statSync(path.join(dir, f)).size })) };
  });

  app.get('/api/scripts', async () => {
    const dryRunAllowed = new Set(['preflight', 'stub-sweep', 'secret-scan', 'assert-stage', 'replay', 'integrity']);
    const scripts = [
      { id: 'preflight', name: 'preflight', safety: 'read', dryRun: true, description: 'Host resource and toolchain check' },
      { id: 'stub-sweep', name: 'stub-sweep', safety: 'read', dryRun: true, description: 'Placeholder scan' },
      { id: 'secret-scan', name: 'secret-scan', safety: 'read', dryRun: true, description: 'Secret-pattern scan' },
      { id: 'assert-stage', name: 'assert-stage', safety: 'read', dryRun: true, description: 'Release-stage allowlist check' },
      { id: 'bench', name: 'bench', safety: 'paid', dryRun: false, description: 'Mock/live bench suite (not a dry-run endpoint)' },
      { id: 'replay', name: 'replay', safety: 'read', dryRun: true, description: 'Event replay report' },
      { id: 'integrity', name: 'integrity', safety: 'read', dryRun: true, description: 'Artifact/manifest integrity check' },
      { id: 'learn', name: 'learn', safety: 'paid', dryRun: false, description: 'Learning dataset/candidate report (not a dry-run endpoint)' },
    ];
    return { scripts: scripts.map((script) => ({ ...script, dryRun: dryRunAllowed.has(script.id) })) };
  });

  app.post('/api/scripts/:id/dry-run', async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const allow = new Set(['preflight', 'stub-sweep', 'secret-scan', 'assert-stage', 'replay', 'integrity']);
    if (!allow.has(id)) return refusal(reply as never, 'E_SCRIPT_DRY_RUN_UNSUPPORTED', { script: id });
    return { script: id, dryRun: true, message: `Run locally: npm.cmd run ${id} -- --json` };
  });

  app.get('/api/learning/overview', async () => {
    const { buildLearningOverview } = await import('./learning/overview.js');
    return buildLearningOverview(getDb(), config.phase);
  });

  app.get('/api/learning/:kind', async (request, reply) => {
    const kind = (request.params as { kind: string }).kind;
    if (!['traces', 'failures', 'datasets', 'candidates', 'evaluations', 'promotions', 'audit'].includes(kind)) return refusal(reply as never, 'E_LEARNING_DISABLED');
    const db = getDb();
    const table: Record<string, string> = {
      traces: 'traces',
      failures: 'failure_signatures',
      datasets: 'eval_suites',
      candidates: 'variants',
      evaluations: 'eval_runs',
      promotions: 'promotions',
      audit: 'learning_audit',
    };
    const rows = db.prepare(`SELECT * FROM ${table[kind]} ORDER BY rowid DESC LIMIT 100`).all() as Array<Record<string, unknown>>;
    return { items: rows };
  });

  app.post('/api/learning/approvals', async (request, reply) => {
    const body = request.body as {
      action?: unknown;
      candidateId?: unknown;
      evaluationId?: unknown;
      promotionId?: unknown;
      typedPhrase?: unknown;
    } | null;
    const action = body?.action;
    const evaluationId = typeof body?.evaluationId === 'string' ? body.evaluationId : '';
    const candidateId = typeof body?.candidateId === 'string' ? body.candidateId : '';
    const promotionId = typeof body?.promotionId === 'string' ? body.promotionId : '';
    if (body?.typedPhrase !== 'APPROVE') {
      return refusal(reply as never, 'E_LEARNING_APPROVAL_REQUIRED', { reason: 'typed approval phrase missing' });
    }
    try {
      const {
        createApprovalService,
        evaluatePromotionGate,
        getPromotion,
        loadGateEvidence,
      } = await import('./learning/index.js');
      const db = getDb();
      let binding: { action: 'promote' | 'rollback'; candidateHash: string; evalHash: string; baselineVersionId: string; suiteUseId: string };
      if (action === 'promote') {
        if (!evaluationId) return refusal(reply as never, 'E_LEARNING_NO_BASELINE', { reason: 'evaluationId is required' });
        const evidence = loadGateEvidence(db, evaluationId);
        if (candidateId && candidateId !== evidence.variantId) {
          return refusal(reply as never, 'E_LEARNING_CANDIDATE_INVALID', { field: 'candidateId', expected: evidence.variantId, observed: candidateId });
        }
        const gate = evaluatePromotionGate(evidence);
        if (gate.decision !== 'promote_eligible') {
          return refusal(reply as never, (gate.code ?? 'E_LEARNING_PROMOTION_REFUSED') as keyof typeof REFUSALS, {
            decision: gate.decision,
            reasons: gate.reasons,
          });
        }
        binding = {
          action: 'promote',
          candidateHash: evidence.variantHash,
          evalHash: evidence.expectedEvidenceHash,
          baselineVersionId: evidence.baselineVersionId,
          suiteUseId: evidence.suiteUseId,
        };
      } else if (action === 'rollback') {
        if (!promotionId) return refusal(reply as never, 'E_LEARNING_ROLLBACK_UNAVAILABLE', { reason: 'promotionId is required' });
        const promotion = getPromotion(db, promotionId);
        if (!promotion || promotion.decision !== 'promote') {
          return refusal(reply as never, 'E_LEARNING_ROLLBACK_UNAVAILABLE');
        }
        const evidence = JSON.parse(promotion.evidenceJson) as Record<string, unknown>;
        binding = {
          action: 'rollback',
          candidateHash: String(evidence.candidateHash ?? ''),
          evalHash: String(evidence.evalHash ?? ''),
          baselineVersionId: promotion.baselineVersionId,
          suiteUseId: String(evidence.suiteUseId ?? ''),
        };
      } else {
        return refusal(reply as never, 'E_LEARNING_APPROVAL_REQUIRED', { reason: 'action must be promote or rollback' });
      }
      const issued = createApprovalService().issue(binding);
      return { approvalToken: issued.token, tokenId: issued.jti, expiresAt: issued.expiresAt };
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? String((error as Error & { code: unknown }).code) : null;
      if (code && code in REFUSALS) {
        return refusal(reply as never, code as keyof typeof REFUSALS, (error as Error & { details?: unknown }).details);
      }
      throw error;
    }
  });

  app.post('/api/learning/promotions', async (request, reply) => {
    const body = request.body as { candidateId?: unknown; evaluationId?: unknown } | null;
    const authorization = request.headers.authorization;
    const approvalToken = typeof authorization === 'string' && authorization.startsWith('HiveApproval ')
      ? authorization.slice('HiveApproval '.length).trim()
      : '';
    if (!approvalToken) return refusal(reply as never, 'E_LEARNING_APPROVAL_REQUIRED');
    const evaluationId = typeof body?.evaluationId === 'string' ? body.evaluationId : '';
    if (!evaluationId) return refusal(reply as never, 'E_LEARNING_NO_BASELINE', { reason: 'evaluationId is required' });
    try {
      const { promote, loadGateEvidence } = await import('./learning/index.js');
      const evidence = loadGateEvidence(getDb(), evaluationId);
      const candidateId = typeof body?.candidateId === 'string' ? body.candidateId : '';
      if (candidateId && candidateId !== evidence.variantId) {
        return refusal(reply as never, 'E_LEARNING_CANDIDATE_INVALID', { field: 'candidateId', expected: evidence.variantId, observed: candidateId });
      }
      const result = promote(getDb(), { evalRunId: evaluationId, approvalToken, approvedBy: 'user' });
      return result;
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? String((error as Error & { code: unknown }).code) : null;
      if (code && code in REFUSALS) {
        return refusal(reply as never, code as keyof typeof REFUSALS, (error as Error & { details?: unknown }).details);
      }
      throw error;
    }
  });

  app.post('/api/learning/rollback', async (request, reply) => {
    const body = request.body as { promotionId?: unknown; reason?: unknown } | null;
    const authorization = request.headers.authorization;
    const approvalToken = typeof authorization === 'string' && authorization.startsWith('HiveApproval ')
      ? authorization.slice('HiveApproval '.length).trim()
      : '';
    if (!approvalToken) return refusal(reply as never, 'E_LEARNING_APPROVAL_REQUIRED');
    const promotionId = typeof body?.promotionId === 'string' ? body.promotionId : '';
    if (!promotionId) return refusal(reply as never, 'E_LEARNING_ROLLBACK_UNAVAILABLE', { reason: 'promotionId is required' });
    const reason = typeof body?.reason === 'string' && body.reason.trim() ? body.reason.trim().slice(0, 500) : 'manual rollback';
    try {
      const { rollback } = await import('./learning/index.js');
      return rollback(getDb(), { promotionId, approvalToken, actor: 'user', reason });
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? String((error as Error & { code: unknown }).code) : null;
      if (code && code in REFUSALS) {
        return refusal(reply as never, code as keyof typeof REFUSALS, (error as Error & { details?: unknown }).details);
      }
      throw error;
    }
  });

  app.get('/api/vault/tree', async () => ({ tree: buildVaultTree(config.vaultDir) }));
  app.get('/api/vault/file', async (request, reply) => {
    const rel = (request.query as { path?: string }).path;
    if (!rel) return refusal(reply as never, 'E_UNSAFE_PATH');
    try {
      const full = safePath(config.vaultDir, rel);
      if (!fs.existsSync(full)) return refusal(reply as never, 'E_FILE_NOT_FOUND');
      reply.header('Content-Type', 'text/plain; charset=utf-8');
      return reply.send(fs.readFileSync(full, 'utf8'));
    } catch {
      return refusal(reply as never, 'E_UNSAFE_PATH');
    }
  });

  app.get('/api/runs/:id/download', async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = getRun(id);
    if (!run) return refusal(reply as never, 'E_RUN_NOT_FOUND');
    if (!TERMINAL_STATUSES.has(run.status as RunStatus)) return refusal(reply as never, 'E_RUN_NOT_TERMINAL');
    const artifacts = getArtifacts(id);
    if (artifacts.length === 0) return refusal(reply as never, 'E_ZIP_EMPTY');
    const { zipSync } = await import('fflate');
    const entries: Record<string, Uint8Array> = {};
    for (const artifact of artifacts) {
      try {
        const full = safePath(run.workspacePath, artifact.path);
        if (fs.existsSync(full)) entries[artifact.path] = new Uint8Array(fs.readFileSync(full));
      } catch {
        // skip unsafe entries
      }
    }
    if (Object.keys(entries).length === 0) return refusal(reply as never, 'E_ZIP_EMPTY');
    const zip = zipSync(entries);
    reply.header('Content-Type', 'application/zip');
    reply.header('Content-Disposition', `attachment; filename="hive-${id.replace(/^run_/, '').slice(0, 10)}.zip"`);
    return reply.send(Buffer.from(zip));
  });

  app.post('/api/runs/:id/search', async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = getRun(id);
    if (!run) return refusal(reply as never, 'E_RUN_NOT_FOUND');
    if (!TERMINAL_STATUSES.has(run.status as RunStatus)) return refusal(reply as never, 'E_RUN_NOT_TERMINAL');
    const body = (request.body ?? {}) as { query?: unknown; limit?: unknown };
    if (typeof body.query !== 'string' || body.query.trim().length < 1 || body.query.length > 200) {
      return refusal(reply as never, 'E_SEARCH_INVALID_QUERY');
    }
    if (body.limit !== undefined && (typeof body.limit !== 'number' || !Number.isInteger(body.limit) || body.limit < 1 || body.limit > 50)) {
      return refusal(reply as never, 'E_SEARCH_INVALID_QUERY');
    }
    try {
      return {
        ok: true,
        ...searchRunWorkspace(run.id, run.workspacePath, body.query.trim(), body.limit ?? 20),
      };
    } catch (error) {
      return refusal(reply as never, 'E_SEARCH_INVALID_QUERY', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post('/api/runs/:id/open-folder', async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = getRun(id);
    if (!run) return refusal(reply as never, 'E_RUN_NOT_FOUND');
    if (process.platform !== 'win32') return refusal(reply as never, 'E_OPEN_FOLDER_UNSUPPORTED');
    try {
      await new Promise<void>((resolve, reject) => {
        const child = spawn('explorer.exe', [run.workspacePath], { detached: true, stdio: 'ignore' });
        child.once('error', reject);
        child.once('spawn', () => {
          child.unref();
          resolve();
        });
      });
    } catch (error) {
      recordError({
        source: 'http',
        code: 'E_OPEN_FOLDER_FAILED',
        message: error instanceof Error ? error.message : String(error),
        runId: id,
        route: '/api/runs/:id/open-folder',
      });
      return refusal(reply as never, 'E_OPEN_FOLDER_FAILED');
    }
    return { opened: true, path: run.workspacePath };
  });

  app.get('/api/runs', async (request, reply) => {
    const query = request.query as { limit?: string; status?: string };
    if (query.status !== undefined && !(RUN_STATUSES as readonly string[]).includes(query.status)) {
      return refusal(reply as never, 'E_INVALID_RUN_FILTER', {
        field: 'status',
        allowed: RUN_STATUSES,
        observed: query.status,
      });
    }
    const rawLimit = Number(query.limit ?? 50);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.max(1, Math.min(100, Math.floor(rawLimit))) : 50;
    return { runs: listRuns(limit, query.status) };
  });

  app.post('/api/runs', async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    const idempotencyKey = request.headers['idempotency-key'];
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      return refusal(reply as never, 'E_IDEMPOTENCY_KEY_REQUIRED');
    }
    const preset = body?.preset ?? 'full-build';
    const model = body?.model ?? config.model;
    const thinking = body?.thinking ?? 'disabled';
    const effort = body?.effort ?? null;
    if (!(PRESETS as readonly unknown[]).includes(preset)) {
      return refusal(reply as never, 'E_INVALID_RUN_INPUT', { field: 'preset', allowed: PRESETS, observed: preset });
    }
    if (!(MODEL_IDS as readonly unknown[]).includes(model)) {
      return refusal(reply as never, 'E_INVALID_RUN_INPUT', { field: 'model', allowed: MODEL_IDS, observed: model });
    }
    if (!(THINKING_MODES as readonly unknown[]).includes(thinking)) {
      return refusal(reply as never, 'E_INVALID_RUN_INPUT', { field: 'thinking', allowed: THINKING_MODES, observed: thinking });
    }
    if (effort !== null && !(EFFORTS as readonly unknown[]).includes(effort)) {
      return refusal(reply as never, 'E_INVALID_RUN_INPUT', { field: 'effort', allowed: EFFORTS, observed: effort });
    }
    const rawMaxCost = body?.maxCostUsd;
    let maxCostUsd: number | undefined;
    if (rawMaxCost !== undefined && rawMaxCost !== null) {
      if (typeof rawMaxCost !== 'number' || !Number.isFinite(rawMaxCost) || rawMaxCost <= 0) {
        return refusal(reply as never, 'E_BUDGET_INVALID_LIMIT', { field: 'maxCostUsd', observed: rawMaxCost });
      }
      if (rawMaxCost > config.limits.maxRunCostUsd) {
        return refusal(reply as never, 'E_BUDGET_INVALID_LIMIT', { field: 'maxCostUsd', max: config.limits.maxRunCostUsd, observed: rawMaxCost });
      }
      maxCostUsd = rawMaxCost;
    }
    const requestedParentId = typeof body?.sourceRunId === 'string' ? body.sourceRunId : typeof body?.parentRunId === 'string' ? body.parentRunId : null;
    if (preset === 'audit' || preset === 'revise') {
      if (!requestedParentId) return refusal(reply as never, 'E_INVALID_PARENT');
      const parent = getRun(requestedParentId);
      const accepted = parent ? getArtifacts(parent.id).filter((artifact) => artifact.status === 'accepted') : [];
      if (!parent || !['completed', 'completed_with_warnings', 'failed'].includes(parent.status) || accepted.length === 0) {
        return refusal(reply as never, 'E_INVALID_PARENT');
      }
    }
    try {
      const result = await createRun({
        brief: String(body?.brief ?? ''),
        preset: preset as never,
        model: model as never,
        thinking: thinking as never,
        effort: effort as never,
        idempotencyKey,
        parentRunId: requestedParentId,
        runKind: preset === 'audit' ? 'audit' : 'user',
        maxCostUsd,
      });
      return reply.code(202).send(result);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'E_INTERNAL';
      if (code in REFUSALS) return refusal(reply as never, code as keyof typeof REFUSALS);
      throw error;
    }
  });

  app.get('/api/runs/active', async () => ({ activeRunId: getActiveRunId() }));

  app.get('/api/runs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = getRun(id);
    if (!run) return refusal(reply as never, 'E_RUN_NOT_FOUND');
    return {
      run,
      steps: getSteps(id),
      checks: getChecks(id),
      artifacts: getArtifacts(id),
      lastEventId: lastEventId(id),
    };
  });

  app.get('/api/runs/:id/snapshot', async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = getRun(id);
    if (!run) return refusal(reply as never, 'E_RUN_NOT_FOUND');
    const allArtifacts = getArtifacts(id);
    const artifacts = allArtifacts.slice(0, 200);
    return {
      run,
      lastEventId: lastEventId(id),
      steps: getSteps(id),
      checks: getChecks(id),
      artifacts,
      truncated: allArtifacts.length > artifacts.length,
      limits: { maxCostUsd: runBudgetUsd(id) },
    };
  });

  app.get('/api/runs/:id/events', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!getRun(id)) return refusal(reply as never, 'E_RUN_NOT_FOUND');
    const query = request.query as { after?: string };
    const after = Math.max(0, Number(query.after ?? 0) || 0);
    const window = config.limits.eventReplayWindow;
    // Count and fetch under one read transaction: truncation must be true only
    // when at least one of THIS run's events after the cursor was not returned,
    // and the rows must always be the newest window (never global-seq math).
    const db = getDb();
    let total = 0;
    let events: RunEvent[] = [];
    db.exec('BEGIN');
    try {
      total = countEventsAfter(id, after);
      events = total > window ? getRecentEvents(id, after, window) : getEvents(id, after, window);
      db.exec('COMMIT');
    } catch (error) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // preserve the original failure
      }
      throw error;
    }
    return {
      events,
      truncated: total > events.length,
      lastEventId: events.length > 0 ? events[events.length - 1].seq : lastEventId(id),
    };
  });

  app.get('/api/runs/:id/stream', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!getRun(id)) return refusal(reply as never, 'E_RUN_NOT_FOUND');
    const rawLastId = Number(request.headers['last-event-id'] ?? 0);
    const current = lastEventId(id);
    const lastId = Number.isFinite(rawLastId) && rawLastId > 0
      ? rawLastId
      : Math.max(0, current - config.limits.eventReplayWindow);
    if (lastId > 0 && current - lastId > config.limits.eventReplayWindow) {
      return refusal(reply as never, 'E_REPLAY_WINDOW_EXCEEDED', { snapshotUrl: `/api/runs/${id}/snapshot`, lastEventId: current });
    }
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    const write = (event: RunEvent) => {
      reply.raw.write(`id: ${event.seq}\nevent: ${event.type}\ndata: ${JSON.stringify({ schema: 'hive.api.v1', type: event.type, data: event.payload, meta: { seq: event.seq, runId: id, replay: false } })}\n\n`);
    };
    for (const event of getEvents(id, lastId)) {
      reply.raw.write(`id: ${event.seq}\nevent: ${event.type}\ndata: ${JSON.stringify({ schema: 'hive.api.v1', type: event.type, data: event.payload, meta: { seq: event.seq, runId: id, replay: true } })}\n\n`);
    }
    const unsubscribe = subscribe(id, write);
    const heartbeat = setInterval(() => reply.raw.write(': ping\n\n'), 15_000);
    request.raw.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  app.post('/api/runs/:id/cancel', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const cancelled = cancelRun(id);
      if (!cancelled) return refusal(reply as never, 'E_RUN_NOT_CANCELLABLE');
      return { cancelled: true };
    } catch (error) {
      const code = error instanceof Error ? error.message : 'E_INTERNAL';
      if (code in REFUSALS) return refusal(reply as never, code as keyof typeof REFUSALS);
      throw error;
    }
  });

  app.post('/api/runs/:id/revise', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parent = getRun(id);
    if (!parent) return refusal(reply as never, 'E_RUN_NOT_FOUND');
    const artifacts = getArtifacts(id).filter((artifact) => artifact.status === 'accepted');
    if (artifacts.length === 0 || !['completed', 'completed_with_warnings', 'failed'].includes(parent.status)) {
      return refusal(reply as never, 'E_INVALID_PARENT');
    }
    const body = request.body as { feedback?: unknown; files?: unknown } | null;
    const feedback = typeof body?.feedback === 'string' ? body.feedback.trim() : '';
    if (feedback.length < 4) return refusal(reply as never, 'E_PROMPT_TOO_LARGE', { reason: 'feedback too short' });
    const idempotencyKey = request.headers['idempotency-key'];
    if (typeof idempotencyKey !== 'string') return refusal(reply as never, 'E_IDEMPOTENCY_KEY_REQUIRED');
    const selected = Array.isArray(body?.files) ? body.files.filter((f): f is string => typeof f === 'string') : [];
    const artifactPaths = new Set(artifacts.map((artifact) => artifact.path));
    if (selected.some((file) => !artifactPaths.has(file))) {
      return refusal(reply as never, 'E_INVALID_REVISION_SCOPE', { selected, artifacts: [...artifactPaths] });
    }
    try {
      const result = await createRun({
        brief: feedback,
        preset: 'revise',
        model: parent.model,
        thinking: parent.thinking,
        effort: parent.effort,
        idempotencyKey,
        parentRunId: id,
        runKind: 'revision',
        metadata: selected.length > 0 ? { revisionFiles: selected } : undefined,
      });
      return reply.code(202).send({ runId: result.runId, replayed: result.replayed });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'E_INTERNAL';
      if (code in REFUSALS) return refusal(reply as never, code as keyof typeof REFUSALS);
      throw error;
    }
  });

  app.post('/api/runs/:id/resume', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parent = getRun(id);
    if (!parent) return refusal(reply as never, 'E_RUN_NOT_FOUND');
    if (!['failed', 'budget_exceeded', 'cancelled', 'interrupted'].includes(parent.status)) {
      return refusal(reply as never, 'E_RESUME_NO_STAGED_FILES', { status: parent.status });
    }
    if (!fs.existsSync(path.join(parent.workspacePath, 'staged'))) {
      return refusal(reply as never, 'E_RESUME_NO_STAGED_FILES', { reason: 'staged directory absent' });
    }
    const idempotencyKey = request.headers['idempotency-key'];
    if (typeof idempotencyKey !== 'string') return refusal(reply as never, 'E_IDEMPOTENCY_KEY_REQUIRED');
    try {
      const result = await createRun({
        brief: parent.brief,
        preset: parent.preset,
        model: parent.model,
        thinking: parent.thinking,
        effort: parent.effort,
        idempotencyKey,
        parentRunId: id,
        runKind: 'resume',
      });
      return reply.code(202).send({ runId: result.runId, replayed: result.replayed });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'E_INTERNAL';
      if (code in REFUSALS) return refusal(reply as never, code as keyof typeof REFUSALS);
      throw error;
    }
  });

  app.get('/api/runs/:id/files', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!getRun(id)) return refusal(reply as never, 'E_RUN_NOT_FOUND');
    return { artifacts: getArtifacts(id) };
  });

  app.get('/api/runs/:id/files/content', async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = getRun(id);
    if (!run) return refusal(reply as never, 'E_RUN_NOT_FOUND');
    const query = request.query as { path?: string };
    if (!query.path) return refusal(reply as never, 'E_UNSAFE_PATH', { reason: 'missing path' });
    const artifact = getArtifacts(id).find((candidate) => candidate.path === query.path);
    if (!artifact) return refusal(reply as never, 'E_FILE_NOT_FOUND', { reason: 'path is not a persisted artifact' });
    try {
      const { safePath } = await import('./security/paths.js');
      const fsmod = await import('node:fs');
      const full = safePath(run.workspacePath, query.path);
      if (!fsmod.existsSync(full)) return refusal(reply as never, 'E_FILE_NOT_FOUND');
      reply.header('Content-Type', 'text/plain; charset=utf-8');
      reply.header('X-Content-Type-Options', 'nosniff');
      return reply.send(fsmod.readFileSync(full, 'utf8'));
    } catch {
      return refusal(reply as never, 'E_UNSAFE_PATH');
    }
  });

  app.get('/api/stats', async () => {
    const db = getDb();
    const counts = db.prepare('SELECT COUNT(*) AS n FROM runs').get() as { n: number };
    const usage = db.prepare(
      `SELECT
         COUNT(*) AS rows,
         SUM(CASE WHEN source = 'unknown' THEN 1 ELSE 0 END) AS unknown_rows,
         COALESCE(SUM(CASE WHEN source <> 'unknown' THEN prompt_tokens ELSE 0 END), 0) AS known_p,
         COALESCE(SUM(CASE WHEN source <> 'unknown' THEN completion_tokens ELSE 0 END), 0) AS known_c,
         COALESCE(SUM(CASE WHEN source <> 'unknown' THEN cost_usd ELSE 0 END), 0) AS known_cost
       FROM usage`,
    ).get() as { rows: number; unknown_rows: number; known_p: number; known_c: number; known_cost: number };
    const unknownUsageRows = Number(usage.unknown_rows ?? 0);
    const partial = unknownUsageRows > 0;
    const chat = FEATURES.chat
      ? (db.prepare('SELECT COALESCE(SUM(cost_usd), 0) AS cost FROM chat_jobs').get() as { cost: number })
      : { cost: 0 };
    const measuredPromptTokens = Number(usage.known_p ?? 0);
    const measuredCompletionTokens = Number(usage.known_c ?? 0);
    const measuredCostUsd = Number(usage.known_cost ?? 0);
    const chatCostUsd = Number(chat.cost ?? 0);
    const { REGISTRY } = await import('./agents/registry.js');
    return {
      agentCount: REGISTRY.length,
      runCount: Number(counts.n),
      totalPromptTokens: partial ? null : measuredPromptTokens,
      totalCompletionTokens: partial ? null : measuredCompletionTokens,
      totalCostUsd: partial ? null : measuredCostUsd + chatCostUsd,
      measuredPromptTokens,
      measuredCompletionTokens,
      measuredCostUsd,
      chatCostUsd,
      unknownUsageRows,
      partial,
    };
  });

  app.get('/api/ops/system', async () => ({
    platform: process.platform,
    node: process.version,
    cpus: os.cpus().length,
    freeMemGB: Math.round((os.freemem() / 1024 ** 3) * 100) / 100,
    totalMemGB: Math.round((os.totalmem() / 1024 ** 3) * 100) / 100,
    time: now(),
  }));

  const dist = path.join(config.root, 'web', 'dist');
  if (fs.existsSync(dist)) {
    await app.register(fastifyStatic, { root: dist, prefix: '/' });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api')) return refusal(reply as never, 'E_RUN_NOT_FOUND');
      const pathname = (() => {
        try {
          return new URL(request.url, 'http://hive.local').pathname;
        } catch {
          return request.url.split('?')[0] ?? '/';
        }
      })();
      const normalized = pathname !== '/' ? pathname.replace(/\/+$/, '') : '/';
      const knownSpaRoute =
        normalized === '/' ||
        ['/agents', '/chat', '/runs', '/analysis', '/scripts', '/vault', '/settings', '/learning'].includes(normalized) ||
        /^\/runs\/[^/]+$/.test(normalized);
      if (!knownSpaRoute) {
        const wantsHtml = String(request.headers.accept ?? '').includes('text/html');
        if (wantsHtml) return reply.code(404).sendFile('index.html');
        return reply.code(404).type('text/plain; charset=utf-8').send('Not found');
      }
      return reply.sendFile('index.html');
    });
  }

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, 'request failed');
    const record = error as Error & { code?: unknown };
    recordError({
      source: 'http',
      code: typeof record.code === 'string' && record.code.startsWith('E_') ? record.code : 'E_INTERNAL',
      message: error instanceof Error ? error.message : String(error),
      route: request.url,
      context: { reqId: request.id, method: request.method },
    });
    if (reply.sent) return;
    return reply.code(500).send({ error: { code: 'E_INTERNAL', message: 'Internal error', retryable: false } });
  });

  return app;
}

function safeDbCheck(): string {
  try {
    getDb().prepare('SELECT 1').get();
    return 'ok';
  } catch {
    return 'unavailable';
  }
}

interface VaultNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: VaultNode[];
}

function buildVaultTree(root: string): VaultNode[] {
  if (!fs.existsSync(root)) return [];
  const walk = (dir: string, rel: string): VaultNode[] => {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith('.'))
      .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
    const nodes: VaultNode[] = [];
    for (const entry of entries) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        nodes.push({ name: entry.name, path: childRel, type: 'dir', children: walk(path.join(dir, entry.name), childRel) });
      } else if (entry.isFile()) {
        nodes.push({ name: entry.name, path: childRel, type: 'file' });
      }
    }
    return nodes;
  };
  return walk(root, '');
}

export { emitEvent };
