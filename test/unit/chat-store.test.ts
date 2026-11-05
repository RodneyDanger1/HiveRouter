import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initDb } from '../../src/server/db/database.js';
import {
  claimNextChatJob,
  chatHistoryForJob,
  createChatThread,
  finishChatJob,
  getChatJob,
  getChatSnapshot,
  getChatThread,
  listChatThreads,
  reapExpiredChatJobs,
  requestCancelChatJob,
  sendChatMessage,
} from '../../src/server/chat/store.js';

beforeEach(() => {
  initDb(':memory:', 'B2');
});

afterEach(() => closeDb());

function thread(agentId = 'router'): string {
  return createChatThread({ agentId, title: 'Store probe' }).id;
}

describe('durable chat store', () => {
  it('atomically creates a user message, one pending assistant message per agent, and one queued job per agent', () => {
    const threadId = thread();
    const result = sendChatMessage(
      threadId,
      { content: 'Compare the two designs', agentIds: ['router', 'architect'] },
      'store-idempotency-key-0001',
    );
    expect(result.replayed).toBe(false);
    expect(result.jobIds).toHaveLength(2);
    const snapshot = getChatSnapshot(threadId);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.messages).toHaveLength(3);
    expect(snapshot?.messages.map((message) => message.role)).toEqual(['user', 'assistant', 'assistant']);
    expect(snapshot?.messages.filter((message) => message.status === 'pending')).toHaveLength(2);
    expect(snapshot?.jobs).toHaveLength(2);
    expect(snapshot?.jobs.every((job) => job.status === 'queued')).toBe(true);
    expect(snapshot?.thread.lastMessagePreview).toBe('Compare the two designs');
    expect(snapshot?.thread.pendingJobCount).toBe(2);
    expect(snapshot?.thread.queuedJobCount).toBe(2);
    expect(snapshot?.lastEventSeq).toBeGreaterThan(0);
    // Residual projection fields are present even before a worker claims the job.
    expect(snapshot?.messages[1]?.jobStatus).toBe('queued');
    expect(snapshot?.messages[1]?.jobAttempts).toBe(0);
    expect(snapshot?.messages[1]?.jobMaxAttempts).toBe(3);
    expect(snapshot?.messages[1]?.jobAvailableAt).toBeTruthy();
  });

  it('keeps the current user turn and the newest context when history exceeds the budget', () => {
    const threadId = thread();
    const turn = (label: string): string =>
      sendChatMessage(threadId, { content: `${label}:${'x'.repeat(6_900)}`, agentIds: ['router'] }, `history-key-${label}`).messageId;
    turn('oldest');
    turn('middle');
    turn('newer');
    const currentId = turn('current');
    const history = chatHistoryForJob(threadId, currentId);
    expect(history.at(-1)?.content).toContain('current:');
    expect(history.some((message) => message.content.includes('oldest:'))).toBe(false);
    expect(history.some((message) => message.content.includes('current:'))).toBe(true);
    expect(history.reduce((total, message) => total + message.content.length, 0)).toBeLessThanOrEqual(24_000);
  });

  it('replays the same idempotency key once without duplicating messages or jobs', () => {
    const threadId = thread();
    const first = sendChatMessage(threadId, { content: 'One question', agentIds: ['router'] }, 'store-idempotency-key-0002');
    const second = sendChatMessage(threadId, { content: 'One question', agentIds: ['router'] }, 'store-idempotency-key-0002');
    expect(second.replayed).toBe(true);
    expect(second.snapshot.messages).toHaveLength(first.snapshot.messages.length);
    expect(second.snapshot.jobs).toHaveLength(1);
    expect(getChatSnapshot(threadId)?.messages).toHaveLength(2);
  });

  it('replays only the original message job ids after newer messages exist', () => {
    const threadId = thread();
    const first = sendChatMessage(threadId, { content: 'First question', agentIds: ['router'] }, 'store-idempotency-key-scope-jobs');
    const second = sendChatMessage(threadId, { content: 'Second question', agentIds: ['architect'] }, 'store-idempotency-key-scope-jobs-2');
    const replay = sendChatMessage(threadId, { content: 'First question', agentIds: ['router'] }, 'store-idempotency-key-scope-jobs');
    expect(replay.replayed).toBe(true);
    expect(replay.jobIds).toEqual(first.jobIds);
    expect(replay.jobIds).not.toContain(second.jobIds[0]);
    expect(replay.snapshot.jobs).toHaveLength(2);
  });

  it('scopes an idempotency key to its thread instead of replaying another thread', () => {
    const firstThread = thread();
    const secondThread = thread();
    const first = sendChatMessage(firstThread, { content: 'Thread one', agentIds: ['router'] }, 'store-idempotency-key-scope');
    const second = sendChatMessage(secondThread, { content: 'Thread two', agentIds: ['router'] }, 'store-idempotency-key-scope');
    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(false);
    expect(second.threadId).toBe(secondThread);
    expect(getChatSnapshot(firstThread)?.messages).toHaveLength(2);
    expect(getChatSnapshot(secondThread)?.messages).toHaveLength(2);
  });

  it('refuses a reused key with a different body or agent set', () => {
    const threadId = thread();
    sendChatMessage(threadId, { content: 'Original body', agentIds: ['router'] }, 'store-idempotency-key-body');
    expect(() => sendChatMessage(threadId, { content: 'Different body', agentIds: ['router'] }, 'store-idempotency-key-body')).toThrow('E_IDEMPOTENCY_KEY_REUSED');
    expect(() => sendChatMessage(threadId, { content: 'Original body', agentIds: ['architect'] }, 'store-idempotency-key-body')).toThrow('E_IDEMPOTENCY_KEY_REUSED');
  });

  it('claims exactly one job and refuses a stale worker completion', () => {
    const threadId = thread();
    sendChatMessage(threadId, { content: 'A job', agentIds: ['router'] }, 'store-idempotency-key-0003');
    const claimed = claimNextChatJob('worker-a', 30_000);
    expect(claimed?.job.status).toBe('running');
    expect(claimed?.job.attempts).toBe(1);
    expect(claimed?.job.leaseOwner).toBe('worker-a');
    expect(claimNextChatJob('worker-b', 30_000)).toBeNull();

    const stale = finishChatJob(claimed!.job.id, 'worker-b', {
      ok: true,
      text: 'stale answer',
      usage: { costUsd: 0.001, promptTokens: 10, completionTokens: 2 },
    });
    expect(stale).toEqual({ applied: false, code: 'E_CHAT_JOB_LEASE_LOST' });
    expect(getChatJob(claimed!.job.id)?.status).toBe('running');
  });

  it('completes a job with measured usage and projects the answer and cost', () => {
    const threadId = thread();
    sendChatMessage(threadId, { content: 'A real question', agentIds: ['router'] }, 'store-idempotency-key-0004');
    const claimed = claimNextChatJob('worker-a', 30_000)!;
    const done = finishChatJob(claimed.job.id, 'worker-a', {
      ok: true,
      text: 'A durable answer',
      usage: { costUsd: 0.000123, promptTokens: 40, completionTokens: 5 },
    });
    expect(done.applied).toBe(true);
    expect(done.status).toBe('succeeded');
    const snapshot = getChatSnapshot(threadId)!;
    expect(snapshot.jobs[0]?.status).toBe('succeeded');
    expect(snapshot.jobs[0]?.costUsd).toBe(0.000123);
    expect(snapshot.messages.find((message) => message.role === 'assistant')?.content).toBe('A durable answer');
    expect(snapshot.messages.find((message) => message.role === 'assistant')?.status).toBe('complete');
    expect(snapshot.thread.lastMessagePreview).toBe('A durable answer');
    expect(snapshot.thread.succeededJobCount).toBe(1);
    expect(listChatThreads().threads[0]?.lastJobStatus).toBe('succeeded');
  });

  it('cancels a queued job and marks its assistant message failed by name', () => {
    const threadId = thread();
    const sent = sendChatMessage(threadId, { content: 'Cancel me', agentIds: ['router'] }, 'store-idempotency-key-0005');
    const cancelled = requestCancelChatJob(sent.jobIds[0]!);
    expect(cancelled).toEqual({ cancelled: true, status: 'cancelled' });
    const snapshot = getChatSnapshot(threadId)!;
    expect(snapshot.jobs[0]?.status).toBe('cancelled');
    expect(snapshot.messages.find((message) => message.role === 'assistant')?.status).toBe('failed');
    expect(snapshot.messages.find((message) => message.role === 'assistant')?.errorCode).toBe('E_CHAT_JOB_CANCELLED');
    expect(claimNextChatJob('worker-a')).toBeNull();
  });

  it('reaps an expired lease back to queued and preserves the attempt count', () => {
    const threadId = thread();
    sendChatMessage(threadId, { content: 'Reap me', agentIds: ['router'] }, 'store-idempotency-key-0006');
    const claimed = claimNextChatJob('worker-a', 30_000)!;
    getDb()
      .prepare('UPDATE chat_jobs SET lease_expires_at = ? WHERE id = ?')
      .run(new Date(Date.now() - 1_000).toISOString(), claimed.job.id);
    expect(reapExpiredChatJobs()).toBe(1);
    const job = getChatJob(claimed.job.id)!;
    expect(job.status).toBe('queued');
    expect(job.attempts).toBe(1);
    expect(job.leaseOwner).toBeNull();
    expect(job.leaseExpiresAt).toBeNull();
    expect(getChatThread(threadId)?.lastJobStatus).toBe('queued');
  });

  it('reaps a cancellation-requested expired lease as cancelled, not as a retry', () => {
    const threadId = thread();
    sendChatMessage(threadId, { content: 'Cancel stale', agentIds: ['router'] }, 'store-idempotency-key-0008');
    const claimed = claimNextChatJob('worker-a', 30_000)!;
    getDb()
      .prepare('UPDATE chat_jobs SET cancel_requested_at = ?, lease_expires_at = ? WHERE id = ?')
      .run(new Date().toISOString(), new Date(Date.now() - 1_000).toISOString(), claimed.job.id);
    expect(reapExpiredChatJobs()).toBe(1);
    const job = getChatJob(claimed.job.id)!;
    expect(job.status).toBe('cancelled');
    expect(job.lastErrorCode).toBe('E_CHAT_JOB_CANCELLED');
    expect(getChatSnapshot(threadId)?.messages.find((message) => message.role === 'assistant')?.errorCode).toBe(
      'E_CHAT_JOB_CANCELLED',
    );
  });
  it('reaps an attempts-exhausted expired lease terminally with E_CHAT_JOB_EXHAUSTED', () => {
    const threadId = thread();
    const sent = sendChatMessage(threadId, { content: 'Exhaust me', agentIds: ['router'] }, 'store-idempotency-key-0007');
    const claimed = claimNextChatJob('worker-a', 30_000)!;
    getDb()
      .prepare('UPDATE chat_jobs SET attempts = max_attempts, lease_expires_at = ? WHERE id = ?')
      .run(new Date(Date.now() - 1_000).toISOString(), claimed.job.id);
    expect(reapExpiredChatJobs()).toBe(1);
    const job = getChatJob(claimed.job.id)!;
    expect(job.status).toBe('failed');
    expect(job.lastErrorCode).toBe('E_CHAT_JOB_EXHAUSTED');
    expect(job.finishedAt).toBeTruthy();
    const snapshot = getChatSnapshot(threadId)!;
    expect(snapshot.messages.find((message) => message.role === 'assistant')?.status).toBe('failed');
    expect(snapshot.messages.find((message) => message.role === 'assistant')?.errorCode).toBe('E_CHAT_JOB_EXHAUSTED');
    expect(sent.jobIds).toHaveLength(1);
  });
});
