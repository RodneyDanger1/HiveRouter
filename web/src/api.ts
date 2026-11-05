import type { AgentDefinition, ApiEnvelope, RunStats } from '@shared/types';
import { isRefusalCode, refusal } from '@shared/refusals';
import { mapPersistedRunEvents } from '@shared/run-events';
import type { ChatSendResult, ChatThreadList, ChatThreadProjection, ChatThreadSnapshot } from '@shared/chat';
import type {
  AgentRunInput,
  AgentView,
  AnalysisCapabilities,
  ApprovalRequest,
  ApprovalResponse,
  ConfidenceView,
  ContextView,
  DominatorAnalysisView,
  DominatorEdge,
  FailuresView,
  HealthResponse,
  KeyStatusResponse,
  LearningOverview,
  LearningRecord,
  MetaResponse,
  PromptAnalysisResponse,
  RawRecord,
  RetriesView,
  RoutingView,
  RunListResponse,
  RunSearchResponse,
  RunSnapshotView,
  RunStreamEvent,
  ScorecardInputView,
  ScorecardResultView,
  ScriptCatalogResponse,
  ScriptDryRunResult,
  StartRunInput,
  StartRunResponse,
  VaultNode,
  VaultTreeResponse,
} from './api-types';

const API_BASE = '/api';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly hint?: string;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor(input: {
    message: string;
    code: string;
    status: number;
    hint?: string;
    retryable?: boolean;
    details?: unknown;
  }) {
    super(input.message);
    this.name = 'ApiError';
    this.code = input.code;
    this.status = input.status;
    this.hint = input.hint;
    this.retryable = input.retryable ?? false;
    this.details = input.details;
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function isRecord(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function refusalCopy(code: string): { message: string; hint?: string; retryable: boolean } | null {
  if (!isRefusalCode(code)) return null;
  const def = refusal(code);
  return { message: def.message, hint: def.hint, retryable: def.retryable };
}

function errorFromPayload(status: number, payload: unknown): ApiError {
  const record = isRecord(payload) ? payload : {};
  const rawError = record.error;
  const nested = isRecord(rawError) ? rawError : record;
  const code = asString(nested.code) ?? asString(record.code) ?? `E_HTTP_${status}`;
  const fallback = refusalCopy(code);
  const message =
    asString(nested.message) ??
    asString(record.message) ??
    fallback?.message ??
    `Request failed with HTTP ${status}.`;
  const hint = asString(nested.hint) ?? asString(record.hint) ?? fallback?.hint;
  const retryable =
    typeof nested.retryable === 'boolean'
      ? nested.retryable
      : typeof record.retryable === 'boolean'
        ? record.retryable
        : (fallback?.retryable ?? false);
  return new ApiError({
    message,
    code,
    status,
    hint,
    retryable,
    details: nested.details ?? record.details,
  });
}

function unwrapEnvelope<T>(payload: unknown): T {
  if (!isRecord(payload)) return payload as T;
  if (payload.schema === 'hive.api.v1') {
    const envelope = payload as unknown as ApiEnvelope<T>;
    if (envelope.ok) return envelope.data;
    throw errorFromPayload(200, payload);
  }
  if (payload.ok === false && payload.error) throw errorFromPayload(200, payload);
  return payload as T;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  idempotencyKey?: string;
  approvalToken?: string;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers ?? {}),
  };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
  if (options.approvalToken) headers.Authorization = `HiveApproval ${options.approvalToken}`;

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
    credentials: 'same-origin',
  });

  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();
  let payload: unknown = null;
  if (text.length > 0) {
    if (contentType.includes('application/json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = null;
      }
    } else {
      payload = text;
    }
  }

  if (!response.ok) throw errorFromPayload(response.status, payload);
  if (payload === null && text.length > 0) {
    throw new ApiError({
      code: 'E_INVALID_RESPONSE',
      status: response.status,
      message: 'The server returned a non-JSON response.',
    });
  }
  return unwrapEnvelope<T>(payload);
}

async function requestText(path: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: 'text/plain, application/octet-stream' },
    signal,
    credentials: 'same-origin',
  });
  const text = await response.text();
  if (!response.ok) {
    let payload: unknown = text;
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      /* keep text */
    }
    throw errorFromPayload(response.status, payload);
  }
  return text;
}

function listFrom<T>(payload: unknown, keys: string[]): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (isRecord(payload)) {
    for (const key of keys) {
      const value = payload[key];
      if (Array.isArray(value)) return value as T[];
    }
    if (isRecord(payload.data)) return listFrom<T>(payload.data, keys);
  }
  return [];
}

function recordFrom(payload: unknown): RawRecord {
  return isRecord(payload) ? payload : {};
}

function normalizeRunId(payload: unknown): string | null {
  if (typeof payload === 'string') return payload;
  if (!isRecord(payload)) return null;
  const direct = asString(payload.runId) ?? asString(payload.id);
  if (direct) return direct;
  if (isRecord(payload.run)) return asString(payload.run.id) ?? null;
  return null;
}

function normalizeSnapshot(payload: unknown): RunSnapshotView {
  const record = recordFrom(payload);
  const candidateRun = record.run;
  const run = isRecord(candidateRun) ? candidateRun : record;
  if (!asString(run.id)) {
    throw new ApiError({
      code: 'E_INVALID_RESPONSE',
      status: 200,
      message: 'The run snapshot is missing its run record.',
    });
  }
  const steps = Array.isArray(record.steps) ? (record.steps as RunSnapshotView['steps']) : [];
  const checks = Array.isArray(record.checks) ? (record.checks as RunSnapshotView['checks']) : [];
  const artifacts = Array.isArray(record.artifacts) ? (record.artifacts as RunSnapshotView['artifacts']) : [];
  return {
    ...record,
    run: run as unknown as RunSnapshotView['run'],
    steps,
    checks,
    artifacts,
    lastEventId: typeof record.lastEventId === 'number' ? record.lastEventId : undefined,
    truncated: record.truncated === true,
  };
}

function normalizeVaultNode(value: unknown): VaultNode | null {
  if (!isRecord(value)) return null;
  const path = asString(value.path);
  const name = asString(value.name) ?? path?.split('/').filter(Boolean).pop();
  if (!path || !name) return null;
  const type = value.type === 'dir' ? 'dir' : 'file';
  const children = Array.isArray(value.children)
    ? value.children.map(normalizeVaultNode).filter((child): child is VaultNode => child !== null)
    : undefined;
  return { path, name, type, children };
}

function normalizeVaultTree(payload: unknown): VaultNode[] {
  const record = recordFrom(payload);
  const raw = Array.isArray(payload)
    ? payload
    : Array.isArray((record as VaultTreeResponse).tree)
      ? (record as VaultTreeResponse).tree
      : Array.isArray((record as VaultTreeResponse).nodes)
        ? (record as VaultTreeResponse).nodes
        : [];
  return (raw ?? []).map(normalizeVaultNode).filter((node): node is VaultNode => node !== null);
}

function normalizeApproval(payload: unknown): ApprovalResponse {
  const record = recordFrom(payload);
  const token = asString(record.approvalToken) ?? asString(record.token);
  if (!token) {
    throw new ApiError({
      code: 'E_INVALID_RESPONSE',
      status: 200,
      message: 'The approval response did not include a token.',
    });
  }
  return {
    approvalToken: token,
    expiresAt: asString(record.expiresAt),
    tokenId: asString(record.tokenId),
  };
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `hive-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function getMeta(signal?: AbortSignal): Promise<MetaResponse> {
  return request<MetaResponse>('/meta', { signal });
}

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return request<HealthResponse>('/health', { signal });
}

export async function getStats(signal?: AbortSignal): Promise<RunStats> {
  return request<RunStats>('/stats', { signal });
}

export async function getKeyStatus(signal?: AbortSignal): Promise<KeyStatusResponse> {
  return request<KeyStatusResponse>('/settings/key-status', { signal });
}

export async function analyzePrompt(prompt: string, signal?: AbortSignal): Promise<PromptAnalysisResponse> {
  return request<PromptAnalysisResponse>('/prompt/analyze', {
    method: 'POST',
    body: { prompt },
    signal,
  });
}

export async function getSettings(signal?: AbortSignal): Promise<RawRecord> {
  return request<RawRecord>('/settings', { signal });
}

export async function listRuns(limit = 50, signal?: AbortSignal, status?: string): Promise<RunListResponse> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (status && status !== 'all') query.set('status', status);
  const payload = await request<unknown>(`/runs?${query.toString()}`, { signal });
  const runs = listFrom<RunListResponse['runs'][number]>(payload, ['runs', 'items', 'data']);
  const record = recordFrom(payload);
  return { runs, total: typeof record.total === 'number' ? record.total : undefined };
}

export async function listChatThreads(limit = 50, signal?: AbortSignal): Promise<ChatThreadList> {
  return request<ChatThreadList>(`/chat/threads?limit=${encodeURIComponent(String(limit))}`, { signal });
}

export async function createChatThread(
  input: { agentId: string; title?: string },
  signal?: AbortSignal,
): Promise<{ thread: ChatThreadProjection; snapshot: ChatThreadSnapshot | null }> {
  return request<{ thread: ChatThreadProjection; snapshot: ChatThreadSnapshot | null }>('/chat/threads', {
    method: 'POST',
    body: input,
    signal,
  });
}

export async function getChatThreadSnapshot(threadId: string, signal?: AbortSignal): Promise<ChatThreadSnapshot> {
  return request<ChatThreadSnapshot>(`/chat/threads/${encodeURIComponent(threadId)}`, { signal });
}

export async function sendChatMessage(
  threadId: string,
  input: { content: string; agentIds: string[] },
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<ChatSendResult> {
  return request<ChatSendResult>(`/chat/threads/${encodeURIComponent(threadId)}/messages`, {
    method: 'POST',
    body: input,
    idempotencyKey,
    signal,
  });
}

export async function cancelChatJob(jobId: string): Promise<{ cancelled: boolean; status: string }> {
  return request<{ cancelled: boolean; status: string }>(`/chat/jobs/${encodeURIComponent(jobId)}/cancel`, {
    method: 'POST',
    body: {},
  });
}

export async function getRunSnapshot(runId: string, signal?: AbortSignal): Promise<RunSnapshotView> {  try {
    return normalizeSnapshot(await request<unknown>(`/runs/${encodeURIComponent(runId)}/snapshot`, { signal }));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return normalizeSnapshot(await request<unknown>(`/runs/${encodeURIComponent(runId)}`, { signal }));
    }
    throw error;
  }
}

export async function getRunEvents(runId: string, signal?: AbortSignal): Promise<RunStreamEvent[]> {
  const payload = await request<unknown>(`/runs/${encodeURIComponent(runId)}/events`, { signal });
  const record = recordFrom(payload);
  const rows = Array.isArray(record.events) ? record.events : [];
  return mapPersistedRunEvents(rows);
}

export async function startRun(
  input: StartRunInput,
  signal?: AbortSignal,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<string> {
  const payload = await request<unknown>('/runs', {
    method: 'POST',
    body: input,
    idempotencyKey,
    signal,
  });
  const runId = normalizeRunId(payload);
  if (!runId) {
    throw new ApiError({ code: 'E_INVALID_RESPONSE', status: 200, message: 'The run was created without a run id.' });
  }
  return runId;
}

export async function cancelRun(runId: string, signal?: AbortSignal): Promise<void> {
  await request<unknown>(`/runs/${encodeURIComponent(runId)}/cancel`, {
    method: 'POST',
    body: {},
    idempotencyKey: newIdempotencyKey(),
    signal,
  });
}

export async function reviseRun(
  runId: string,
  feedback: string,
  files: string[] = [],
  signal?: AbortSignal,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<string> {
  const payload = await request<unknown>(`/runs/${encodeURIComponent(runId)}/revise`, {
    method: 'POST',
    body: { feedback, files },
    idempotencyKey,
    signal,
  });
  const childId = normalizeRunId(payload);
  if (!childId) {
    throw new ApiError({ code: 'E_INVALID_RESPONSE', status: 200, message: 'The revision did not return a run id.' });
  }
  return childId;
}

export async function auditRun(
  runId: string,
  brief: string,
  signal?: AbortSignal,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<string> {
  return startRun(
    {
      brief,
      preset: 'audit',
      sourceRunId: runId,
    },
    signal,
    idempotencyKey,
  );
}

export async function resumeRun(
  runId: string,
  signal?: AbortSignal,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<string> {
  const payload = await request<{ runId: string }>(`/runs/${encodeURIComponent(runId)}/resume`, {
    method: 'POST',
    body: {},
    idempotencyKey,
    signal,
  });
  return payload.runId;
}

export async function openRunFolder(runId: string, signal?: AbortSignal): Promise<void> {
  await request<unknown>(`/runs/${encodeURIComponent(runId)}/open-folder`, {
    method: 'POST',
    body: {},
    signal,
  });
}

export async function downloadRunArchive(runId: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch(`${API_BASE}/runs/${encodeURIComponent(runId)}/download`, {
    headers: { Accept: 'application/zip, application/json' },
    signal,
    credentials: 'same-origin',
  });
  if (!response.ok) {
    const text = await response.text();
    let payload: unknown = null;
    if (text.trim().startsWith('{')) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = null;
      }
    }
    throw errorFromPayload(response.status, payload);
  }
  return response.blob();
}

export async function getFileContent(runId: string, path: string, signal?: AbortSignal): Promise<string> {
  return requestText(
    `/runs/${encodeURIComponent(runId)}/files/content?path=${encodeURIComponent(path)}`,
    signal,
  );
}

export async function searchRun(
  runId: string,
  query: string,
  limit = 20,
  signal?: AbortSignal,
): Promise<RunSearchResponse> {
  return request<RunSearchResponse>(`/runs/${encodeURIComponent(runId)}/search`, {
    method: 'POST',
    body: { query, limit },
    signal,
  });
}

export async function listAgents(signal?: AbortSignal): Promise<AgentView[]> {
  const payload = await request<unknown>('/agents', { signal });
  return listFrom<AgentView>(payload, ['agents', 'items', 'data']);
}

export async function getAgent(agentId: string, signal?: AbortSignal): Promise<AgentView> {
  const payload = await request<unknown>(`/agents/${encodeURIComponent(agentId)}`, { signal });
  const record = recordFrom(payload);
  const agent = record.agent ?? payload;
  if (!isRecord(agent)) {
    throw new ApiError({ code: 'E_INVALID_RESPONSE', status: 200, message: 'The agent response was empty.' });
  }
  return agent as unknown as AgentView;
}

export async function updateAgentPrompt(agentId: string, prompt: string, signal?: AbortSignal): Promise<void> {
  await request<unknown>(`/agents/${encodeURIComponent(agentId)}/prompt`, {
    method: 'PUT',
    body: { prompt },
    idempotencyKey: newIdempotencyKey(),
    signal,
  });
}

export async function resetAgentPrompt(agentId: string, signal?: AbortSignal): Promise<void> {
  await request<unknown>(`/agents/${encodeURIComponent(agentId)}/prompt`, {
    method: 'DELETE',
    idempotencyKey: newIdempotencyKey(),
    signal,
  });
}

export async function runAgent(
  agentId: string,
  input: AgentRunInput,
  signal?: AbortSignal,
  idempotencyKey: string = newIdempotencyKey(),
): Promise<string> {
  const payload = await request<unknown>(`/agents/${encodeURIComponent(agentId)}/run`, {
    method: 'POST',
    body: input,
    idempotencyKey,
    signal,
  });
  const runId = normalizeRunId(payload);
  if (!runId) {
    throw new ApiError({ code: 'E_INVALID_RESPONSE', status: 200, message: 'The agent run did not return a run id.' });
  }
  return runId;
}

export async function getRouting(runId: string, signal?: AbortSignal): Promise<RoutingView> {
  return request<RoutingView>(`/runs/${encodeURIComponent(runId)}/routing`, { signal });
}

export async function getContext(runId: string, signal?: AbortSignal): Promise<ContextView> {
  return request<ContextView>(`/runs/${encodeURIComponent(runId)}/context`, { signal });
}

export async function getFailures(runId: string, signal?: AbortSignal): Promise<FailuresView> {
  return request<FailuresView>(`/runs/${encodeURIComponent(runId)}/failures`, { signal });
}

export async function getRetries(runId: string, signal?: AbortSignal): Promise<RetriesView> {
  return request<RetriesView>(`/runs/${encodeURIComponent(runId)}/retries`, { signal });
}

export async function getConfidence(runId: string, signal?: AbortSignal): Promise<ConfidenceView> {
  return request<ConfidenceView>(`/runs/${encodeURIComponent(runId)}/confidence`, { signal });
}

export async function getLearningOverview(signal?: AbortSignal): Promise<LearningOverview> {
  return request<LearningOverview>('/learning/overview', { signal });
}

export async function listLearningRecords(
  kind: 'traces' | 'failures' | 'datasets' | 'candidates' | 'evaluations' | 'promotions' | 'audit',
  signal?: AbortSignal,
): Promise<LearningRecord[]> {
  const payload = await request<unknown>(`/learning/${kind}`, { signal });
  return listFrom<LearningRecord>(payload, [kind, 'items', 'data', 'records']);
}

export async function requestApproval(input: ApprovalRequest, signal?: AbortSignal): Promise<ApprovalResponse> {
  const payload = await request<unknown>('/learning/approvals', {
    method: 'POST',
    body: input,
    idempotencyKey: newIdempotencyKey(),
    signal,
  });
  return normalizeApproval(payload);
}

export async function promoteLearning(
  input: { candidateId: string; evaluationId: string },
  approvalToken: string,
  signal?: AbortSignal,
): Promise<void> {
  await request<unknown>('/learning/promotions', {
    method: 'POST',
    body: input,
    approvalToken,
    idempotencyKey: newIdempotencyKey(),
    signal,
  });
}

export async function rollbackLearning(
  input: { promotionId: string; reason: string },
  approvalToken: string,
  signal?: AbortSignal,
): Promise<void> {
  await request<unknown>('/learning/rollback', {
    method: 'POST',
    body: input,
    approvalToken,
    idempotencyKey: newIdempotencyKey(),
    signal,
  });
}

export async function getVaultTree(signal?: AbortSignal): Promise<VaultNode[]> {
  return normalizeVaultTree(await request<unknown>('/vault/tree', { signal }));
}

export async function getVaultFile(path: string, signal?: AbortSignal): Promise<string> {
  return requestText(`/vault/file?path=${encodeURIComponent(path)}`, signal);
}

export async function getAnalysisCapabilities(signal?: AbortSignal): Promise<AnalysisCapabilities> {
  return request<AnalysisCapabilities>('/analysis', { signal });
}

export async function analyzeDominators(
  input: { root: string; edges: DominatorEdge[] },
  signal?: AbortSignal,
): Promise<DominatorAnalysisView> {
  const payload = await request<{ ok: boolean; analysis: DominatorAnalysisView }>('/analysis/dominators', {
    method: 'POST',
    body: input,
    signal,
  });
  return payload.analysis;
}

export async function evaluateScorecards(
  input: { scorecards: ScorecardInputView[]; threshold?: number },
  signal?: AbortSignal,
): Promise<ScorecardResultView> {
  const payload = await request<{ ok: boolean; result: ScorecardResultView }>('/analysis/scorecards', {
    method: 'POST',
    body: input,
    signal,
  });
  return payload.result;
}

export async function getScripts(signal?: AbortSignal): Promise<ScriptCatalogResponse> {
  return request<ScriptCatalogResponse>('/scripts', { signal });
}

export async function dryRunScript(id: string, signal?: AbortSignal): Promise<ScriptDryRunResult> {
  return request<ScriptDryRunResult>(`/scripts/${encodeURIComponent(id)}/dry-run`, {
    method: 'POST',
    body: {},
    signal,
  });
}

export function agentBadgeLabel(badge: string): string {
  switch (badge) {
    case 'registered':
      return 'Registered';
    case 'schema-valid':
      return 'Schema valid';
    case 'mock-run':
      return 'Mock-run';
    case 'representative-live':
      return 'Live evidence';
    default:
      return badge.replace(/[-_]/g, ' ');
  }
}

export function agentIsEnabled(agent: AgentDefinition): boolean {
  const candidate = agent as AgentView;
  return candidate.enabled !== false;
}
