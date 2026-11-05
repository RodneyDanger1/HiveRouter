import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDb, getDb, initDb } from '../../src/server/db/database.js';
import { createChatThread, getChatJob, getChatSnapshot, sendChatMessage } from '../../src/server/chat/store.js';
import { cancelChatJob, processNextChatJob } from '../../src/server/chat/worker.js';
import { LlmError } from '../../src/server/llm/client.js';

beforeEach(() => {
  initDb(':memory:', 'B2');
});

afterEach(() => closeDb());

function queuedJob(content = 'Worker probe'): string {
  const thread = createChatThread({ agentId: 'router', title: 'Worker probe' });
  const sent = sendChatMessage(thread.id, { content, agentIds: ['router'] }, `worker-key-${content}-0001`);
  return sent.jobIds[0]!;
}

describe('chat job worker', () => {
  it('claims and completes one job with a measured answer', async () => {
    const jobId = queuedJob('answer me');
    const result = await processNextChatJob({
      generator: async () => ({
        text: 'The durable answer.',
        usage: { costUsd: 0.00042, promptTokens: 12, completionTokens: 4 },
      }),
    });
    expect(result).toEqual({ processed: true, jobId, status: 'succeeded' });
    const snapshot = getChatSnapshot(getChatJob(jobId)!.threadId)!;
    expect(snapshot.jobs[0]?.status).toBe('succeeded');
    expect(snapshot.messages.find((message) => message.role === 'assistant')?.content).toBe('The durable answer.');
    expect(snapshot.messages.find((message) => message.role === 'assistant')?.status).toBe('complete');
    expect(snapshot.jobs[0]?.costUsd).toBe(0.00042);
  });

  it('requeues a retryable failure, then exhausts at maxAttempts with an honest code', async () => {
    const jobId = queuedJob('will fail twice');
    const failure = new LlmError('E_LLM_NETWORK', 'The provider network failed.', null, true);
    const first = await processNextChatJob({ generator: async () => { throw failure; } });
    expect(first).toEqual({ processed: true, jobId, status: 'queued' });
    // The retry backoff is five seconds in production; make it immediately due
    // in this deterministic probe instead of sleeping.
    getDb().prepare('UPDATE chat_jobs SET available_at = ? WHERE id = ?').run(new Date(0).toISOString(), jobId);
    const second = await processNextChatJob({ generator: async () => { throw failure; } });
    expect(second).toEqual({ processed: true, jobId, status: 'queued' });
    getDb().prepare('UPDATE chat_jobs SET available_at = ? WHERE id = ?').run(new Date(0).toISOString(), jobId);
    const third = await processNextChatJob({ generator: async () => { throw failure; } });
    expect(third).toEqual({ processed: true, jobId, status: 'failed' });
    const snapshot = getChatSnapshot(getChatJob(jobId)!.threadId)!;
    expect(snapshot.jobs[0]?.status).toBe('failed');
    expect(snapshot.jobs[0]?.lastErrorCode).toBe('E_CHAT_JOB_EXHAUSTED');
    expect(snapshot.messages.find((message) => message.role === 'assistant')?.errorCode).toBe('E_CHAT_JOB_EXHAUSTED');
  });

  it('fails a deterministic provider error on the first attempt without a false retry', async () => {
    const jobId = queuedJob('deterministic');
    const result = await processNextChatJob({
      generator: async () => {
        throw new LlmError('E_LLM_BAD_REQUEST', 'The request was rejected.', 400, false);
      },
    });
    expect(result).toEqual({ processed: true, jobId, status: 'failed' });
    expect(getChatJob(jobId)?.lastErrorCode).toBe('E_LLM_BAD_REQUEST');
    expect(getChatJob(jobId)?.attempts).toBe(1);
  });

  it('cancels a running job through the worker controller and marks the message failed', async () => {
    const jobId = queuedJob('cancel while running');
    const result = await processNextChatJob({
      generator: async () => {
        cancelChatJob(jobId);
        throw new Error('The handler observed cancellation.');
      },
    });
    expect(result).toEqual({ processed: true, jobId, status: 'cancelled' });
    const snapshot = getChatSnapshot(getChatJob(jobId)!.threadId)!;
    expect(snapshot.jobs[0]?.status).toBe('cancelled');
    expect(snapshot.messages.find((message) => message.role === 'assistant')?.errorCode).toBe('E_CHAT_JOB_CANCELLED');
  });

  it('returns processed:false when the durable queue is empty', async () => {
    await expect(processNextChatJob({ generator: async () => ({ text: 'unused', usage: { costUsd: 0, promptTokens: 0, completionTokens: 0 } }) })).resolves.toEqual({ processed: false });
  });
});
