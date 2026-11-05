import os from 'node:os';
import { config } from '../config.js';
import { getChatJob, claimNextChatJob, finishChatJob, reapExpiredChatJobs, requestCancelChatJob } from './store.js';
import { generateChatReply, chatFailure, type ChatUsage } from './generate.js';
import type { ChatJobStatus } from '../../shared/chat.js';

export type ChatGenerator = typeof generateChatReply;

export type ProcessChatResult =
  | { processed: false }
  | { processed: true; jobId: string; status: ChatJobStatus | 'cancellation_requested' | 'lease_lost' };

const activeControllers = new Map<string, AbortController>();
let workerId = `${os.hostname()}:${process.pid}`;

function logWorker(level: 'info' | 'warn' | 'error', message: string, fields: Record<string, unknown> = {}): void {
  // Never log message content, prompts, or provider bodies.
  const safe: Record<string, unknown> = {};
  for (const key of ['jobId', 'threadId', 'status', 'code', 'attempts']) {
    if (fields[key] !== undefined) safe[key] = fields[key];
  }
  console.log(JSON.stringify({ at: new Date().toISOString(), level, message, ...safe }));
}

export function setChatWorkerId(id: string): void {
  workerId = id;
}

export function cancelChatJob(jobId: string): { cancelled: boolean; status: ChatJobStatus | 'cancellation_requested' } {
  const controller = activeControllers.get(jobId);
  const result = requestCancelChatJob(jobId);
  if (controller && !controller.signal.aborted) controller.abort();
  return result;
}

/**
 * Claim and process at most one job. The generator is injectable so the worker's
 * lease/retry/cancel state machine can be tested without a provider call; the
 * production path always uses the real generator defined in generate.ts.
 */
export async function processNextChatJob(
  options: {
    generator?: ChatGenerator;
    leaseMs?: number;
    controllerTimeoutMs?: number;
  } = {},
): Promise<ProcessChatResult> {
  const leaseMs = options.leaseMs ?? config.chat.leaseMs;
  const generator = options.generator ?? generateChatReply;
  const claimed = claimNextChatJob(workerId, leaseMs);
  if (!claimed) return { processed: false };
  const { job, thread } = claimed;
  const controller = new AbortController();
  activeControllers.set(job.id, controller);
  const timeoutMs = Math.max(500, Math.min(options.controllerTimeoutMs ?? leaseMs - 5_000, leaseMs - 1_000));
  const timer = setTimeout(() => {
    controller.abort(new Error('E_CHAT_JOB_TIMEOUT'));
  }, timeoutMs);
  timer.unref?.();
  let usage: ChatUsage | null = null;
  try {
    if (job.cancelRequestedAt) {
      finishChatJob(job.id, workerId, { cancelled: true, usage });
      return { processed: true, jobId: job.id, status: 'cancelled' };
    }
    const generated = await generator({
      jobId: job.id,
      threadId: job.threadId,
      userMessageId: job.userMessageId,
      agentId: job.agentId,
      model: thread.model as 'deepseek-flash' | 'deepseek-v4-pro',
      thinking: thread.thinking as 'enabled' | 'disabled',
      effort: thread.effort as 'low' | 'high' | 'max' | null,
      signal: controller.signal,
      onUsage: (next) => {
        usage = next;
      },
    });
    usage = generated.usage ?? usage;
    if (controller.signal.aborted) {
      throw controller.signal.reason instanceof Error
        ? controller.signal.reason
        : new Error('E_CHAT_JOB_TIMEOUT');
    }
    const afterGeneration = getChatJob(job.id);
    if (afterGeneration?.cancelRequestedAt) {
      const cancelled = finishChatJob(job.id, workerId, { cancelled: true, usage });
      return { processed: true, jobId: job.id, status: cancelled.applied ? 'cancelled' : 'lease_lost' };
    }
    const finished = finishChatJob(job.id, workerId, { ok: true, text: generated.text, usage });
    if (!finished.applied) {
      logWorker('warn', 'chat job completion lost its lease', { jobId: job.id, code: finished.code ?? null });
      return { processed: true, jobId: job.id, status: 'lease_lost' };
    }
    logWorker('info', 'chat job succeeded', { jobId: job.id, threadId: job.threadId, status: 'succeeded' });
    return { processed: true, jobId: job.id, status: 'succeeded' };
  } catch (error) {
    if (controller.signal.aborted) {
      const current = getChatJob(job.id);
      if (current?.cancelRequestedAt) {
        const cancelled = finishChatJob(job.id, workerId, { cancelled: true, usage });
        return { processed: true, jobId: job.id, status: cancelled.applied ? 'cancelled' : 'lease_lost' };
      }
      const failure = chatFailure(
        controller.signal.reason instanceof Error ? controller.signal.reason : new Error('E_CHAT_JOB_TIMEOUT'),
      );
      const finished = finishChatJob(job.id, workerId, {
        ok: false,
        code: 'E_CHAT_JOB_TIMEOUT',
        message: failure.message || 'The chat job exceeded its lease-safe execution window.',
        retryable: true,
        usage,
      });
      return { processed: true, jobId: job.id, status: finished.status ?? 'lease_lost' };
    }
    const failure = chatFailure(error);
    const finished = finishChatJob(job.id, workerId, {
      ok: false,
      code: failure.code,
      message: failure.message,
      retryable: failure.retryable,
      usage: usage ?? failure.usage,
    });
    logWorker('warn', 'chat job failed an attempt', {
      jobId: job.id,
      threadId: job.threadId,
      status: finished.status ?? 'lease_lost',
      code: failure.code,
      attempts: job.attempts,
    });
    return { processed: true, jobId: job.id, status: finished.status ?? 'lease_lost' };
  } finally {
    clearTimeout(timer);
    activeControllers.delete(job.id);
  }
}

export type ChatWorkerHandle = { stop: () => void; isRunning: boolean };

/** Start the one in-process worker. Startup reaps expired leases first. */
export function startChatWorker(options: { pollMs?: number } = {}): ChatWorkerHandle {
  const pollMs = Math.max(100, options.pollMs ?? config.chat.pollMs);
  let running = true;
  let busy = false;
  const run = async (): Promise<void> => {
    if (!running || busy) return;
    busy = true;
    try {
      reapExpiredChatJobs();
      await processNextChatJob();
    } catch (error) {
      logWorker('error', 'chat worker tick failed', {
        code: error instanceof Error ? error.message.slice(0, 80) : 'E_CHAT_WORKER_TICK',
      });
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(() => void run(), pollMs);
  timer.unref?.();
  void run();
  return {
    stop: () => {
      running = false;
      clearInterval(timer);
      for (const controller of activeControllers.values()) controller.abort();
      activeControllers.clear();
    },
    get isRunning() {
      return running;
    },
  };
}
