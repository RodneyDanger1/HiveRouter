import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { getDb, nowIso, tx } from '../db/database.js';
import { config } from '../config.js';
import { getAgent } from '../agents/registry.js';
import {
  previewContent,
  type ChatEventRecord,
  type ChatJobProjection,
  type ChatJobStatus,
  type ChatMessageProjection,
  type ChatRole,
  type ChatThreadList,
  type ChatThreadProjection,
  type ChatThreadSnapshot,
} from '../../shared/chat.js';
import {
  appendChatEvent,
  getChatEvents,
  lastChatEventSeq,
  publishChatEvents,
} from './events.js';

export type ChatCreateThreadInput = { title?: string; agentId: string };
export type ChatSendMessageInput = { content: string; agentIds: string[] };

export type ChatJobOutcome =
  | {
      ok: true;
      text: string;
      usage: { costUsd: number; promptTokens: number; completionTokens: number } | null;
    }
  | {
      ok: false;
      code: string;
      message: string;
      retryable: boolean;
      usage?: { costUsd: number; promptTokens: number; completionTokens: number } | null;
    }
  | { cancelled: true; usage?: { costUsd: number; promptTokens: number; completionTokens: number } | null };

export type ChatJobClaim = {
  job: ChatJobProjection;
  thread: ChatThreadProjection;
};

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(9).toString('hex')}`;
}

function asStatus(value: unknown): ChatJobStatus | null {
  return value === 'queued' ||
    value === 'running' ||
    value === 'succeeded' ||
    value === 'failed' ||
    value === 'cancelled'
    ? value
    : null;
}

function threadRow(row: Record<string, unknown>): ChatThreadProjection {
  return {
    id: String(row.id),
    title: String(row.title),
    agentId: String(row.agent_id),
    model: String(row.model),
    thinking: String(row.thinking),
    effort: row.effort == null ? null : String(row.effort),
    status: String(row.status),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastMessageAt: row.last_message_at == null ? null : String(row.last_message_at),
    lastMessagePreview: row.last_message_preview == null ? null : String(row.last_message_preview),
    lastJobId: row.last_job_id == null ? null : String(row.last_job_id),
    lastJobStatus: asStatus(row.last_job_status),
    messageCount: Number(row.message_count ?? 0),
    pendingJobCount: Number(row.queued_job_count ?? 0) + Number(row.running_job_count ?? 0),
    queuedJobCount: Number(row.queued_job_count ?? 0),
    runningJobCount: Number(row.running_job_count ?? 0),
    failedJobCount: Number(row.failed_job_count ?? 0),
    succeededJobCount: Number(row.succeeded_job_count ?? 0),
  };
}

const THREAD_SELECT = `
  SELECT t.*,
    (SELECT COUNT(*) FROM chat_messages m WHERE m.thread_id = t.id) AS message_count,
    (SELECT COUNT(*) FROM chat_jobs j WHERE j.thread_id = t.id AND j.status = 'queued') AS queued_job_count,
    (SELECT COUNT(*) FROM chat_jobs j WHERE j.thread_id = t.id AND j.status = 'running') AS running_job_count,
    (SELECT COUNT(*) FROM chat_jobs j WHERE j.thread_id = t.id AND j.status = 'failed') AS failed_job_count,
    (SELECT COUNT(*) FROM chat_jobs j WHERE j.thread_id = t.id AND j.status = 'succeeded') AS succeeded_job_count
  FROM chat_threads t
`;

function getThreadRow(threadId: string, db: DatabaseSync = getDb()): ChatThreadProjection | null {
  const row = db.prepare(`${THREAD_SELECT} WHERE t.id = ?`).get(threadId) as Record<string, unknown> | undefined;
  return row ? threadRow(row) : null;
}

export function listChatThreads(limit: number = config.chat.maxThreadsPerList): ChatThreadList {
  const capped = Math.max(1, Math.min(config.chat.maxThreadsPerList, Math.floor(limit)));
  const rows = getDb()
    .prepare(`${THREAD_SELECT} WHERE t.status = 'active' ORDER BY t.updated_at DESC, t.id DESC LIMIT ?`)
    .all(capped) as Array<Record<string, unknown>>;
  return { threads: rows.map(threadRow) };
}

export function getChatThread(threadId: string): ChatThreadProjection | null {
  return getThreadRow(threadId);
}

function messageRows(threadId: string, db: DatabaseSync = getDb()): ChatMessageProjection[] {
  const rows = db
    .prepare(
      `SELECT m.*, j.status AS job_status, j.attempts AS job_attempts,
              j.max_attempts AS job_max_attempts, j.available_at AS job_available_at,
              j.lease_expires_at AS job_lease_expires_at,
              j.last_error_code AS job_last_error_code,
              j.last_error_message AS job_last_error_message,
              j.cost_usd AS job_cost_usd
       FROM chat_messages m
       LEFT JOIN chat_jobs j ON j.message_id = m.id
       WHERE m.thread_id = ?
       ORDER BY m.seq ASC`,
    )
    .all(threadId) as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: String(row.id),
    seq: Number(row.seq),
    role: String(row.role) as ChatRole,
    agentId: row.agent_id == null ? null : String(row.agent_id),
    content: String(row.content),
    status: String(row.status) as ChatMessageProjection['status'],
    jobId: row.job_id == null ? null : String(row.job_id),
    errorCode: row.error_code == null ? null : String(row.error_code),
    errorMessage: row.error_message == null ? null : String(row.error_message),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    jobStatus: asStatus(row.job_status),
    jobAttempts: row.job_attempts == null ? null : Number(row.job_attempts),
    jobMaxAttempts: row.job_max_attempts == null ? null : Number(row.job_max_attempts),
    jobAvailableAt: row.job_available_at == null ? null : String(row.job_available_at),
    jobLeaseExpiresAt: row.job_lease_expires_at == null ? null : String(row.job_lease_expires_at),
    jobLastErrorCode: row.job_last_error_code == null ? null : String(row.job_last_error_code),
    jobLastErrorMessage: row.job_last_error_message == null ? null : String(row.job_last_error_message),
    jobCostUsd: row.job_cost_usd == null ? null : Number(row.job_cost_usd),
  }));
}

export function getChatSnapshot(threadId: string): ChatThreadSnapshot | null {
  const thread = getThreadRow(threadId);
  if (!thread) return null;
  const jobs = getChatJobs(threadId);
  return {
    thread,
    messages: messageRows(threadId),
    jobs,
    lastEventSeq: lastChatEventSeq(threadId),
  };
}

function jobProjection(row: Record<string, unknown>): ChatJobProjection {
  return {
    id: String(row.id),
    threadId: String(row.thread_id),
    messageId: String(row.message_id),
    userMessageId: String(row.user_message_id),
    agentId: String(row.agent_id),
    kind: String(row.kind),
    status: String(row.status) as ChatJobStatus,
    attempts: Number(row.attempts),
    maxAttempts: Number(row.max_attempts),
    leaseOwner: row.lease_owner == null ? null : String(row.lease_owner),
    leaseExpiresAt: row.lease_expires_at == null ? null : String(row.lease_expires_at),
    availableAt: String(row.available_at),
    cancelRequestedAt: row.cancel_requested_at == null ? null : String(row.cancel_requested_at),
    lastErrorCode: row.last_error_code == null ? null : String(row.last_error_code),
    lastErrorMessage: row.last_error_message == null ? null : String(row.last_error_message),
    costUsd: row.cost_usd == null ? null : Number(row.cost_usd),
    promptTokens: row.prompt_tokens == null ? null : Number(row.prompt_tokens),
    completionTokens: row.completion_tokens == null ? null : Number(row.completion_tokens),
    createdAt: String(row.created_at),
    startedAt: row.started_at == null ? null : String(row.started_at),
    finishedAt: row.finished_at == null ? null : String(row.finished_at),
    updatedAt: String(row.updated_at),
  };
}

export function getChatJobs(threadId: string): ChatJobProjection[] {
  const rows = getDb()
    .prepare('SELECT * FROM chat_jobs WHERE thread_id = ? ORDER BY created_at ASC, id ASC')
    .all(threadId) as Array<Record<string, unknown>>;
  return rows.map(jobProjection);
}

export function getChatJob(jobId: string): ChatJobProjection | null {
  const row = getDb().prepare('SELECT * FROM chat_jobs WHERE id = ?').get(jobId) as
    | Record<string, unknown>
    | undefined;
  return row ? jobProjection(row) : null;
}

/** Events are replayed newest-window-first only when the cursor exceeds the window. */
export function getChatEventProjection(
  threadId: string,
  after: number,
): { events: ReturnType<typeof getChatEvents>; truncated: boolean; lastEventId: number } {
  const total = getDb()
    .prepare('SELECT COUNT(*) AS n FROM chat_events WHERE thread_id = ? AND seq > ?')
    .get(threadId, after) as { n: number } | undefined;
  const count = Number(total?.n ?? 0);
  const window = config.limits.eventReplayWindow;
  const events = count > window
    ? getRecentChatEvents(threadId, after, window)
    : getChatEvents(threadId, after, window);
  return {
    events,
    truncated: count > events.length,
    lastEventId: events.length > 0 ? events[events.length - 1].seq : lastChatEventSeq(threadId),
  };
}

function getRecentChatEvents(threadId: string, after: number, limit: number): ChatEventRecord[] {
  const rows = getDb()
    .prepare(
      `SELECT seq, thread_id, type, payload_json, created_at
       FROM chat_events WHERE thread_id = ? AND seq > ? ORDER BY seq DESC LIMIT ?`,
    )
    .all(threadId, after, limit) as Array<{
    seq: number;
    thread_id: string;
    type: string;
    payload_json: string;
    created_at: string;
  }>;
  return rows
    .map((row) => ({
      seq: Number(row.seq),
      threadId: row.thread_id,
      type: row.type as ChatEventRecord['type'],
      payload: JSON.parse(row.payload_json) as Record<string, unknown>,
      createdAt: row.created_at,
    }))
    .reverse();
}

export function createChatThread(input: ChatCreateThreadInput): ChatThreadProjection {
  const agent = getAgent(input.agentId);
  if (!agent) throw new Error('E_UNSUPPORTED_AGENT');
  const title = (input.title ?? `Chat with ${agent.name}`).trim();
  if (title.length < 1 || title.length > 120) throw new Error('E_CHAT_INVALID_INPUT');
  const id = newId('chat');
  const createdAt = nowIso();
  let events: ReturnType<typeof appendChatEvent>[] = [];
  tx((db) => {
    db.prepare(
      `INSERT INTO chat_threads
       (id, title, agent_id, model, thinking, effort, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'disabled', NULL, 'active', ?, ?)`,
    ).run(id, title, agent.id, config.model, createdAt, createdAt);
    events = [appendChatEvent(db, id, 'chat.thread.updated', { threadId: id, status: 'active' })];
  });
  publishChatEvents(events);
  return getChatThread(id) as ChatThreadProjection;
}

function validateMessage(input: ChatSendMessageInput): { content: string; agentIds: string[] } {
  const content = input.content.trim();
  if (content.length < 1 || content.length > config.limits.briefChars) throw new Error('E_CHAT_INVALID_INPUT');
  const agentIds = Array.from(new Set(input.agentIds));
  if (agentIds.length < 1 || agentIds.length > config.chat.maxAgentsPerMessage) {
    throw new Error('E_CHAT_INVALID_INPUT');
  }
  for (const agentId of agentIds) {
    if (!getAgent(agentId)) throw new Error('E_UNSUPPORTED_AGENT');
  }
  return { content, agentIds };
}

export type ChatSendResult = {
  replayed: boolean;
  threadId: string;
  messageId: string;
  jobIds: string[];
  snapshot: ChatThreadSnapshot;
};

/**
 * Atomically persist one user message, one pending assistant message per
 * selected agent, and one queued job per assistant message. A duplicate
 * idempotency key returns the original snapshot instead of enqueuing again.
 */
export function sendChatMessage(threadId: string, input: ChatSendMessageInput, requestKey: string): ChatSendResult {
  const thread = getChatThread(threadId);
  if (!thread) throw new Error('E_CHAT_THREAD_NOT_FOUND');
  const { content, agentIds } = validateMessage(input);
  // Scope the request key to its thread and bind it to the actual body. A key
  // reused on another thread or with different content is a conflict, not a
  // replay of the first thread's snapshot.
  const scopedKey = `${threadId}\u0000${requestKey}`;
  const requestHash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ content, agentIds }))
    .digest('hex');
  const existing = getDb()
    .prepare('SELECT id, thread_id, request_hash FROM chat_messages WHERE request_key = ?')
    .get(scopedKey) as { id: string; thread_id: string; request_hash: string | null } | undefined;
  if (existing) {
    if (existing.thread_id !== threadId) throw new Error('E_IDEMPOTENCY_KEY_REUSED');
    if (existing.request_hash !== null && existing.request_hash !== requestHash) {
      throw new Error('E_IDEMPOTENCY_KEY_REUSED');
    }
    const snapshot = getChatSnapshot(existing.thread_id);
    if (!snapshot) throw new Error('E_CHAT_THREAD_NOT_FOUND');
    const replayedJobIds = (
      getDb()
        .prepare('SELECT id FROM chat_jobs WHERE user_message_id = ? ORDER BY created_at ASC, id ASC')
        .all(existing.id) as Array<{ id: string }>
    ).map((row) => row.id);
    return {
      replayed: true,
      threadId: existing.thread_id,
      messageId: existing.id,
      jobIds: replayedJobIds,
      snapshot,
    };
  }
  const createdAt = nowIso();
  const userId = newId('cmsg');
  const pending = agentIds.map((agentId) => ({
    agentId,
    messageId: newId('cmsg'),
    jobId: newId('cjob'),
  }));
  const events: ReturnType<typeof appendChatEvent>[] = [];
  tx((db) => {
    const current = db.prepare('SELECT id, status FROM chat_threads WHERE id = ?').get(threadId) as
      | { id: string; status: string }
      | undefined;
    if (!current || current.status !== 'active') throw new Error('E_CHAT_THREAD_NOT_FOUND');
    const max = db
      .prepare('SELECT COALESCE(MAX(seq), 0) AS seq FROM chat_messages WHERE thread_id = ?')
      .get(threadId) as { seq: number } | undefined;
    let seq = Number(max?.seq ?? 0);
    seq += 1;
    db.prepare(
      `INSERT INTO chat_messages
       (id, thread_id, seq, role, agent_id, content, status, job_id, error_code, error_message, request_key, request_hash, created_at, updated_at)
       VALUES (?, ?, ?, 'user', NULL, ?, 'complete', NULL, NULL, NULL, ?, ?, ?, ?)`,
    ).run(userId, threadId, seq, content, scopedKey, requestHash, createdAt, createdAt);
    events.push(appendChatEvent(db, threadId, 'chat.message.created', { threadId, messageId: userId, role: 'user', seq }));
    for (const target of pending) {
      seq += 1;
      db.prepare(
        `INSERT INTO chat_messages
         (id, thread_id, seq, role, agent_id, content, status, job_id, error_code, error_message, request_key, created_at, updated_at)
         VALUES (?, ?, ?, 'assistant', ?, '', 'pending', ?, NULL, NULL, NULL, ?, ?)`,
      ).run(target.messageId, threadId, seq, target.agentId, target.jobId, createdAt, createdAt);
      db.prepare(
        `INSERT INTO chat_jobs
         (id, thread_id, message_id, user_message_id, agent_id, kind, status, attempts, max_attempts,
          lease_owner, lease_expires_at, available_at, cancel_requested_at, last_error_code, last_error_message,
          cost_usd, prompt_tokens, completion_tokens, created_at, started_at, finished_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'chat.reply', 'queued', 0, ?, NULL, NULL, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, NULL, NULL, ?)`,
      ).run(
        target.jobId,
        threadId,
        target.messageId,
        userId,
        target.agentId,
        config.chat.maxAttempts,
        createdAt,
        createdAt,
        createdAt,
      );
      events.push(
        appendChatEvent(db, threadId, 'chat.message.created', {
          threadId,
          messageId: target.messageId,
          role: 'assistant',
          seq,
          agentId: target.agentId,
          jobId: target.jobId,
        }),
      );
      events.push(
        appendChatEvent(db, threadId, 'chat.job.queued', {
          threadId,
          jobId: target.jobId,
          messageId: target.messageId,
          agentId: target.agentId,
          status: 'queued',
          attempts: 0,
          maxAttempts: config.chat.maxAttempts,
        }),
      );
    }
    db.prepare(
      `UPDATE chat_threads SET last_message_at = ?, last_message_preview = ?, last_job_id = ?,
         last_job_status = 'queued', updated_at = ? WHERE id = ?`,
    ).run(createdAt, content.slice(0, 160), pending[pending.length - 1]?.jobId ?? null, createdAt, threadId);
    events.push(
      appendChatEvent(db, threadId, 'chat.thread.updated', {
        threadId,
        lastJobStatus: 'queued',
        lastJobId: pending[pending.length - 1]?.jobId ?? null,
      }),
    );
  });
  publishChatEvents(events);
  const snapshot = getChatSnapshot(threadId);
  if (!snapshot) throw new Error('E_CHAT_THREAD_NOT_FOUND');
  return {
    replayed: false,
    threadId,
    messageId: userId,
    jobIds: pending.map((target) => target.jobId),
    snapshot,
  };
}

/**
 * Claim at most one queued job atomically. A lease is a time box; the reaper
 * owns expired leases. Attempts increment at claim time, so a killed worker's
 * attempt is never forgotten.
 */
export function claimNextChatJob(workerId: string, leaseMs: number = config.chat.leaseMs): ChatJobClaim | null {
  const now = Date.now();
  const nowIsoValue = new Date(now).toISOString();
  const leaseUntil = new Date(now + leaseMs).toISOString();
  let claimed: { jobId: string; threadId: string; events: ReturnType<typeof appendChatEvent>[] } | null = null;
  tx((db) => {
    const row = db
      .prepare(
        `SELECT id, thread_id FROM chat_jobs
         WHERE status = 'queued' AND available_at <= ? AND cancel_requested_at IS NULL
         ORDER BY created_at ASC, id ASC LIMIT 1`,
      )
      .get(nowIsoValue) as { id: string; thread_id: string } | undefined;
    if (!row) return;
    const update = db
      .prepare(
        `UPDATE chat_jobs SET status = 'running', attempts = attempts + 1, lease_owner = ?,
          lease_expires_at = ?, started_at = COALESCE(started_at, ?), updated_at = ?
         WHERE id = ? AND status = 'queued'`,
      )
      .run(workerId, leaseUntil, nowIsoValue, nowIsoValue, row.id);
    if (Number(update.changes) !== 1) return;
    db.prepare("UPDATE chat_threads SET last_job_status = 'running', updated_at = ? WHERE id = ?").run(
      nowIsoValue,
      row.thread_id,
    );
    const job = db.prepare('SELECT attempts, max_attempts, message_id, agent_id FROM chat_jobs WHERE id = ?').get(row.id) as {
      attempts: number;
      max_attempts: number;
      message_id: string;
      agent_id: string;
    };
    const events = [
      appendChatEvent(db, row.thread_id, 'chat.job.started', {
        threadId: row.thread_id,
        jobId: row.id,
        messageId: job.message_id,
        agentId: job.agent_id,
        status: 'running',
        attempts: Number(job.attempts),
        maxAttempts: Number(job.max_attempts),
        leaseExpiresAt: leaseUntil,
      }),
    ];
    claimed = { jobId: row.id, threadId: row.thread_id, events };
  });
  const picked = claimed as { jobId: string; threadId: string; events: ReturnType<typeof appendChatEvent>[] } | null;
  if (!picked) return null;
  publishChatEvents(picked.events);
  const job = getChatJob(picked.jobId);
  const thread = getChatThread(picked.threadId);
  return job && thread ? { job, thread } : null;
}

/** Finish a claimed job with a CAS on the worker's lease. */
export function finishChatJob(
  jobId: string,
  workerId: string,
  outcome: ChatJobOutcome,
): { applied: boolean; code?: string; status?: ChatJobStatus } {
  const now = nowIso();
  const events: ReturnType<typeof appendChatEvent>[] = [];
  let result: { applied: boolean; code?: string; status?: ChatJobStatus } = { applied: false };
  tx((db) => {
    const row = db.prepare('SELECT * FROM chat_jobs WHERE id = ?').get(jobId) as Record<string, unknown> | undefined;
    if (!row) {
      result = { applied: false, code: 'E_CHAT_JOB_NOT_FOUND' };
      return;
    }
    if (String(row.status) !== 'running' || String(row.lease_owner ?? '') !== workerId) {
      result = { applied: false, code: 'E_CHAT_JOB_LEASE_LOST' };
      return;
    }
    const threadId = String(row.thread_id);
    const messageId = String(row.message_id);
    const attempts = Number(row.attempts);
    const maxAttempts = Number(row.max_attempts);
    const usage = 'usage' in outcome ? outcome.usage ?? null : null;
    if ('cancelled' in outcome) {
      db.prepare(
        `UPDATE chat_jobs SET status = 'cancelled', lease_owner = NULL, lease_expires_at = NULL,
          last_error_code = 'E_CHAT_JOB_CANCELLED', last_error_message = 'The owner cancelled this chat job.',
          cost_usd = COALESCE(cost_usd, ?), prompt_tokens = COALESCE(prompt_tokens, ?),
          completion_tokens = COALESCE(completion_tokens, ?),
          finished_at = ?, updated_at = ? WHERE id = ?`,
      ).run(
        outcome.usage?.costUsd ?? null,
        outcome.usage?.promptTokens ?? null,
        outcome.usage?.completionTokens ?? null,
        now,
        now,
        jobId,
      );
      db.prepare(
        `UPDATE chat_messages SET status = 'failed', error_code = 'E_CHAT_JOB_CANCELLED',
          error_message = 'The owner cancelled this chat job.', updated_at = ? WHERE id = ?`,
      ).run(now, messageId);
      db.prepare("UPDATE chat_threads SET last_job_status = 'cancelled', updated_at = ? WHERE id = ?").run(now, threadId);
      events.push(
        appendChatEvent(db, threadId, 'chat.job.cancelled', { threadId, jobId, messageId, status: 'cancelled' }),
      );
      events.push(appendChatEvent(db, threadId, 'chat.message.failed', { threadId, messageId, jobId, code: 'E_CHAT_JOB_CANCELLED' }));
      result = { applied: true, status: 'cancelled' };
      return;
    }
    if (outcome.ok) {
      db.prepare(
        `UPDATE chat_jobs SET status = 'succeeded', lease_owner = NULL, lease_expires_at = NULL,
          last_error_code = NULL, last_error_message = NULL, cost_usd = ?, prompt_tokens = ?, completion_tokens = ?,
          finished_at = ?, updated_at = ? WHERE id = ?`,
      ).run(usage?.costUsd ?? null, usage?.promptTokens ?? null, usage?.completionTokens ?? null, now, now, jobId);
      db.prepare(
        `UPDATE chat_messages SET content = ?, status = 'complete', error_code = NULL, error_message = NULL,
          updated_at = ? WHERE id = ?`,
      ).run(outcome.text, now, messageId);
      db.prepare(
        `UPDATE chat_threads SET last_message_at = ?, last_message_preview = ?, last_job_status = 'succeeded',
          updated_at = ? WHERE id = ?`,
      ).run(now, previewContent(outcome.text), now, threadId);
      events.push(
        appendChatEvent(db, threadId, 'chat.message.completed', { threadId, messageId, jobId, status: 'complete' }),
      );
      events.push(appendChatEvent(db, threadId, 'chat.job.succeeded', { threadId, jobId, messageId, status: 'succeeded' }));
      result = { applied: true, status: 'succeeded' };
      return;
    }
    const retry = outcome.retryable && attempts < maxAttempts;
    if (retry) {
      const available = new Date(Date.now() + config.chat.backoffMs).toISOString();
      db.prepare(
        `UPDATE chat_jobs SET status = 'queued', lease_owner = NULL, lease_expires_at = NULL, available_at = ?,
          last_error_code = ?, last_error_message = ?, cost_usd = COALESCE(cost_usd, ?),
          prompt_tokens = COALESCE(prompt_tokens, ?), completion_tokens = COALESCE(completion_tokens, ?),
          updated_at = ? WHERE id = ?`,
      ).run(
        available,
        outcome.code,
        outcome.message.slice(0, 1000),
        usage?.costUsd ?? null,
        usage?.promptTokens ?? null,
        usage?.completionTokens ?? null,
        now,
        jobId,
      );
      db.prepare(
        `UPDATE chat_messages SET status = 'pending', error_code = ?, error_message = ?, updated_at = ? WHERE id = ?`,
      ).run(outcome.code, outcome.message.slice(0, 1000), now, messageId);
      db.prepare("UPDATE chat_threads SET last_job_status = 'queued', updated_at = ? WHERE id = ?").run(now, threadId);
      events.push(
        appendChatEvent(db, threadId, 'chat.job.requeued', {
          threadId,
          jobId,
          messageId,
          status: 'queued',
          attempts,
          maxAttempts,
          code: outcome.code,
          availableAt: available,
        }),
      );
      result = { applied: true, status: 'queued' };
      return;
    }
    const code = attempts >= maxAttempts && outcome.retryable ? 'E_CHAT_JOB_EXHAUSTED' : outcome.code;
    const message =
      attempts >= maxAttempts && outcome.retryable
        ? `${outcome.message} (attempts exhausted after ${attempts} of ${maxAttempts})`
        : outcome.message;
    db.prepare(
      `UPDATE chat_jobs SET status = 'failed', lease_owner = NULL, lease_expires_at = NULL,
        last_error_code = ?, last_error_message = ?, finished_at = ?, updated_at = ?,
        cost_usd = COALESCE(cost_usd, ?), prompt_tokens = COALESCE(prompt_tokens, ?), completion_tokens = COALESCE(completion_tokens, ?)
       WHERE id = ?`,
    ).run(code, message.slice(0, 1000), now, now, usage?.costUsd ?? null, usage?.promptTokens ?? null, usage?.completionTokens ?? null, jobId);
    db.prepare(
      `UPDATE chat_messages SET status = 'failed', error_code = ?, error_message = ?, updated_at = ? WHERE id = ?`,
    ).run(code, message.slice(0, 1000), now, messageId);
    db.prepare("UPDATE chat_threads SET last_job_status = 'failed', updated_at = ? WHERE id = ?").run(now, threadId);
    events.push(
      appendChatEvent(db, threadId, 'chat.job.failed', {
        threadId,
        jobId,
        messageId,
        status: 'failed',
        attempts,
        maxAttempts,
        code,
      }),
    );
    events.push(appendChatEvent(db, threadId, 'chat.message.failed', { threadId, messageId, jobId, code }));
    result = { applied: true, status: 'failed' };
  });
  publishChatEvents(events);
  return result;
}

/** Recover every expired running lease; requeue or terminally exhaust it. */
export function reapExpiredChatJobs(now = new Date()): number {
  const nowValue = now.toISOString();
  const rows = getDb()
    .prepare("SELECT id FROM chat_jobs WHERE status = 'running' AND lease_expires_at IS NOT NULL AND lease_expires_at < ?")
    .all(nowValue) as Array<{ id: string }>;
  let reaped = 0;
  for (const row of rows) {
    const events: ReturnType<typeof appendChatEvent>[] = [];
    let changed = false;
    tx((db) => {
      const job = db.prepare('SELECT * FROM chat_jobs WHERE id = ? AND status = \'running\'').get(row.id) as
        | Record<string, unknown>
        | undefined;
      if (!job) return;
      if (job.cancel_requested_at) {
        const code = 'E_CHAT_JOB_CANCELLED';
        db.prepare(
          `UPDATE chat_jobs SET status = 'cancelled', lease_owner = NULL, lease_expires_at = NULL,
            last_error_code = ?, last_error_message = 'The owner cancelled this chat job.', finished_at = ?, updated_at = ?
           WHERE id = ?`,
        ).run(code, nowValue, nowValue, row.id);
        db.prepare(
          `UPDATE chat_messages SET status = 'failed', error_code = ?, error_message = ?, updated_at = ? WHERE id = ?`,
        ).run(code, 'The owner cancelled this chat job.', nowValue, String(job.message_id));
        db.prepare("UPDATE chat_threads SET last_job_status = 'cancelled', updated_at = ? WHERE id = ?").run(
          nowValue,
          String(job.thread_id),
        );
        events.push(
          appendChatEvent(db, String(job.thread_id), 'chat.job.cancelled', {
            threadId: String(job.thread_id),
            jobId: row.id,
            messageId: String(job.message_id),
            status: 'cancelled',
            recoveredFromExpiredLease: true,
          }),
        );
        events.push(
          appendChatEvent(db, String(job.thread_id), 'chat.message.failed', {
            threadId: String(job.thread_id),
            messageId: String(job.message_id),
            jobId: row.id,
            code,
          }),
        );
        changed = true;
        return;
      }
      if (Number(job.attempts) >= Number(job.max_attempts)) {
        const code = 'E_CHAT_JOB_EXHAUSTED';
        db.prepare(
          `UPDATE chat_jobs SET status = 'failed', lease_owner = NULL, lease_expires_at = NULL,
            last_error_code = ?, last_error_message = ?, finished_at = ?, updated_at = ? WHERE id = ?`,
        ).run(code, 'The worker lease expired before the job finished; attempts are exhausted.', nowValue, nowValue, row.id);
        db.prepare(
          `UPDATE chat_messages SET status = 'failed', error_code = ?, error_message = ?, updated_at = ? WHERE id = ?`,
        ).run(code, 'The worker lease expired before the job finished; attempts are exhausted.', nowValue, String(job.message_id));
        events.push(
          appendChatEvent(db, String(job.thread_id), 'chat.job.failed', {
            threadId: String(job.thread_id),
            jobId: row.id,
            messageId: String(job.message_id),
            status: 'failed',
            code,
            recoveredFromExpiredLease: true,
          }),
        );
        events.push(
          appendChatEvent(db, String(job.thread_id), 'chat.message.failed', {
            threadId: String(job.thread_id),
            messageId: String(job.message_id),
            jobId: row.id,
            code,
          }),
        );
      } else {
        const availableAt = new Date(now.getTime() + config.chat.backoffMs).toISOString();
        db.prepare(
          `UPDATE chat_jobs SET status = 'queued', lease_owner = NULL, lease_expires_at = NULL,
            available_at = ?, updated_at = ? WHERE id = ?`,
        ).run(availableAt, nowValue, row.id);
        db.prepare("UPDATE chat_threads SET last_job_status = 'queued', updated_at = ? WHERE id = ?").run(
          nowValue,
          String(job.thread_id),
        );
        events.push(
          appendChatEvent(db, String(job.thread_id), 'chat.job.requeued', {
            threadId: String(job.thread_id),
            jobId: row.id,
            messageId: String(job.message_id),
            status: 'queued',
            attempts: Number(job.attempts),
            maxAttempts: Number(job.max_attempts),
            recoveredFromExpiredLease: true,
            availableAt,
          }),
        );
      }
      changed = true;
    });
    if (changed) reaped += 1;
    publishChatEvents(events);
  }
  return reaped;
}

/**
 * Owner cancellation. A queued job is terminal immediately. A running job gets
 * a cancellation request and its worker (if in this process) aborts; a stale
 * lease will be reaped by the same path.
 */
export function requestCancelChatJob(jobId: string): {
  cancelled: boolean;
  status: ChatJobStatus | 'cancellation_requested';
} {
  const now = nowIso();
  const events: ReturnType<typeof appendChatEvent>[] = [];
  let result: { cancelled: boolean; status: ChatJobStatus | 'cancellation_requested' } | null = null;
  tx((db) => {
    const row = db.prepare('SELECT * FROM chat_jobs WHERE id = ?').get(jobId) as Record<string, unknown> | undefined;
    if (!row) throw new Error('E_CHAT_JOB_NOT_FOUND');
    const status = String(row.status);
    if (status === 'queued') {
      db.prepare(
        `UPDATE chat_jobs SET status = 'cancelled', cancel_requested_at = ?, finished_at = ?, updated_at = ? WHERE id = ?`,
      ).run(now, now, now, jobId);
      db.prepare(
        `UPDATE chat_messages SET status = 'failed', error_code = 'E_CHAT_JOB_CANCELLED',
          error_message = 'The owner cancelled this chat job.', updated_at = ? WHERE id = ?`,
      ).run(now, String(row.message_id));
      db.prepare("UPDATE chat_threads SET last_job_status = 'cancelled', updated_at = ? WHERE id = ?").run(
        now,
        String(row.thread_id),
      );
      events.push(
        appendChatEvent(db, String(row.thread_id), 'chat.job.cancelled', {
          threadId: String(row.thread_id),
          jobId,
          messageId: String(row.message_id),
          status: 'cancelled',
        }),
      );
      events.push(
        appendChatEvent(db, String(row.thread_id), 'chat.message.failed', {
          threadId: String(row.thread_id),
          messageId: String(row.message_id),
          jobId,
          code: 'E_CHAT_JOB_CANCELLED',
        }),
      );
      result = { cancelled: true, status: 'cancelled' };
      return;
    }
    if (status === 'running') {
      db.prepare('UPDATE chat_jobs SET cancel_requested_at = ?, updated_at = ? WHERE id = ?').run(now, now, jobId);
      result = { cancelled: false, status: 'cancellation_requested' };
      return;
    }
    result = { cancelled: false, status: status as ChatJobStatus };
  });
  publishChatEvents(events);
  if (!result) throw new Error('E_CHAT_JOB_NOT_FOUND');
  return result;
}

/** Messages visible to a job: complete prior context plus the current user turn. */
export function chatHistoryForJob(threadId: string, userMessageId: string): Array<{ role: ChatRole; content: string }> {
  const rows = getDb()
    .prepare(
      `SELECT id, role, content, status FROM chat_messages
       WHERE thread_id = ? AND seq <= (SELECT seq FROM chat_messages WHERE id = ?)
       ORDER BY seq ASC`,
    )
    .all(threadId, userMessageId) as Array<{ id: string; role: string; content: string; status: string }>;
  const currentIndex = rows.findIndex((row) => row.id === userMessageId);
  if (currentIndex < 0) return [];
  const current = rows[currentIndex];
  if (current.content.length === 0) return [];
  const kept: Array<{ role: ChatRole; content: string }> = [{ role: current.role as ChatRole, content: current.content }];
  let chars = current.content.length;
  // Keep the most recent complete context, not the oldest. The previous
  // implementation walked oldest-first and could omit the current user turn
  // once the thread exceeded maxHistoryChars.
  const prior: Array<{ role: ChatRole; content: string }> = [];
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (row.content.length === 0) continue;
    if (row.role === 'assistant' && row.status !== 'complete') continue;
    if (chars + row.content.length > config.chat.maxHistoryChars) break;
    prior.unshift({ role: row.role as ChatRole, content: row.content });
    chars += row.content.length;
  }
  return [...prior, ...kept];
}

export function chatUserMessageForJob(jobId: string): { id: string; content: string } | null {
  const row = getDb()
    .prepare(
      `SELECT m.id, m.content FROM chat_jobs j JOIN chat_messages m ON m.id = j.user_message_id WHERE j.id = ?`,
    )
    .get(jobId) as { id: string; content: string } | undefined;
  return row ? { id: row.id, content: row.content } : null;
}
