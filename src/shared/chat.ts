/**
 * Shared live-chat contracts. The server is the source of truth for every
 * projection; the web client consumes these shapes and never computes run/job
 * state locally.
 */

export const CHAT_ROLES = ['user', 'assistant'] as const;
export type ChatRole = (typeof CHAT_ROLES)[number];

export const CHAT_MESSAGE_STATUSES = ['pending', 'complete', 'failed'] as const;
export type ChatMessageStatus = (typeof CHAT_MESSAGE_STATUSES)[number];

export const CHAT_JOB_STATUSES = ['queued', 'running', 'succeeded', 'failed', 'cancelled'] as const;
export type ChatJobStatus = (typeof CHAT_JOB_STATUSES)[number];

export const CHAT_EVENT_TYPES = [
  'chat.thread.updated',
  'chat.message.created',
  'chat.message.completed',
  'chat.message.failed',
  'chat.job.queued',
  'chat.job.started',
  'chat.job.succeeded',
  'chat.job.failed',
  'chat.job.requeued',
  'chat.job.cancelled',
] as const;
export type ChatEventType = (typeof CHAT_EVENT_TYPES)[number];

export interface ChatThreadProjection {
  id: string;
  title: string;
  agentId: string;
  model: string;
  thinking: string;
  effort: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastJobId: string | null;
  lastJobStatus: ChatJobStatus | null;
  messageCount: number;
  pendingJobCount: number;
  queuedJobCount: number;
  runningJobCount: number;
  failedJobCount: number;
  succeededJobCount: number;
}

export interface ChatJobProjection {
  id: string;
  threadId: string;
  messageId: string;
  userMessageId: string;
  agentId: string;
  kind: string;
  status: ChatJobStatus;
  attempts: number;
  maxAttempts: number;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  availableAt: string;
  cancelRequestedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  costUsd: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
}

export interface ChatMessageProjection {
  id: string;
  seq: number;
  role: ChatRole;
  agentId: string | null;
  content: string;
  status: ChatMessageStatus;
  jobId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  /** Residual projection fields joined from the owning job (null for a user message). */
  jobStatus: ChatJobStatus | null;
  jobAttempts: number | null;
  jobMaxAttempts: number | null;
  jobAvailableAt: string | null;
  jobLeaseExpiresAt: string | null;
  jobLastErrorCode: string | null;
  jobLastErrorMessage: string | null;
  jobCostUsd: number | null;
}

export interface ChatEventRecord {
  seq: number;
  threadId: string;
  type: ChatEventType;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ChatThreadSnapshot {
  thread: ChatThreadProjection;
  messages: ChatMessageProjection[];
  jobs: ChatJobProjection[];
  lastEventSeq: number;
}

export interface ChatSendResult {
  replayed: boolean;
  threadId: string;
  messageId: string;
  jobIds: string[];
  snapshot: ChatThreadSnapshot;
}

export interface ChatThreadList {
  threads: ChatThreadProjection[];
}

export interface ChatSendInput {
  content: string;
  agentIds: string[];
}

export interface ChatCreateInput {
  title?: string;
  agentId: string;
}

/** Bounded preview used by the thread list and the persisted thread projection. */
export function previewContent(content: string, max = 160): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

/**
 * Usage is two independent measurements. A missing completion count must not
 * render as zero just because the prompt count arrived; unknown stays unknown.
 */
export function formatChatTokenUsage(
  usage: { promptTokens: number | null; completionTokens: number | null } | null,
): string {
  if (!usage) return 'not reported';
  const prompt = usage.promptTokens == null ? 'prompt not reported' : `${usage.promptTokens} in`;
  const completion = usage.completionTokens == null ? 'completion not reported' : `${usage.completionTokens} out`;
  if (usage.promptTokens == null && usage.completionTokens == null) return 'not reported';
  return `${prompt} / ${completion}`;
}

export function isChatJobStatus(value: unknown): value is ChatJobStatus {
  return typeof value === 'string' && (CHAT_JOB_STATUSES as readonly string[]).includes(value);
}

export function isChatEventType(value: unknown): value is ChatEventType {
  return typeof value === 'string' && (CHAT_EVENT_TYPES as readonly string[]).includes(value);
}
